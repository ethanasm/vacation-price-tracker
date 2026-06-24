"""Tests for the Expo push-send activity. The DB and Expo HTTP are both faked."""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from worker.activities import notifications as notif


class _FakeSession:
    """Minimal async-session stand-in returning scripted rows."""

    def __init__(self, *, outbox_row, device_tokens, trip):
        self._outbox_row = outbox_row
        self._device_tokens = device_tokens
        self._trip = trip
        self.entered = False

    async def __aenter__(self):
        self.entered = True
        return self

    async def __aexit__(self, *exc):
        return False


@pytest.mark.asyncio
async def test_no_push_when_flag_disabled():
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=False)):
        with patch.object(notif, "AsyncSessionLocal") as session_factory:
            session_factory.return_value = _FakeSession(outbox_row=None, device_tokens=[], trip=None)
            sent = await notif.send_push_notification_activity(str(uuid.uuid4()))
    assert sent == 0


@pytest.mark.asyncio
async def test_sends_one_push_per_device_when_outbox_row_exists(monkeypatch):
    snapshot_id = uuid.uuid4()
    user_id = uuid.uuid4()
    trip_id = uuid.uuid4()

    # Build the rows the activity reads.
    outbox = notif.NotificationOutbox(
        user_id=user_id, trip_id=trip_id, snapshot_id=snapshot_id,
        new_price=Decimal("680.00"),
    )
    trip = notif.Trip(id=trip_id, user_id=user_id, name="Maui")  # name used in the push body
    devices = [
        notif.DeviceToken(user_id=user_id, expo_push_token="ExponentPushToken[a]", platform="ios"),
        notif.DeviceToken(user_id=user_id, expo_push_token="ExponentPushToken[b]", platform="android"),
    ]

    sent_messages = {}

    async def fake_send(self, messages):
        sent_messages["messages"] = messages
        return [{"status": "ok"} for _ in messages]

    # Patch the activity's data access to return our scripted rows.
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(outbox, trip, devices))), \
         patch.object(notif.ExpoPushClient, "send", fake_send):
        sent = await notif.send_push_notification_activity(str(snapshot_id))

    assert sent == 2
    tokens = {m["to"] for m in sent_messages["messages"]}
    assert tokens == {"ExponentPushToken[a]", "ExponentPushToken[b]"}
    assert all("Maui" in m["body"] or "Maui" in m["title"] for m in sent_messages["messages"])


@pytest.mark.asyncio
async def test_no_push_when_no_outbox_row():
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(None, None, []))):
        sent = await notif.send_push_notification_activity(str(uuid.uuid4()))
    assert sent == 0


@pytest.mark.asyncio
async def test_no_push_when_user_has_no_devices():
    outbox = notif.NotificationOutbox(
        user_id=uuid.uuid4(), trip_id=uuid.uuid4(), snapshot_id=uuid.uuid4(),
        new_price=Decimal("680.00"),
    )
    trip = notif.Trip(id=outbox.trip_id, user_id=outbox.user_id, name="Maui")
    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(outbox, trip, []))):
        sent = await notif.send_push_notification_activity(str(outbox.snapshot_id))
    assert sent == 0


@pytest.mark.asyncio
async def test_expo_error_is_swallowed_returns_zero():
    outbox = notif.NotificationOutbox(
        user_id=uuid.uuid4(), trip_id=uuid.uuid4(), snapshot_id=uuid.uuid4(),
        new_price=Decimal("680.00"),
    )
    trip = notif.Trip(id=outbox.trip_id, user_id=outbox.user_id, name="Maui")
    devices = [notif.DeviceToken(user_id=outbox.user_id, expo_push_token="ExponentPushToken[a]", platform="ios")]

    async def boom(self, messages):
        raise notif.ExpoPushError("network down")

    with patch.object(notif, "is_feature_enabled", AsyncMock(return_value=True)), \
         patch.object(notif, "_load_push_context", AsyncMock(return_value=(outbox, trip, devices))), \
         patch.object(notif.ExpoPushClient, "send", boom):
        sent = await notif.send_push_notification_activity(str(outbox.snapshot_id))
    assert sent == 0  # delivery failure never fails the workflow
