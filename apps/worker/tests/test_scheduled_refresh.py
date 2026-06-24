from __future__ import annotations

from types import SimpleNamespace

import pytest
from worker.workflows.scheduled_refresh import (
    SEND_DAILY_DIGESTS_WORKFLOW_NAME,
    ScheduledRefreshAllUsersWorkflow,
)


@pytest.mark.asyncio
async def test_scheduled_refresh_fans_out_then_sends_digest(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    user_ids = ["user-1", "user-2", "user-3", "user-4"]
    refresh_child_ids: list[str] = []
    digest_started = False

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return user_ids

    async def fake_execute_child_workflow(name, *args, id=None, **_kwargs):
        nonlocal digest_started
        if name == SEND_DAILY_DIGESTS_WORKFLOW_NAME:
            digest_started = True
            assert id == "daily-digest-run-xyz"
            return {"users_total": 0, "sent": 0, "skipped": 0}
        # Per-user refresh child workflow
        refresh_child_ids.append(id or "")
        if args[0] == "user-3":
            raise RuntimeError("child boom")
        return {"total": 1, "successful": 1, "failed": 0}

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    monkeypatch.setattr(
        scheduled_module.workflow, "execute_child_workflow", fake_execute_child_workflow
    )
    monkeypatch.setattr(
        scheduled_module.workflow, "info", lambda: SimpleNamespace(run_id="run-xyz")
    )

    result = await ScheduledRefreshAllUsersWorkflow().run()

    assert result["users_total"] == 4
    assert result["users_successful"] == 3
    assert result["users_failed"] == 1
    assert refresh_child_ids == [f"scheduled-refresh-{uid}-run-xyz" for uid in user_ids]
    assert digest_started is True


@pytest.mark.asyncio
async def test_scheduled_refresh_still_sends_digest_when_no_users(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    digest_calls: list[tuple[str, str | None]] = []

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    async def fake_execute_child_workflow(name, *_args, id=None, **_kwargs):
        digest_calls.append((name, id))
        return {"users_total": 0, "sent": 0, "skipped": 0}

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    monkeypatch.setattr(
        scheduled_module.workflow, "execute_child_workflow", fake_execute_child_workflow
    )
    monkeypatch.setattr(
        scheduled_module.workflow, "info", lambda: SimpleNamespace(run_id="run-1")
    )

    result = await ScheduledRefreshAllUsersWorkflow().run()

    # The digest still drains any straggler outbox rows even with no active trips.
    assert result == {"users_total": 0, "users_successful": 0, "users_failed": 0}
    assert digest_calls == [(SEND_DAILY_DIGESTS_WORKFLOW_NAME, "daily-digest-run-1")]


@pytest.mark.asyncio
async def test_scheduled_refresh_swallows_digest_failure(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    async def fake_execute_child_workflow(_name, *_args, id=None, **_kwargs):
        raise RuntimeError("digest boom")

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    monkeypatch.setattr(
        scheduled_module.workflow, "execute_child_workflow", fake_execute_child_workflow
    )
    monkeypatch.setattr(
        scheduled_module.workflow, "info", lambda: SimpleNamespace(run_id="run-2")
    )

    # A digest dispatch failure must not fail the refresh run.
    result = await ScheduledRefreshAllUsersWorkflow().run()
    assert result == {"users_total": 0, "users_successful": 0, "users_failed": 0}
