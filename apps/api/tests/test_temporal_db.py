"""Tests for Temporal client singleton helpers."""

from unittest.mock import AsyncMock

import pytest
from app.db import temporal as temporal_module


@pytest.mark.asyncio
async def test_init_temporal_client_connects(monkeypatch):
    dummy_client = object()
    temporal_module.temporal_client = None

    connect_mock = AsyncMock(return_value=dummy_client)
    monkeypatch.setattr(temporal_module.Client, "connect", connect_mock)

    client = await temporal_module.init_temporal_client()

    assert client is dummy_client
    assert temporal_module.temporal_client is dummy_client
    connect_mock.assert_called_once()


def test_close_temporal_client_resets():
    temporal_module.temporal_client = object()

    temporal_module.close_temporal_client()

    assert temporal_module.temporal_client is None


def test_get_temporal_client_requires_init():
    temporal_module.temporal_client = None

    with pytest.raises(RuntimeError):
        temporal_module.get_temporal_client()
