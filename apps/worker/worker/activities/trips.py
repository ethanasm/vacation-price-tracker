import logging
import uuid
from datetime import UTC, date, datetime

from app.core.cache_keys import CacheKeys
from app.core.constants import TripStatus
from app.core.telemetry import langfuse_context, observe
from app.db.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.models.trip import Trip
from sqlalchemy import func, update
from sqlmodel import select
from temporalio import activity

logger = logging.getLogger(__name__)

# Statuses that should no longer be refreshed by scheduled/manual runs.
INACTIVE_STATUSES = (TripStatus.PAUSED, TripStatus.EXPIRED)


def is_trip_past(depart_date: date, return_date: date | None, today: date) -> bool:
    """Return True when a trip's travel dates have already passed.

    A trip's effective end is its return date (round trips) or its departure
    date (one-way trips). It is considered past once that day is strictly
    before ``today``.
    """
    effective_end = return_date if return_date is not None else depart_date
    return effective_end < today


@activity.defn
async def expire_past_trips() -> int:
    """Mark active/error trips whose travel dates have passed as EXPIRED.

    Returns the number of trips transitioned. Paused trips are left untouched so
    a user's explicit pause is preserved.
    """
    today = datetime.now(UTC).date()
    # Effective end date: return_date for round trips, else depart_date.
    effective_end = func.coalesce(Trip.return_date, Trip.depart_date)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            update(Trip)
            .where(
                Trip.status.in_([TripStatus.ACTIVE, TripStatus.ERROR]),
                effective_end < today,
            )
            .values(status=TripStatus.EXPIRED)
        )
        await session.commit()
        count = result.rowcount or 0
        logger.info(
            "Marked %d past trips as expired",
            count,
            extra={"event": "trip.expire.ok", "count": count},
        )
        return count


@activity.defn
async def get_active_trips(user_id: str) -> list[str]:
    logger.info(
        "Fetching active trips for user_id=%s",
        user_id,
        extra={"event": "trips.active.start", "user_id": user_id},
    )
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Trip.id).where(
                Trip.user_id == uuid.UUID(user_id),
                Trip.status.notin_(INACTIVE_STATUSES),
            )
        )
        trip_ids = [str(trip_id) for trip_id in result.scalars().all()]
        logger.info(
            "Found %d active trips for user_id=%s",
            len(trip_ids),
            user_id,
            extra={"event": "trips.active.ok", "user_id": user_id, "count": len(trip_ids)},
        )
        return trip_ids


@activity.defn
@observe(name="worker.get_all_user_ids_with_active_trips")
async def get_all_user_ids_with_active_trips() -> list[str]:
    try:
        workflow_id = activity.info().workflow_id
    except Exception:
        workflow_id = None
    langfuse_context.update_current_trace(
        name="scheduled_refresh_all_users",
        tags=["worker", "scheduled_refresh"],
        session_id=workflow_id,
        metadata={"workflow_id": workflow_id},
    )
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Trip.user_id).where(Trip.status.notin_(INACTIVE_STATUSES)).distinct()
        )
        user_ids = [str(user_id) for user_id in result.scalars().all()]
        logger.info(
            "Found %d users with active trips for scheduled refresh",
            len(user_ids),
            extra={"event": "trips.users.ok", "count": len(user_ids)},
        )
    langfuse_context.update_current_observation(
        output={"user_count": len(user_ids)},
    )
    return user_ids


@activity.defn
async def clear_refresh_lock(user_id: str) -> bool:
    """Clear the refresh lock for a user after workflow completion."""
    lock_key = CacheKeys.refresh_lock(user_id)
    deleted = await redis_client.delete(lock_key)
    if deleted:
        logger.info(
            "Cleared refresh lock for user_id=%s",
            user_id,
            extra={"event": "refresh.lock.cleared", "user_id": user_id},
        )
    else:
        logger.debug(
            "No refresh lock to clear for user_id=%s",
            user_id,
            extra={"event": "refresh.lock.absent", "user_id": user_id},
        )
    return deleted > 0
