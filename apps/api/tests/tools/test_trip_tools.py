"""Tests for trip management MCP tools."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from app.core.config import settings
from app.core.constants import CabinClass, StopsMode, ThresholdType, TripStatus
from app.models.notification_rule import NotificationRule
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from app.models.user import User
from app.tools import (
    BaseTool,
    CreateTripTool,
    DeleteTripTool,
    GetTripDetailsTool,
    ListTripsTool,
    PauseTripTool,
    ResumeTripTool,
    SetNotificationTool,
    TriggerRefreshTool,
    TriggerRefreshTripTool,
    get_all_trip_tools,
    get_trip_tool,
)

from tests.test_models import set_test_timestamps

# =============================================================================
# Test Fixtures
# =============================================================================


async def create_test_user(test_session, email: str = "test@example.com") -> User:
    """Create a test user."""
    user = User(google_sub=str(uuid.uuid4()), email=email)
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


async def create_test_trip(
    test_session,
    user_id: uuid.UUID,
    name: str = "Test Trip",
    status: TripStatus = TripStatus.ACTIVE,
) -> Trip:
    """Create a test trip."""
    trip = Trip(
        user_id=user_id,
        name=name,
        origin_airport="SFO",
        destination_code="HNL",
        depart_date=date.today() + timedelta(days=30),
        return_date=date.today() + timedelta(days=37),
        adults=2,
        status=status,
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)
    return trip


def valid_trip_args() -> dict:
    """Return valid arguments for creating a trip."""
    return {
        "name": "Hawaii Vacation",
        "origin_airport": "SFO",
        "destination_code": "HNL",
        "depart_date": (date.today() + timedelta(days=30)).isoformat(),
        "return_date": (date.today() + timedelta(days=37)).isoformat(),
        "adults": 2,
        "notification_threshold": 2000.00,
    }


# =============================================================================
# Module-Level Tests
# =============================================================================


def test_get_trip_tool_returns_tool():
    """Test get_trip_tool returns correct tool class."""
    assert get_trip_tool("create_trip") is CreateTripTool
    assert get_trip_tool("delete_trip") is DeleteTripTool
    assert get_trip_tool("list_trips") is ListTripsTool
    assert get_trip_tool("get_trip_details") is GetTripDetailsTool
    assert get_trip_tool("set_notification") is SetNotificationTool
    assert get_trip_tool("pause_trip") is PauseTripTool
    assert get_trip_tool("resume_trip") is ResumeTripTool
    assert get_trip_tool("trigger_refresh") is TriggerRefreshTool
    assert get_trip_tool("trigger_refresh_trip") is TriggerRefreshTripTool


def test_get_trip_tool_returns_none_for_unknown():
    """Test get_trip_tool returns None for unknown tool."""
    assert get_trip_tool("unknown_tool") is None


def test_get_all_trip_tools():
    """Test get_all_trip_tools returns all tools."""
    tools = get_all_trip_tools()
    assert len(tools) == 9
    assert "create_trip" in tools
    assert "delete_trip" in tools
    assert "list_trips" in tools
    assert "trigger_refresh_trip" in tools


# =============================================================================
# BaseTool Tests
# =============================================================================


def test_base_tool_success_helper():
    """Test BaseTool success helper method."""

    class TestTool(BaseTool):
        name = "test"
        description = "Test tool"

        async def execute(self, args, user_id, db):
            return self.success({"key": "value"})

    tool = TestTool()
    result = tool.success({"key": "value"})
    assert result.success is True
    assert result.data == {"key": "value"}
    assert result.error is None


def test_base_tool_error_helper():
    """Test BaseTool error helper method."""

    class TestTool(BaseTool):
        name = "test"
        description = "Test tool"

        async def execute(self, args, user_id, db):
            return self.error("Something went wrong")

    tool = TestTool()
    result = tool.error("Something went wrong")
    assert result.success is False
    assert result.error == "Something went wrong"
    assert result.data is None


# =============================================================================
# CreateTripTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_create_trip_success(test_session):
    """Test successful trip creation."""
    user = await create_test_user(test_session, "create@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert "trip_id" in result.data
    assert result.data["name"] == "Hawaii Vacation"
    assert "Created trip" in result.data["message"]
    assert "trigger_refresh_trip" in result.data["message"]


@pytest.mark.asyncio
async def test_create_trip_with_flight_prefs(test_session):
    """Test trip creation with flight preferences."""
    user = await create_test_user(test_session, "flight-prefs@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["airlines"] = ["UA", "AA"]
    args["cabin"] = "business"
    args["stops_mode"] = "nonstop"

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True


@pytest.mark.asyncio
async def test_create_trip_with_hotel_prefs(test_session):
    """Test trip creation with hotel preferences."""
    user = await create_test_user(test_session, "hotel-prefs@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["hotel_rooms"] = 2
    args["room_types"] = ["King", "Suite"]
    args["views"] = ["Ocean"]

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True


@pytest.mark.asyncio
async def test_create_trip_with_invalid_cabin(test_session):
    """Test trip creation with invalid cabin class defaults to economy."""
    user = await create_test_user(test_session, "invalid-cabin@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["cabin"] = "super_deluxe"  # Invalid

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True


@pytest.mark.asyncio
async def test_create_trip_with_invalid_stops_mode(test_session):
    """Test trip creation with invalid stops mode defaults to any."""
    user = await create_test_user(test_session, "invalid-stops@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["stops_mode"] = "invalid"

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True


@pytest.mark.asyncio
async def test_create_trip_with_invalid_threshold_type(test_session):
    """Test trip creation with invalid threshold type defaults to trip_total."""
    user = await create_test_user(test_session, "invalid-threshold@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["threshold_type"] = "invalid_type"

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True


@pytest.mark.asyncio
async def test_create_trip_limit_exceeded(test_session, monkeypatch):
    """Test trip creation fails when limit exceeded."""
    user = await create_test_user(test_session, "limit@example.com")
    tool = CreateTripTool()

    monkeypatch.setattr(settings, "max_trips_per_user", 1)

    # Create first trip
    args = valid_trip_args()
    await tool.execute(args, str(user.id), test_session)

    # Try to create second trip
    args["name"] = "Second Trip"
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is False
    assert "Trip limit reached" in result.error


@pytest.mark.asyncio
async def test_create_trip_duplicate_name(test_session):
    """Test trip creation fails with duplicate name."""
    user = await create_test_user(test_session, "duplicate@example.com")
    tool = CreateTripTool()

    # Create first trip
    args = valid_trip_args()
    await tool.execute(args, str(user.id), test_session)

    # Try to create duplicate
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is False
    assert "already exists" in result.error


@pytest.mark.asyncio
async def test_create_trip_invalid_date(test_session):
    """Test trip creation fails with invalid date format."""
    user = await create_test_user(test_session, "invalid-date@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["depart_date"] = "not-a-date"

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is False
    assert "Invalid date format" in result.error


@pytest.mark.asyncio
async def test_create_trip_missing_date(test_session):
    """Test trip creation returns elicitation request with missing date.

    With elicitation support, missing required fields trigger an elicitation
    request instead of failing directly.
    """
    user = await create_test_user(test_session, "missing-date@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    del args["depart_date"]

    result = await tool.execute(args, str(user.id), test_session)

    # Now returns elicitation request instead of error
    assert result.success is True
    assert result.data.get("needs_elicitation") is True
    assert "depart_date" in result.data.get("missing_fields", [])


@pytest.mark.asyncio
async def test_create_trip_validation_error(test_session):
    """Test trip creation fails with validation error."""
    user = await create_test_user(test_session, "validation@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["origin_airport"] = "INVALID"  # Must be 3 chars

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is False


@pytest.mark.asyncio
async def test_create_trip_date_object(test_session):
    """Test trip creation with date objects instead of strings."""
    user = await create_test_user(test_session, "date-object@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    args["depart_date"] = date.today() + timedelta(days=30)
    args["return_date"] = date.today() + timedelta(days=37)

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True


@pytest.mark.asyncio
async def test_create_trip_no_notification_threshold(test_session):
    """Test trip creation with default notification threshold."""
    user = await create_test_user(test_session, "no-threshold@example.com")
    tool = CreateTripTool()

    args = valid_trip_args()
    del args["notification_threshold"]

    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True


# =============================================================================
# ListTripsTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_list_trips_success(test_session):
    """Test listing trips successfully."""
    user = await create_test_user(test_session, "list@example.com")
    await create_test_trip(test_session, user.id, "Trip 1")
    await create_test_trip(test_session, user.id, "Trip 2")

    tool = ListTripsTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is True
    assert result.data["count"] == 2
    assert len(result.data["trips"]) == 2


@pytest.mark.asyncio
async def test_list_trips_empty(test_session):
    """Test listing trips when none exist."""
    user = await create_test_user(test_session, "empty-list@example.com")

    tool = ListTripsTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is True
    assert result.data["count"] == 0
    assert result.data["trips"] == []


@pytest.mark.asyncio
async def test_list_trips_with_price(test_session):
    """Test listing trips includes current price from snapshot."""
    user = await create_test_user(test_session, "list-price@example.com")
    trip = await create_test_trip(test_session, user.id, "Priced Trip")

    # Add snapshot
    snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("500.00"),
        hotel_price=Decimal("800.00"),
        total_price=Decimal("1300.00"),
        created_at=datetime.now(UTC),
    )
    test_session.add(snapshot)
    await test_session.commit()

    tool = ListTripsTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is True
    assert result.data["trips"][0]["current_price"] == 1300.00


@pytest.mark.asyncio
async def test_list_trips_filter_by_status(test_session):
    """Test listing trips filtered by status."""
    user = await create_test_user(test_session, "filter-status@example.com")
    await create_test_trip(test_session, user.id, "Active Trip", TripStatus.ACTIVE)
    await create_test_trip(test_session, user.id, "Paused Trip", TripStatus.PAUSED)

    tool = ListTripsTool()

    # Filter for active
    result = await tool.execute({"status": TripStatus.ACTIVE}, str(user.id), test_session)
    assert result.data["count"] == 1
    assert result.data["trips"][0]["status"] == "active"

    # Filter for paused
    result = await tool.execute({"status": TripStatus.PAUSED}, str(user.id), test_session)
    assert result.data["count"] == 1
    assert result.data["trips"][0]["status"] == "paused"


# =============================================================================
# GetTripDetailsTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_get_trip_details_success(test_session):
    """Test getting trip details successfully."""
    user = await create_test_user(test_session, "details@example.com")
    trip = await create_test_trip(test_session, user.id, "Detail Trip")

    tool = GetTripDetailsTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["name"] == "Detail Trip"
    assert result.data["origin"] == "SFO"
    assert result.data["destination"] == "HNL"


@pytest.mark.asyncio
async def test_get_trip_details_with_prefs(test_session):
    """Test getting trip details includes preferences."""
    user = await create_test_user(test_session, "prefs-details@example.com")
    trip = await create_test_trip(test_session, user.id, "Prefs Trip")

    # Add flight prefs
    flight_prefs = TripFlightPrefs(
        trip_id=trip.id,
        airlines=["UA", "AA"],
        cabin=CabinClass.BUSINESS,
        stops_mode=StopsMode.NONSTOP,
    )
    test_session.add(flight_prefs)

    # Add hotel prefs
    hotel_prefs = TripHotelPrefs(
        trip_id=trip.id,
        rooms=2,
        preferred_room_types=["King"],
        preferred_views=["Ocean"],
    )
    test_session.add(hotel_prefs)

    # Add notification rule
    notification_rule = NotificationRule(
        trip_id=trip.id,
        threshold_type=ThresholdType.TRIP_TOTAL,
        threshold_value=Decimal("2000.00"),
    )
    test_session.add(notification_rule)
    await test_session.commit()

    tool = GetTripDetailsTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["flight_prefs"]["airlines"] == ["UA", "AA"]
    assert result.data["hotel_prefs"]["rooms"] == 2
    assert result.data["notification"]["threshold_value"] == 2000.00


@pytest.mark.asyncio
async def test_get_trip_details_with_price_history(test_session):
    """Test getting trip details includes price history."""
    user = await create_test_user(test_session, "history@example.com")
    trip = await create_test_trip(test_session, user.id, "History Trip")

    # Add snapshots
    for i in range(5):
        snapshot = PriceSnapshot(
            trip_id=trip.id,
            flight_price=Decimal(str(100 + i * 10)),
            hotel_price=Decimal(str(200 + i * 10)),
            total_price=Decimal(str(300 + i * 20)),
            created_at=datetime.now(UTC) - timedelta(days=i),
        )
        test_session.add(snapshot)
    await test_session.commit()

    tool = GetTripDetailsTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert len(result.data["price_history"]) == 5


@pytest.mark.asyncio
async def test_get_trip_details_not_found(test_session):
    """Test getting trip details for non-existent trip."""
    user = await create_test_user(test_session, "not-found@example.com")

    tool = GetTripDetailsTool()
    result = await tool.execute({"trip_id": str(uuid.uuid4())}, str(user.id), test_session)

    assert result.success is False
    assert "not found" in result.error.lower()


@pytest.mark.asyncio
async def test_get_trip_details_missing_trip_id(test_session):
    """Test getting trip details without trip_id."""
    user = await create_test_user(test_session, "missing-id@example.com")

    tool = GetTripDetailsTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "trip_id is required" in result.error


@pytest.mark.asyncio
async def test_get_trip_details_invalid_trip_id(test_session):
    """Test getting trip details with invalid trip_id format."""
    user = await create_test_user(test_session, "invalid-id@example.com")

    tool = GetTripDetailsTool()
    result = await tool.execute({"trip_id": "not-a-uuid"}, str(user.id), test_session)

    assert result.success is False
    assert "Invalid trip_id format" in result.error


@pytest.mark.asyncio
async def test_get_trip_details_wrong_user(test_session):
    """Test getting trip details for another user's trip."""
    user1 = await create_test_user(test_session, "user1@example.com")
    user2 = await create_test_user(test_session, "user2@example.com")
    trip = await create_test_trip(test_session, user1.id, "User1 Trip")

    tool = GetTripDetailsTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user2.id), test_session)

    assert result.success is False
    assert "not found" in result.error.lower()


# =============================================================================
# SetNotificationTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_set_notification_success(test_session):
    """Test setting notification threshold successfully."""
    user = await create_test_user(test_session, "set-notif@example.com")
    trip = await create_test_trip(test_session, user.id, "Notif Trip")

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": str(trip.id), "threshold_value": 1500},
        str(user.id),
        test_session,
    )

    assert result.success is True
    assert result.data["threshold_value"] == 1500.0
    assert "Alert set" in result.data["message"]


@pytest.mark.asyncio
async def test_set_notification_update_existing(test_session):
    """Test updating existing notification threshold."""
    user = await create_test_user(test_session, "update-notif@example.com")
    trip = await create_test_trip(test_session, user.id, "Update Notif Trip")

    # Create initial notification rule
    rule = NotificationRule(
        trip_id=trip.id,
        threshold_type=ThresholdType.TRIP_TOTAL,
        threshold_value=Decimal("1000.00"),
    )
    test_session.add(rule)
    await test_session.commit()

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": str(trip.id), "threshold_value": 2000, "threshold_type": "flight_total"},
        str(user.id),
        test_session,
    )

    assert result.success is True
    assert result.data["threshold_value"] == 2000.0
    assert result.data["threshold_type"] == "flight_total"


@pytest.mark.asyncio
async def test_set_notification_invalid_threshold_type(test_session):
    """Test setting notification with invalid threshold type defaults to trip_total."""
    user = await create_test_user(test_session, "invalid-type@example.com")
    trip = await create_test_trip(test_session, user.id, "Invalid Type Trip")

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": str(trip.id), "threshold_value": 1500, "threshold_type": "invalid"},
        str(user.id),
        test_session,
    )

    assert result.success is True
    assert result.data["threshold_type"] == "trip_total"


@pytest.mark.asyncio
async def test_set_notification_missing_trip_id(test_session):
    """Test setting notification without trip_id."""
    user = await create_test_user(test_session, "missing-trip-id@example.com")

    tool = SetNotificationTool()
    result = await tool.execute({"threshold_value": 1500}, str(user.id), test_session)

    assert result.success is False
    assert "trip_id is required" in result.error


@pytest.mark.asyncio
async def test_set_notification_missing_threshold(test_session):
    """Test setting notification without threshold_value."""
    user = await create_test_user(test_session, "missing-threshold@example.com")
    trip = await create_test_trip(test_session, user.id, "Missing Threshold Trip")

    tool = SetNotificationTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is False
    assert "threshold_value is required" in result.error


@pytest.mark.asyncio
async def test_set_notification_invalid_trip_id(test_session):
    """Test setting notification with invalid trip_id."""
    user = await create_test_user(test_session, "invalid-trip@example.com")

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": "invalid", "threshold_value": 1500},
        str(user.id),
        test_session,
    )

    assert result.success is False
    assert "Invalid trip_id format" in result.error


@pytest.mark.asyncio
async def test_set_notification_invalid_threshold_value(test_session):
    """Test setting notification with invalid threshold value."""
    user = await create_test_user(test_session, "invalid-value@example.com")
    trip = await create_test_trip(test_session, user.id, "Invalid Value Trip")

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": str(trip.id), "threshold_value": "not-a-number"},
        str(user.id),
        test_session,
    )

    assert result.success is False
    assert "Invalid threshold_value" in result.error


@pytest.mark.asyncio
async def test_set_notification_negative_threshold(test_session):
    """Test setting notification with negative threshold value."""
    user = await create_test_user(test_session, "negative@example.com")
    trip = await create_test_trip(test_session, user.id, "Negative Trip")

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": str(trip.id), "threshold_value": -100},
        str(user.id),
        test_session,
    )

    assert result.success is False
    assert "non-negative" in result.error


@pytest.mark.asyncio
async def test_set_notification_trip_not_found(test_session):
    """Test setting notification for non-existent trip."""
    user = await create_test_user(test_session, "notif-not-found@example.com")

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": str(uuid.uuid4()), "threshold_value": 1500},
        str(user.id),
        test_session,
    )

    assert result.success is False
    assert "not found" in result.error.lower()


# =============================================================================
# PauseTripTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_pause_trip_success(test_session):
    """Test pausing a trip successfully."""
    user = await create_test_user(test_session, "pause@example.com")
    trip = await create_test_trip(test_session, user.id, "Pause Trip", TripStatus.ACTIVE)

    tool = PauseTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["status"] == "paused"
    assert "Paused tracking" in result.data["message"]


@pytest.mark.asyncio
async def test_pause_trip_already_paused(test_session):
    """Test pausing an already paused trip."""
    user = await create_test_user(test_session, "already-paused@example.com")
    trip = await create_test_trip(test_session, user.id, "Already Paused", TripStatus.PAUSED)

    tool = PauseTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert "already paused" in result.data["message"]


@pytest.mark.asyncio
async def test_pause_trip_not_found(test_session):
    """Test pausing a non-existent trip."""
    user = await create_test_user(test_session, "pause-not-found@example.com")

    tool = PauseTripTool()
    result = await tool.execute({"trip_id": str(uuid.uuid4())}, str(user.id), test_session)

    assert result.success is False
    assert "not found" in result.error.lower()


@pytest.mark.asyncio
async def test_pause_trip_missing_trip_id(test_session):
    """Test pausing without trip_id."""
    user = await create_test_user(test_session, "pause-missing@example.com")

    tool = PauseTripTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "trip_id is required" in result.error


@pytest.mark.asyncio
async def test_pause_trip_invalid_trip_id(test_session):
    """Test pausing with invalid trip_id."""
    user = await create_test_user(test_session, "pause-invalid@example.com")

    tool = PauseTripTool()
    result = await tool.execute({"trip_id": "invalid"}, str(user.id), test_session)

    assert result.success is False
    assert "Invalid trip_id format" in result.error


# =============================================================================
# ResumeTripTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_resume_trip_success(test_session, monkeypatch):
    """Test resuming a trip successfully."""
    user = await create_test_user(test_session, "resume@example.com")
    trip = await create_test_trip(test_session, user.id, "Resume Trip", TripStatus.PAUSED)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.pause_resume.trigger_price_check_workflow", mock_trigger)

    tool = ResumeTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["status"] == "active"
    assert "Fetching latest prices" in result.data["message"]
    mock_trigger.assert_called_once()


@pytest.mark.asyncio
async def test_resume_trip_already_active(test_session, monkeypatch):
    """Test resuming an already active trip."""
    user = await create_test_user(test_session, "already-active@example.com")
    trip = await create_test_trip(test_session, user.id, "Already Active", TripStatus.ACTIVE)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.pause_resume.trigger_price_check_workflow", mock_trigger)

    tool = ResumeTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert "already active" in result.data["message"]
    mock_trigger.assert_not_called()


@pytest.mark.asyncio
async def test_resume_trip_workflow_failure(test_session, monkeypatch):
    """Test resuming trip when workflow fails to start."""
    user = await create_test_user(test_session, "resume-fail@example.com")
    trip = await create_test_trip(test_session, user.id, "Resume Fail", TripStatus.PAUSED)

    mock_trigger = AsyncMock(side_effect=Exception("Workflow error"))
    monkeypatch.setattr("app.tools.pause_resume.trigger_price_check_workflow", mock_trigger)

    tool = ResumeTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert "failed to start" in result.data["message"]


@pytest.mark.asyncio
async def test_resume_trip_not_found(test_session, monkeypatch):
    """Test resuming a non-existent trip."""
    user = await create_test_user(test_session, "resume-not-found@example.com")

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.pause_resume.trigger_price_check_workflow", mock_trigger)

    tool = ResumeTripTool()
    result = await tool.execute({"trip_id": str(uuid.uuid4())}, str(user.id), test_session)

    assert result.success is False
    assert "not found" in result.error.lower()


@pytest.mark.asyncio
async def test_resume_trip_missing_trip_id(test_session, monkeypatch):
    """Test resuming without trip_id."""
    user = await create_test_user(test_session, "resume-missing@example.com")

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.pause_resume.trigger_price_check_workflow", mock_trigger)

    tool = ResumeTripTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "trip_id is required" in result.error


@pytest.mark.asyncio
async def test_resume_trip_invalid_trip_id(test_session, monkeypatch):
    """Test resuming with invalid trip_id."""
    user = await create_test_user(test_session, "resume-invalid@example.com")

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.pause_resume.trigger_price_check_workflow", mock_trigger)

    tool = ResumeTripTool()
    result = await tool.execute({"trip_id": "invalid"}, str(user.id), test_session)

    assert result.success is False
    assert "Invalid trip_id format" in result.error


# =============================================================================
# TriggerRefreshTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_trigger_refresh_success(test_session, monkeypatch, mock_redis):
    """Test triggering refresh successfully."""
    user = await create_test_user(test_session, "refresh@example.com")

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_start = AsyncMock()
    monkeypatch.setattr("app.tools.trigger_refresh.start_refresh_all_workflow", mock_start)

    tool = TriggerRefreshTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is True
    assert "workflow_id" in result.data
    assert "Refreshing prices" in result.data["message"]
    mock_start.assert_called_once()


@pytest.mark.asyncio
async def test_trigger_refresh_already_in_progress(test_session, monkeypatch, mock_redis):
    """Test triggering refresh when one is already in progress."""
    user = await create_test_user(test_session, "refresh-lock@example.com")

    mock_redis.set = AsyncMock(return_value=None)
    mock_redis.get = AsyncMock(return_value="existing-refresh-id")
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    tool = TriggerRefreshTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "already in progress" in result.error


@pytest.mark.asyncio
async def test_trigger_refresh_already_in_progress_bytes(test_session, monkeypatch, mock_redis):
    """Test triggering refresh when lock value is bytes."""
    user = await create_test_user(test_session, "refresh-bytes@example.com")

    mock_redis.set = AsyncMock(return_value=None)
    mock_redis.get = AsyncMock(return_value=b"existing-refresh-id")
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    tool = TriggerRefreshTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "already in progress" in result.error


@pytest.mark.asyncio
async def test_trigger_refresh_workflow_failure(test_session, monkeypatch, mock_redis):
    """Test triggering refresh when workflow fails to start."""
    user = await create_test_user(test_session, "refresh-fail@example.com")

    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.delete = AsyncMock(return_value=1)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_start = AsyncMock(side_effect=Exception("Workflow error"))
    monkeypatch.setattr("app.tools.trigger_refresh.start_refresh_all_workflow", mock_start)

    tool = TriggerRefreshTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "Failed to start" in result.error
    mock_redis.delete.assert_called_once()


# =============================================================================
# TriggerRefreshTripTool Tests
# =============================================================================


@pytest.mark.asyncio
async def test_trigger_refresh_trip_success(test_session, monkeypatch, mock_redis):
    """Test triggering refresh for a specific trip successfully."""
    user = await create_test_user(test_session, "refresh-trip@example.com")
    trip = await create_test_trip(test_session, user.id, "Refresh Trip", TripStatus.ACTIVE)

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.trigger_refresh.trigger_price_check_workflow", mock_trigger)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["trip_id"] == str(trip.id)
    assert result.data["trip_name"] == "Refresh Trip"
    assert "Refreshing prices" in result.data["message"]
    mock_trigger.assert_called_once_with(trip.id)


@pytest.mark.asyncio
async def test_trigger_refresh_trip_not_found(test_session, monkeypatch, mock_redis):
    """Test triggering refresh for a non-existent trip."""
    user = await create_test_user(test_session, "refresh-trip-not-found@example.com")

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(uuid.uuid4())}, str(user.id), test_session)

    assert result.success is False
    assert "Trip not found" in result.error


@pytest.mark.asyncio
async def test_trigger_refresh_trip_wrong_user(test_session, monkeypatch, mock_redis):
    """Test triggering refresh for another user's trip."""
    user1 = await create_test_user(test_session, "user1-refresh-trip@example.com")
    user2 = await create_test_user(test_session, "user2-refresh-trip@example.com")
    trip = await create_test_trip(test_session, user1.id, "User1 Trip", TripStatus.ACTIVE)

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.trigger_refresh.trigger_price_check_workflow", mock_trigger)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user2.id), test_session)

    assert result.success is False
    assert "Trip not found" in result.error
    mock_trigger.assert_not_called()


@pytest.mark.asyncio
async def test_trigger_refresh_trip_paused(test_session, monkeypatch, mock_redis):
    """Test triggering refresh for a paused trip fails."""
    user = await create_test_user(test_session, "refresh-trip-paused@example.com")
    trip = await create_test_trip(test_session, user.id, "Paused Trip", TripStatus.PAUSED)

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.trigger_refresh.trigger_price_check_workflow", mock_trigger)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is False
    assert "paused" in result.error.lower()
    assert "resume" in result.error.lower()
    mock_trigger.assert_not_called()


@pytest.mark.asyncio
async def test_trigger_refresh_trip_already_in_progress(test_session, monkeypatch, mock_redis):
    """Test triggering refresh when one is already in progress for the trip."""
    user = await create_test_user(test_session, "refresh-trip-lock@example.com")
    trip = await create_test_trip(test_session, user.id, "Lock Trip", TripStatus.ACTIVE)

    mock_redis.set = AsyncMock(return_value=None)  # Lock not acquired
    mock_redis.get = AsyncMock(return_value="existing-refresh-id")
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.trigger_refresh.trigger_price_check_workflow", mock_trigger)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is False
    assert "already in progress" in result.error
    assert "Lock Trip" in result.error
    mock_trigger.assert_not_called()


@pytest.mark.asyncio
async def test_trigger_refresh_trip_already_in_progress_bytes(test_session, monkeypatch, mock_redis):
    """Test triggering refresh when lock value is bytes."""
    user = await create_test_user(test_session, "refresh-trip-bytes@example.com")
    trip = await create_test_trip(test_session, user.id, "Bytes Trip", TripStatus.ACTIVE)

    mock_redis.set = AsyncMock(return_value=None)  # Lock not acquired
    mock_redis.get = AsyncMock(return_value=b"existing-refresh-id")
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.trigger_refresh.trigger_price_check_workflow", mock_trigger)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is False
    assert "already in progress" in result.error
    mock_trigger.assert_not_called()


@pytest.mark.asyncio
async def test_trigger_refresh_trip_workflow_failure(test_session, monkeypatch, mock_redis):
    """Test triggering refresh when workflow fails to start."""
    user = await create_test_user(test_session, "refresh-trip-fail@example.com")
    trip = await create_test_trip(test_session, user.id, "Fail Trip", TripStatus.ACTIVE)

    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.delete = AsyncMock(return_value=1)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_trigger = AsyncMock(side_effect=Exception("Workflow error"))
    monkeypatch.setattr("app.tools.trigger_refresh.trigger_price_check_workflow", mock_trigger)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is False
    assert "Failed to start" in result.error
    mock_redis.delete.assert_called_once()


@pytest.mark.asyncio
async def test_trigger_refresh_trip_missing_trip_id(test_session, monkeypatch, mock_redis):
    """Test triggering refresh without trip_id."""
    user = await create_test_user(test_session, "refresh-trip-missing@example.com")

    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "trip_id is required" in result.error


@pytest.mark.asyncio
async def test_trigger_refresh_trip_invalid_trip_id(test_session, monkeypatch, mock_redis):
    """Test triggering refresh with invalid trip_id format."""
    user = await create_test_user(test_session, "refresh-trip-invalid@example.com")

    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": "invalid-uuid"}, str(user.id), test_session)

    assert result.success is False
    assert "Invalid trip_id format" in result.error


@pytest.mark.asyncio
async def test_trigger_refresh_trip_error_status(test_session, monkeypatch, mock_redis):
    """Test triggering refresh for a trip in error status still works."""
    user = await create_test_user(test_session, "refresh-trip-error@example.com")
    trip = await create_test_trip(test_session, user.id, "Error Trip", TripStatus.ERROR)

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr("app.tools.trigger_refresh.redis_client", mock_redis)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.trigger_refresh.trigger_price_check_workflow", mock_trigger)

    tool = TriggerRefreshTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    # Trips in error status can still be refreshed (they're not paused)
    assert result.success is True
    assert result.data["trip_name"] == "Error Trip"
    mock_trigger.assert_called_once_with(trip.id)


# =============================================================================
# Tool Properties Tests
# =============================================================================


def test_tool_names_and_descriptions():
    """Test that all tools have name and description."""
    tools = [
        CreateTripTool(),
        DeleteTripTool(),
        ListTripsTool(),
        GetTripDetailsTool(),
        SetNotificationTool(),
        PauseTripTool(),
        ResumeTripTool(),
        TriggerRefreshTool(),
        TriggerRefreshTripTool(),
    ]

    for tool in tools:
        assert tool.name, f"{type(tool).__name__} has no name"
        assert tool.description, f"{type(tool).__name__} has no description"
        assert len(tool.name) > 0
        assert len(tool.description) > 0


# =============================================================================
# Row-Level Security Tests (user_id filtering)
# =============================================================================


@pytest.mark.asyncio
async def test_list_trips_only_returns_own_trips(test_session):
    """Test that list_trips only returns trips owned by the requesting user."""
    user1 = await create_test_user(test_session, "user1-rls@example.com")
    user2 = await create_test_user(test_session, "user2-rls@example.com")

    # Create trips for both users
    await create_test_trip(test_session, user1.id, "User1 Trip A")
    await create_test_trip(test_session, user1.id, "User1 Trip B")
    await create_test_trip(test_session, user2.id, "User2 Trip")

    tool = ListTripsTool()

    # User1 should only see their own trips
    result1 = await tool.execute({}, str(user1.id), test_session)
    assert result1.success is True
    assert result1.data["count"] == 2
    trip_names = [t["name"] for t in result1.data["trips"]]
    assert "User1 Trip A" in trip_names
    assert "User1 Trip B" in trip_names
    assert "User2 Trip" not in trip_names

    # User2 should only see their own trip
    result2 = await tool.execute({}, str(user2.id), test_session)
    assert result2.success is True
    assert result2.data["count"] == 1
    assert result2.data["trips"][0]["name"] == "User2 Trip"


@pytest.mark.asyncio
async def test_set_notification_wrong_user(test_session):
    """Test that set_notification fails for another user's trip."""
    user1 = await create_test_user(test_session, "user1-notif-rls@example.com")
    user2 = await create_test_user(test_session, "user2-notif-rls@example.com")
    trip = await create_test_trip(test_session, user1.id, "User1 Protected Trip")

    tool = SetNotificationTool()
    result = await tool.execute(
        {"trip_id": str(trip.id), "threshold_value": 1500},
        str(user2.id),  # Different user
        test_session,
    )

    assert result.success is False
    assert "not found" in result.error.lower()


@pytest.mark.asyncio
async def test_pause_trip_wrong_user(test_session):
    """Test that pause_trip fails for another user's trip."""
    user1 = await create_test_user(test_session, "user1-pause-rls@example.com")
    user2 = await create_test_user(test_session, "user2-pause-rls@example.com")
    trip = await create_test_trip(test_session, user1.id, "User1 Pause Trip", TripStatus.ACTIVE)

    tool = PauseTripTool()
    result = await tool.execute(
        {"trip_id": str(trip.id)},
        str(user2.id),  # Different user
        test_session,
    )

    assert result.success is False
    assert "not found" in result.error.lower()


@pytest.mark.asyncio
async def test_resume_trip_wrong_user(test_session, monkeypatch):
    """Test that resume_trip fails for another user's trip."""
    user1 = await create_test_user(test_session, "user1-resume-rls@example.com")
    user2 = await create_test_user(test_session, "user2-resume-rls@example.com")
    trip = await create_test_trip(test_session, user1.id, "User1 Resume Trip", TripStatus.PAUSED)

    mock_trigger = AsyncMock()
    monkeypatch.setattr("app.tools.pause_resume.trigger_price_check_workflow", mock_trigger)

    tool = ResumeTripTool()
    result = await tool.execute(
        {"trip_id": str(trip.id)},
        str(user2.id),  # Different user
        test_session,
    )

    assert result.success is False
    assert "not found" in result.error.lower()
    mock_trigger.assert_not_called()  # Workflow should never be called


@pytest.mark.asyncio
async def test_create_trip_counts_only_own_trips(test_session, monkeypatch):
    """Test that trip limit only counts user's own trips."""
    user1 = await create_test_user(test_session, "user1-limit-rls@example.com")
    user2 = await create_test_user(test_session, "user2-limit-rls@example.com")

    # Set trip limit to 2
    monkeypatch.setattr(settings, "max_trips_per_user", 2)

    tool = CreateTripTool()

    # Create 2 trips for user1 (at limit)
    args1 = valid_trip_args()
    await tool.execute(args1, str(user1.id), test_session)
    args1["name"] = "User1 Second Trip"
    await tool.execute(args1, str(user1.id), test_session)

    # User1 should not be able to create more
    args1["name"] = "User1 Third Trip"
    result1 = await tool.execute(args1, str(user1.id), test_session)
    assert result1.success is False
    assert "Trip limit reached" in result1.error

    # User2 should still be able to create trips (their count is 0)
    args2 = valid_trip_args()
    args2["name"] = "User2 First Trip"
    result2 = await tool.execute(args2, str(user2.id), test_session)
    assert result2.success is True


@pytest.mark.asyncio
async def test_create_trip_duplicate_name_per_user(test_session):
    """Test that duplicate trip names are allowed for different users."""
    user1 = await create_test_user(test_session, "user1-dup-rls@example.com")
    user2 = await create_test_user(test_session, "user2-dup-rls@example.com")

    tool = CreateTripTool()
    args = valid_trip_args()
    args["name"] = "Same Name Trip"

    # User1 creates trip
    result1 = await tool.execute(args, str(user1.id), test_session)
    assert result1.success is True

    # User2 can create trip with same name
    result2 = await tool.execute(args, str(user2.id), test_session)
    assert result2.success is True

    # User1 cannot create another with same name
    result3 = await tool.execute(args, str(user1.id), test_session)
    assert result3.success is False
    assert "already exists" in result3.error
