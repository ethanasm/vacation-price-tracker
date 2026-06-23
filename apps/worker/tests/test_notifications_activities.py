from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from app.core.constants import NotificationStatus, ThresholdType
from app.models.notification_outbox import NotificationOutbox
from app.models.notification_rule import NotificationRule
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from worker.activities import notifications as wn

BASE_TIME = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)


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
    monkeypatch.setattr(wn, "AsyncSessionLocal", factory)
    monkeypatch.setattr(wn.settings, "enable_email_notifications", True)
    monkeypatch.setattr(wn.settings, "app_base_url", "https://app.test")
    monkeypatch.setattr(wn.settings, "email_physical_address", "1 Test St")

    yield factory
    await engine.dispose()


async def _seed_trip(factory, *, email_enabled=True, threshold=Decimal("2000"), **rule_kwargs):
    user = User(email="traveler@example.com", google_sub=f"sub-{uuid.uuid4()}")
    async with factory() as session:
        session.add(user)
        await session.flush()
        trip = Trip(
            user_id=user.id,
            name="Maui Getaway",
            origin_airport="SFO",
            destination_code="OGG",
            depart_date=datetime(2026, 12, 1).date(),
        )
        session.add(trip)
        await session.flush()
        rule = NotificationRule(
            trip_id=trip.id,
            threshold_type=ThresholdType.TRIP_TOTAL,
            threshold_value=threshold,
            email_enabled=email_enabled,
            **rule_kwargs,
        )
        session.add(rule)
        await session.commit()
        return user.id, trip.id


async def _add_snapshot(factory, trip_id, *, total, created_at, flight=None, hotel=None):
    async with factory() as session:
        snap = PriceSnapshot(
            trip_id=trip_id,
            total_price=Decimal(str(total)) if total is not None else None,
            flight_price=Decimal(str(flight)) if flight is not None else None,
            hotel_price=Decimal(str(hotel)) if hotel is not None else None,
            created_at=created_at,
        )
        session.add(snap)
        await session.commit()
        return snap.id


async def _outbox_rows(factory, trip_id=None):
    async with factory() as session:
        stmt = select(NotificationOutbox)
        if trip_id is not None:
            stmt = stmt.where(NotificationOutbox.trip_id == trip_id)
        return (await session.execute(stmt)).scalars().all()


# --------------------------------------------------------------------------- #
# evaluate_notifications_activity
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_evaluate_enqueues_when_threshold_crossed(session_factory):
    _, trip_id = await _seed_trip(session_factory, threshold=Decimal("2000"))
    await _add_snapshot(session_factory, trip_id, total=2500, created_at=BASE_TIME)
    snap_id = await _add_snapshot(
        session_factory, trip_id, total=1900, created_at=BASE_TIME + timedelta(hours=1)
    )

    enqueued = await wn.evaluate_notifications_activity(str(snap_id))

    assert enqueued is True
    rows = await _outbox_rows(session_factory, trip_id)
    assert len(rows) == 1
    assert rows[0].new_price == Decimal("1900.00")
    assert rows[0].old_price == Decimal("2500.00")
    assert rows[0].status == NotificationStatus.PENDING


@pytest.mark.asyncio
async def test_evaluate_enqueues_with_no_previous_snapshot(session_factory):
    _, trip_id = await _seed_trip(session_factory, threshold=Decimal("2000"))
    snap_id = await _add_snapshot(session_factory, trip_id, total=1500, created_at=BASE_TIME)

    enqueued = await wn.evaluate_notifications_activity(str(snap_id))

    assert enqueued is True
    rows = await _outbox_rows(session_factory, trip_id)
    assert len(rows) == 1
    assert rows[0].old_price is None


@pytest.mark.asyncio
async def test_evaluate_no_alert_above_threshold(session_factory):
    _, trip_id = await _seed_trip(session_factory, threshold=Decimal("2000"))
    snap_id = await _add_snapshot(session_factory, trip_id, total=2500, created_at=BASE_TIME)

    assert await wn.evaluate_notifications_activity(str(snap_id)) is False
    assert await _outbox_rows(session_factory, trip_id) == []


@pytest.mark.asyncio
async def test_evaluate_dedup_suppresses_repeat(session_factory):
    _, trip_id = await _seed_trip(session_factory, threshold=Decimal("2000"))
    s1 = await _add_snapshot(session_factory, trip_id, total=1900, created_at=BASE_TIME)
    await wn.evaluate_notifications_activity(str(s1))

    # Same price again on a new snapshot → not lower than last_notified_price.
    s2 = await _add_snapshot(
        session_factory, trip_id, total=1900, created_at=BASE_TIME + timedelta(hours=2)
    )
    assert await wn.evaluate_notifications_activity(str(s2)) is False
    assert len(await _outbox_rows(session_factory, trip_id)) == 1


@pytest.mark.asyncio
async def test_evaluate_rearm_after_price_rises_above_threshold(session_factory):
    _, trip_id = await _seed_trip(session_factory, threshold=Decimal("2000"))
    s1 = await _add_snapshot(session_factory, trip_id, total=1900, created_at=BASE_TIME)
    await wn.evaluate_notifications_activity(str(s1))

    # Price climbs above threshold → re-arm (clears last_notified_price).
    s2 = await _add_snapshot(
        session_factory, trip_id, total=2200, created_at=BASE_TIME + timedelta(hours=1)
    )
    assert await wn.evaluate_notifications_activity(str(s2)) is False

    # A later drop alerts again, even though it's not below the prior alert price.
    s3 = await _add_snapshot(
        session_factory, trip_id, total=1950, created_at=BASE_TIME + timedelta(hours=2)
    )
    assert await wn.evaluate_notifications_activity(str(s3)) is True
    assert len(await _outbox_rows(session_factory, trip_id)) == 2


@pytest.mark.asyncio
async def test_evaluate_notify_without_threshold_on_drop(session_factory):
    _, trip_id = await _seed_trip(
        session_factory, threshold=Decimal("100"), notify_without_threshold=True
    )
    await _add_snapshot(session_factory, trip_id, total=3000, created_at=BASE_TIME)
    snap_id = await _add_snapshot(
        session_factory, trip_id, total=2800, created_at=BASE_TIME + timedelta(hours=1)
    )

    # Above the $100 threshold, but dropped vs previous → notify_without_threshold fires.
    assert await wn.evaluate_notifications_activity(str(snap_id)) is True
    assert len(await _outbox_rows(session_factory, trip_id)) == 1


@pytest.mark.asyncio
async def test_notify_without_threshold_alerts_on_every_drop(session_factory):
    # Regression: the re-arm logic must not swallow consecutive drops for
    # "notify on any drop" rules (threshold is just a low floor).
    _, trip_id = await _seed_trip(
        session_factory, threshold=Decimal("100"), notify_without_threshold=True
    )
    await _add_snapshot(session_factory, trip_id, total=3000, created_at=BASE_TIME)
    s2 = await _add_snapshot(
        session_factory, trip_id, total=2800, created_at=BASE_TIME + timedelta(hours=1)
    )
    s3 = await _add_snapshot(
        session_factory, trip_id, total=2600, created_at=BASE_TIME + timedelta(hours=2)
    )

    assert await wn.evaluate_notifications_activity(str(s2)) is True
    assert await wn.evaluate_notifications_activity(str(s3)) is True
    assert len(await _outbox_rows(session_factory, trip_id)) == 2


@pytest.mark.asyncio
async def test_notify_without_threshold_skips_when_not_dropped(session_factory):
    _, trip_id = await _seed_trip(
        session_factory, threshold=Decimal("100"), notify_without_threshold=True
    )
    await _add_snapshot(session_factory, trip_id, total=2600, created_at=BASE_TIME)
    # Price rises → no drop → no alert.
    s2 = await _add_snapshot(
        session_factory, trip_id, total=2700, created_at=BASE_TIME + timedelta(hours=1)
    )
    assert await wn.evaluate_notifications_activity(str(s2)) is False
    assert await _outbox_rows(session_factory, trip_id) == []


@pytest.mark.asyncio
async def test_evaluate_idempotent_on_snapshot(session_factory):
    _, trip_id = await _seed_trip(session_factory, threshold=Decimal("2000"))
    snap_id = await _add_snapshot(session_factory, trip_id, total=1900, created_at=BASE_TIME)

    assert await wn.evaluate_notifications_activity(str(snap_id)) is True
    assert await wn.evaluate_notifications_activity(str(snap_id)) is False
    assert len(await _outbox_rows(session_factory, trip_id)) == 1


@pytest.mark.asyncio
async def test_evaluate_skips_when_email_disabled_on_rule(session_factory):
    _, trip_id = await _seed_trip(session_factory, email_enabled=False)
    snap_id = await _add_snapshot(session_factory, trip_id, total=1000, created_at=BASE_TIME)
    assert await wn.evaluate_notifications_activity(str(snap_id)) is False


@pytest.mark.asyncio
async def test_evaluate_feature_flag_off(session_factory, monkeypatch):
    monkeypatch.setattr(wn.settings, "enable_email_notifications", False)
    _, trip_id = await _seed_trip(session_factory)
    snap_id = await _add_snapshot(session_factory, trip_id, total=1000, created_at=BASE_TIME)
    assert await wn.evaluate_notifications_activity(str(snap_id)) is False


@pytest.mark.asyncio
async def test_evaluate_missing_snapshot(session_factory):
    assert await wn.evaluate_notifications_activity(str(uuid.uuid4())) is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("threshold_type", "kwargs"),
    [
        (ThresholdType.FLIGHT_TOTAL, {"flight": 400, "total": 2000}),
        (ThresholdType.HOTEL_TOTAL, {"hotel": 300, "total": 2000}),
    ],
)
async def test_evaluate_uses_threshold_type_price(session_factory, threshold_type, kwargs):
    user = User(email="t2@example.com", google_sub=f"sub-{uuid.uuid4()}")
    async with session_factory() as session:
        session.add(user)
        await session.flush()
        trip = Trip(
            user_id=user.id,
            name="Trip",
            origin_airport="SFO",
            destination_code="OGG",
            depart_date=datetime(2026, 12, 1).date(),
        )
        session.add(trip)
        await session.flush()
        session.add(
            NotificationRule(
                trip_id=trip.id,
                threshold_type=threshold_type,
                threshold_value=Decimal("500"),
            )
        )
        await session.commit()
        trip_id = trip.id

    snap_id = await _add_snapshot(session_factory, trip_id, created_at=BASE_TIME, **kwargs)

    # Flight/hotel component is below the $500 threshold even though the trip total is high.
    assert await wn.evaluate_notifications_activity(str(snap_id)) is True
    rows = await _outbox_rows(session_factory, trip_id)
    assert rows[0].threshold_type == threshold_type


@pytest.mark.asyncio
async def test_evaluate_no_price_in_snapshot(session_factory):
    _, trip_id = await _seed_trip(session_factory, threshold=Decimal("2000"))
    snap_id = await _add_snapshot(session_factory, trip_id, total=None, created_at=BASE_TIME)
    assert await wn.evaluate_notifications_activity(str(snap_id)) is False


# --------------------------------------------------------------------------- #
# get_pending_digest_user_ids + send_user_digest_activity
# --------------------------------------------------------------------------- #


class _FakeResend:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def send(self, **kwargs):
        self.calls.append(kwargs)
        return {"id": "email-1"}


class _BoomResend:
    async def send(self, **_kwargs):
        from app.clients.email import EmailSendError

        raise EmailSendError("resend down")


@pytest.mark.asyncio
async def test_get_pending_digest_user_ids(session_factory):
    user_id, trip_id = await _seed_trip(session_factory)
    snap_id = await _add_snapshot(session_factory, trip_id, total=1900, created_at=BASE_TIME)
    await wn.evaluate_notifications_activity(str(snap_id))

    ids = await wn.get_pending_digest_user_ids()
    assert ids == [str(user_id)]


@pytest.mark.asyncio
async def test_get_pending_digest_user_ids_flag_off(session_factory, monkeypatch):
    monkeypatch.setattr(wn.settings, "enable_email_notifications", False)
    assert await wn.get_pending_digest_user_ids() == []


@pytest.mark.asyncio
async def test_send_user_digest_sends_and_marks_sent(session_factory, monkeypatch):
    fake = _FakeResend()
    monkeypatch.setattr(wn, "ResendClient", lambda: fake)

    user_id, trip_id = await _seed_trip(session_factory)
    snap_id = await _add_snapshot(session_factory, trip_id, total=1900, created_at=BASE_TIME)
    await wn.evaluate_notifications_activity(str(snap_id))

    result = await wn.send_user_digest_activity(str(user_id))

    assert result == {"sent": True, "count": 1}
    assert len(fake.calls) == 1
    call = fake.calls[0]
    assert call["to"] == "traveler@example.com"
    assert "List-Unsubscribe" in call["headers"]
    assert call["idempotency_key"]
    rows = await _outbox_rows(session_factory, trip_id)
    assert rows[0].status == NotificationStatus.SENT
    assert rows[0].sent_at is not None


@pytest.mark.asyncio
async def test_send_user_digest_dedups_rows_per_trip(session_factory, monkeypatch):
    fake = _FakeResend()
    monkeypatch.setattr(wn, "ResendClient", lambda: fake)

    # Two drops on the same trip in one day → two outbox rows, one digest line.
    user_id, trip_id = await _seed_trip(
        session_factory, threshold=Decimal("100"), notify_without_threshold=True
    )
    await _add_snapshot(session_factory, trip_id, total=3000, created_at=BASE_TIME)
    s2 = await _add_snapshot(
        session_factory, trip_id, total=2800, created_at=BASE_TIME + timedelta(hours=1)
    )
    s3 = await _add_snapshot(
        session_factory, trip_id, total=2600, created_at=BASE_TIME + timedelta(hours=2)
    )
    await wn.evaluate_notifications_activity(str(s2))
    await wn.evaluate_notifications_activity(str(s3))
    assert len(await _outbox_rows(session_factory, trip_id)) == 2

    result = await wn.send_user_digest_activity(str(user_id))

    assert result == {"sent": True, "count": 1}  # one trip, not two rows
    html = fake.calls[0]["html"]
    assert html.count("Maui Getaway") == 1  # collapsed to a single line
    # Both rows are still drained.
    rows = await _outbox_rows(session_factory, trip_id)
    assert all(r.status == NotificationStatus.SENT for r in rows)


@pytest.mark.asyncio
async def test_send_user_digest_no_pending(session_factory):
    user_id, _ = await _seed_trip(session_factory)
    assert await wn.send_user_digest_activity(str(user_id)) == {"sent": False, "count": 0}


@pytest.mark.asyncio
async def test_send_user_digest_unsubscribed_drains_rows(session_factory, monkeypatch):
    fake = _FakeResend()
    monkeypatch.setattr(wn, "ResendClient", lambda: fake)

    user_id, trip_id = await _seed_trip(session_factory)
    snap_id = await _add_snapshot(session_factory, trip_id, total=1900, created_at=BASE_TIME)
    await wn.evaluate_notifications_activity(str(snap_id))

    # Unsubscribe the user.
    async with session_factory() as session:
        user = await session.get(User, user_id)
        user.email_notifications_enabled = False
        session.add(user)
        await session.commit()

    result = await wn.send_user_digest_activity(str(user_id))

    assert result == {"sent": False, "count": 0}
    assert fake.calls == []  # nothing sent
    rows = await _outbox_rows(session_factory, trip_id)
    assert rows[0].status == NotificationStatus.SENT  # drained, not left pending


@pytest.mark.asyncio
async def test_send_user_digest_records_failure(session_factory, monkeypatch):
    monkeypatch.setattr(wn, "ResendClient", lambda: _BoomResend())

    user_id, trip_id = await _seed_trip(session_factory)
    snap_id = await _add_snapshot(session_factory, trip_id, total=1900, created_at=BASE_TIME)
    await wn.evaluate_notifications_activity(str(snap_id))

    result = await wn.send_user_digest_activity(str(user_id))

    assert result == {"sent": False, "count": 0}
    rows = await _outbox_rows(session_factory, trip_id)
    assert rows[0].status == NotificationStatus.PENDING  # left for retry
    assert rows[0].attempts == 1
    assert "resend down" in (rows[0].error or "")


@pytest.mark.asyncio
async def test_send_user_digest_flag_off(session_factory, monkeypatch):
    monkeypatch.setattr(wn.settings, "enable_email_notifications", False)
    assert await wn.send_user_digest_activity(str(uuid.uuid4())) == {"sent": False, "count": 0}
