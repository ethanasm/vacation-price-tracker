"""Integration test: the daily-refresh schedule actually fires the right workflow.

Spins up Temporal's local dev server via `WorkflowEnvironment.start_local()`,
bootstraps the schedule, forces an immediate fire with `ScheduleHandle.trigger()`
(no need to wait 24h for cron), and asserts the configured workflow runs.

This is intentionally gated behind the `integration` marker so it's excluded from
the default test run. CI runs it in a dedicated step; locally you can invoke it
with `uv run pytest apps/worker/tests -m integration`.

The local dev server binary is downloaded by temporalio on first use, which
requires outbound network access to GitHub. In sandboxed environments without
network, this test is skipped via the marker rather than failing.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker
from worker.schedule_bootstrap import (
    SCHEDULE_ID,
    WORKFLOW_NAME,
    ensure_daily_refresh_schedule,
)
from worker.workflows.scheduled_refresh import ScheduledRefreshAllUsersWorkflow

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]

# Fixed test-scoped task queue so the stub worker doesn't collide with a real
# worker listening on settings.temporal_task_queue.
_TEST_TASK_QUEUE = "test-scheduled-refresh-" + uuid.uuid4().hex[:8]


@activity.defn(name="get_all_user_ids_with_active_trips")
async def _fake_get_all_user_ids() -> list[str]:
    """Stub activity — returns empty so no child workflows are started."""
    return []


async def _wait_for_recent_actions(handle, timeout_seconds: float = 20.0):
    """Poll the schedule until it records a triggered action, or time out."""
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    while asyncio.get_event_loop().time() < deadline:
        desc = await handle.describe()
        if desc.info.recent_actions:
            return desc
        await asyncio.sleep(0.25)
    return await handle.describe()


async def test_ensure_daily_refresh_schedule_creates_correct_spec(monkeypatch):
    """Bootstrap creates a schedule whose cron + action match the config."""
    # Override the task queue so the schedule targets our stub worker.
    monkeypatch.setattr(
        "worker.schedule_bootstrap.settings.temporal_task_queue",
        _TEST_TASK_QUEUE,
    )

    async with await WorkflowEnvironment.start_local() as env:
        await ensure_daily_refresh_schedule(env.client)

        handle = env.client.get_schedule_handle(SCHEDULE_ID)
        desc = await handle.describe()

        assert desc.schedule.action.workflow == WORKFLOW_NAME
        assert desc.schedule.action.task_queue == _TEST_TASK_QUEUE
        assert desc.schedule.spec.cron_expressions  # non-empty
        # Overlap policy SKIP prevents stacking slow runs.
        from temporalio.client import ScheduleOverlapPolicy

        assert desc.schedule.policy.overlap == ScheduleOverlapPolicy.SKIP


async def test_schedule_trigger_runs_configured_workflow(monkeypatch):
    """Triggering the schedule actually starts ScheduledRefreshAllUsersWorkflow
    on the configured task queue, and it runs to completion."""
    monkeypatch.setattr(
        "worker.schedule_bootstrap.settings.temporal_task_queue",
        _TEST_TASK_QUEUE,
    )

    async with await WorkflowEnvironment.start_local() as env:
        # Register the real workflow + a stub activity so we don't need a DB.
        async with Worker(
            env.client,
            task_queue=_TEST_TASK_QUEUE,
            workflows=[ScheduledRefreshAllUsersWorkflow],
            activities=[_fake_get_all_user_ids],
        ):
            await ensure_daily_refresh_schedule(env.client)

            handle = env.client.get_schedule_handle(SCHEDULE_ID)
            await handle.trigger()

            desc = await _wait_for_recent_actions(handle, timeout_seconds=20.0)
            assert desc.info.recent_actions, "schedule did not fire within 20s"

            # The triggered action references a specific workflow execution —
            # grab its handle and wait for completion.
            action = desc.info.recent_actions[-1]
            wf_handle = env.client.get_workflow_handle(
                action.action.workflow_id,
                run_id=action.action.first_execution_run_id,
            )
            result = await wf_handle.result(rpc_timeout=timedelta(seconds=30))
            assert result == {"users_total": 0, "users_successful": 0, "users_failed": 0}
