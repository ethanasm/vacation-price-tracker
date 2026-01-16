import logging
import uuid

from app.core.constants import TripStatus
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
