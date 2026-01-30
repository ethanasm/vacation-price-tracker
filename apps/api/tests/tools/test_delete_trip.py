"""Tests for the delete_trip MCP tool."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from app.core.constants import ThresholdType, TripStatus
from app.models.notification_rule import NotificationRule
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from app.models.user import User
from app.tools import DeleteTripTool, get_trip_tool
from sqlalchemy import select

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


async def create_trip_with_related_data(test_session, user_id: uuid.UUID) -> Trip:
    """Create a trip with flight prefs, hotel prefs, notification rule, and price snapshots."""
    trip = await create_test_trip(test_session, user_id, "Trip with Data")

    # Add flight prefs
    flight_prefs = TripFlightPrefs(
        trip_id=trip.id,
        airlines=["UA", "AA"],
    )
    test_session.add(flight_prefs)

    # Add hotel prefs
    hotel_prefs = TripHotelPrefs(
        trip_id=trip.id,
        rooms=2,
        preferred_room_types=["King"],
    )
    test_session.add(hotel_prefs)

    # Add notification rule
    notification_rule = NotificationRule(
        trip_id=trip.id,
        threshold_type=ThresholdType.TRIP_TOTAL,
        threshold_value=Decimal("2000.00"),
    )
    test_session.add(notification_rule)

    # Add price snapshots
    for i in range(3):
        snapshot = PriceSnapshot(
            trip_id=trip.id,
            flight_price=Decimal(str(500 + i * 10)),
            hotel_price=Decimal(str(800 + i * 10)),
            total_price=Decimal(str(1300 + i * 20)),
            created_at=datetime.now(UTC) - timedelta(days=i),
        )
        test_session.add(snapshot)

    await test_session.commit()
    return trip


# =============================================================================
# Module-Level Tests
# =============================================================================


def test_get_trip_tool_returns_delete_trip():
    """Test get_trip_tool returns DeleteTripTool for delete_trip."""
    assert get_trip_tool("delete_trip") is DeleteTripTool


def test_delete_trip_tool_has_name_and_description():
    """Test DeleteTripTool has proper name and description."""
    tool = DeleteTripTool()
    assert tool.name == "delete_trip"
    assert len(tool.description) > 0
    assert "delete" in tool.description.lower()


# =============================================================================
# Successful Deletion Tests
# =============================================================================


@pytest.mark.asyncio
async def test_delete_trip_success(test_session):
    """Test successful trip deletion."""
    user = await create_test_user(test_session, "delete-success@example.com")
    trip = await create_test_trip(test_session, user.id, "Trip to Delete")

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["deleted_trip_name"] == "Trip to Delete"
    assert result.data["trip_id"] == str(trip.id)
    assert "Deleted trip" in result.data["message"]

    # Verify trip is actually deleted
    check = await test_session.execute(select(Trip).where(Trip.id == trip.id))
    assert check.scalars().first() is None


@pytest.mark.asyncio
async def test_delete_trip_with_related_data(test_session):
    """Test that deleting a trip with related data succeeds.

    Note: SQLite doesn't enforce foreign key cascades by default (requires
    PRAGMA foreign_keys = ON). In production PostgreSQL, cascade delete
    removes related records automatically. This test verifies the tool
    successfully deletes the trip itself when related data exists.
    """
    user = await create_test_user(test_session, "cascade@example.com")
    trip = await create_trip_with_related_data(test_session, user.id)
    trip_id = trip.id

    # Verify related data exists before deletion
    flight_prefs = await test_session.execute(
        select(TripFlightPrefs).where(TripFlightPrefs.trip_id == trip_id)
    )
    assert flight_prefs.scalars().first() is not None

    hotel_prefs = await test_session.execute(
        select(TripHotelPrefs).where(TripHotelPrefs.trip_id == trip_id)
    )
    assert hotel_prefs.scalars().first() is not None

    notification = await test_session.execute(
        select(NotificationRule).where(NotificationRule.trip_id == trip_id)
    )
    assert notification.scalars().first() is not None

    snapshots = await test_session.execute(
        select(PriceSnapshot).where(PriceSnapshot.trip_id == trip_id)
    )
    assert len(snapshots.scalars().all()) == 3

    # Delete the trip - this should succeed even with related data
    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip_id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["deleted_trip_name"] == "Trip with Data"

    # Expire all objects in session to force fresh database queries
    test_session.expire_all()

    # Verify the trip itself is deleted
    trip_check = await test_session.execute(select(Trip).where(Trip.id == trip_id))
    assert trip_check.scalars().first() is None


@pytest.mark.asyncio
async def test_delete_paused_trip(test_session):
    """Test deleting a paused trip."""
    user = await create_test_user(test_session, "delete-paused@example.com")
    trip = await create_test_trip(test_session, user.id, "Paused Trip", TripStatus.PAUSED)

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["deleted_trip_name"] == "Paused Trip"


@pytest.mark.asyncio
async def test_delete_trip_with_error_status(test_session):
    """Test deleting a trip with error status."""
    user = await create_test_user(test_session, "delete-error@example.com")
    trip = await create_test_trip(test_session, user.id, "Error Trip", TripStatus.ERROR)

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["deleted_trip_name"] == "Error Trip"


# =============================================================================
# Error Cases Tests
# =============================================================================


@pytest.mark.asyncio
async def test_delete_trip_not_found(test_session):
    """Test deleting a non-existent trip."""
    user = await create_test_user(test_session, "not-found@example.com")

    tool = DeleteTripTool()
    result = await tool.execute(
        {"trip_id": str(uuid.uuid4())}, str(user.id), test_session
    )

    assert result.success is False
    assert "not found" in result.error.lower()


@pytest.mark.asyncio
async def test_delete_trip_missing_trip_id(test_session):
    """Test deleting without trip_id."""
    user = await create_test_user(test_session, "missing-id@example.com")

    tool = DeleteTripTool()
    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is False
    assert "trip_id is required" in result.error


@pytest.mark.asyncio
async def test_delete_trip_invalid_trip_id(test_session):
    """Test deleting with invalid trip_id format."""
    user = await create_test_user(test_session, "invalid-id@example.com")

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": "not-a-uuid"}, str(user.id), test_session)

    assert result.success is False
    assert "Invalid trip_id format" in result.error


@pytest.mark.asyncio
async def test_delete_trip_empty_trip_id(test_session):
    """Test deleting with empty trip_id."""
    user = await create_test_user(test_session, "empty-id@example.com")

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": ""}, str(user.id), test_session)

    assert result.success is False
    # Empty string triggers the "required" check before UUID parsing
    assert "trip_id is required" in result.error


# =============================================================================
# Authorization Tests (Row-Level Security)
# =============================================================================


@pytest.mark.asyncio
async def test_delete_trip_wrong_user(test_session):
    """Test that a user cannot delete another user's trip."""
    user1 = await create_test_user(test_session, "user1-delete@example.com")
    user2 = await create_test_user(test_session, "user2-delete@example.com")
    trip = await create_test_trip(test_session, user1.id, "User1's Trip")

    tool = DeleteTripTool()
    result = await tool.execute(
        {"trip_id": str(trip.id)},
        str(user2.id),  # Different user
        test_session,
    )

    assert result.success is False
    assert "not found" in result.error.lower()

    # Verify trip still exists
    check = await test_session.execute(select(Trip).where(Trip.id == trip.id))
    assert check.scalars().first() is not None


@pytest.mark.asyncio
async def test_delete_own_trip_leaves_other_trips(test_session):
    """Test that deleting one trip doesn't affect other trips."""
    user = await create_test_user(test_session, "multi-trip@example.com")
    trip1 = await create_test_trip(test_session, user.id, "Trip 1")
    trip2 = await create_test_trip(test_session, user.id, "Trip 2")
    trip3 = await create_test_trip(test_session, user.id, "Trip 3")

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip2.id)}, str(user.id), test_session)

    assert result.success is True

    # Verify only trip2 is deleted
    check1 = await test_session.execute(select(Trip).where(Trip.id == trip1.id))
    assert check1.scalars().first() is not None

    check2 = await test_session.execute(select(Trip).where(Trip.id == trip2.id))
    assert check2.scalars().first() is None

    check3 = await test_session.execute(select(Trip).where(Trip.id == trip3.id))
    assert check3.scalars().first() is not None


@pytest.mark.asyncio
async def test_delete_trip_different_users_same_name(test_session):
    """Test that users with same-named trips can only delete their own."""
    user1 = await create_test_user(test_session, "user1-same@example.com")
    user2 = await create_test_user(test_session, "user2-same@example.com")

    # Both users have a trip with the same name
    trip1 = await create_test_trip(test_session, user1.id, "Hawaii Vacation")
    trip2 = await create_test_trip(test_session, user2.id, "Hawaii Vacation")

    tool = DeleteTripTool()

    # User1 deletes their trip
    result = await tool.execute({"trip_id": str(trip1.id)}, str(user1.id), test_session)
    assert result.success is True

    # User2's trip should still exist
    check2 = await test_session.execute(select(Trip).where(Trip.id == trip2.id))
    assert check2.scalars().first() is not None

    # User1's trip should be deleted
    check1 = await test_session.execute(select(Trip).where(Trip.id == trip1.id))
    assert check1.scalars().first() is None


# =============================================================================
# Edge Cases Tests
# =============================================================================


@pytest.mark.asyncio
async def test_delete_trip_with_many_snapshots(test_session):
    """Test deleting a trip with many price snapshots succeeds.

    Note: SQLite doesn't enforce foreign key cascades by default. In production
    PostgreSQL, cascade delete removes all snapshots. This test verifies the
    tool successfully deletes the trip when many snapshots exist.
    """
    user = await create_test_user(test_session, "many-snapshots@example.com")
    trip = await create_test_trip(test_session, user.id, "Trip with History")
    trip_id = trip.id

    # Create 50 price snapshots
    for i in range(50):
        snapshot = PriceSnapshot(
            trip_id=trip_id,
            flight_price=Decimal(str(500 + i)),
            hotel_price=Decimal(str(800 + i)),
            total_price=Decimal(str(1300 + i * 2)),
            created_at=datetime.now(UTC) - timedelta(hours=i),
        )
        test_session.add(snapshot)
    await test_session.commit()

    # Verify snapshots exist
    snapshots = await test_session.execute(
        select(PriceSnapshot).where(PriceSnapshot.trip_id == trip_id)
    )
    assert len(snapshots.scalars().all()) == 50

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip_id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["deleted_trip_name"] == "Trip with History"

    # Expire all objects in session to force fresh database queries
    test_session.expire_all()

    # Verify the trip itself is deleted
    trip_check = await test_session.execute(select(Trip).where(Trip.id == trip_id))
    assert trip_check.scalars().first() is None


@pytest.mark.asyncio
async def test_delete_trip_with_special_characters_in_name(test_session):
    """Test deleting a trip with special characters in name."""
    user = await create_test_user(test_session, "special-chars@example.com")
    trip = await create_test_trip(
        test_session, user.id, "Trip to Paris (2024) - Summer Vacation!"
    )

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["deleted_trip_name"] == "Trip to Paris (2024) - Summer Vacation!"


@pytest.mark.asyncio
async def test_delete_trip_with_unicode_name(test_session):
    """Test deleting a trip with unicode characters in name."""
    user = await create_test_user(test_session, "unicode@example.com")
    trip = await create_test_trip(test_session, user.id, "Tokyo 東京 Trip 🗼")

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert result.data["deleted_trip_name"] == "Tokyo 東京 Trip 🗼"


@pytest.mark.asyncio
async def test_delete_trip_result_contains_required_fields(test_session):
    """Test that delete result contains all required fields."""
    user = await create_test_user(test_session, "fields@example.com")
    trip = await create_test_trip(test_session, user.id, "Complete Trip")

    tool = DeleteTripTool()
    result = await tool.execute({"trip_id": str(trip.id)}, str(user.id), test_session)

    assert result.success is True
    assert "message" in result.data
    assert "trip_id" in result.data
    assert "deleted_trip_name" in result.data
    assert result.data["trip_id"] == str(trip.id)
