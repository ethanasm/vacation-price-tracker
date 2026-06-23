"""Notification activities: threshold detection + daily digest delivery.

Detection (``evaluate_notifications_activity``) runs after each price snapshot is
saved. It is **retriable and idempotent** (keyed on ``snapshot_id`` via a unique
constraint), so it does not need to share the snapshot's transaction.

Delivery (``get_pending_digest_user_ids`` + ``send_user_digest_activity``) drains
the outbox once per day, sending one Resend email per user. It is chained onto the
end of the scheduled refresh so every snapshot is written before it runs.
"""

import hashlib
import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from app.clients.email import EmailError, ResendClient
from app.core.config import settings
from app.core.constants import NotificationStatus, ThresholdType
from app.core.security import make_unsubscribe_token
from app.db.session import AsyncSessionLocal
from app.models.notification_outbox import NotificationOutbox
from app.models.notification_rule import NotificationRule
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.user import User
from app.services.email_render import DigestTrip, render_daily_digest
from sqlmodel import select
from temporalio import activity

logger = logging.getLogger(__name__)

_THRESHOLD_LABELS = {
    ThresholdType.TRIP_TOTAL: "Trip total",
    ThresholdType.FLIGHT_TOTAL: "Flight",
    ThresholdType.HOTEL_TOTAL: "Hotel",
}


def _price_for(snapshot: PriceSnapshot, threshold_type: ThresholdType) -> Decimal | None:
    if threshold_type == ThresholdType.FLIGHT_TOTAL:
        return snapshot.flight_price
    if threshold_type == ThresholdType.HOTEL_TOTAL:
        return snapshot.hotel_price
    return snapshot.total_price


@activity.defn
async def evaluate_notifications_activity(snapshot_id: str) -> bool:
    """Evaluate a trip's notification rule against a new snapshot.

    Enqueues a ``notification_outbox`` row when the trip has crossed its
    threshold (or dropped, for ``notify_without_threshold`` rules). Returns True
    when a row was enqueued. Idempotent on ``snapshot_id``.
    """
    if not settings.enable_email_notifications:
        return False

    snapshot_uuid = uuid.UUID(snapshot_id)
    async with AsyncSessionLocal() as session:
        snapshot = await session.get(PriceSnapshot, snapshot_uuid)
        if snapshot is None:
            logger.warning("evaluate_notifications: snapshot %s not found", snapshot_id)
            return False

        rule = (
            await session.execute(
                select(NotificationRule).where(NotificationRule.trip_id == snapshot.trip_id)
            )
        ).scalar_one_or_none()
        if rule is None or not rule.email_enabled:
            return False

        # Idempotency: never enqueue twice for the same snapshot.
        existing = (
            await session.execute(
                select(NotificationOutbox.id).where(
                    NotificationOutbox.snapshot_id == snapshot_uuid
                )
            )
        ).first()
        if existing is not None:
            return False

        price = _price_for(snapshot, rule.threshold_type)
        if price is None:
            return False

        # Re-arm: once the price climbs back above the threshold, clear the
        # dedup marker so a later drop alerts again.
        if rule.last_notified_price is not None and price > rule.threshold_value:
            rule.last_notified_price = None
            session.add(rule)
            await session.commit()
            return False

        previous = (
            await session.execute(
                select(PriceSnapshot)
                .where(
                    PriceSnapshot.trip_id == snapshot.trip_id,
                    PriceSnapshot.created_at < snapshot.created_at,
                )
                .order_by(PriceSnapshot.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        previous_price = _price_for(previous, rule.threshold_type) if previous else None

        crossed = price <= rule.threshold_value
        dropped = previous_price is not None and price < previous_price
        should_notify = crossed or (rule.notify_without_threshold and dropped)

        # Suppress repeats unless the price has dropped below the last alert.
        if (
            should_notify
            and rule.last_notified_price is not None
            and price >= rule.last_notified_price
        ):
            should_notify = False

        if not should_notify:
            return False

        trip = await session.get(Trip, snapshot.trip_id)
        if trip is None:  # pragma: no cover - FK guarantees the trip exists
            return False

        session.add(
            NotificationOutbox(
                user_id=trip.user_id,
                trip_id=trip.id,
                snapshot_id=snapshot.id,
                threshold_type=rule.threshold_type,
                old_price=previous_price,
                new_price=price,
                threshold_value=rule.threshold_value,
            )
        )
        rule.last_notified_price = price
        rule.last_notified_at = datetime.now(UTC)
        session.add(rule)
        await session.commit()
        logger.info(
            "Enqueued price-drop notification for trip_id=%s new_price=%s", trip.id, price
        )
        return True


@activity.defn
async def get_pending_digest_user_ids() -> list[str]:
    """Distinct user ids that have at least one pending notification."""
    if not settings.enable_email_notifications:
        return []
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(NotificationOutbox.user_id)
            .where(NotificationOutbox.status == NotificationStatus.PENDING)
            .distinct()
        )
        return [str(user_id) for user_id in result.scalars().all()]


def _digest_idempotency_key(user_id: str) -> str:
    today = datetime.now(UTC).date().isoformat()
    return hashlib.sha256(f"{user_id}:{today}".encode()).hexdigest()


@activity.defn
async def send_user_digest_activity(user_id: str) -> dict:
    """Render and send one daily digest for a user; mark their rows sent.

    Returns ``{"sent": bool, "count": int}``. Per-user email failures are caught
    and recorded (rows stay ``pending`` for the next run) so one bad send never
    fails the batch.
    """
    if not settings.enable_email_notifications:
        return {"sent": False, "count": 0}

    user_uuid = uuid.UUID(user_id)
    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                select(NotificationOutbox)
                .where(
                    NotificationOutbox.user_id == user_uuid,
                    NotificationOutbox.status == NotificationStatus.PENDING,
                )
                .order_by(NotificationOutbox.created_at)
            )
        ).scalars().all()
        if not rows:
            return {"sent": False, "count": 0}

        user = await session.get(User, user_uuid)
        now = datetime.now(UTC)

        # Unsubscribed or unreachable users: drain their pending rows so they
        # don't accumulate, but send nothing.
        if user is None or not user.email_notifications_enabled or not user.email:
            for row in rows:
                row.status = NotificationStatus.SENT
                row.sent_at = now
                session.add(row)
            await session.commit()
            return {"sent": False, "count": 0}

        trip_names = dict(
            (
                await session.execute(
                    select(Trip.id, Trip.name).where(
                        Trip.id.in_([row.trip_id for row in rows])
                    )
                )
            ).all()
        )

        base = settings.app_base_url.rstrip("/")
        token = make_unsubscribe_token(user_id)
        unsubscribe_url = f"{base}/v1/notifications/unsubscribe?token={token}"

        digest_trips: list[DigestTrip] = [
            {
                "name": trip_names.get(row.trip_id, "Your trip"),
                "old_price": row.old_price,
                "new_price": row.new_price,
                "threshold_value": row.threshold_value,
                "threshold_label": _THRESHOLD_LABELS.get(row.threshold_type, "Trip total"),
                "trip_url": f"{base}/trips/{row.trip_id}",
            }
            for row in rows
        ]

        subject, html = render_daily_digest(
            trips=digest_trips,
            app_url=base or "#",
            unsubscribe_url=unsubscribe_url,
            physical_address=settings.email_physical_address,
        )

        try:
            await ResendClient().send(
                to=user.email,
                subject=subject,
                html=html,
                headers={
                    "List-Unsubscribe": f"<{unsubscribe_url}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
                idempotency_key=_digest_idempotency_key(user_id),
            )
        except EmailError as exc:
            logger.error("Digest send failed for user_id=%s: %s", user_id, exc)
            for row in rows:
                row.attempts += 1
                row.error = str(exc)[:500]
                session.add(row)
            await session.commit()
            return {"sent": False, "count": 0}

        for row in rows:
            row.status = NotificationStatus.SENT
            row.sent_at = now
            session.add(row)
        await session.commit()
        logger.info("Sent digest to user_id=%s covering %d trips", user_id, len(rows))
        return {"sent": True, "count": len(rows)}
