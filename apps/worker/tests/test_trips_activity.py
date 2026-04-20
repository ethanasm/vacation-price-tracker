from __future__ import annotations

import uuid

import pytest
from worker.activities import trips as trips_activity


class DummyResult:
    def __init__(self, values: list[uuid.UUID]) -> None:
        self._values = values

    def scalars(self) -> DummyResult:
        return self

    def all(self) -> list[uuid.UUID]:
        return self._values


class DummySession:
    def __init__(self, values: list[uuid.UUID]) -> None:
        self._values = values

    async def execute(self, *_args, **_kwargs):
        return DummyResult(self._values)


class DummySessionManager:
    def __init__(self, session: DummySession) -> None:
        self._session = session

    async def __aenter__(self) -> DummySession:
        return self._session

    async def __aexit__(self, *_exc) -> None:
        return None


@pytest.mark.asyncio
async def test_get_active_trips(monkeypatch):
    trip_ids = [uuid.uuid4(), uuid.uuid4()]
    session = DummySession(trip_ids)
    monkeypatch.setattr(trips_activity, "AsyncSessionLocal", lambda: DummySessionManager(session))

    result = await trips_activity.get_active_trips(str(uuid.uuid4()))

    assert result == [str(trip_id) for trip_id in trip_ids]


@pytest.mark.asyncio
async def test_get_all_user_ids_with_active_trips(monkeypatch):
    user_ids = [uuid.uuid4(), uuid.uuid4(), uuid.uuid4()]
    session = DummySession(user_ids)
    monkeypatch.setattr(trips_activity, "AsyncSessionLocal", lambda: DummySessionManager(session))

    result = await trips_activity.get_all_user_ids_with_active_trips()

    assert result == [str(user_id) for user_id in user_ids]


@pytest.mark.asyncio
async def test_get_all_user_ids_tags_langfuse_trace(monkeypatch):
    user_ids = [uuid.uuid4()]
    session = DummySession(user_ids)
    monkeypatch.setattr(trips_activity, "AsyncSessionLocal", lambda: DummySessionManager(session))

    trace_updates: list[dict] = []
    observation_updates: list[dict] = []
    monkeypatch.setattr(
        trips_activity.langfuse_context,
        "update_current_trace",
        lambda **kwargs: trace_updates.append(kwargs),
    )
    monkeypatch.setattr(
        trips_activity.langfuse_context,
        "update_current_observation",
        lambda **kwargs: observation_updates.append(kwargs),
    )

    await trips_activity.get_all_user_ids_with_active_trips()

    assert trace_updates, "expected update_current_trace to be called"
    assert trace_updates[0]["name"] == "scheduled_refresh_all_users"
    assert "worker" in trace_updates[0]["tags"]
    assert "scheduled_refresh" in trace_updates[0]["tags"]
    assert observation_updates, "expected update_current_observation to be called"
    assert observation_updates[-1]["output"] == {"user_count": 1}
