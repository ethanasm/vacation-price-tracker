"""MCP tool for listing user trips."""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool


class ListTripsTool(BaseTool):
    """List all vacation trips being tracked for the current user.

    Returns trip names, routes, dates, status, and current prices.
    """

    name = "list_trips"
    description = (
        "List all vacation trips being tracked for the current user. "
        "Returns trip names, routes, dates, status, and current prices."
    )

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """List trips for the authenticated user.

        Args:
            args: No required arguments. Optional:
                - status: Filter by status ('active', 'paused', 'error')
            user_id: UUID string of the authenticated user.
            db: Database session.

        Returns:
            ToolResult with list of trips and count.
        """
        user_uuid = uuid.UUID(user_id)

        # Subquery for latest snapshot per trip
        latest_snapshot_at = (
            select(
                PriceSnapshot.trip_id,
                func.max(PriceSnapshot.created_at).label("latest_created_at"),
            )
            .group_by(PriceSnapshot.trip_id)
            .subquery()
        )
        latest_snapshot = aliased(PriceSnapshot)

        # Query trips with latest snapshot
        stmt = (
            select(Trip, latest_snapshot)
            .outerjoin(latest_snapshot_at, latest_snapshot_at.c.trip_id == Trip.id)
            .outerjoin(
                latest_snapshot,
                (latest_snapshot.trip_id == Trip.id)
                & (latest_snapshot.created_at == latest_snapshot_at.c.latest_created_at),
            )
            .where(Trip.user_id == user_uuid)
            .order_by(Trip.created_at.desc())
        )

        # Optional status filter
        status_filter = args.get("status")
        if status_filter:
            stmt = stmt.where(Trip.status == status_filter)

        rows = (await db.execute(stmt)).all()

        trips = []
        for trip, snapshot in rows:
            trip_data = {
                "id": str(trip.id),
                "name": trip.name,
                "route": f"{trip.origin_airport} → {trip.destination_code}",
                "dates": f"{trip.depart_date} - {trip.return_date}",
                "status": trip.status.value,
                "current_price": None,
            }

            if snapshot and snapshot.total_price is not None:
                trip_data["current_price"] = float(snapshot.total_price)

            trips.append(trip_data)

        return self.success(
            {
                "trips": trips,
                "count": len(trips),
            }
        )
