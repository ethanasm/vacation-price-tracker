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
