"""MCP tools for triggering price refresh."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.constants import TripStatus
from app.db.redis import redis_client
from app.models.trip import Trip
from app.schemas.mcp import ToolResult
from app.services.temporal import start_refresh_all_workflow, trigger_price_check_workflow
from app.tools.base import BaseTool


class RefreshAllTripPricesTool(BaseTool):
    """Trigger an immediate price refresh for all active trips.

    This will fetch the latest flight and hotel prices.
    """

    name = "refresh_all_trip_prices"
    description = (
        "Trigger an immediate price refresh for ALL active trips. "
        "Use this when the user wants to update prices or refresh their trips. "
        "This fetches the latest flight and hotel prices for every active trip."
    )

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Trigger refresh workflow for all active trips.

        Args:
            args: No required arguments.
            user_id: UUID string of the authenticated user.
            db: Database session (not used but required by interface).

        Returns:
            ToolResult with workflow ID or error if refresh is in progress.
        """
        user_uuid = uuid.UUID(user_id)
        lock_key = CacheKeys.refresh_lock(user_id)

        # Check for existing refresh in progress
        lock_set = await redis_client.set(
            lock_key,
            f"refresh-{user_id}-{datetime.now().isoformat()}",
            ex=CacheTTL.REFRESH_LOCK,
            nx=True,
        )

        if not lock_set:
            existing = await redis_client.get(lock_key)
            if isinstance(existing, (bytes, bytearray)):
                existing = existing.decode("utf-8")
            return self.error(f"A refresh is already in progress. Please wait. (ID: {existing})")

        # Generate workflow ID
        workflow_id = f"refresh-{user_id}-{datetime.now().isoformat()}"

        try:
            await start_refresh_all_workflow(user_uuid, workflow_id)
        except Exception as exc:
            # Release lock on failure
            await redis_client.delete(lock_key)
            return self.error(f"Failed to start refresh workflow: {str(exc)}")

        return self.success(
            {
                "message": "Refreshing prices for all active trips...",
                "workflow_id": workflow_id,
            }
        )


class RefreshTripPricesTool(BaseTool):
    """Trigger an immediate price refresh for a specific trip.

    This will fetch the latest flight and hotel prices for the specified trip.
    """

    name = "refresh_trip_prices"
    description = (
        "Trigger an immediate price refresh for a SPECIFIC trip. "
        "Use this when the user wants to update prices for just one trip. "
        "Requires a trip_id parameter. The trip must be active (not paused)."
    )

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Trigger refresh workflow for a specific trip.

        Args:
            args: Tool arguments:
                - trip_id: UUID of the trip to refresh (required)
            user_id: UUID string of the authenticated user.
            db: Database session.

        Returns:
            ToolResult with workflow status or error.
        """
        trip_id_str = args.get("trip_id")
        if not trip_id_str:
            return self.error("trip_id is required")

        try:
            trip_id = uuid.UUID(str(trip_id_str))
        except ValueError:
            return self.error(f"Invalid trip_id format: {trip_id_str}")

        user_uuid = uuid.UUID(user_id)

        # Get trip and validate ownership
        result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_uuid))
        trip = result.scalars().first()

        if not trip:
            return self.error("Trip not found")

        # Check if trip is paused
        if trip.status == TripStatus.PAUSED:
            return self.error(
                f"Trip '{trip.name}' is paused. Please resume the trip first before refreshing prices."
            )

        # Check for existing refresh in progress using per-trip lock
        lock_key = CacheKeys.trip_refresh_lock(str(trip_id))
        lock_set = await redis_client.set(
            lock_key,
            f"refresh-{trip_id}-{datetime.now().isoformat()}",
            ex=CacheTTL.REFRESH_LOCK,
            nx=True,
        )

        if not lock_set:
            existing = await redis_client.get(lock_key)
            if isinstance(existing, (bytes, bytearray)):
                existing = existing.decode("utf-8")
            return self.error(
                f"A refresh for trip '{trip.name}' is already in progress. Please wait. (ID: {existing})"
            )

        # Trigger price check workflow
        try:
            await trigger_price_check_workflow(trip_id)
        except Exception as exc:
            # Release lock on failure
            await redis_client.delete(lock_key)
            return self.error(f"Failed to start refresh workflow: {str(exc)}")

        return self.success(
            {
                "message": f"Refreshing prices for '{trip.name}'...",
                "trip_id": str(trip.id),
                "trip_name": trip.name,
            }
        )
