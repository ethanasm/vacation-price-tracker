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


# --- Real-DB tests for the per-user opt-out gate and dead-token pruning ---------

from datetime import datetime  # noqa: E402

import pytest_asyncio  # noqa: E402
from app.core.feature_flags import FeatureFlags, set_feature_flag  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlmodel import SQLModel, select  # noqa: E402


@pytest_asyncio.fixture
async def session_factory(monkeypatch):
    import app.models  # noqa: F401 - register all tables

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(notif, "AsyncSessionLocal", factory)
    # Enable the push feature flag for these end-to-end runs.
    async with factory() as session:
        await set_feature_flag(session, FeatureFlags.PUSH_NOTIFICATIONS, True)

    yield factory
    await engine.dispose()


async def _seed_push_context(factory, *, push_enabled: bool, tokens: list[str]):
    """Seed a user (+ push pref), trip, outbox row and device tokens; return snapshot_id."""
    snapshot_id = uuid.uuid4()
    async with factory() as session:
        user = notif.User(
            email=f"{uuid.uuid4().hex}@example.com",
            google_sub=f"sub-{uuid.uuid4()}",
            push_notifications_enabled=push_enabled,
        )
        session.add(user)
        await session.flush()
        trip = notif.Trip(
            user_id=user.id,
            name="Maui",
            origin_airport="SFO",
            destination_code="OGG",
            depart_date=datetime(2026, 12, 1).date(),
        )
        session.add(trip)
        await session.flush()
        session.add(
            notif.NotificationOutbox(
                user_id=user.id,
                trip_id=trip.id,
                snapshot_id=snapshot_id,
                new_price=Decimal("680.00"),
            )
        )
        for token in tokens:
            session.add(
                notif.DeviceToken(user_id=user.id, expo_push_token=token, platform="ios")
            )
        await session.commit()
    return snapshot_id


@pytest.mark.asyncio
async def test_no_push_when_user_opted_out(session_factory):
    snapshot_id = await _seed_push_context(
        session_factory, push_enabled=False, tokens=["ExponentPushToken[a]"]
    )
    send_mock = AsyncMock(return_value=[])
    with patch.object(notif.ExpoPushClient, "send", send_mock):
        sent = await notif.send_push_notification_activity(str(snapshot_id))
    assert sent == 0
    send_mock.assert_not_called()


@pytest.mark.asyncio
async def test_dead_tokens_are_pruned(session_factory):
    snapshot_id = await _seed_push_context(
        session_factory,
        push_enabled=True,
        tokens=["ExponentPushToken[live]", "ExponentPushToken[dead]"],
    )

    async def fake_send(self, messages):
        # First device OK, second reported as unregistered (order matches messages).
        return [
            {"status": "ok", "id": "ticket-1"},
            {"status": "error", "details": {"error": "DeviceNotRegistered"}},
        ]

    with patch.object(notif.ExpoPushClient, "send", fake_send):
        sent = await notif.send_push_notification_activity(str(snapshot_id))

    assert sent == 2  # both were sent
    # ...but the dead token was pruned.
    async with session_factory() as session:
        remaining = (
            await session.execute(select(notif.DeviceToken.expo_push_token))
        ).scalars().all()
    assert remaining == ["ExponentPushToken[live]"]
