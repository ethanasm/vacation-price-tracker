"""Tests for cost/abuse ceiling helpers (per-user daily quota + global budget)."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from app.core import quota
from app.core.cache_keys import CacheTTL

# =============================================================================
# _seconds_to_utc_midnight / _day_bucket
# =============================================================================


def test_seconds_to_utc_midnight_midday():
    now = datetime(2026, 6, 23, 12, 0, 0, tzinfo=UTC)
    # 12 hours to midnight.
    assert quota._seconds_to_utc_midnight(now) == 12 * 3600


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
    monkeypatch.setattr(quota.redis_client, "eval", AsyncMock(return_value=[1, 41, 0]))
    allowed, remaining, retry_after = await quota.check_and_incr_daily_quota(
        "user:abc", "chat", 42
    )
    assert allowed is True
    assert remaining == 41
    assert retry_after == 0


@pytest.mark.asyncio
async def test_daily_quota_exceeded_returns_retry_after(monkeypatch):
    monkeypatch.setattr(quota.redis_client, "eval", AsyncMock(return_value=[0, 0, 3600]))
    allowed, remaining, retry_after = await quota.check_and_incr_daily_quota(
        "user:abc", "chat", 42
    )
    assert allowed is False
    assert remaining == 0
    assert retry_after == 3600


@pytest.mark.asyncio
async def test_daily_quota_fails_open_on_redis_error(monkeypatch, caplog):
    monkeypatch.setattr(
        quota.redis_client, "eval", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    with caplog.at_level("WARNING"):
        allowed, remaining, retry_after = await quota.check_and_incr_daily_quota(
            "user:abc", "api", 100
        )
    assert allowed is True
    assert remaining == 100
    assert retry_after == 0
    assert "Daily quota check failed" in caplog.text


# =============================================================================
# release_daily_quota
#
# These cover the Python side; the Lua's own guarantee — that a refund against an
# already-expired day bucket is a no-op rather than a resurrection into a
# negative value — is the same script as, and is executed for real by, the
# mcp-budget-governor suite (fakeredis plus a real-Redis CI job). vpt's tests
# mock `eval`, so asserting on the script text is the most they can do here.
# =============================================================================


@pytest.mark.asyncio
async def test_release_daily_quota_evals_against_the_days_key(monkeypatch):
    eval_mock = AsyncMock(return_value=3)
    monkeypatch.setattr(quota.redis_client, "eval", eval_mock)

    now = datetime(2026, 6, 23, 12, 0, 0, tzinfo=UTC)
    await quota.release_daily_quota("user:abc", "api", now=now)

    script, numkeys, key, amount = eval_mock.await_args.args
    assert numkeys == 1
    assert key.endswith(":20260623")
    assert "user:abc" in key and "api" in key
    assert amount == "1"


@pytest.mark.asyncio
async def test_release_daily_quota_refuses_to_resurrect_a_missing_key(monkeypatch):
    """The script must bail on a missing key rather than DECRBY it negative.

    A bare DECRBY creates the key at -1, which survives a full day and silently
    hands that user extra headroom. Asserted on the script itself because the
    Redis client is mocked here.
    """
    monkeypatch.setattr(quota.redis_client, "eval", AsyncMock(return_value=0))
    await quota.release_daily_quota("user:abc", "api")

    assert "EXISTS" in quota._RELEASE_QUOTA_LUA
    # And the clamp must not extend the key's lifetime either.
    assert "KEEPTTL" in quota._RELEASE_QUOTA_LUA


@pytest.mark.asyncio
async def test_release_daily_quota_swallows_redis_errors(monkeypatch, caplog):
    """A failed refund must not turn a 429 into a 500.

    This runs on a path whose job is to reject the request; the caller already
    has its answer, and one over-counted counter for the rest of the day is a far
    better failure than an unhandled exception in middleware.
    """
    monkeypatch.setattr(
        quota.redis_client, "eval", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    with caplog.at_level("WARNING"):
        await quota.release_daily_quota("user:abc", "api")
    assert "Daily quota refund failed" in caplog.text


# =============================================================================
# incr_and_check_global_budget
# =============================================================================


@pytest.mark.asyncio
async def test_global_budget_within(monkeypatch):
    monkeypatch.setattr(quota.redis_client, "eval", AsyncMock(return_value=[1, 500]))
    within, total = await quota.incr_and_check_global_budget("groq_tokens", 500, 1000)
    assert within is True
    assert total == 500


@pytest.mark.asyncio
async def test_global_budget_trips_and_logs_once(monkeypatch, caplog):
    # total jumps from <=limit to >limit on this increment -> log the trip.
    monkeypatch.setattr(quota.redis_client, "eval", AsyncMock(return_value=[0, 1200]))
    with caplog.at_level("WARNING"):
        within, total = await quota.incr_and_check_global_budget(
            "groq_tokens", 300, 1000
        )
    assert within is False
    assert total == 1200
    assert "Global budget breaker tripped" in caplog.text


@pytest.mark.asyncio
async def test_global_budget_over_does_not_relog_after_trip(monkeypatch, caplog):
    # Already well over the limit before this increment -> no fresh trip log.
    monkeypatch.setattr(quota.redis_client, "eval", AsyncMock(return_value=[0, 5000]))
    with caplog.at_level("WARNING"):
        within, total = await quota.incr_and_check_global_budget(
            "groq_tokens", 100, 1000
        )
    assert within is False
    assert total == 5000
    assert "Global budget breaker tripped" not in caplog.text


@pytest.mark.asyncio
async def test_global_budget_fails_open_on_redis_error(monkeypatch):
    monkeypatch.setattr(
        quota.redis_client, "eval", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    within, total = await quota.incr_and_check_global_budget("skiplagged_calls", 1, 100)
    assert within is True
    assert total == 0


# =============================================================================
# is_global_budget_tripped
# =============================================================================


@pytest.mark.asyncio
async def test_is_tripped_false_when_no_key(monkeypatch):
    monkeypatch.setattr(quota.redis_client, "get", AsyncMock(return_value=None))
    assert await quota.is_global_budget_tripped("groq_tokens", 1000) is False


@pytest.mark.asyncio
async def test_is_tripped_false_under_limit(monkeypatch):
    monkeypatch.setattr(quota.redis_client, "get", AsyncMock(return_value="999"))
    assert await quota.is_global_budget_tripped("groq_tokens", 1000) is False


@pytest.mark.asyncio
async def test_is_tripped_true_over_limit(monkeypatch):
    monkeypatch.setattr(quota.redis_client, "get", AsyncMock(return_value="1001"))
    assert await quota.is_global_budget_tripped("groq_tokens", 1000) is True


@pytest.mark.asyncio
async def test_is_tripped_false_on_garbage_value(monkeypatch):
    monkeypatch.setattr(quota.redis_client, "get", AsyncMock(return_value="not-a-number"))
    assert await quota.is_global_budget_tripped("groq_tokens", 1000) is False


@pytest.mark.asyncio
async def test_is_tripped_fails_open_on_redis_error(monkeypatch):
    monkeypatch.setattr(
        quota.redis_client, "get", AsyncMock(side_effect=RuntimeError("redis down"))
    )
    assert await quota.is_global_budget_tripped("groq_tokens", 1000) is False
