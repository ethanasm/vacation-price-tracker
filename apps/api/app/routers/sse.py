"""Server-Sent Events (SSE) endpoint for real-time price updates."""

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.deps import get_db
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.routers.auth import UserResponse, get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


async def _get_latest_snapshot_for_trip(db: AsyncSession, trip_id: uuid.UUID) -> PriceSnapshot | None:
    """Get the most recent price snapshot for a trip."""
    result = await db.execute(
        select(PriceSnapshot).where(PriceSnapshot.trip_id == trip_id).order_by(PriceSnapshot.created_at.desc()).limit(1)
    )
    return result.scalars().first()


async def _get_user_trips_with_snapshots(
    db: AsyncSession, user_id: uuid.UUID, since: datetime | None = None
) -> list[dict]:
    """Get all user trips with their latest snapshots, optionally filtered by timestamp."""
    # Get all active trips for the user
    trips_result = await db.execute(select(Trip).where(Trip.user_id == user_id).order_by(Trip.created_at.desc()))
    trips = trips_result.scalars().all()

    updates = []
    for trip in trips:
        snapshot = await _get_latest_snapshot_for_trip(db, trip.id)
        if snapshot:
            # If since is provided, only include snapshots newer than that timestamp
            if since and snapshot.created_at <= since:
                continue

            updates.append(
                {
                    "type": "price_update",
                    "trip_id": str(trip.id),
                    "trip_name": trip.name,
                    "flight_price": str(snapshot.flight_price) if snapshot.flight_price else None,
                    "hotel_price": str(snapshot.hotel_price) if snapshot.hotel_price else None,
                    "total_price": str(snapshot.total_price) if snapshot.total_price else None,
                    "updated_at": snapshot.created_at.isoformat(),
                }
            )

    return updates


def _format_sse_event(event_type: str, data: dict) -> str:
    """Format a dictionary as an SSE event string."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _get_max_timestamp(updates: list[dict], current_max: datetime | None) -> datetime | None:
    """Get the maximum timestamp from a list of updates."""
    for update in updates:
        update_time = datetime.fromisoformat(update["updated_at"])
        if current_max is None or update_time > current_max:
            current_max = update_time
    return current_max


async def event_generator(
    user_id: uuid.UUID,
    db: AsyncSession,
    heartbeat_interval: int = 30,
    poll_interval: int = 5,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for price updates.

    Args:
        user_id: The authenticated user's ID.
        db: Database session.
        heartbeat_interval: Seconds between heartbeat messages.
        poll_interval: Seconds between database polls for new data.
    """
    last_heartbeat = datetime.now(UTC)
    last_snapshot_time: datetime | None = None

    # Send initial connection event
    yield _format_sse_event("connected", {"status": "connected", "user_id": str(user_id)})

    # Send initial data snapshot
    try:
        initial_updates = await _get_user_trips_with_snapshots(db, user_id)
        for update in initial_updates:
            yield _format_sse_event("price_update", update)
        last_snapshot_time = _get_max_timestamp(initial_updates, last_snapshot_time)
    except Exception as e:
        logger.error("Error fetching initial updates: %s", e)
        yield _format_sse_event("error", {"error": "Failed to fetch initial data"})

    # Main event loop
    while True:
        try:
            now = datetime.now(UTC)

            # Check for new price updates
            new_updates = await _get_user_trips_with_snapshots(db, user_id, since=last_snapshot_time)
            for update in new_updates:
                yield _format_sse_event("price_update", update)
            last_snapshot_time = _get_max_timestamp(new_updates, last_snapshot_time)

            # Send heartbeat if needed
            if (now - last_heartbeat).total_seconds() >= heartbeat_interval:
                yield _format_sse_event("heartbeat", {"timestamp": now.isoformat()})
                last_heartbeat = now

            await asyncio.sleep(poll_interval)

        except asyncio.CancelledError:
            logger.info("SSE connection cancelled for user %s", user_id)
            break
        except Exception as e:
            logger.error("Error in SSE event loop: %s", e)
            yield f"event: error\ndata: {json.dumps({'error': 'Internal error'})}\n\n"
            break


@router.get("/v1/sse/updates")
async def stream_price_updates(
    heartbeat_interval: int = Query(default=30, ge=5, le=60),
    poll_interval: int = Query(default=5, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Stream real-time price updates via Server-Sent Events.

    This endpoint provides a persistent connection that streams price updates
    for all of the authenticated user's trips.

    Events:
    - `connected`: Sent immediately upon connection.
    - `price_update`: Sent when a trip's price snapshot is updated.
    - `heartbeat`: Sent periodically to keep the connection alive.
    - `error`: Sent when an error occurs.

    Query Parameters:
    - `heartbeat_interval`: Seconds between heartbeats (default: 30, range: 5-60).
    - `poll_interval`: Seconds between database polls (default: 5, range: 1-30).
    """
    user_id = uuid.UUID(current_user.id)

    return StreamingResponse(
        event_generator(user_id, db, heartbeat_interval, poll_interval),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/v1/sse/status")
async def get_sse_status(
    current_user: UserResponse = Depends(get_current_user),
):
    """Check SSE endpoint availability.

    Returns status information for debugging SSE connections.
    """
    return {
        "status": "available",
        "user_id": current_user.id,
        "endpoints": {
            "updates": "/v1/sse/updates",
        },
    }
