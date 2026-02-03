"""Tests for the system prompts module."""

import uuid
from datetime import UTC, date, datetime

import pytest
from app.core.constants import TripStatus
from app.core.prompts import (
    TRAVEL_ASSISTANT_PROMPT,
    TripSummary,
    build_minimal_system_prompt,
    build_system_prompt,
    build_user_context,
    format_trip_summary,
    get_date_context,
)
from app.models.trip import Trip
from app.models.user import User

# =============================================================================
# FIXTURES
# =============================================================================


@pytest.fixture
def sample_user() -> User:
    """Create a sample user for testing."""
    return User(
        id=uuid.uuid4(),
        email="test@example.com",
        google_sub="google_123456",
        created_at=datetime(2025, 1, 15, 10, 0, 0, tzinfo=UTC),
        updated_at=datetime(2025, 1, 15, 10, 0, 0, tzinfo=UTC),
    )


@pytest.fixture
def sample_trip() -> Trip:
    """Create a sample trip for testing."""
    return Trip(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Hawaii Vacation",
        origin_airport="SFO",
        destination_code="HNL",
        is_round_trip=True,
        depart_date=date(2026, 3, 15),
        return_date=date(2026, 3, 22),
        adults=2,
        status=TripStatus.ACTIVE,
        created_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=UTC),
        updated_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=UTC),
    )


@pytest.fixture
def sample_trips() -> list[Trip]:
    """Create multiple sample trips for testing."""
    base_user_id = uuid.uuid4()
    return [
        Trip(
            id=uuid.uuid4(),
            user_id=base_user_id,
            name="Hawaii Vacation",
            origin_airport="SFO",
            destination_code="HNL",
            is_round_trip=True,
            depart_date=date(2026, 3, 15),
            return_date=date(2026, 3, 22),
            adults=2,
            status=TripStatus.ACTIVE,
            created_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=UTC),
            updated_at=datetime(2025, 1, 20, 10, 0, 0, tzinfo=UTC),
        ),
        Trip(
            id=uuid.uuid4(),
            user_id=base_user_id,
            name="Europe Trip",
            origin_airport="JFK",
            destination_code="CDG",
            is_round_trip=True,
            depart_date=date(2026, 6, 1),
            return_date=date(2026, 6, 15),
            adults=1,
            status=TripStatus.ACTIVE,
            created_at=datetime(2025, 1, 22, 10, 0, 0, tzinfo=UTC),
            updated_at=datetime(2025, 1, 22, 10, 0, 0, tzinfo=UTC),
        ),
        Trip(
            id=uuid.uuid4(),
            user_id=base_user_id,
            name="Japan Adventure",
            origin_airport="LAX",
            destination_code="NRT",
            is_round_trip=True,
            depart_date=date(2026, 4, 10),
            return_date=date(2026, 4, 24),
            adults=2,
            status=TripStatus.PAUSED,
            created_at=datetime(2025, 1, 25, 10, 0, 0, tzinfo=UTC),
            updated_at=datetime(2025, 1, 25, 10, 0, 0, tzinfo=UTC),
        ),
    ]


# =============================================================================
# BASE PROMPT TESTS
# =============================================================================


def test_travel_assistant_prompt_contains_persona():
    """Test that the base prompt contains the travel assistant persona."""
    assert "travel assistant" in TRAVEL_ASSISTANT_PROMPT.lower()
    assert "Vacation Price Tracker" in TRAVEL_ASSISTANT_PROMPT


def test_travel_assistant_prompt_contains_capabilities():
    """Test that the base prompt lists key capabilities."""
    assert "Creating new price tracking trips" in TRAVEL_ASSISTANT_PROMPT
    assert "Listing and managing existing trips" in TRAVEL_ASSISTANT_PROMPT
    assert "Setting price alert thresholds" in TRAVEL_ASSISTANT_PROMPT


def test_travel_assistant_prompt_contains_trip_creation_guidance():
    """Test that the base prompt mentions trip creation guidance."""
    # Prompt should mention that tool opens form for missing fields
    assert "form" in TRAVEL_ASSISTANT_PROMPT
    # And that it should call trigger_refresh_trip after creating
    assert "trigger_refresh_trip" in TRAVEL_ASSISTANT_PROMPT


def test_travel_assistant_prompt_contains_iata_examples():
    """Test that the base prompt includes common IATA code examples."""
    assert "SFO" in TRAVEL_ASSISTANT_PROMPT
    assert "LAX" in TRAVEL_ASSISTANT_PROMPT
    assert "JFK" in TRAVEL_ASSISTANT_PROMPT
    assert "HNL" in TRAVEL_ASSISTANT_PROMPT


def test_travel_assistant_prompt_has_user_context_placeholder():
    """Test that the base prompt has a placeholder for user context."""
    assert "{user_context}" in TRAVEL_ASSISTANT_PROMPT


def test_travel_assistant_prompt_contains_example_interactions():
    """Test that the base prompt contains example interactions."""
    assert "Example Interactions" in TRAVEL_ASSISTANT_PROMPT
    assert "Creating a trip" in TRAVEL_ASSISTANT_PROMPT


# =============================================================================
# TRIP SUMMARY TESTS
# =============================================================================


def test_trip_summary_dataclass():
    """Test TripSummary dataclass creation."""
    summary = TripSummary(
        id="123",
        name="Test Trip",
        route="SFO → HNL",
        dates="2026-03-15 to 2026-03-22",
        status="active",
        current_price=1500.00,
    )

    assert summary.id == "123"
    assert summary.name == "Test Trip"
    assert summary.route == "SFO → HNL"
    assert summary.dates == "2026-03-15 to 2026-03-22"
    assert summary.status == "active"
    assert summary.current_price == 1500.00


def test_trip_summary_optional_price():
    """Test TripSummary with no price."""
    summary = TripSummary(
        id="123",
        name="Test Trip",
        route="SFO → HNL",
        dates="2026-03-15 to 2026-03-22",
        status="active",
    )

    assert summary.current_price is None


def test_format_trip_summary(sample_trip: Trip):
    """Test formatting a Trip into a TripSummary."""
    summary = format_trip_summary(sample_trip, current_price=1500.00)

    assert summary.id == str(sample_trip.id)
    assert summary.name == "Hawaii Vacation"
    assert summary.route == "SFO → HNL"
    assert summary.dates == "2026-03-15 to 2026-03-22"
    assert summary.status == "active"
    assert summary.current_price == 1500.00


def test_format_trip_summary_no_price(sample_trip: Trip):
    """Test formatting a Trip without price."""
    summary = format_trip_summary(sample_trip)

    assert summary.current_price is None


# =============================================================================
# USER CONTEXT TESTS
# =============================================================================


def test_build_user_context_basic(sample_user: User):
    """Test building user context with just user info."""
    context = build_user_context(sample_user)

    assert "Current User Context" in context
    assert "test@example.com" in context
    assert "January 15, 2025" in context
    assert "No trips created yet" in context


def test_build_user_context_with_trips(sample_user: User, sample_trips: list[Trip]):
    """Test building user context with trips."""
    context = build_user_context(sample_user, trips=sample_trips)

    assert "3 total" in context
    assert "Active Trips" in context
    assert "Paused Trips" in context
    assert "Hawaii Vacation" in context
    assert "Europe Trip" in context
    assert "Japan Adventure" in context
    assert "SFO → HNL" in context
    assert "JFK → CDG" in context
    assert "LAX → NRT" in context


def test_build_user_context_with_trip_prices(sample_user: User, sample_trips: list[Trip]):
    """Test building user context with trip prices."""
    trip_prices = {str(sample_trips[0].id): 1500.00, str(sample_trips[1].id): 2500.00}

    context = build_user_context(sample_user, trips=sample_trips, trip_prices=trip_prices)

    assert "$1,500.00" in context
    assert "$2,500.00" in context


def test_build_user_context_shows_remaining_slots(sample_user: User):
    """Test that user context shows remaining trip slots when low."""
    # Create 8 trips to leave only 2 slots
    trips = [
        Trip(
            id=uuid.uuid4(),
            user_id=sample_user.id,
            name=f"Trip {i}",
            origin_airport="SFO",
            destination_code="HNL",
            depart_date=date(2026, 3, 15),
            return_date=date(2026, 3, 22),
            status=TripStatus.ACTIVE,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        for i in range(8)
    ]

    context = build_user_context(sample_user, trips=trips)

    assert "2 trip slots remaining" in context


def test_build_user_context_no_warning_when_many_slots(sample_user: User, sample_trips: list[Trip]):
    """Test that no warning appears when user has many slots remaining."""
    context = build_user_context(sample_user, trips=sample_trips)

    # With 3 trips, user has 7 slots remaining - no warning
    assert "trip slots remaining" not in context


# =============================================================================
# FULL SYSTEM PROMPT TESTS
# =============================================================================


def test_build_system_prompt_basic(sample_user: User):
    """Test building complete system prompt."""
    prompt = build_system_prompt(sample_user)

    # Should contain base prompt content
    assert "travel assistant" in prompt.lower()
    assert "Vacation Price Tracker" in prompt

    # Should contain user context
    assert "test@example.com" in prompt


def test_build_system_prompt_with_trips(sample_user: User, sample_trips: list[Trip]):
    """Test building system prompt with trips."""
    prompt = build_system_prompt(sample_user, trips=sample_trips)

    assert "Hawaii Vacation" in prompt
    assert "Europe Trip" in prompt
    assert "Japan Adventure" in prompt


def test_build_system_prompt_with_prices(sample_user: User, sample_trips: list[Trip]):
    """Test building system prompt with trip prices."""
    trip_prices = {str(sample_trips[0].id): 1500.00}

    prompt = build_system_prompt(sample_user, trips=sample_trips, trip_prices=trip_prices)

    assert "$1,500.00" in prompt


def test_build_minimal_system_prompt():
    """Test building minimal system prompt without user context."""
    prompt = build_minimal_system_prompt()

    # Should contain base prompt content
    assert "travel assistant" in prompt.lower()
    assert "Vacation Price Tracker" in prompt

    # Should NOT contain user context section header (since it's empty)
    assert "Current User Context" not in prompt


# =============================================================================
# UTILITY FUNCTION TESTS
# =============================================================================


def test_get_date_context():
    """Test getting current date context."""
    context = get_date_context()
    today = date.today()

    assert today.strftime("%B") in context  # Month name
    assert today.isoformat() in context  # ISO format date
    assert "Today's date is" in context


def test_system_prompt_is_valid_format_string():
    """Test that the system prompt can be formatted without errors."""
    # This should not raise
    result = TRAVEL_ASSISTANT_PROMPT.format(user_context="Test context")

    assert "Test context" in result


def test_system_prompt_no_extra_format_placeholders():
    """Test that the system prompt only has the expected placeholder."""
    # Remove the expected placeholder and check no others exist
    test_prompt = TRAVEL_ASSISTANT_PROMPT.replace("{user_context}", "")

    # Should not contain any other format placeholders
    assert "{" not in test_prompt or "}" not in test_prompt.split("{")[-1]
