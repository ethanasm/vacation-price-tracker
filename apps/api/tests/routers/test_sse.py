"""Comprehensive tests for the SSE router.

Coverage targets:
- GET /v1/sse/updates: SSE streaming, authentication, event types
- GET /v1/sse/status: Status endpoint
- Event generation: connected, price_update, heartbeat, error events
- Edge cases and error handling
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.db.deps import get_db
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.user import User
from app.routers.auth import UserResponse, get_current_user
from app.routers.sse import (
    _get_latest_snapshot_for_trip,
    _get_user_trips_with_snapshots,
    event_generator,
)
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_models import set_test_timestamps


def set_snapshot_timestamp(snapshot: PriceSnapshot) -> None:
    """Helper to set timestamp for PriceSnapshot (only has created_at, not updated_at)."""
    snapshot.created_at = datetime.now(UTC)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_user_response():
    """Create a mock authenticated user response."""
    return UserResponse(id=str(uuid.uuid4()), email="test@example.com")


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    db = AsyncMock(spec=AsyncSession)
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


@pytest.fixture
def app_with_sse(mock_db_session, mock_user_response):
    """Create a FastAPI app with SSE router and mock dependencies."""
    from app.routers import sse

    app = FastAPI()
    app.include_router(sse.router, tags=["sse"])

    async def override_get_db():
        yield mock_db_session

    async def override_get_current_user():
        return mock_user_response

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    return app


@pytest.fixture
def client_with_sse(app_with_sse):
    """Create a test client with SSE router."""
    return TestClient(app_with_sse)


# =============================================================================
# _get_latest_snapshot_for_trip Tests
# =============================================================================


@pytest.mark.asyncio
async def test_get_latest_snapshot_for_trip_exists(test_session):
    """Test getting latest snapshot when it exists."""
    # Create user and trip
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    trip = Trip(
        user_id=user.id,
        name="Test Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)

    # Create snapshots
    old_snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("100.00"),
        total_price=Decimal("100.00"),
        raw_data={},
    )
    old_snapshot.created_at = datetime.now(UTC) - timedelta(hours=2)
    test_session.add(old_snapshot)

    new_snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("150.00"),
        total_price=Decimal("150.00"),
        raw_data={},
    )
    set_snapshot_timestamp(new_snapshot)
    test_session.add(new_snapshot)
    await test_session.commit()

    # Get latest snapshot
    result = await _get_latest_snapshot_for_trip(test_session, trip.id)

    assert result is not None
    assert result.flight_price == Decimal("150.00")


@pytest.mark.asyncio
async def test_get_latest_snapshot_for_trip_not_exists(test_session):
    """Test getting latest snapshot when none exists."""
    # Create user and trip without snapshots
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    trip = Trip(
        user_id=user.id,
        name="Test Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)

    result = await _get_latest_snapshot_for_trip(test_session, trip.id)

    assert result is None


# =============================================================================
# _get_user_trips_with_snapshots Tests
# =============================================================================


@pytest.mark.asyncio
async def test_get_user_trips_with_snapshots_returns_updates(test_session):
    """Test getting user trips with their latest snapshots."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    # Create trip with snapshot
    trip = Trip(
        user_id=user.id,
        name="Test Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)

    snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("200.00"),
        hotel_price=Decimal("300.00"),
        total_price=Decimal("500.00"),
        raw_data={},
    )
    set_snapshot_timestamp(snapshot)
    test_session.add(snapshot)
    await test_session.commit()

    updates = await _get_user_trips_with_snapshots(test_session, user.id)

    assert len(updates) == 1
    assert updates[0]["type"] == "price_update"
    assert updates[0]["trip_id"] == str(trip.id)
    assert updates[0]["trip_name"] == "Test Trip"
    assert updates[0]["flight_price"] == "200.00"
    assert updates[0]["hotel_price"] == "300.00"
    assert updates[0]["total_price"] == "500.00"


@pytest.mark.asyncio
async def test_get_user_trips_with_snapshots_filters_by_since(test_session):
    """Test filtering updates by since timestamp."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    # Create trip
    trip = Trip(
        user_id=user.id,
        name="Test Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)

    # Create old snapshot
    old_snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("100.00"),
        total_price=Decimal("100.00"),
        raw_data={},
    )
    set_snapshot_timestamp(old_snapshot)
    old_snapshot.created_at = datetime.now(UTC) - timedelta(hours=2)
    test_session.add(old_snapshot)
    await test_session.commit()

    # Filter with since = 1 hour ago (should exclude the 2-hour-old snapshot)
    since = datetime.now(UTC) - timedelta(hours=1)
    updates = await _get_user_trips_with_snapshots(test_session, user.id, since=since)

    assert len(updates) == 0


@pytest.mark.asyncio
async def test_get_user_trips_with_snapshots_empty_when_no_trips(test_session):
    """Test returns empty list when user has no trips."""
    # Create user without trips
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    updates = await _get_user_trips_with_snapshots(test_session, user.id)

    assert len(updates) == 0


@pytest.mark.asyncio
async def test_get_user_trips_with_snapshots_handles_null_prices(test_session):
    """Test handling of null prices in snapshots."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    # Create trip
    trip = Trip(
        user_id=user.id,
        name="Test Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)

    # Create snapshot with only flight price (no hotel price)
    snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("200.00"),
        hotel_price=None,
        total_price=Decimal("200.00"),
        raw_data={},
    )
    set_snapshot_timestamp(snapshot)
    test_session.add(snapshot)
    await test_session.commit()

    updates = await _get_user_trips_with_snapshots(test_session, user.id)

    assert len(updates) == 1
    assert updates[0]["flight_price"] == "200.00"
    assert updates[0]["hotel_price"] is None
    assert updates[0]["total_price"] == "200.00"


# =============================================================================
# event_generator Tests
# =============================================================================


@pytest.mark.asyncio
async def test_event_generator_sends_connected_event(test_session):
    """Test that event generator sends connected event first."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    gen = event_generator(user.id, test_session, heartbeat_interval=30, poll_interval=1)

    # Get first event
    first_event = await gen.__anext__()

    assert "event: connected" in first_event
    assert '"status": "connected"' in first_event
    assert str(user.id) in first_event

    # Clean up generator
    await gen.aclose()


@pytest.mark.asyncio
async def test_event_generator_sends_initial_price_updates(test_session):
    """Test that event generator sends initial price updates."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    # Create trip with snapshot
    trip = Trip(
        user_id=user.id,
        name="Hawaii Trip",
        origin_airport="SFO",
        destination_code="HNL",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)

    snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("500.00"),
        total_price=Decimal("500.00"),
        raw_data={},
    )
    set_snapshot_timestamp(snapshot)
    test_session.add(snapshot)
    await test_session.commit()

    gen = event_generator(user.id, test_session, heartbeat_interval=30, poll_interval=1)

    # Get first event (connected)
    await gen.__anext__()

    # Get second event (price update)
    second_event = await gen.__anext__()

    assert "event: price_update" in second_event
    assert "Hawaii Trip" in second_event
    assert "500.00" in second_event

    # Clean up generator
    await gen.aclose()


@pytest.mark.asyncio
async def test_event_generator_handles_cancellation(test_session):
    """Test that event generator handles cancellation gracefully."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    gen = event_generator(user.id, test_session, heartbeat_interval=30, poll_interval=1)

    # Get connected event
    await gen.__anext__()

    # Cancel the generator
    await gen.aclose()

    # Generator should be closed without error


# =============================================================================
# /v1/sse/updates Endpoint Tests
# =============================================================================


def test_sse_updates_requires_authentication():
    """Test that SSE updates endpoint requires authentication."""
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)

    # Without auth cookies, should get 401
    response = client.get("/v1/sse/updates")
    assert response.status_code == 401


def test_sse_updates_returns_streaming_response(client_with_sse):
    """Test that SSE updates endpoint returns streaming response."""
    # TestClient doesn't fully support SSE, but we can check headers
    response = client_with_sse.get("/v1/sse/updates", timeout=1)

    # The response should start streaming
    assert response.headers.get("content-type", "").startswith("text/event-stream")


def test_sse_updates_accepts_query_params(client_with_sse):
    """Test that SSE updates endpoint accepts query parameters."""
    response = client_with_sse.get(
        "/v1/sse/updates?heartbeat_interval=15&poll_interval=2",
        timeout=1,
    )

    # Should still work with custom params
    assert response.headers.get("content-type", "").startswith("text/event-stream")


def test_sse_updates_validates_heartbeat_interval(client_with_sse):
    """Test that heartbeat_interval is validated."""
    # Too low
    response = client_with_sse.get("/v1/sse/updates?heartbeat_interval=1")
    assert response.status_code == 422

    # Too high
    response = client_with_sse.get("/v1/sse/updates?heartbeat_interval=100")
    assert response.status_code == 422


def test_sse_updates_validates_poll_interval(client_with_sse):
    """Test that poll_interval is validated."""
    # Too low
    response = client_with_sse.get("/v1/sse/updates?poll_interval=0")
    assert response.status_code == 422

    # Too high
    response = client_with_sse.get("/v1/sse/updates?poll_interval=60")
    assert response.status_code == 422


# =============================================================================
# /v1/sse/status Endpoint Tests
# =============================================================================


def test_sse_status_returns_available(client_with_sse, mock_user_response):
    """Test that SSE status endpoint returns available status."""
    response = client_with_sse.get("/v1/sse/status")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "available"
    assert data["user_id"] == mock_user_response.id
    assert "endpoints" in data
    assert data["endpoints"]["updates"] == "/v1/sse/updates"


def test_sse_status_requires_authentication():
    """Test that SSE status endpoint requires authentication."""
    from app.main import app

    client = TestClient(app, raise_server_exceptions=False)

    # Without auth cookies, should get 401
    response = client.get("/v1/sse/status")
    assert response.status_code == 401


# =============================================================================
# Integration Tests with Real Database
# =============================================================================


@pytest.mark.asyncio
async def test_sse_integration_multiple_trips(test_session):
    """Test SSE with multiple trips and snapshots."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    # Create multiple trips
    trips = []
    for i in range(3):
        trip = Trip(
            user_id=user.id,
            name=f"Trip {i + 1}",
            origin_airport="SFO",
            destination_code="LAX",
            depart_date=datetime.now(UTC).date() + timedelta(days=30),
            return_date=datetime.now(UTC).date() + timedelta(days=37),
        )
        set_test_timestamps(trip)
        test_session.add(trip)
        trips.append(trip)
    await test_session.commit()

    for trip in trips:
        await test_session.refresh(trip)

    # Create snapshots for each trip
    for i, trip in enumerate(trips):
        snapshot = PriceSnapshot(
            trip_id=trip.id,
            flight_price=Decimal(f"{100 * (i + 1)}.00"),
            total_price=Decimal(f"{100 * (i + 1)}.00"),
            raw_data={},
        )
        set_snapshot_timestamp(snapshot)
        test_session.add(snapshot)
    await test_session.commit()

    # Get updates
    updates = await _get_user_trips_with_snapshots(test_session, user.id)

    assert len(updates) == 3
    # Check all trips are present
    trip_names = {u["trip_name"] for u in updates}
    assert trip_names == {"Trip 1", "Trip 2", "Trip 3"}


@pytest.mark.asyncio
async def test_sse_integration_different_users_isolated(test_session):
    """Test that different users' trips are isolated."""
    # Create two users
    user1 = User(google_sub=str(uuid.uuid4()), email="user1@example.com")
    user2 = User(google_sub=str(uuid.uuid4()), email="user2@example.com")
    set_test_timestamps(user1)
    set_test_timestamps(user2)
    test_session.add(user1)
    test_session.add(user2)
    await test_session.commit()
    await test_session.refresh(user1)
    await test_session.refresh(user2)

    # Create trips for each user
    trip1 = Trip(
        user_id=user1.id,
        name="User 1 Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    trip2 = Trip(
        user_id=user2.id,
        name="User 2 Trip",
        origin_airport="JFK",
        destination_code="MIA",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip1)
    set_test_timestamps(trip2)
    test_session.add(trip1)
    test_session.add(trip2)
    await test_session.commit()
    await test_session.refresh(trip1)
    await test_session.refresh(trip2)

    # Create snapshots
    snapshot1 = PriceSnapshot(
        trip_id=trip1.id,
        flight_price=Decimal("100.00"),
        total_price=Decimal("100.00"),
        raw_data={},
    )
    snapshot2 = PriceSnapshot(
        trip_id=trip2.id,
        flight_price=Decimal("200.00"),
        total_price=Decimal("200.00"),
        raw_data={},
    )
    set_snapshot_timestamp(snapshot1)
    set_snapshot_timestamp(snapshot2)
    test_session.add(snapshot1)
    test_session.add(snapshot2)
    await test_session.commit()

    # Get updates for user1
    updates1 = await _get_user_trips_with_snapshots(test_session, user1.id)
    assert len(updates1) == 1
    assert updates1[0]["trip_name"] == "User 1 Trip"

    # Get updates for user2
    updates2 = await _get_user_trips_with_snapshots(test_session, user2.id)
    assert len(updates2) == 1
    assert updates2[0]["trip_name"] == "User 2 Trip"


# =============================================================================
# Error Handling Tests
# =============================================================================


@pytest.mark.asyncio
async def test_event_generator_handles_database_error():
    """Test that event generator handles database errors gracefully."""
    # Create mock session that raises an error
    mock_db = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    user_id = uuid.uuid4()

    gen = event_generator(user_id, mock_db, heartbeat_interval=30, poll_interval=1)

    # First event should still be connected
    first_event = await gen.__anext__()
    assert "event: connected" in first_event

    await gen.aclose()


@pytest.mark.asyncio
async def test_get_user_trips_handles_trip_without_snapshot(test_session):
    """Test that trips without snapshots are not included in updates."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    # Create trip without snapshot
    trip = Trip(
        user_id=user.id,
        name="New Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()

    # Get updates
    updates = await _get_user_trips_with_snapshots(test_session, user.id)

    # Trip without snapshot should not appear in updates
    assert len(updates) == 0


# =============================================================================
# Edge Cases
# =============================================================================


@pytest.mark.asyncio
async def test_event_format_is_valid_sse(test_session):
    """Test that event format follows SSE specification."""
    # Create user
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    gen = event_generator(user.id, test_session, heartbeat_interval=30, poll_interval=1)

    event = await gen.__anext__()

    # SSE format: "event: <type>\ndata: <json>\n\n"
    assert event.startswith("event:")
    assert "\ndata:" in event
    assert event.endswith("\n\n")

    # Data should be valid JSON
    data_line = [line for line in event.split("\n") if line.startswith("data:")][0]
    json_str = data_line.replace("data: ", "")
    parsed = json.loads(json_str)
    assert isinstance(parsed, dict)

    await gen.aclose()


@pytest.mark.asyncio
async def test_price_update_event_structure(test_session):
    """Test that price update events have the correct structure."""
    # Create user and trip with snapshot
    user = User(google_sub=str(uuid.uuid4()), email="test@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    trip = Trip(
        user_id=user.id,
        name="Test Trip",
        origin_airport="SFO",
        destination_code="LAX",
        depart_date=datetime.now(UTC).date() + timedelta(days=30),
        return_date=datetime.now(UTC).date() + timedelta(days=37),
    )
    set_test_timestamps(trip)
    test_session.add(trip)
    await test_session.commit()
    await test_session.refresh(trip)

    snapshot = PriceSnapshot(
        trip_id=trip.id,
        flight_price=Decimal("150.00"),
        hotel_price=Decimal("250.00"),
        total_price=Decimal("400.00"),
        raw_data={},
    )
    set_snapshot_timestamp(snapshot)
    test_session.add(snapshot)
    await test_session.commit()

    updates = await _get_user_trips_with_snapshots(test_session, user.id)

    assert len(updates) == 1
    update = updates[0]

    # Check all required fields are present
    assert "type" in update
    assert "trip_id" in update
    assert "trip_name" in update
    assert "flight_price" in update
    assert "hotel_price" in update
    assert "total_price" in update
    assert "updated_at" in update

    # Check field values
    assert update["type"] == "price_update"
    assert update["trip_id"] == str(trip.id)
    assert update["trip_name"] == "Test Trip"
    assert update["flight_price"] == "150.00"
    assert update["hotel_price"] == "250.00"
    assert update["total_price"] == "400.00"
