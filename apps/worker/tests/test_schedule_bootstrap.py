from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from temporalio.client import (
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
    ScheduleSpec,
    ScheduleUpdate,
)
from worker import schedule_bootstrap


class FakeClient:
    def __init__(self, *, already_exists: bool = False) -> None:
        self.create_schedule = AsyncMock()
        if already_exists:
            self.create_schedule.side_effect = ScheduleAlreadyRunningError()
        self.handle = FakeScheduleHandle()

    def get_schedule_handle(self, schedule_id: str) -> FakeScheduleHandle:
        assert schedule_id == schedule_bootstrap.SCHEDULE_ID
        return self.handle


class FakeScheduleHandle:
    def __init__(self) -> None:
        self.update_called_with: ScheduleUpdate | None = None

    async def update(self, updater):
        self.update_called_with = updater(None)


@pytest.mark.asyncio
async def test_ensure_daily_refresh_schedule_creates_when_missing():
    client = FakeClient(already_exists=False)

    await schedule_bootstrap.ensure_daily_refresh_schedule(client)

    client.create_schedule.assert_awaited_once()
    schedule_id, schedule = client.create_schedule.await_args.args
    assert schedule_id == schedule_bootstrap.SCHEDULE_ID
    assert isinstance(schedule, Schedule)
    assert isinstance(schedule.action, ScheduleActionStartWorkflow)
    assert schedule.action.workflow == schedule_bootstrap.WORKFLOW_NAME
    assert isinstance(schedule.spec, ScheduleSpec)
    assert schedule.spec.cron_expressions
    assert client.handle.update_called_with is None


@pytest.mark.asyncio
async def test_ensure_daily_refresh_schedule_updates_when_exists():
    client = FakeClient(already_exists=True)

    await schedule_bootstrap.ensure_daily_refresh_schedule(client)

    client.create_schedule.assert_awaited_once()
    assert isinstance(client.handle.update_called_with, ScheduleUpdate)
    updated_schedule = client.handle.update_called_with.schedule
    assert isinstance(updated_schedule, Schedule)
    assert updated_schedule.action.workflow == schedule_bootstrap.WORKFLOW_NAME
