"""MCP tool for deleting a trip."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool


class DeleteTripTool(BaseTool):
    """Delete a vacation price tracking trip.

    This tool permanently deletes a trip and all associated data including:
    - Price snapshots (price history)
    - Notification rules
    - Flight and hotel preferences

    The deletion is cascaded automatically by the database.
    """

    name = "delete_trip"
    description = (
        "Permanently delete a vacation price tracking trip and all its associated data. "
        "This action cannot be undone. "
        "All price history, notification settings, and preferences will be deleted."
    )

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Delete a trip for the user.

        Args:
            args: Tool arguments:
                - trip_id: UUID of the trip to delete (required)
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

        # Get trip with user ownership check
        result = await db.execute(
            select(Trip).where(Trip.id == trip_id, Trip.user_id == user_uuid)
        )
        trip = result.scalars().first()
        if not trip:
            return self.error("Trip not found")

        # Store trip name before deletion for confirmation message
        trip_name = trip.name

        # Delete trip (cascade will handle related records)
        await db.delete(trip)
        await db.commit()

        return self.success(
            {
                "message": f"Deleted trip '{trip_name}'",
                "trip_id": str(trip_id),
                "deleted_trip_name": trip_name,
            }
        )
