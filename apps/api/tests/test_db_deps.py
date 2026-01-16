"""Tests for database dependency helpers."""

import pytest
from app.db import deps as deps_module


class _DummySessionManager:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return None


@pytest.mark.asyncio
async def test_get_db_yields_session(monkeypatch):
    dummy_session = object()
    monkeypatch.setattr(deps_module, "AsyncSessionLocal", lambda: _DummySessionManager(dummy_session))

    async for session in deps_module.get_db():
        assert session is dummy_session
