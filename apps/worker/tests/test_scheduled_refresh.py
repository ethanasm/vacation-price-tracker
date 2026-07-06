from __future__ import annotations

from types import SimpleNamespace

import pytest
from worker.workflows.scheduled_refresh import (
    RUN_HEALTH_CHECK_WORKFLOW_NAME,
    SEND_DAILY_DIGESTS_WORKFLOW_NAME,
    ScheduledRefreshAllUsersWorkflow,
)


def _patch_workflow(monkeypatch, module, *, run_id, execute_child, start_child):
    async def fake_execute_activity(_activity, *_args, **_kwargs):
        raise NotImplementedError  # overridden per-test

    monkeypatch.setattr(module.workflow, "execute_child_workflow", execute_child)
    monkeypatch.setattr(module.workflow, "start_child_workflow", start_child)
    monkeypatch.setattr(module.workflow, "info", lambda: SimpleNamespace(run_id=run_id))


@pytest.mark.asyncio
async def test_scheduled_refresh_fans_out_then_sends_digest(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    user_ids = ["user-1", "user-2", "user-3", "user-4"]
    refresh_child_ids: list[str] = []
    digest_started = False
    health_starts: list[tuple[str, dict, str | None]] = []

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return user_ids

    async def fake_execute_child_workflow(name, *args, id=None, **_kwargs):
        nonlocal digest_started
        if name == SEND_DAILY_DIGESTS_WORKFLOW_NAME:
            digest_started = True
            assert id == "daily-digest-run-xyz"
            return {"users_total": 4, "sent": 3, "skipped": 1}
        # Per-user refresh child workflow
        refresh_child_ids.append(id or "")
        if args[0] == "user-3":
            raise RuntimeError("child boom")
        return {"total": 1, "successful": 1, "failed": 0}

    async def fake_start_child_workflow(name, *args, id=None, **_kwargs):
        health_starts.append((name, args[0], id))
        return SimpleNamespace()

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    _patch_workflow(
        monkeypatch,
        scheduled_module,
        run_id="run-xyz",
        execute_child=fake_execute_child_workflow,
        start_child=fake_start_child_workflow,
    )
    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)

    result = await ScheduledRefreshAllUsersWorkflow().run()

    assert result["users_total"] == 4
    assert result["users_successful"] == 3
    assert result["users_failed"] == 1
    assert refresh_child_ids == [f"scheduled-refresh-{uid}-run-xyz" for uid in user_ids]
    assert digest_started is True
    # The health check chains off this run with the run's results + digest outcome.
    assert health_starts == [
        (
            RUN_HEALTH_CHECK_WORKFLOW_NAME,
            {
                "users_total": 4,
                "users_successful": 3,
                "users_failed": 1,
                "digests": {"users_total": 4, "sent": 3, "skipped": 1},
            },
            "health-check-run-xyz",
        )
    ]


@pytest.mark.asyncio
async def test_scheduled_refresh_still_sends_digest_when_no_users(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    digest_calls: list[tuple[str, str | None]] = []
    health_starts: list[dict] = []

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    async def fake_execute_child_workflow(name, *_args, id=None, **_kwargs):
        digest_calls.append((name, id))
        return {"users_total": 0, "sent": 0, "skipped": 0}

    async def fake_start_child_workflow(_name, *args, **_kwargs):
        health_starts.append(args[0])
        return SimpleNamespace()

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    _patch_workflow(
        monkeypatch,
        scheduled_module,
        run_id="run-1",
        execute_child=fake_execute_child_workflow,
        start_child=fake_start_child_workflow,
    )

    result = await ScheduledRefreshAllUsersWorkflow().run()

    # The digest still drains any straggler outbox rows even with no active trips.
    assert result == {"users_total": 0, "users_successful": 0, "users_failed": 0}
    assert digest_calls == [(SEND_DAILY_DIGESTS_WORKFLOW_NAME, "daily-digest-run-1")]
    assert health_starts[0]["digests"] == {"users_total": 0, "sent": 0, "skipped": 0}


@pytest.mark.asyncio
async def test_scheduled_refresh_swallows_digest_failure(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    health_starts: list[dict] = []

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    async def fake_execute_child_workflow(_name, *_args, id=None, **_kwargs):
        raise RuntimeError("digest boom")

    async def fake_start_child_workflow(_name, *args, **_kwargs):
        health_starts.append(args[0])
        return SimpleNamespace()

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    _patch_workflow(
        monkeypatch,
        scheduled_module,
        run_id="run-2",
        execute_child=fake_execute_child_workflow,
        start_child=fake_start_child_workflow,
    )

    # A digest dispatch failure must not fail the refresh run.
    result = await ScheduledRefreshAllUsersWorkflow().run()
    assert result == {"users_total": 0, "users_successful": 0, "users_failed": 0}
    # The health check still chains — without a digests key.
    assert health_starts == [{"users_total": 0, "users_successful": 0, "users_failed": 0}]


@pytest.mark.asyncio
async def test_scheduled_refresh_swallows_health_dispatch_failure(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    async def fake_execute_child_workflow(_name, *_args, id=None, **_kwargs):
        return {"users_total": 0, "sent": 0, "skipped": 0}

    async def fake_start_child_workflow(_name, *_args, **_kwargs):
        raise RuntimeError("health boom")

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    _patch_workflow(
        monkeypatch,
        scheduled_module,
        run_id="run-3",
        execute_child=fake_execute_child_workflow,
        start_child=fake_start_child_workflow,
    )

    # The 07:00 cron fallback still exists — a health dispatch failure must
    # not fail the refresh run.
    result = await ScheduledRefreshAllUsersWorkflow().run()
    assert result == {"users_total": 0, "users_successful": 0, "users_failed": 0}
