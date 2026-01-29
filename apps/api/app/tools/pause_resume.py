"""MCP tools for pausing and resuming trip tracking."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import TripStatus
from app.models.trip import Trip
from app.schemas.mcp import ToolResult
from app.services.temporal import trigger_price_check_workflow
from app.tools.base import BaseTool


class PauseTripTool(BaseTool):
    """Pause price tracking for a trip.

    The trip will not be refreshed until resumed.
    """

    name = "pause_trip"
    description = "Pause price tracking for a trip. The trip will not be refreshed until resumed."

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Pause tracking for a trip.

        Args:
            args: Tool arguments:
                - trip_id: UUID of the trip to pause (required)
            user_id: UUID string of the authenticated user.
            db: Database session.

        Returns:
            ToolResult with confirmation or error.
        """
        trip_id_str = args.get("trip_id")
        if not trip_id_str:
            return self.error("trip_id is required")

        try:
            trip_id = uuid.UUID(str(trip_id_str))
        except ValueError:
            return self.error(f"Invalid trip_id format: {trip_id_str}")

        user_uuid = uuid.UUID(user_id)

        # Get and update trip
        result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_uuid))
        trip = result.scalars().first()
        if not trip:
            return self.error("Trip not found")

        if trip.status == TripStatus.PAUSED:
            return self.success(
                {
                    "message": f"Trip '{trip.name}' is already paused",
                    "trip_id": str(trip.id),
                    "status": TripStatus.PAUSED.value,
                }
            )

        trip.status = TripStatus.PAUSED
        db.add(trip)
        await db.commit()

        return self.success(
            {
                "message": f"Paused tracking for '{trip.name}'",
                "trip_id": str(trip.id),
                "status": TripStatus.PAUSED.value,
            }
        )


class ResumeTripTool(BaseTool):
    """Resume price tracking for a paused trip.

    This will also trigger an immediate price refresh.
    """

    name = "resume_trip"
    description = "Resume price tracking for a paused trip. This will also trigger an immediate price refresh."

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Resume tracking for a paused trip.

        Args:
            args: Tool arguments:
                - trip_id: UUID of the trip to resume (required)
            user_id: UUID string of the authenticated user.
            db: Database session.

        Returns:
            ToolResult with confirmation or error.
        """
        trip_id_str = args.get("trip_id")
        if not trip_id_str:
            return self.error("trip_id is required")

        try:
            trip_id = uuid.UUID(str(trip_id_str))
        except ValueError:
            return self.error(f"Invalid trip_id format: {trip_id_str}")

        user_uuid = uuid.UUID(user_id)

        # Get and update trip
        result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_uuid))
        trip = result.scalars().first()
        if not trip:
            return self.error("Trip not found")

        if trip.status == TripStatus.ACTIVE:
            return self.success(
                {
                    "message": f"Trip '{trip.name}' is already active",
                    "trip_id": str(trip.id),
                    "status": TripStatus.ACTIVE.value,
                }
            )

        trip.status = TripStatus.ACTIVE
        db.add(trip)
        await db.commit()

        # Trigger immediate price check
        workflow_started = True
        try:
            await trigger_price_check_workflow(trip.id)
        except Exception:
            workflow_started = False

        message = f"Resumed tracking for '{trip.name}'"
        if workflow_started:
            message += ". Fetching latest prices..."
        else:
            message += ", but price refresh failed to start."

        return self.success(
            {
                "message": message,
                "trip_id": str(trip.id),
                "status": TripStatus.ACTIVE.value,
            }
        )
