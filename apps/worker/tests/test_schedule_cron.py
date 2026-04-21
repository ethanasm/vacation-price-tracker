"""Unit tests for the daily-refresh cron expression.

These tests do NOT require Temporal — they just validate that the cron
string configured on `settings.daily_refresh_cron` parses correctly and
produces the expected next fire time. Catches typos like `"0 6 * *"` or
`"0 6 * * * *"` before they reach a running Temporal schedule.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from app.core.config import settings
from croniter import CroniterBadCronError, croniter
from worker.schedule_bootstrap import _build_schedule


def test_daily_refresh_cron_is_parseable():
    base = datetime(2026, 4, 21, 3, 0, tzinfo=UTC)
    # Should not raise
    it = croniter(settings.daily_refresh_cron, base)
    assert it is not None


def test_daily_refresh_cron_default_fires_at_0600_utc():
    # Confirm the shipped default (`0 6 * * *`) fires at 06:00 UTC daily.
    assert settings.daily_refresh_cron == "0 6 * * *"
    base = datetime(2026, 4, 21, 3, 0, tzinfo=UTC)
    next_fire = croniter(settings.daily_refresh_cron, base).get_next(datetime)
    assert next_fire == datetime(2026, 4, 21, 6, 0, tzinfo=UTC)

    # And the following fire is exactly 24h later.
    subsequent = croniter(settings.daily_refresh_cron, next_fire).get_next(datetime)
    assert subsequent == datetime(2026, 4, 22, 6, 0, tzinfo=UTC)


def test_schedule_spec_embeds_configured_cron():
    schedule = _build_schedule()
    assert schedule.spec.cron_expressions == [settings.daily_refresh_cron]


@pytest.mark.parametrize(
    "bad_cron",
    [
        "0 6 * *",  # too few fields
        "not a cron",
        "99 6 * * *",  # minute out of range
    ],
)
def test_bad_cron_would_fail_validation(bad_cron):
    with pytest.raises((CroniterBadCronError, ValueError, KeyError)):
        croniter(bad_cron, datetime(2026, 4, 21, tzinfo=UTC))
