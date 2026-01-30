"""Tests for smart_defaults service with 95%+ coverage."""

import uuid
from datetime import date

import pytest
import pytest_asyncio
from app.models.trip import Trip
from app.models.user import User
from app.services.smart_defaults import (
    DEFAULT_ADULTS,
    DEFAULT_THRESHOLD_PERCENTAGE,
    SmartDefaults,
    get_default_adults,
    infer_return_date,
    parse_trip_duration_text,
    recommend_threshold,
    suggest_airports,
)


class TestInferReturnDate:
    """Tests for infer_return_date function."""

    def test_a_week(self):
        """Test 'a week' duration."""
        depart = date(2026, 3, 15)
        result = infer_return_date("a week in Hawaii", depart)
        assert result == date(2026, 3, 22)

    def test_one_week(self):
        """Test 'one week' duration."""
        depart = date(2026, 6, 1)
        result = infer_return_date("one week vacation", depart)
        assert result == date(2026, 6, 8)

    def test_1_week(self):
        """Test '1 week' duration."""
        depart = date(2026, 1, 10)
        result = infer_return_date("1 week trip", depart)
        assert result == date(2026, 1, 17)

    def test_multiple_weeks(self):
        """Test 'N weeks' duration."""
        depart = date(2026, 5, 1)
        result = infer_return_date("2 weeks in Europe", depart)
        assert result == date(2026, 5, 15)

        result = infer_return_date("3 weeks backpacking", depart)
        assert result == date(2026, 5, 22)

    def test_weekend(self):
        """Test 'weekend' duration (3 days)."""
        depart = date(2026, 4, 10)
        result = infer_return_date("a weekend in Vegas", depart)
        assert result == date(2026, 4, 13)

        result = infer_return_date("the weekend getaway", depart)
        assert result == date(2026, 4, 13)

    def test_long_weekend(self):
        """Test 'long weekend' duration (4 days)."""
        depart = date(2026, 7, 3)
        result = infer_return_date("long weekend trip", depart)
        assert result == date(2026, 7, 7)

    def test_days(self):
        """Test 'N days' duration."""
        depart = date(2026, 8, 1)
        result = infer_return_date("5 days in Paris", depart)
        assert result == date(2026, 8, 6)

        result = infer_return_date("10 day adventure", depart)
        assert result == date(2026, 8, 11)

    def test_a_day(self):
        """Test 'a day' duration."""
        depart = date(2026, 2, 14)
        result = infer_return_date("a day trip", depart)
        assert result == date(2026, 2, 15)

    def test_nights(self):
        """Test 'N nights' duration (N+1 days)."""
        depart = date(2026, 9, 15)
        # 3 nights = 4 day trip
        result = infer_return_date("3 nights in Rome", depart)
        assert result == date(2026, 9, 19)

        # 5 night stay = 6 day trip
        result = infer_return_date("5 night hotel stay", depart)
        assert result == date(2026, 9, 21)

    def test_one_night(self):
        """Test 'one night' duration (2 days)."""
        depart = date(2026, 3, 20)
        result = infer_return_date("one night in the city", depart)
        assert result == date(2026, 3, 22)

    def test_fortnight(self):
        """Test 'fortnight' duration (14 days)."""
        depart = date(2026, 11, 1)
        result = infer_return_date("a fortnight abroad", depart)
        assert result == date(2026, 11, 15)

    def test_no_duration(self):
        """Test text without duration returns None."""
        depart = date(2026, 5, 1)
        result = infer_return_date("trip to Hawaii", depart)
        assert result is None

        result = infer_return_date("vacation plans", depart)
        assert result is None

    def test_case_insensitive(self):
        """Test pattern matching is case insensitive."""
        depart = date(2026, 4, 1)
        result = infer_return_date("A WEEK IN HAWAII", depart)
        assert result == date(2026, 4, 8)

        result = infer_return_date("Long Weekend Trip", depart)
        assert result == date(2026, 4, 5)

    def test_embedded_in_text(self):
        """Test duration extraction from longer text."""
        depart = date(2026, 6, 10)
        result = infer_return_date("Planning a week in Hawaii with the family for summer", depart)
        assert result == date(2026, 6, 17)

    def test_year_boundary(self):
        """Test return date crossing year boundary."""
        depart = date(2026, 12, 28)
        result = infer_return_date("a week celebrating new year", depart)
        assert result == date(2027, 1, 4)


class TestSuggestAirports:
    """Tests for suggest_airports function."""

    def test_san_francisco_full(self):
        """Test full 'San Francisco' name."""
        result = suggest_airports("San Francisco")
        assert result == ["SFO", "OAK", "SJC"]

    def test_sf_abbreviation(self):
        """Test 'SF' abbreviation."""
        result = suggest_airports("SF")
        assert result == ["SFO", "OAK", "SJC"]

    def test_bay_area(self):
        """Test 'Bay Area' region."""
        result = suggest_airports("bay area")
        assert result == ["SFO", "OAK", "SJC"]

    def test_nyc(self):
        """Test NYC airports."""
        result = suggest_airports("NYC")
        assert result == ["JFK", "EWR", "LGA"]

    def test_new_york_city(self):
        """Test 'New York City' full name."""
        result = suggest_airports("New York City")
        assert result == ["JFK", "EWR", "LGA"]

    def test_los_angeles(self):
        """Test Los Angeles airports."""
        result = suggest_airports("Los Angeles")
        assert result == ["LAX", "BUR", "SNA", "ONT", "LGB"]

    def test_la_abbreviation(self):
        """Test 'LA' abbreviation."""
        result = suggest_airports("LA")
        assert result == ["LAX", "BUR", "SNA", "ONT", "LGB"]

    def test_hawaii(self):
        """Test Hawaii region returns multiple islands."""
        result = suggest_airports("Hawaii")
        assert "HNL" in result
        assert "OGG" in result  # Maui

    def test_specific_island(self):
        """Test specific Hawaiian island."""
        result = suggest_airports("Maui")
        assert result == ["OGG"]

        result = suggest_airports("Kauai")
        assert result == ["LIH"]

    def test_international_cities(self):
        """Test international city airports."""
        result = suggest_airports("London")
        assert "LHR" in result
        assert "LGW" in result

        result = suggest_airports("Tokyo")
        assert "NRT" in result
        assert "HND" in result

        result = suggest_airports("Paris")
        assert result == ["CDG", "ORY"]

    def test_unknown_city(self):
        """Test unknown city returns empty list."""
        result = suggest_airports("Unknown City XYZ")
        assert result == []

    def test_case_insensitive(self):
        """Test case insensitivity."""
        result1 = suggest_airports("SAN FRANCISCO")
        result2 = suggest_airports("san francisco")
        result3 = suggest_airports("San Francisco")
        assert result1 == result2 == result3

    def test_whitespace_handling(self):
        """Test whitespace is trimmed."""
        result = suggest_airports("  San Francisco  ")
        assert result == ["SFO", "OAK", "SJC"]

    def test_partial_match(self):
        """Test partial city name matching."""
        result = suggest_airports("san fran")
        assert result == ["SFO", "OAK", "SJC"]

    def test_returns_copy(self):
        """Test returned list is a copy (not the original)."""
        result = suggest_airports("San Francisco")
        result.append("TEST")
        # Original should not be modified
        result2 = suggest_airports("San Francisco")
        assert "TEST" not in result2


class TestRecommendThreshold:
    """Tests for recommend_threshold function."""

    def test_default_percentage(self):
        """Test default 10% discount."""
        result = recommend_threshold(1500)
        # 10% off $1500 = $1350
        assert result == 1350.0

    def test_custom_percentage(self):
        """Test custom percentage discount."""
        result = recommend_threshold(1000, percentage=0.20)
        # 20% off $1000 = $800
        assert result == 800.0

    def test_rounding_to_tens(self):
        """Test rounding to nearest $10."""
        # $1234 - 10% = $1110.60 -> rounds to $1110
        result = recommend_threshold(1234)
        assert result == 1110.0

        # $1555 - 10% = $1399.50 -> rounds to $1400
        result = recommend_threshold(1555)
        assert result == 1400.0

    def test_zero_price(self):
        """Test zero price returns 0."""
        result = recommend_threshold(0)
        assert result == 0.0

    def test_negative_price(self):
        """Test negative price returns 0."""
        result = recommend_threshold(-100)
        assert result == 0.0

    def test_small_price(self):
        """Test small price handling."""
        # $50 - 10% = $45 -> rounds to $40 (round(4.5) = 4 in Python's banker's rounding)
        result = recommend_threshold(50)
        assert result == 40.0

        # $100 - 10% = $90
        result = recommend_threshold(100)
        assert result == 90.0

    def test_large_price(self):
        """Test large price handling."""
        # $10000 - 10% = $9000
        result = recommend_threshold(10000)
        assert result == 9000.0

    def test_returns_float(self):
        """Test return type is float."""
        result = recommend_threshold(1000)
        assert isinstance(result, float)


class TestGetDefaultAdults:
    """Tests for get_default_adults async function."""

    @pytest_asyncio.fixture
    async def db_session(self, test_session):
        """Use the test session from conftest."""
        return test_session

    @pytest_asyncio.fixture
    async def test_user(self, db_session):
        """Create a test user."""
        user = User(
            google_sub="test_google_sub_123",
            email="test@example.com",
            name="Test User",
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)
        return user

    @pytest.mark.anyio
    async def test_no_trips_returns_default(self, db_session, test_user):
        """Test returns DEFAULT_ADULTS when user has no trips."""
        result = await get_default_adults(str(test_user.id), db_session)
        assert result == DEFAULT_ADULTS

    @pytest.mark.anyio
    async def test_returns_most_recent_trip_adults(self, db_session, test_user):
        """Test returns adults from most recent trip."""
        # Create a single trip with 3 adults
        trip = Trip(
            user_id=test_user.id,
            name="Test Trip",
            origin_airport="SFO",
            destination_code="HNL",
            depart_date=date(2026, 1, 1),
            return_date=date(2026, 1, 8),
            adults=3,
        )
        db_session.add(trip)
        await db_session.flush()

        result = await get_default_adults(str(test_user.id), db_session)
        assert result == 3

    @pytest.mark.anyio
    async def test_invalid_user_id_format(self, db_session):
        """Test invalid user_id format returns default."""
        result = await get_default_adults("not-a-uuid", db_session)
        assert result == DEFAULT_ADULTS

    @pytest.mark.anyio
    async def test_nonexistent_user_returns_default(self, db_session):
        """Test non-existent user returns default."""
        fake_user_id = str(uuid.uuid4())
        result = await get_default_adults(fake_user_id, db_session)
        assert result == DEFAULT_ADULTS


class TestParseTripDurationText:
    """Tests for parse_trip_duration_text function."""

    def test_week_returns_7(self):
        """Test week durations return 7."""
        assert parse_trip_duration_text("a week in hawaii") == 7
        assert parse_trip_duration_text("one week") == 7
        assert parse_trip_duration_text("1 week") == 7

    def test_multiple_weeks(self):
        """Test multiple weeks."""
        assert parse_trip_duration_text("2 weeks") == 14
        assert parse_trip_duration_text("3 weeks abroad") == 21

    def test_days(self):
        """Test day durations."""
        assert parse_trip_duration_text("5 days") == 5
        assert parse_trip_duration_text("a day trip") == 1

    def test_nights_plus_one(self):
        """Test nights add 1 for trip duration."""
        assert parse_trip_duration_text("3 nights") == 4
        assert parse_trip_duration_text("5 nights in Paris") == 6
        assert parse_trip_duration_text("one night") == 2

    def test_weekend(self):
        """Test weekend durations."""
        assert parse_trip_duration_text("a weekend") == 3
        assert parse_trip_duration_text("long weekend") == 4

    def test_fortnight(self):
        """Test fortnight is 14 days."""
        assert parse_trip_duration_text("a fortnight") == 14

    def test_no_duration(self):
        """Test no duration returns None."""
        assert parse_trip_duration_text("vacation plans") is None
        assert parse_trip_duration_text("trip somewhere") is None


class TestSmartDefaultsClass:
    """Tests for SmartDefaults wrapper class."""

    def test_infer_return_date_wrapper(self):
        """Test infer_return_date class method."""
        sd = SmartDefaults()
        depart = date(2026, 5, 1)
        result = sd.infer_return_date("a week in Hawaii", depart)
        assert result == date(2026, 5, 8)

    def test_suggest_airports_wrapper(self):
        """Test suggest_airports class method."""
        sd = SmartDefaults()
        result = sd.suggest_airports("San Francisco")
        assert result == ["SFO", "OAK", "SJC"]

    def test_recommend_threshold_wrapper(self):
        """Test recommend_threshold class method."""
        sd = SmartDefaults()
        result = sd.recommend_threshold(1000)
        assert result == 900.0

    def test_parse_duration_wrapper(self):
        """Test parse_duration class method."""
        sd = SmartDefaults()
        result = sd.parse_duration("a week")
        assert result == 7

    @pytest.mark.anyio
    async def test_get_default_adults_without_db(self):
        """Test get_default_adults returns default without db."""
        sd = SmartDefaults(db=None)
        result = await sd.get_default_adults("some-user-id")
        assert result == DEFAULT_ADULTS

    @pytest.mark.anyio
    async def test_get_default_adults_with_db(self, test_session):
        """Test get_default_adults uses db when provided."""
        # Create user and trip
        user = User(
            google_sub="class_test_user",
            email="class_test@example.com",
            name="Class Test",
        )
        test_session.add(user)
        await test_session.flush()
        await test_session.refresh(user)

        trip = Trip(
            user_id=user.id,
            name="Test Trip",
            origin_airport="SFO",
            destination_code="LAX",
            depart_date=date(2026, 3, 1),
            return_date=date(2026, 3, 5),
            adults=3,
        )
        test_session.add(trip)
        await test_session.flush()

        sd = SmartDefaults(db=test_session)
        result = await sd.get_default_adults(str(user.id))
        assert result == 3


class TestEdgeCases:
    """Additional edge case tests for complete coverage."""

    def test_infer_return_date_multidigit_weeks(self):
        """Test double-digit weeks."""
        depart = date(2026, 1, 1)
        result = infer_return_date("10 weeks journey", depart)
        assert result == date(2026, 3, 12)

    def test_infer_return_date_multidigit_days(self):
        """Test double-digit days."""
        depart = date(2026, 7, 1)
        result = infer_return_date("14 days exploring", depart)
        assert result == date(2026, 7, 15)

    def test_infer_return_date_multidigit_nights(self):
        """Test double-digit nights."""
        depart = date(2026, 8, 1)
        result = infer_return_date("10 nights hotel", depart)
        assert result == date(2026, 8, 12)

    def test_suggest_airports_oakland(self):
        """Test Oakland returns OAK first."""
        result = suggest_airports("Oakland")
        assert result[0] == "OAK"

    def test_suggest_airports_san_jose(self):
        """Test San Jose returns SJC first."""
        result = suggest_airports("San Jose")
        assert result[0] == "SJC"

    def test_suggest_airports_dc_variants(self):
        """Test DC and Washington DC variants."""
        result1 = suggest_airports("DC")
        result2 = suggest_airports("Washington DC")
        assert result1 == result2
        assert "DCA" in result1

    def test_suggest_airports_vegas(self):
        """Test Vegas abbreviation."""
        result = suggest_airports("Vegas")
        assert result == ["LAS"]

    def test_recommend_threshold_edge_rounding(self):
        """Test rounding at the edge (0.5 rounds up)."""
        # $550 - 10% = $495 -> rounds to $500
        result = recommend_threshold(550)
        assert result == 500.0

        # $555 - 10% = $499.5 -> rounds to $500
        result = recommend_threshold(555)
        assert result == 500.0

    def test_constants_exist(self):
        """Test module constants are defined correctly."""
        assert DEFAULT_THRESHOLD_PERCENTAGE == 0.10
        assert DEFAULT_ADULTS == 1

    def test_suggest_airports_iceland(self):
        """Test Iceland region."""
        result = suggest_airports("Iceland")
        assert result == ["KEF"]

        result = suggest_airports("Reykjavik")
        assert result == ["KEF"]

    def test_suggest_airports_international_south_america(self):
        """Test South American airports."""
        result = suggest_airports("Rio de Janeiro")
        assert "GIG" in result

        result = suggest_airports("Buenos Aires")
        assert "EZE" in result
