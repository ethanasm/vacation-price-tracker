"""Tests for the Expo push client (HTTP mocked)."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from worker.clients.expo_push import (
    EXPO_PUSH_URL,
    ExpoPushClient,
    ExpoPushError,
)


@pytest.mark.asyncio
async def test_send_posts_batch_and_returns_tickets():
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"status": "ok", "id": "ticket-1"}]}

    async def fake_post(url, json, **kwargs):
        captured["url"] = url
        captured["json"] = json
        return FakeResponse()

    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=fake_post)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=False)

    with patch("worker.clients.expo_push.httpx.AsyncClient", return_value=fake_client):
        tickets = await ExpoPushClient().send(
            [{"to": "ExponentPushToken[a]", "title": "Price drop", "body": "Now $680", "data": {"trip_id": "t1"}}]
        )

    assert captured["url"] == EXPO_PUSH_URL
    assert captured["json"][0]["to"] == "ExponentPushToken[a]"
    assert tickets == [{"status": "ok", "id": "ticket-1"}]


@pytest.mark.asyncio
async def test_send_empty_is_noop():
    tickets = await ExpoPushClient().send([])
    assert tickets == []


@pytest.mark.asyncio
async def test_send_http_error_raises():
    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=httpx.ConnectError("boom"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=False)

    with patch("worker.clients.expo_push.httpx.AsyncClient", return_value=fake_client):
        with pytest.raises(ExpoPushError):
            await ExpoPushClient().send(
                [{"to": "ExponentPushToken[a]", "title": "x", "body": "y", "data": {}}]
            )
