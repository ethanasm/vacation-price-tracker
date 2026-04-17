from __future__ import annotations

from types import SimpleNamespace

import pytest
from worker.workflows.scheduled_refresh import ScheduledRefreshAllUsersWorkflow


@pytest.mark.asyncio
async def test_scheduled_refresh_fans_out_per_user(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    user_ids = ["user-1", "user-2", "user-3", "user-4"]
    started_child_ids: list[str] = []

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return user_ids

    async def fake_execute_child_workflow(_name, user_id, *, id=None, **_kwargs):
        started_child_ids.append(id or "")
        if user_id == "user-3":
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
    assert started_child_ids == [
        f"scheduled-refresh-{uid}-run-xyz" for uid in user_ids
    ]


@pytest.mark.asyncio
async def test_scheduled_refresh_returns_empty_when_no_users(monkeypatch):
    import worker.workflows.scheduled_refresh as scheduled_module

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    async def fake_execute_child_workflow(*_args, **_kwargs):
        raise AssertionError("child workflow should not be started when no users")

    monkeypatch.setattr(scheduled_module.workflow, "execute_activity", fake_execute_activity)
    monkeypatch.setattr(
        scheduled_module.workflow, "execute_child_workflow", fake_execute_child_workflow
    )

    result = await ScheduledRefreshAllUsersWorkflow().run()

    assert result == {"users_total": 0, "users_successful": 0, "users_failed": 0}
