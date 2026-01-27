import logging
import uuid

from app.core.cache_keys import CacheKeys
from app.core.constants import TripStatus
from app.db.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.models.trip import Trip
from sqlmodel import select
from temporalio import activity

logger = logging.getLogger(__name__)


@activity.defn
async def get_active_trips(user_id: str) -> list[str]:
    logger.info("Fetching active trips for user_id=%s", user_id)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Trip.id).where(
                Trip.user_id == uuid.UUID(user_id),
                Trip.status != TripStatus.PAUSED,
            )
        )
        trip_ids = [str(trip_id) for trip_id in result.scalars().all()]
        logger.info("Found %d active trips for user_id=%s", len(trip_ids), user_id)
        return trip_ids


@activity.defn
async def clear_refresh_lock(user_id: str) -> bool:
    """Clear the refresh lock for a user after workflow completion."""
    lock_key = CacheKeys.refresh_lock(user_id)
    deleted = await redis_client.delete(lock_key)
    if deleted:
        logger.info("Cleared refresh lock for user_id=%s", user_id)
    else:
        logger.debug("No refresh lock to clear for user_id=%s", user_id)
    return deleted > 0
