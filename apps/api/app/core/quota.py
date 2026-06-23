"""Cost / abuse ceilings: per-user daily quotas + a global daily budget guard.

These are Redis-backed defenses layered on top of the per-minute rate limiter
(`app/middleware/rate_limit.py`):

- **Per-user daily quota** (`check_and_incr_daily_quota`) — a day-bucketed
  counter, atomically checked + incremented, mirroring the per-minute limiter.
- **Global daily budget guard / circuit breaker** (`incr_and_check_global_budget`
  + `is_global_budget_tripped`) — a per-UTC-day counter incremented at the shared
  provider chokepoints (`groq.chat()`, `skiplagged._call_mcp()`) so a leaked
  session or aggregate abuse can't run up an unbounded bill silently.

All keys carry a `:{YYYYMMDD}` (UTC) suffix and a seconds-to-midnight TTL, so the
quotas and the breaker auto-reset at UTC midnight — no cleanup job. Every helper
**fails open** on Redis error (logs a warning, allows the request); the per-user
quota and per-minute limiter remain the backstop.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from app.core.cache_keys import CacheKeys, CacheTTL
from app.db.redis import redis_client

logger = logging.getLogger(__name__)


def _now(now: datetime | None) -> datetime:
    return now or datetime.now(UTC)


def _day_bucket(now: datetime) -> str:
    """UTC calendar-day bucket, e.g. '20260623'."""
    return now.astimezone(UTC).strftime("%Y%m%d")


def _seconds_to_utc_midnight(now: datetime | None = None) -> int:
    """Seconds from `now` until the next 00:00 UTC.

    Used as the TTL for every day-bucket key so they all expire together at the
    reset boundary. Floored at `CacheTTL.DAILY_QUOTA_MIN_TTL` so a request landing
    a second before midnight still sets a usable TTL.
    """
    current = _now(now).astimezone(UTC)
    next_midnight = (current + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return max(CacheTTL.DAILY_QUOTA_MIN_TTL, int((next_midnight - current).total_seconds()))


# GET → compare to limit → INCR → repair TTL when missing. Returns
# [allowed, remaining, retry_after]. Mirrors the per-minute limiter's script but
# with a seconds-to-midnight TTL and an unconditional EXPIRE whenever the key has
# no TTL (a dropped EXPIRE on a day-bucket key would otherwise never self-heal).
_DAILY_QUOTA_LUA = """
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call('GET', key)
if current == false then
    current = 0
else
    current = tonumber(current)
end

if current >= max_requests then
    local remaining_ttl = redis.call('TTL', key)
    if remaining_ttl < 0 then
        redis.call('EXPIRE', key, ttl)
        remaining_ttl = ttl
    end
    return {0, 0, remaining_ttl}
end

local new_count = redis.call('INCR', key)
if redis.call('TTL', key) < 0 then
    redis.call('EXPIRE', key, ttl)
end

local remaining = max_requests - new_count
if remaining < 0 then
    remaining = 0
end
return {1, remaining, 0}
"""


# INCRBY → repair TTL when missing → compare to limit. Returns [within, total].
_GLOBAL_BUDGET_LUA = """
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local total = redis.call('INCRBY', key, amount)
if redis.call('TTL', key) < 0 then
    redis.call('EXPIRE', key, ttl)
end

if total <= limit then
    return {1, total}
end
return {0, total}
"""


async def check_and_incr_daily_quota(
    identifier: str,
    resource: str,
    limit: int,
    *,
    now: datetime | None = None,
) -> tuple[bool, int, int]:
    """Atomically check + increment a per-day counter for (identifier, resource).

    Returns ``(allowed, remaining, retry_after_seconds)``. When over limit,
    ``(False, 0, seconds_to_midnight)``. Fails open as ``(True, limit, 0)`` on a
    Redis error.
    """
    moment = _now(now)
    key = CacheKeys.daily_quota(identifier, resource, _day_bucket(moment))
    ttl = _seconds_to_utc_midnight(moment)
    try:
        allowed, remaining, retry_after = await redis_client.eval(
            _DAILY_QUOTA_LUA, 1, key, str(limit), str(ttl)
        )
        return bool(allowed), int(remaining), int(retry_after)
    except Exception as exc:  # pragma: no cover - exercised via monkeypatched eval
        logger.warning("Daily quota check failed, allowing request: %s", exc)
        return True, limit, 0


async def incr_and_check_global_budget(
    metric: str,
    amount: int,
    limit: int,
    *,
    now: datetime | None = None,
) -> tuple[bool, int]:
    """Atomically add ``amount`` to the global per-UTC-day counter for ``metric``.

    Returns ``(within_budget, total_after_increment)``. Fails open as
    ``(True, 0)`` on a Redis error. Logs a warning on the increment that trips the
    breaker so the operator has a signal in stdout (there is no Axiom).
    """
    moment = _now(now)
    key = CacheKeys.global_budget(metric, _day_bucket(moment))
    ttl = _seconds_to_utc_midnight(moment)
    try:
        within, total = await redis_client.eval(
            _GLOBAL_BUDGET_LUA, 1, key, str(amount), str(limit), str(ttl)
        )
    except Exception as exc:  # pragma: no cover - exercised via monkeypatched eval
        logger.warning("Global budget increment failed, allowing request: %s", exc)
        return True, 0

    within, total = bool(within), int(total)
    if not within and (total - amount) <= limit:
        # Log only on the increment that crosses the line, not every call after.
        logger.warning(
            "Global budget breaker tripped: metric=%s total=%s limit=%s",
            metric,
            total,
            limit,
        )
    return within, total


async def is_global_budget_tripped(
    metric: str,
    limit: int,
    *,
    now: datetime | None = None,
) -> bool:
    """Read-only check (no increment) of whether the breaker is tripped.

    Used by edge gatekeepers (chat middleware, manual-refresh trigger) to reject
    new expensive work cheaply. Fails open as ``False`` (not tripped) on error.
    """
    key = CacheKeys.global_budget(metric, _day_bucket(_now(now)))
    try:
        raw = await redis_client.get(key)
    except Exception as exc:  # pragma: no cover - exercised via monkeypatched get
        logger.warning("Global budget read failed, treating as not tripped: %s", exc)
        return False
    if raw is None:
        return False
    try:
        return int(raw) > limit
    except (TypeError, ValueError):
        return False
