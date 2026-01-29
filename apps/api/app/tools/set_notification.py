"""MCP tool for setting notification thresholds."""

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ThresholdType
from app.models.notification_rule import NotificationRule
from app.models.trip import Trip
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool


class SetNotificationTool(BaseTool):
    """Set or update the price alert threshold for a trip.

    You will be notified when the price drops below this threshold.
    """

    name = "set_notification"
    description = (
        "Set or update the price alert threshold for a trip. "
        "You will be notified when the price drops below this threshold."
    )

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Set notification threshold for a trip.

        Args:
            args: Tool arguments:
                - trip_id: UUID of the trip (required)
                - threshold_value: Price threshold in dollars (required)
                - threshold_type: What to compare - 'trip_total', 'flight_total',
                  or 'hotel_total' (optional, default 'trip_total')
            user_id: UUID string of the authenticated user.
            db: Database session.

        Returns:
            ToolResult with confirmation or error.
        """
        trip_id_str = args.get("trip_id")
        if not trip_id_str:
            return self.error("trip_id is required")

        threshold_value = args.get("threshold_value")
        if threshold_value is None:
            return self.error("threshold_value is required")

        try:
            trip_id = uuid.UUID(str(trip_id_str))
        except ValueError:
            return self.error(f"Invalid trip_id format: {trip_id_str}")

        try:
            threshold_decimal = Decimal(str(threshold_value))
            if threshold_decimal < 0:
                return self.error("threshold_value must be non-negative")
        except InvalidOperation:
            return self.error(f"Invalid threshold_value: {threshold_value}")

        user_uuid = uuid.UUID(user_id)

        # Verify trip ownership
        result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_uuid))
        trip = result.scalars().first()
        if not trip:
            return self.error("Trip not found")

        # Parse threshold type
        threshold_type_str = args.get("threshold_type", "trip_total")
        try:
            threshold_type = ThresholdType(str(threshold_type_str).lower())
        except ValueError:
            threshold_type = ThresholdType.TRIP_TOTAL

        # Get or create notification rule
        rule_result = await db.execute(select(NotificationRule).where(NotificationRule.trip_id == trip_id))
        notification_rule = rule_result.scalars().first()

        if notification_rule:
            # Update existing rule
            notification_rule.threshold_type = threshold_type
            notification_rule.threshold_value = threshold_decimal
        else:
            # Create new rule
            notification_rule = NotificationRule(
                trip_id=trip_id,
                threshold_type=threshold_type,
                threshold_value=threshold_decimal,
            )
            db.add(notification_rule)

        await db.commit()

        type_label = threshold_type.value.replace("_", " ")
        return self.success(
            {
                "message": f"Alert set: Notify when {type_label} drops below ${threshold_decimal}",
                "trip_id": str(trip_id),
                "trip_name": trip.name,
                "threshold_type": threshold_type.value,
                "threshold_value": float(threshold_decimal),
            }
        )
