"""Tests for the cost/abuse ceiling adapter over mcp-budget-governor.

The Lua, the key scheme, and the gated/ungated counter semantics are the
library's and are tested there (fakeredis executing the scripts for real, plus a
real-Redis CI job). What vpt owns — and what these tests pin — is the adapter
contract: the public signatures and return shapes the middleware and the
provider clients rely on, the fail-open behaviour, the preserved Axiom events,
and the exact keys the counters land under (a silently changed key is a silently
reset quota).
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from app.core import quota
from app.core.cache_keys import CacheTTL
from mcp_budget_governor import AccumulateResult, ConsumeResult

NOON = datetime(2026, 6, 23, 12, 0, 0, tzinfo=UTC)

# =============================================================================
# _seconds_to_utc_midnight / _day_bucket
# =============================================================================


def test_seconds_to_utc_midnight_midday():
    assert quota._seconds_to_utc_midnight(NOON) == 12 * 3600


def test_seconds_to_utc_midnight_floor_near_midnight():
    now = datetime(2026, 6, 23, 23, 59, 59, tzinfo=UTC)
    # 1 second to midnight, but floored to the minimum TTL.
    assert quota._seconds_to_utc_midnight(now) == CacheTTL.DAILY_QUOTA_MIN_TTL


def test_day_bucket_is_utc_yyyymmdd():
    now = datetime(2026, 6, 23, 5, 30, 0, tzinfo=UTC)
    assert quota._day_bucket(now) == "20260623"


# =============================================================================
# check_and_incr_daily_quota
# =============================================================================


@pytest.mark.asyncio
async def test_daily_quota_allowed(monkeypatch):
    consume = AsyncMock(return_value=ConsumeResult(allowed=True, total=1, remaining=41))
    monkeypatch.setattr(quota._backend, "consume", consume)

    allowed, remaining, retry_after = await quota.check_and_incr_daily_quota(
        "user:abc", "chat", 42, now=NOON
    )
    assert (allowed, remaining, retry_after) == (True, 41, 0)


@pytest.mark.asyncio
async def test_daily_quota_key_is_the_library_scheme(monkeypatch):
    """The exact key matters: changing it silently resets everyone's quota.

    Pinned here so a library upgrade that moves the scheme fails a vpt test
    instead of resetting production counters unnoticed.
    """
    consume = AsyncMock(return_value=ConsumeResult(allowed=True, total=1, remaining=1))
    monkeypatch.setattr(quota._backend, "consume", consume)

    await quota.check_and_incr_daily_quota("user:abc", "chat", 42, now=NOON)

    key, amount, cap, ttl = consume.await_args.args
    assert key == "mcpbg:daily_chat:user=user:abc:20260623"
    assert (amount, cap) == (1, 42)
    assert ttl == 12 * 3600  # to UTC midnight


@pytest.mark.asyncio
async def test_daily_quota_exceeded_returns_retry_after(monkeypatch):
    consume = AsyncMock(return_value=ConsumeResult(allowed=False, total=42, remaining=0))
    monkeypatch.setattr(quota._backend, "consume", consume)

    allowed, remaining, retry_after = await quota.check_and_incr_daily_quota(
        "user:abc", "chat", 42, now=NOON
    )
    assert allowed is False
    assert remaining == 0
    # Not floored: the caller is told the real seconds to midnight.
    assert retry_after == 12 * 3600


@pytest.mark.asyncio
async def test_daily_quota_fails_open_on_redis_error(monkeypatch):
    monkeypatch.setattr(
        quota._backend, "consume", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    allowed, remaining, retry_after = await quota.check_and_incr_daily_quota(
        "user:abc", "api", 100, now=NOON
    )
    # Fail open exactly as before the library swap: allowed, full headroom.
    assert (allowed, remaining, retry_after) == (True, 100, 0)


# =============================================================================
# release_daily_quota
# =============================================================================


@pytest.mark.asyncio
async def test_release_targets_the_same_key_consume_charged(monkeypatch):
    """A refund against a different key than the charge would be a silent no-op
    — the leak this function exists to fix would be back, invisibly."""
    consume = AsyncMock(return_value=ConsumeResult(allowed=True, total=1, remaining=1))
    release = AsyncMock()
    monkeypatch.setattr(quota._backend, "consume", consume)
    monkeypatch.setattr(quota._backend, "release", release)

    await quota.check_and_incr_daily_quota("user:abc", "api", 100, now=NOON)
    await quota.release_daily_quota("user:abc", "api", now=NOON)

    charged_key = consume.await_args.args[0]
    released_key, released_amount = release.await_args.args
    assert released_key == charged_key
    assert released_amount == 1


@pytest.mark.asyncio
async def test_release_swallows_redis_errors(monkeypatch, caplog):
    """A failed refund must not turn a 429 into a 500."""
    monkeypatch.setattr(
        quota._backend, "release", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    with caplog.at_level("WARNING"):
        await quota.release_daily_quota("user:abc", "api", now=NOON)
    assert "Daily quota refund failed" in caplog.text


# =============================================================================
# incr_and_check_global_budget
# =============================================================================


@pytest.mark.asyncio
async def test_global_budget_within(monkeypatch):
    accumulate = AsyncMock(
        return_value=AccumulateResult(within=True, total=500, crossed=False)
    )
    monkeypatch.setattr(quota._backend, "accumulate", accumulate)

    within, total = await quota.incr_and_check_global_budget(
        "groq_tokens", 500, 1000, now=NOON
    )
    assert (within, total) == (True, 500)

    key = accumulate.await_args.args[0]
    assert key == "mcpbg:groq_tokens:global:20260623"


@pytest.mark.asyncio
async def test_global_budget_trips_and_logs_once(monkeypatch, caplog):
    accumulate = AsyncMock(
        return_value=AccumulateResult(within=False, total=1200, crossed=True)
    )
    monkeypatch.setattr(quota._backend, "accumulate", accumulate)

    with caplog.at_level("WARNING"):
        within, total = await quota.incr_and_check_global_budget(
            "groq_tokens", 600, 1000, now=NOON
        )
    assert (within, total) == (False, 1200)
    # Two records fire: the library's own governor.breaker_tripped and the
    # vpt-catalogued budget.breaker_tripped this adapter preserves. Dashboards
    # key on the latter, so that is the one pinned here.
    events = [getattr(record, "event", None) for record in caplog.records]
    assert "budget.breaker_tripped" in events


@pytest.mark.asyncio
async def test_global_budget_over_does_not_relog_after_trip(monkeypatch, caplog):
    # `crossed` is computed atomically in the backend: only the increment that
    # takes the total over the line reports it, so later calls stay quiet.
    accumulate = AsyncMock(
        return_value=AccumulateResult(within=False, total=1800, crossed=False)
    )
    monkeypatch.setattr(quota._backend, "accumulate", accumulate)

    with caplog.at_level("WARNING"):
        within, total = await quota.incr_and_check_global_budget(
            "groq_tokens", 600, 1000, now=NOON
        )
    assert (within, total) == (False, 1800)
    assert not caplog.records


@pytest.mark.asyncio
async def test_global_budget_fails_open_on_redis_error(monkeypatch):
    monkeypatch.setattr(
        quota._backend, "accumulate", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    within, total = await quota.incr_and_check_global_budget(
        "groq_tokens", 500, 1000, now=NOON
    )
    assert (within, total) == (True, 0)


# =============================================================================
# is_global_budget_tripped
# =============================================================================


@pytest.mark.asyncio
async def test_is_tripped_false_when_no_key(monkeypatch):
    monkeypatch.setattr(quota._backend, "peek", AsyncMock(return_value=0))
    assert await quota.is_global_budget_tripped("groq_tokens", 1000, now=NOON) is False


@pytest.mark.asyncio
async def test_is_tripped_false_under_limit(monkeypatch):
    monkeypatch.setattr(quota._backend, "peek", AsyncMock(return_value=999))
    assert await quota.is_global_budget_tripped("groq_tokens", 1000, now=NOON) is False


@pytest.mark.asyncio
async def test_is_tripped_true_over_limit(monkeypatch):
    monkeypatch.setattr(quota._backend, "peek", AsyncMock(return_value=1001))
    assert await quota.is_global_budget_tripped("groq_tokens", 1000, now=NOON) is True


@pytest.mark.asyncio
async def test_is_tripped_fails_open_on_redis_error(monkeypatch):
    monkeypatch.setattr(
        quota._backend, "peek", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    assert await quota.is_global_budget_tripped("groq_tokens", 1000, now=NOON) is False


# =============================================================================
# Adapter configuration guarantees
# =============================================================================


def test_governor_is_configured_for_prod_parity():
    """local_fallback must stay off until turning it on is its own decision.

    Production vpt has always failed fully open on a Redis outage; the library
    can instead degrade to per-replica enforcement, which is a behaviour change
    this adoption deliberately does not make. This test is the tripwire against
    someone flipping it as a drive-by.
    """
    governor = quota._governor(quota._daily_limit("api", 10), NOON)
    assert governor._fallback is None


def test_backend_does_not_own_the_shared_redis_client():
    """Closing vpt's Redis client is the app lifespan's job, not the adapter's."""
    assert quota._backend._owns_client is False
