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
