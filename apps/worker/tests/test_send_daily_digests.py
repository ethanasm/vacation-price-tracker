from __future__ import annotations

import pytest
from worker.activities.notifications import (
    get_pending_digest_user_ids,
    send_user_digest_activity,
)
from worker.workflows.send_daily_digests import SendDailyDigestsWorkflow


@pytest.mark.asyncio
async def test_digest_workflow_no_pending(monkeypatch):
    import worker.workflows.send_daily_digests as mod

    async def fake_execute_activity(_activity, *_args, **_kwargs):
        return []

    monkeypatch.setattr(mod.workflow, "execute_activity", fake_execute_activity)

    result = await SendDailyDigestsWorkflow().run()
    assert result == {"users_total": 0, "sent": 0, "skipped": 0}


@pytest.mark.asyncio
async def test_digest_workflow_counts_sent_and_skipped(monkeypatch):
    import worker.workflows.send_daily_digests as mod

    user_ids = ["u1", "u2", "u3"]

    async def fake_execute_activity(activity, *args, **_kwargs):
        if activity is get_pending_digest_user_ids:
            return user_ids
        if activity is send_user_digest_activity:
            user_id = args[0]
            if user_id == "u2":
                raise RuntimeError("send boom")  # caught via return_exceptions
            return {"sent": user_id == "u1", "count": 1 if user_id == "u1" else 0}
        raise AssertionError("unexpected activity")

    monkeypatch.setattr(mod.workflow, "execute_activity", fake_execute_activity)

    result = await SendDailyDigestsWorkflow().run()
    assert result == {"users_total": 3, "sent": 1, "skipped": 2}
