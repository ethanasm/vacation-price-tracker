"""Cost / abuse ceilings, backed by the mcp-budget-governor library.

This module's design was extracted into the standalone `mcp-budget-governor`
package and is now adopted back: the Lua, the key scheme, the day-bucketed
self-expiry, and the gated/ungated split live in the library, and this module is
the vpt-shaped adapter over it. The public functions, their signatures, their
fail-open behaviour, and the Axiom events the observability catalog documents
(`quota.daily_exceeded` is the middleware's; `budget.breaker_tripped` and
`quota.release_failed` are emitted here) are all unchanged — callers and
dashboards should not notice the swap.

Two deliberate adapter choices, so nobody re-derives them later:

- **Per-call policies.** vpt's callers pass caps as arguments (they come from
  `Settings`, but tests pass arbitrary values), while a library `Policy` is
  frozen. Building a one-limit policy per call keeps the public contract exact;
  a `Policy` is two small frozen dataclasses, so this costs allocations, not
  round trips.
- **`local_fallback=False`.** The library can degrade a fail-open limit to
  per-replica enforcement when Redis is down; production vpt has always failed
  fully open, and this adoption must not silently change prod behaviour. Turning
  the fallback on is its own future decision, not a side effect of this swap.

**Operational note:** counter keys move from `daily_quota:*` / `global_budget:*`
to the library's `mcpbg:*` scheme, so the deploy that ships this resets the
day's counters once (in the permissive direction — everyone starts the day
fresh). The old keys expire on their own at UTC midnight.

Backend failure events: the library logs `governor.backend_unavailable` (WARNING,
with the limit name) where this module used to log `quota.check_failed` /
`budget.incr_failed` / `budget.read_failed`; those records still carry an
`event` field and ship to Axiom.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from mcp_budget_governor import (
    Context,
    Governor,
    Limit,
    Policy,
    RedisBackend,
    Scope,
    Unit,
    Window,
)
from mcp_budget_governor import keys as governor_keys

from app.core.cache_keys import CacheTTL
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

#: One backend for the whole app, sharing the app's Redis pool. It does not own
#: the client — closing vpt's Redis is the app lifespan's job, not this module's.
_backend = RedisBackend(redis_client)


def _now(now: datetime | None) -> datetime:
    return now or datetime.now(UTC)


def _day_bucket(now: datetime) -> str:
    """UTC calendar-day bucket, e.g. '20260623'. Kept for callers and tests."""
    return now.astimezone(UTC).strftime("%Y%m%d")


def _seconds_to_utc_midnight(now: datetime | None = None) -> int:
    """Seconds from `now` until the next 00:00 UTC.

    Still exported for the middleware's 503 `Retry-After`. Floored at
    `CacheTTL.DAILY_QUOTA_MIN_TTL`, matching the library's own TTL floor.
    """
    current = _now(now).astimezone(UTC)
    next_midnight = (current + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return max(CacheTTL.DAILY_QUOTA_MIN_TTL, int((next_midnight - current).total_seconds()))


def _daily_limit(resource: str, cap: int) -> Limit:
    """A per-user, per-UTC-day gated limit for one resource ('api', 'chat')."""
    return Limit(f"daily_{resource}", cap=cap, window=Window.DAY, scope=Scope.USER)


def _budget_limit(metric: str, cap: int) -> Limit:
    """The global daily budget for one metric ('groq_tokens', ...). Ungated —
    spend already incurred is always recorded — and a breaker by role."""
    return Limit(
        metric, cap=cap, window=Window.DAY, unit=Unit.TOKENS, breaker=True, gated=False
    )


def _governor(limit: Limit, now: datetime | None) -> Governor:
    moment = _now(now)
    return Governor(
        Policy.of(limit),
        _backend,
        local_fallback=False,  # prod parity: fail fully open, as vpt always has
        clock=lambda: moment,
    )


async def check_and_incr_daily_quota(
    identifier: str,
    resource: str,
    limit: int,
    *,
    now: datetime | None = None,
) -> tuple[bool, int, int]:
    """Atomically check + increment a per-day counter for (identifier, resource).

    Returns ``(allowed, remaining, retry_after_seconds)``. When over limit,
    ``(False, 0, seconds_to_midnight)``. Fails open as ``(True, limit, 0)`` when
    Redis is unavailable (the library logs the outage).
    """
    daily = _daily_limit(resource, limit)
    decision = await _governor(daily, now).check(Context(user=identifier))
    if decision.allowed:
        # The library omits a limit it could not evaluate (fail-open); report
        # the full cap as remaining then, exactly as the old code did.
        return True, decision.remaining.get(daily.name, limit), 0
    return False, 0, decision.retry_after


async def release_daily_quota(
    identifier: str,
    resource: str,
    *,
    amount: int = 1,
    now: datetime | None = None,
) -> None:
    """Give back a daily-quota unit taken by a request that was then rejected.

    Ceilings are charged in order, so a request refused by a *later* ceiling has
    already incremented every *earlier* one; without the refund, a user parked at
    their chat cap drains the overall API quota on rejected retries. The
    library's release refuses to resurrect an expired day bucket and never
    extends a key's life.

    Best-effort by design: this runs on a path whose job is to reject, the
    caller already has its answer, and one over-counted counter beats turning a
    429 into a 500.
    """
    moment = _now(now)
    daily = _daily_limit(resource, cap=0)  # the cap is irrelevant to a release
    key = governor_keys.counter_key(daily, {Scope.USER: identifier}, moment)
    try:
        await _backend.release(key, amount)
    except Exception as exc:
        logger.warning(
            "Daily quota refund failed: %s",
            exc,
            exc_info=exc,
            extra={"event": "quota.release_failed", "resource": resource},
        )


async def incr_and_check_global_budget(
    metric: str,
    amount: int,
    limit: int,
    *,
    now: datetime | None = None,
) -> tuple[bool, int]:
    """Atomically add ``amount`` to the global per-UTC-day counter for ``metric``.

    Returns ``(within_budget, total_after_increment)``. Fails open as
    ``(True, 0)`` when Redis is unavailable. Logs ``budget.breaker_tripped`` on
    the increment that trips the breaker — exactly once per window — so the
    operator has a signal in stdout and Axiom.
    """
    budget = _budget_limit(metric, limit)
    result = await _governor(budget, now).meter(metric, amount)
    if result.crossed:
        logger.warning(
            "Global budget breaker tripped: metric=%s total=%s limit=%s",
            metric,
            result.total,
            limit,
            extra={
                "event": "budget.breaker_tripped",
                "metric": metric,
                "total": result.total,
                "limit": limit,
            },
        )
    return result.within, result.total


async def is_global_budget_tripped(
    metric: str,
    limit: int,
    *,
    now: datetime | None = None,
) -> bool:
    """Read-only check (no increment) of whether the breaker is tripped.

    Used by edge gatekeepers (chat middleware, manual-refresh trigger) to reject
    new expensive work cheaply. Fails open as ``False`` (not tripped) when Redis
    is unavailable — a store that cannot answer is not evidence of a breach.
    """
    budget = _budget_limit(metric, limit)
    return await _governor(budget, now).is_tripped(metric)
