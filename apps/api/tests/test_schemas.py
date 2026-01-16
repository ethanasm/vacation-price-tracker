"""Tests for Pydantic schemas validation."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from app.core.constants import CabinClass, StopsMode, ThresholdType, TripStatus
from app.schemas.trip import (
    FlightPrefs,
    HotelPrefs,
    NotificationPrefs,
    TripCreate,
    TripStatusUpdate,
)
from pydantic import ValidationError


class TestFlightPrefs:
    """Tests for FlightPrefs schema."""

    def test_default_values(self):
        """Test default values are set correctly."""
        prefs = FlightPrefs()
        assert prefs.airlines == []
        assert prefs.stops_mode == StopsMode.ANY
        assert prefs.max_stops is None
        assert prefs.cabin == CabinClass.ECONOMY

    def test_valid_airline_codes(self):
        """Test valid 2-character airline codes are accepted."""
        prefs = FlightPrefs(airlines=["UA", "AA", "DL", "B6"])
        assert prefs.airlines == ["UA", "AA", "DL", "B6"]

    def test_invalid_airline_code_too_long(self):
        """Test airline codes longer than 2 chars are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FlightPrefs(airlines=["UAL"])
        assert "Invalid airline code" in str(exc_info.value)

    def test_invalid_airline_code_too_short(self):
        """Test airline codes shorter than 2 chars are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FlightPrefs(airlines=["U"])
        assert "Invalid airline code" in str(exc_info.value)

    def test_max_stops_constraints(self):
        """Test max_stops must be between 0 and 3."""
        prefs = FlightPrefs(max_stops=0)
        assert prefs.max_stops == 0

        prefs = FlightPrefs(max_stops=3)
        assert prefs.max_stops == 3

        with pytest.raises(ValidationError):
            FlightPrefs(max_stops=-1)

        with pytest.raises(ValidationError):
            FlightPrefs(max_stops=4)


class TestHotelPrefs:
    """Tests for HotelPrefs schema."""

    def test_default_values(self):
        """Test default values are set correctly."""
        prefs = HotelPrefs()
        assert prefs.rooms == 1
        assert prefs.adults_per_room == 2
        assert prefs.preferred_room_types == []
        assert prefs.preferred_views == []

    def test_rooms_constraints(self):
        """Test rooms must be between 1 and 9."""
        prefs = HotelPrefs(rooms=1)
        assert prefs.rooms == 1

        prefs = HotelPrefs(rooms=9)
        assert prefs.rooms == 9

        with pytest.raises(ValidationError):
            HotelPrefs(rooms=0)

        with pytest.raises(ValidationError):
            HotelPrefs(rooms=10)

    def test_adults_per_room_constraints(self):
        """Test adults_per_room must be between 1 and 4."""
        prefs = HotelPrefs(adults_per_room=1)
        assert prefs.adults_per_room == 1

        prefs = HotelPrefs(adults_per_room=4)
        assert prefs.adults_per_room == 4

        with pytest.raises(ValidationError):
            HotelPrefs(adults_per_room=0)

        with pytest.raises(ValidationError):
            HotelPrefs(adults_per_room=5)


class TestNotificationPrefs:
    """Tests for NotificationPrefs schema."""

    def test_valid_notification_prefs(self):
        """Test valid notification preferences."""
        prefs = NotificationPrefs(threshold_value=Decimal("500.00"))
        assert prefs.threshold_type == ThresholdType.TRIP_TOTAL
        assert prefs.threshold_value == Decimal("500.00")
        assert prefs.email_enabled is True
        assert prefs.sms_enabled is False

    def test_threshold_value_required(self):
        """Test threshold_value is required."""
        with pytest.raises(ValidationError) as exc_info:
            NotificationPrefs()
        assert "threshold_value" in str(exc_info.value)

    def test_threshold_value_non_negative(self):
        """Test threshold_value cannot be negative."""
        with pytest.raises(ValidationError):
            NotificationPrefs(threshold_value=Decimal("-1.00"))


class TestTripCreate:
    """Tests for TripCreate schema."""

    @pytest.fixture
    def valid_trip_data(self):
        """Valid trip creation data."""
        return {
            "name": "Hawaii Vacation",
            "origin_airport": "SFO",
            "destination_code": "HNL",
            "depart_date": date.today() + timedelta(days=30),
            "return_date": date.today() + timedelta(days=37),
            "notification_prefs": {"threshold_value": Decimal("2000.00")},
        }

    def test_valid_trip_creation(self, valid_trip_data):
        """Test valid trip creation."""
        trip = TripCreate(**valid_trip_data)
        assert trip.name == "Hawaii Vacation"
        assert trip.origin_airport == "SFO"
        assert trip.destination_code == "HNL"
        assert trip.is_round_trip is True
        assert trip.adults == 1

    def test_name_min_length(self):
        """Test name must have at least 1 character."""
        with pytest.raises(ValidationError) as exc_info:
            TripCreate(
                name="",
                origin_airport="SFO",
                destination_code="HNL",
                depart_date=date.today() + timedelta(days=30),
                return_date=date.today() + timedelta(days=37),
                notification_prefs={"threshold_value": Decimal("2000.00")},
            )
        assert "name" in str(exc_info.value).lower()

    def test_name_max_length(self, valid_trip_data):
        """Test name cannot exceed 100 characters."""
        valid_trip_data["name"] = "A" * 101
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

    def test_iata_code_format_valid(self, valid_trip_data):
        """Test valid IATA codes (3 uppercase letters)."""
        valid_trip_data["origin_airport"] = "LAX"
        valid_trip_data["destination_code"] = "MCO"
        trip = TripCreate(**valid_trip_data)
        assert trip.origin_airport == "LAX"
        assert trip.destination_code == "MCO"

    def test_iata_code_format_invalid_lowercase(self, valid_trip_data):
        """Test lowercase IATA codes are rejected."""
        valid_trip_data["origin_airport"] = "sfo"
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

    def test_iata_code_format_invalid_length(self, valid_trip_data):
        """Test IATA codes must be exactly 3 characters."""
        valid_trip_data["origin_airport"] = "SF"
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

        valid_trip_data["origin_airport"] = "SFOO"
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

    def test_iata_code_format_invalid_numbers(self, valid_trip_data):
        """Test IATA codes cannot contain numbers."""
        valid_trip_data["origin_airport"] = "SF1"
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

    def test_return_date_must_be_after_depart(self, valid_trip_data):
        """Test return_date must be after depart_date."""
        valid_trip_data["depart_date"] = date.today() + timedelta(days=30)
        valid_trip_data["return_date"] = date.today() + timedelta(days=30)
        with pytest.raises(ValidationError) as exc_info:
            TripCreate(**valid_trip_data)
        assert "return_date must be after depart_date" in str(exc_info.value)

    def test_return_date_before_depart(self, valid_trip_data):
        """Test return_date before depart_date is rejected."""
        valid_trip_data["depart_date"] = date.today() + timedelta(days=30)
        valid_trip_data["return_date"] = date.today() + timedelta(days=25)
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

    def test_date_cannot_be_in_past(self, valid_trip_data):
        """Test dates cannot be in the past."""
        valid_trip_data["depart_date"] = date.today() - timedelta(days=1)
        valid_trip_data["return_date"] = date.today() + timedelta(days=7)
        with pytest.raises(ValidationError) as exc_info:
            TripCreate(**valid_trip_data)
        assert "cannot be in the past" in str(exc_info.value)

    def test_date_within_359_days(self, valid_trip_data):
        """Test dates cannot be more than 359 days out (Amadeus limit)."""
        valid_trip_data["depart_date"] = date.today() + timedelta(days=360)
        valid_trip_data["return_date"] = date.today() + timedelta(days=367)
        with pytest.raises(ValidationError) as exc_info:
            TripCreate(**valid_trip_data)
        assert "359 days" in str(exc_info.value)

    def test_adults_constraints(self, valid_trip_data):
        """Test adults must be between 1 and 9."""
        valid_trip_data["adults"] = 1
        trip = TripCreate(**valid_trip_data)
        assert trip.adults == 1

        valid_trip_data["adults"] = 9
        trip = TripCreate(**valid_trip_data)
        assert trip.adults == 9

        valid_trip_data["adults"] = 0
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

        valid_trip_data["adults"] = 10
        with pytest.raises(ValidationError):
            TripCreate(**valid_trip_data)

    def test_notification_prefs_required(self, valid_trip_data):
        """Test notification_prefs is required."""
        del valid_trip_data["notification_prefs"]
        with pytest.raises(ValidationError) as exc_info:
            TripCreate(**valid_trip_data)
        assert "notification_prefs" in str(exc_info.value)

    def test_optional_flight_prefs(self, valid_trip_data):
        """Test flight_prefs is optional."""
        trip = TripCreate(**valid_trip_data)
        assert trip.flight_prefs is None

        valid_trip_data["flight_prefs"] = {"airlines": ["UA"]}
        trip = TripCreate(**valid_trip_data)
        assert trip.flight_prefs is not None
        assert trip.flight_prefs.airlines == ["UA"]

    def test_optional_hotel_prefs(self, valid_trip_data):
        """Test hotel_prefs is optional."""
        trip = TripCreate(**valid_trip_data)
        assert trip.hotel_prefs is None

        valid_trip_data["hotel_prefs"] = {"rooms": 2}
        trip = TripCreate(**valid_trip_data)
        assert trip.hotel_prefs is not None
        assert trip.hotel_prefs.rooms == 2


class TestTripStatusUpdate:
    """Tests for TripStatusUpdate schema."""

    def test_valid_status_active(self):
        """Test valid status update to active."""
        update = TripStatusUpdate(status=TripStatus.ACTIVE)
        assert update.status == TripStatus.ACTIVE

    def test_valid_status_paused(self):
        """Test valid status update to paused."""
        update = TripStatusUpdate(status=TripStatus.PAUSED)
        assert update.status == TripStatus.PAUSED

    def test_invalid_status_error(self):
        """Test ERROR status is not allowed for status update."""
        with pytest.raises(ValidationError):
            TripStatusUpdate(status=TripStatus.ERROR)
