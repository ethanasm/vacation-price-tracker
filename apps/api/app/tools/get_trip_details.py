"""MCP tool for getting trip details."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_rule import NotificationRule
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool


class GetTripDetailsTool(BaseTool):
    """Get detailed information about a specific trip.

    Returns flight preferences, hotel preferences, notification settings,
    and price history.
    """

    name = "get_trip_details"
    description = (
        "Get detailed information about a specific trip including flight preferences, "
        "hotel preferences, notification settings, and price history."
    )

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Get detailed trip information.

        Args:
            args: Tool arguments:
                - trip_id: UUID of the trip (required)
            user_id: UUID string of the authenticated user.
            db: Database session.

        Returns:
            ToolResult with trip details or error if not found.
        """
        trip_id_str = args.get("trip_id")
        if not trip_id_str:
            return self.error("trip_id is required")

        try:
            trip_id = uuid.UUID(str(trip_id_str))
        except ValueError:
            return self.error(f"Invalid trip_id format: {trip_id_str}")

        user_uuid = uuid.UUID(user_id)

        # Get trip
        result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_uuid))
        trip = result.scalars().first()
        if not trip:
            return self.error("Trip not found")

        # Get preferences
        flight_prefs = (
            (await db.execute(select(TripFlightPrefs).where(TripFlightPrefs.trip_id == trip_id))).scalars().first()
        )

        hotel_prefs = (
            (await db.execute(select(TripHotelPrefs).where(TripHotelPrefs.trip_id == trip_id))).scalars().first()
        )

        notification_rule = (
            (await db.execute(select(NotificationRule).where(NotificationRule.trip_id == trip_id))).scalars().first()
        )

        # Get recent price snapshots (last 10)
        snapshots = (
            (
                await db.execute(
                    select(PriceSnapshot)
                    .where(PriceSnapshot.trip_id == trip_id)
                    .order_by(PriceSnapshot.created_at.desc())
                    .limit(10)
                )
            )
            .scalars()
            .all()
        )

        # Build response
        data: dict[str, Any] = {
            "id": str(trip.id),
            "name": trip.name,
            "origin": trip.origin_airport,
            "destination": trip.destination_code,
            "dates": {
                "depart": str(trip.depart_date),
                "return": str(trip.return_date),
            },
            "adults": trip.adults,
            "is_round_trip": trip.is_round_trip,
            "status": trip.status.value,
        }

        # Add flight prefs
        if flight_prefs:
            data["flight_prefs"] = {
                "airlines": flight_prefs.airlines,
                "stops_mode": flight_prefs.stops_mode.value,
                "max_stops": flight_prefs.max_stops,
                "cabin": flight_prefs.cabin.value,
            }

        # Add hotel prefs
        if hotel_prefs:
            data["hotel_prefs"] = {
                "rooms": hotel_prefs.rooms,
                "adults_per_room": hotel_prefs.adults_per_room,
                "room_selection_mode": hotel_prefs.room_selection_mode.value,
                "preferred_room_types": hotel_prefs.preferred_room_types,
                "preferred_views": hotel_prefs.preferred_views,
            }

        # Add notification settings
        if notification_rule:
            data["notification"] = {
                "threshold_type": notification_rule.threshold_type.value,
                "threshold_value": float(notification_rule.threshold_value),
                "notify_without_threshold": notification_rule.notify_without_threshold,
                "email_enabled": notification_rule.email_enabled,
                "sms_enabled": notification_rule.sms_enabled,
            }

        # Add price history
        data["price_history"] = [
            {
                "date": str(s.created_at),
                "flight": float(s.flight_price) if s.flight_price else None,
                "hotel": float(s.hotel_price) if s.hotel_price else None,
                "total": float(s.total_price) if s.total_price else None,
            }
            for s in snapshots
        ]

        return self.success(data)
