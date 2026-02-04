"""MCP tool for creating a new trip."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import CabinClass, StopsMode, ThresholdType
from app.models.notification_rule import NotificationRule
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from app.schemas.mcp import ToolResult
from app.schemas.trip import TripCreate
from app.tools.base import BaseTool


class CreateTripTool(BaseTool):
    """Create a new vacation price tracking trip.

    This tool creates a new trip with the specified flight/hotel preferences
    and notification settings. It also triggers an initial price check workflow.

    When required fields are missing, the tool returns an elicitation request
    instead of failing, allowing the frontend to collect the missing data
    via a form UI.
    """

    name = "create_trip"
    description = (
        "Create a new vacation price tracking trip. "
        "Sets up monitoring for flights and hotels between the specified locations and dates. "
        "New trips are created with 'active' status by default. "
        "After creating a trip, call refresh_trip_prices with the returned trip_id to fetch initial prices."
    )

    # Required fields for trip creation
    # These must be provided either in the initial request or via elicitation
    REQUIRED_FIELDS = ["name", "origin_airport", "destination_code", "depart_date", "return_date"]

    # Component name for the frontend to render when elicitation is needed
    ELICITATION_COMPONENT = "create-trip-form"

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Create a new trip for the user.

        If required fields are missing, returns an elicitation request
        that signals the frontend to collect the missing data via a form.
        """
        # Check for missing required fields before any database operations
        elicitation_result = self._check_elicitation_needed(args)
        if elicitation_result:
            return elicitation_result

        user_uuid = uuid.UUID(user_id)

        # Pre-validation checks
        validation_error = await self._validate_trip_creation(args, user_uuid, db)
        if validation_error:
            return validation_error

        # Parse and validate trip data
        trip_create_result = self._build_trip_create(args)
        if isinstance(trip_create_result, ToolResult):
            return trip_create_result
        trip_create = trip_create_result

        # Persist trip and related data
        trip = await self._persist_trip(trip_create, user_uuid, db)
        if isinstance(trip, ToolResult):
            return trip

        # Build success response (do NOT trigger refresh here - LLM should call trigger_refresh_trip separately)
        return self._build_success_response(trip)

    def _build_success_response(self, trip: Trip) -> ToolResult:
        """Build success response after trip creation."""
        return self.success(
            {
                "trip_id": str(trip.id),
                "name": trip.name,
                "origin": trip.origin_airport,
                "destination": trip.destination_code,
                "dates": f"{trip.depart_date} to {trip.return_date}",
                "message": f"Created trip '{trip.name}'. Call refresh_trip_prices to fetch initial prices.",
            }
        )

    def _check_elicitation_needed(self, args: dict[str, Any]) -> ToolResult | None:
        """Check if required fields are missing and return elicitation request if so.

        This method enables conversational trip creation where users can say
        "create a trip to Seattle" and be guided through a form to complete
        missing details.

        Args:
            args: Dictionary of arguments provided by the LLM.

        Returns:
            ToolResult with elicitation request if fields are missing,
            None if all required fields are present.
        """
        # Identify missing required fields
        missing_fields = [
            field for field in self.REQUIRED_FIELDS
            if not args.get(field) or (isinstance(args.get(field), str) and not args.get(field).strip())
        ]

        if not missing_fields:
            return None

        # Build prefilled data from provided arguments
        # Include all provided args, not just the required ones, to preserve optional prefs
        prefilled = {
            key: value for key, value in args.items()
            if value is not None and (not isinstance(value, str) or value.strip())
        }

        return self.success(
            {
                "needs_elicitation": True,
                "component": self.ELICITATION_COMPONENT,
                "prefilled": prefilled,
                "missing_fields": missing_fields,
            }
        )

    async def _validate_trip_creation(
        self, args: dict[str, Any], user_uuid: uuid.UUID, db: AsyncSession
    ) -> ToolResult | None:
        """Validate trip creation constraints. Returns error ToolResult or None if valid."""
        # Check trip limit
        count_stmt = select(func.count()).select_from(Trip).where(Trip.user_id == user_uuid)
        trip_count = (await db.execute(count_stmt)).scalar_one()
        if trip_count >= settings.max_trips_per_user:
            return self.error(f"Trip limit reached ({settings.max_trips_per_user})")

        # Check for duplicate name
        existing = await db.execute(select(Trip.id).where(Trip.user_id == user_uuid, Trip.name == args.get("name")))
        if existing.first():
            return self.error(f"A trip named '{args.get('name')}' already exists")

        return None

    def _build_trip_create(self, args: dict[str, Any]) -> TripCreate | ToolResult:
        """Build and validate TripCreate from args. Returns TripCreate or error ToolResult."""
        # Parse dates
        try:
            depart_date = self._parse_date(args.get("depart_date"))
            return_date = self._parse_date(args.get("return_date"))
        except ValueError as e:
            return self.error(str(e))

        # Validate via Pydantic schema
        try:
            return TripCreate(
                name=args.get("name", ""),
                origin_airport=args.get("origin_airport", "").upper(),
                destination_code=args.get("destination_code", "").upper(),
                depart_date=depart_date,
                return_date=return_date,
                adults=args.get("adults", 1),
                is_round_trip=args.get("is_round_trip", True),
                flight_prefs=self._build_flight_prefs(args),
                hotel_prefs=self._build_hotel_prefs(args),
                notification_prefs=self._build_notification_prefs(args),
            )
        except ValidationError as e:
            errors = e.errors()
            if errors:
                first_error = errors[0]
                field = ".".join(str(loc) for loc in first_error.get("loc", []))
                msg = first_error.get("msg", "Validation error")
                return self.error(f"Invalid {field}: {msg}")
            return self.error("Validation error")

    async def _persist_trip(self, trip_create: TripCreate, user_uuid: uuid.UUID, db: AsyncSession) -> Trip | ToolResult:
        """Create and persist trip to database. Returns Trip or error ToolResult."""
        trip = Trip(
            user_id=user_uuid,
            name=trip_create.name,
            origin_airport=trip_create.origin_airport,
            destination_code=trip_create.destination_code,
            is_round_trip=trip_create.is_round_trip,
            depart_date=trip_create.depart_date,
            return_date=trip_create.return_date,
            adults=trip_create.adults,
        )
        db.add(trip)
        await db.flush()

        if trip_create.flight_prefs:
            db.add(TripFlightPrefs(trip_id=trip.id, **trip_create.flight_prefs.model_dump()))

        if trip_create.hotel_prefs:
            db.add(TripHotelPrefs(trip_id=trip.id, **trip_create.hotel_prefs.model_dump()))

        db.add(NotificationRule(trip_id=trip.id, **trip_create.notification_prefs.model_dump()))

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            return self.error("Trip could not be created due to a conflict")

        await db.refresh(trip)
        return trip

    def _parse_date(self, date_str: Any) -> date:
        """Parse a date string into a date object."""
        if isinstance(date_str, date):
            return date_str
        if not date_str:
            raise ValueError("Date is required")
        try:
            return date.fromisoformat(str(date_str))
        except ValueError as exc:
            raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD") from exc

    def _build_flight_prefs(self, args: dict[str, Any]) -> dict[str, Any] | None:
        """Build flight preferences dict from args."""
        prefs: dict[str, Any] = {}

        if "airlines" in args and args["airlines"]:
            prefs["airlines"] = [code.upper() for code in args["airlines"]]

        if "cabin" in args and args["cabin"]:
            cabin_str = str(args["cabin"]).lower()
            try:
                prefs["cabin"] = CabinClass(cabin_str)
            except ValueError:
                prefs["cabin"] = CabinClass.ECONOMY

        if "stops_mode" in args and args["stops_mode"]:
            stops_str = str(args["stops_mode"]).lower()
            try:
                prefs["stops_mode"] = StopsMode(stops_str)
            except ValueError:
                prefs["stops_mode"] = StopsMode.ANY

        return prefs if prefs else None

    def _build_hotel_prefs(self, args: dict[str, Any]) -> dict[str, Any] | None:
        """Build hotel preferences dict from args."""
        prefs: dict[str, Any] = {}

        if "hotel_rooms" in args and args["hotel_rooms"]:
            prefs["rooms"] = int(args["hotel_rooms"])

        if "room_types" in args and args["room_types"]:
            prefs["preferred_room_types"] = args["room_types"]

        if "views" in args and args["views"]:
            prefs["preferred_views"] = args["views"]

        return prefs if prefs else None

    def _build_notification_prefs(self, args: dict[str, Any]) -> dict[str, Any]:
        """Build notification preferences dict from args."""
        prefs: dict[str, Any] = {}

        threshold = args.get("notification_threshold")
        prefs["threshold_value"] = Decimal(str(threshold)) if threshold is not None else Decimal("0")

        if "threshold_type" in args and args["threshold_type"]:
            type_str = str(args["threshold_type"]).lower()
            try:
                prefs["threshold_type"] = ThresholdType(type_str)
            except ValueError:
                prefs["threshold_type"] = ThresholdType.TRIP_TOTAL

        return prefs
