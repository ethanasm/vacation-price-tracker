"""Tests for Amadeus MCP tool wrappers.

These tests cover:
- AmadeusFlightTool (amadeus_flights.py)
- AmadeusHotelTool (amadeus_hotels.py)
- AmadeusHotelOfferTool (amadeus_hotel_offers.py)

Target: 95%+ code coverage.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from app.clients.amadeus import AmadeusClientError
from app.tools.amadeus_flights import AmadeusFlightTool
from app.tools.amadeus_hotel_offers import AmadeusHotelOfferTool
from app.tools.amadeus_hotels import AmadeusHotelTool

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_amadeus_client():
    """Create a mock AmadeusClient."""
    return MagicMock()


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    return AsyncMock()


# =============================================================================
# AmadeusFlightTool Tests
# =============================================================================


class TestAmadeusFlightTool:
    """Tests for AmadeusFlightTool."""

    def test_tool_attributes(self):
        """Test tool has correct name and description."""
        tool = AmadeusFlightTool()
        assert tool.name == "search_flights_amadeus"
        assert "flight" in tool.description.lower()
        assert "Amadeus" in tool.description

    @pytest.mark.asyncio
    async def test_execute_success(self, mock_amadeus_client, mock_db):
        """Test successful flight search."""
        mock_amadeus_client.search_flights = AsyncMock(
            return_value={
                "data": [
                    {
                        "id": "1",
                        "price": {"grandTotal": "342.00", "currency": "USD", "base": "300.00"},
                        "validatingAirlineCodes": ["UA"],
                        "numberOfBookableSeats": 5,
                        "itineraries": [
                            {
                                "duration": "PT5H30M",
                                "segments": [
                                    {
                                        "carrierCode": "UA",
                                        "number": "200",
                                        "departure": {
                                            "iataCode": "SFO",
                                            "terminal": "3",
                                            "at": "2026-02-01T08:00:00",
                                        },
                                        "arrival": {
                                            "iataCode": "MCO",
                                            "terminal": "B",
                                            "at": "2026-02-01T16:30:00",
                                        },
                                        "duration": "PT5H30M",
                                        "aircraft": {"code": "737"},
                                        "cabin": "ECONOMY",
                                        "numberOfStops": 0,
                                        "operating": {"carrierCode": "UA"},
                                    }
                                ],
                            }
                        ],
                    }
                ],
                "meta": {"count": 1},
            }
        )

        tool = AmadeusFlightTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "MCO",
                "departure_date": "2026-02-01",
                "adults": 2,
            },
            user_id="test-user-123",
            db=mock_db,
        )

        assert result.success is True
        assert result.data is not None
        assert result.data["count"] == 1
        assert result.data["provider"] == "amadeus"
        assert len(result.data["flights"]) == 1

        flight = result.data["flights"][0]
        assert flight["id"] == "1"
        assert flight["price"]["total"] == "342.00"
        assert flight["validating_airlines"] == ["UA"]
        assert len(flight["itineraries"]) == 1

        segment = flight["itineraries"][0]["segments"][0]
        assert segment["flight_number"] == "UA200"
        assert segment["departure"]["airport"] == "SFO"
        assert segment["arrival"]["airport"] == "MCO"

    @pytest.mark.asyncio
    async def test_execute_missing_required_params(self, mock_amadeus_client, mock_db):
        """Test error when required parameters are missing."""
        tool = AmadeusFlightTool(client=mock_amadeus_client)

        # Missing origin
        result = await tool.execute(
            args={"destination": "MCO", "departure_date": "2026-02-01"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "Missing required parameters" in result.error

        # Missing destination
        result = await tool.execute(
            args={"origin": "SFO", "departure_date": "2026-02-01"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False

        # Missing departure_date
        result = await tool.execute(
            args={"origin": "SFO", "destination": "MCO"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False

    @pytest.mark.asyncio
    async def test_execute_amadeus_error(self, mock_amadeus_client, mock_db):
        """Test handling of AmadeusClientError."""
        mock_amadeus_client.search_flights = AsyncMock(side_effect=AmadeusClientError("API rate limit exceeded"))

        tool = AmadeusFlightTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "MCO",
                "departure_date": "2026-02-01",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Flight search failed" in result.error

    @pytest.mark.asyncio
    async def test_execute_unexpected_error(self, mock_amadeus_client, mock_db):
        """Test handling of unexpected exceptions."""
        mock_amadeus_client.search_flights = AsyncMock(side_effect=RuntimeError("Network connection failed"))

        tool = AmadeusFlightTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "MCO",
                "departure_date": "2026-02-01",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "unexpected error" in result.error.lower()

    @pytest.mark.asyncio
    async def test_execute_with_all_optional_params(self, mock_amadeus_client, mock_db):
        """Test flight search with all optional parameters."""
        mock_amadeus_client.search_flights = AsyncMock(return_value={"data": [], "meta": {}})

        tool = AmadeusFlightTool(client=mock_amadeus_client)
        await tool.execute(
            args={
                "origin": "SFO",
                "destination": "MCO",
                "departure_date": "2026-02-01",
                "return_date": "2026-02-08",
                "adults": 3,
                "travel_class": "BUSINESS",
                "non_stop": True,
                "max_results": 25,
            },
            user_id="test-user",
            db=mock_db,
        )

        mock_amadeus_client.search_flights.assert_called_once_with(
            origin="SFO",
            destination="MCO",
            departure_date="2026-02-01",
            return_date="2026-02-08",
            adults=3,
            travel_class="BUSINESS",
            non_stop=True,
            max_results=25,
        )

    @pytest.mark.asyncio
    async def test_execute_empty_results(self, mock_amadeus_client, mock_db):
        """Test handling of empty search results."""
        mock_amadeus_client.search_flights = AsyncMock(return_value={"data": [], "meta": {"count": 0}})

        tool = AmadeusFlightTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "XYZ",
                "departure_date": "2026-02-01",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        assert result.data["count"] == 0
        assert result.data["flights"] == []

    def test_format_results_handles_missing_price(self, mock_amadeus_client):
        """Test formatting handles missing price fields."""
        tool = AmadeusFlightTool(client=mock_amadeus_client)

        result = tool._format_results(
            {
                "data": [
                    {
                        "id": "1",
                        "price": {"total": "299.00"},  # No grandTotal
                        "validatingAirlineCodes": ["UA"],
                        "itineraries": [],
                    }
                ],
                "meta": {},
            }
        )

        assert result["flights"][0]["price"]["total"] == "299.00"

    def test_format_single_offer_handles_invalid_data(self, mock_amadeus_client):
        """Test _format_single_offer handles malformed data."""
        tool = AmadeusFlightTool(client=mock_amadeus_client)

        # Test with None
        result = tool._format_single_offer(None)
        assert result is None

        # Test with missing required fields (triggers TypeError)
        result = tool._format_single_offer({"id": "1"})
        # Should still return partial data since we use .get() with defaults
        assert result is not None
        assert result["id"] == "1"

    def test_format_itinerary_handles_invalid_data(self, mock_amadeus_client):
        """Test _format_itinerary handles malformed data."""
        tool = AmadeusFlightTool(client=mock_amadeus_client)

        # Test with None
        result = tool._format_itinerary(None)
        assert result is None

        # Test with empty segments
        result = tool._format_itinerary({"segments": [], "duration": "PT5H"})
        assert result is not None
        assert result["segments"] == []
        assert result["segment_count"] == 0

    def test_format_itinerary_complete_segment(self, mock_amadeus_client):
        """Test _format_itinerary with complete segment data."""
        tool = AmadeusFlightTool(client=mock_amadeus_client)

        result = tool._format_itinerary(
            {
                "duration": "PT5H30M",
                "segments": [
                    {
                        "carrierCode": "UA",
                        "number": "100",
                        "departure": {"iataCode": "SFO", "terminal": "3", "at": "2026-02-01T08:00:00"},
                        "arrival": {"iataCode": "DEN", "terminal": "B", "at": "2026-02-01T11:30:00"},
                        "duration": "PT2H30M",
                        "aircraft": {"code": "737"},
                        "cabin": "ECONOMY",
                        "numberOfStops": 0,
                        "operating": {"carrierCode": "UA"},
                    }
                ],
            }
        )

        assert result["duration"] == "PT5H30M"
        assert result["segment_count"] == 1
        segment = result["segments"][0]
        assert segment["flight_number"] == "UA100"
        assert segment["aircraft"] == "737"
        assert segment["cabin"] == "ECONOMY"


# =============================================================================
# AmadeusHotelTool Tests
# =============================================================================


class TestAmadeusHotelTool:
    """Tests for AmadeusHotelTool."""

    def test_tool_attributes(self):
        """Test tool has correct name and description."""
        tool = AmadeusHotelTool()
        assert tool.name == "search_hotels"
        assert "hotel" in tool.description.lower()

    @pytest.mark.asyncio
    async def test_execute_success(self, mock_amadeus_client, mock_db):
        """Test successful hotel search."""
        mock_amadeus_client.search_hotels = AsyncMock(
            return_value={
                "data": [
                    {
                        "hotel": {
                            "hotelId": "HLMCO001",
                            "name": "Grand Hotel",
                            "chainCode": "HI",
                            "cityCode": "MCO",
                            "latitude": 28.4,
                            "longitude": -81.3,
                        },
                        "offers": [
                            {
                                "id": "offer-1",
                                "checkInDate": "2026-03-12",
                                "checkOutDate": "2026-03-14",
                                "price": {"total": "289.00", "currency": "USD", "base": "260.00"},
                                "room": {
                                    "type": "DOUBLE",
                                    "typeEstimated": {"category": "STANDARD"},
                                    "description": {"text": "Standard double room"},
                                },
                                "guests": {"adults": 2},
                                "policies": {
                                    "cancellation": {"description": {"text": "Free cancellation"}},
                                    "paymentType": "CREDIT_CARD",
                                },
                            }
                        ],
                    }
                ],
                "meta": {"count": 1, "provider": "amadeus"},
            }
        )

        tool = AmadeusHotelTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "city_code": "MCO",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
                "adults": 2,
            },
            user_id="test-user-123",
            db=mock_db,
        )

        assert result.success is True
        assert result.data is not None
        assert result.data["count"] == 1
        assert len(result.data["hotels"]) == 1

        hotel = result.data["hotels"][0]
        assert hotel["hotel_id"] == "HLMCO001"
        assert hotel["name"] == "Grand Hotel"
        assert hotel["cheapest_price"] == "289.0"
        assert len(hotel["offers"]) == 1

    @pytest.mark.asyncio
    async def test_execute_missing_required_params(self, mock_amadeus_client, mock_db):
        """Test error when required parameters are missing."""
        tool = AmadeusHotelTool(client=mock_amadeus_client)

        # Missing city_code
        result = await tool.execute(
            args={"check_in_date": "2026-03-12", "check_out_date": "2026-03-14"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "Missing required parameters" in result.error

        # Missing check_in_date
        result = await tool.execute(
            args={"city_code": "MCO", "check_out_date": "2026-03-14"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False

        # Missing check_out_date
        result = await tool.execute(
            args={"city_code": "MCO", "check_in_date": "2026-03-12"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False

    @pytest.mark.asyncio
    async def test_execute_amadeus_error(self, mock_amadeus_client, mock_db):
        """Test handling of AmadeusClientError."""
        mock_amadeus_client.search_hotels = AsyncMock(side_effect=AmadeusClientError("Invalid city code"))

        tool = AmadeusHotelTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "city_code": "XYZ",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Hotel search failed" in result.error

    @pytest.mark.asyncio
    async def test_execute_unexpected_error(self, mock_amadeus_client, mock_db):
        """Test handling of unexpected exceptions."""
        mock_amadeus_client.search_hotels = AsyncMock(side_effect=RuntimeError("Connection timeout"))

        tool = AmadeusHotelTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "city_code": "MCO",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "unexpected error" in result.error.lower()

    @pytest.mark.asyncio
    async def test_execute_with_all_optional_params(self, mock_amadeus_client, mock_db):
        """Test hotel search with all optional parameters."""
        mock_amadeus_client.search_hotels = AsyncMock(return_value={"data": [], "meta": {}})

        tool = AmadeusHotelTool(client=mock_amadeus_client)
        await tool.execute(
            args={
                "city_code": "MCO",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
                "adults": 3,
                "rooms": 2,
                "max_hotels": 30,
            },
            user_id="test-user",
            db=mock_db,
        )

        mock_amadeus_client.search_hotels.assert_called_once_with(
            city_code="MCO",
            check_in_date="2026-03-12",
            check_out_date="2026-03-14",
            adults=3,
            rooms=2,
            max_hotels=30,
        )

    @pytest.mark.asyncio
    async def test_execute_empty_results(self, mock_amadeus_client, mock_db):
        """Test handling of empty search results."""
        mock_amadeus_client.search_hotels = AsyncMock(
            return_value={"data": [], "meta": {"count": 0, "provider": "amadeus"}}
        )

        tool = AmadeusHotelTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "city_code": "XYZ",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        assert result.data["count"] == 0
        assert result.data["hotels"] == []

    def test_format_single_hotel_handles_invalid_data(self, mock_amadeus_client):
        """Test _format_single_hotel handles malformed data."""
        tool = AmadeusHotelTool(client=mock_amadeus_client)

        # Test with None
        result = tool._format_single_hotel(None)
        assert result is None

    def test_format_offer_handles_invalid_data(self, mock_amadeus_client):
        """Test _format_offer handles malformed data."""
        tool = AmadeusHotelTool(client=mock_amadeus_client)

        # Test with None
        result = tool._format_offer(None)
        assert result is None

        # Test with minimal data
        result = tool._format_offer({"id": "test"})
        assert result is not None
        assert result["offer_id"] == "test"

    def test_get_cheapest_price_empty_list(self, mock_amadeus_client):
        """Test _get_cheapest_price with empty list."""
        tool = AmadeusHotelTool(client=mock_amadeus_client)
        assert tool._get_cheapest_price([]) is None

    def test_get_cheapest_price_invalid_prices(self, mock_amadeus_client):
        """Test _get_cheapest_price with invalid price values."""
        tool = AmadeusHotelTool(client=mock_amadeus_client)

        # All invalid prices
        result = tool._get_cheapest_price([{"price": {"total": "invalid"}}])
        assert result is None

        # Mix of valid and invalid
        result = tool._get_cheapest_price([{"price": {"total": "invalid"}}, {"price": {"total": "199.00"}}])
        assert result == "199.0"

    def test_get_cheapest_price_multiple_offers(self, mock_amadeus_client):
        """Test _get_cheapest_price returns minimum price."""
        tool = AmadeusHotelTool(client=mock_amadeus_client)

        result = tool._get_cheapest_price(
            [
                {"price": {"total": "299.00"}},
                {"price": {"total": "199.00"}},
                {"price": {"total": "399.00"}},
            ]
        )
        assert result == "199.0"


# =============================================================================
# AmadeusHotelOfferTool Tests
# =============================================================================


class TestAmadeusHotelOfferTool:
    """Tests for AmadeusHotelOfferTool."""

    def test_tool_attributes(self):
        """Test tool has correct name and description."""
        tool = AmadeusHotelOfferTool()
        assert tool.name == "search_hotel_offers"
        assert "hotel" in tool.description.lower()

    @pytest.mark.asyncio
    async def test_execute_success(self, mock_amadeus_client, mock_db):
        """Test successful hotel offer search."""
        mock_amadeus_client.search_hotel_offers = AsyncMock(
            return_value={
                "data": [
                    {
                        "hotel": {
                            "hotelId": "HLMCO001",
                            "name": "Grand Hotel",
                            "chainCode": "HI",
                            "cityCode": "MCO",
                        },
                        "offers": [
                            {
                                "id": "offer-1",
                                "checkInDate": "2026-03-12",
                                "checkOutDate": "2026-03-14",
                                "price": {
                                    "total": "289.00",
                                    "currency": "USD",
                                    "base": "260.00",
                                    "variations": {"average": {"total": "144.50"}},
                                },
                                "room": {
                                    "type": "DOUBLE",
                                    "typeEstimated": {
                                        "category": "STANDARD",
                                        "beds": 1,
                                        "bedType": "KING",
                                    },
                                    "description": {"text": "Deluxe king room with city view"},
                                },
                                "guests": {"adults": 2},
                                "policies": {
                                    "cancellation": {
                                        "deadline": "2026-03-10T23:59:00",
                                        "amount": "0.00",
                                        "description": {"text": "Free cancellation until 48h before"},
                                    },
                                    "paymentType": "CREDIT_CARD",
                                    "guarantee": {
                                        "description": {"text": "Credit card required"},
                                        "acceptedPayments": {
                                            "creditCards": ["VI", "MC", "AX"],
                                            "methods": ["CREDIT_CARD"],
                                        },
                                    },
                                },
                                "rateFamilyEstimated": {"type": "PACKAGE"},
                                "boardType": "ROOM_ONLY",
                            }
                        ],
                    }
                ],
            }
        )

        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "hotel_id": "HLMCO001",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
                "adults": 2,
            },
            user_id="test-user-123",
            db=mock_db,
        )

        assert result.success is True
        assert result.data is not None
        assert result.data["hotel_id"] == "HLMCO001"
        assert result.data["hotel_name"] == "Grand Hotel"
        assert result.data["count"] == 1

        offer = result.data["offers"][0]
        assert offer["offer_id"] == "offer-1"
        assert offer["price"]["total"] == "289.00"
        assert offer["price"]["nightly_average"] == "144.50"
        assert offer["room"]["bed_type"] == "KING"
        assert offer["policies"]["guarantee"]["accepted_cards"] == ["VI", "MC", "AX"]

    @pytest.mark.asyncio
    async def test_execute_missing_required_params(self, mock_amadeus_client, mock_db):
        """Test error when required parameters are missing."""
        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)

        # Missing hotel_id
        result = await tool.execute(
            args={"check_in_date": "2026-03-12", "check_out_date": "2026-03-14"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "Missing required parameters" in result.error

        # Missing check_in_date
        result = await tool.execute(
            args={"hotel_id": "HLMCO001", "check_out_date": "2026-03-14"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False

        # Missing check_out_date
        result = await tool.execute(
            args={"hotel_id": "HLMCO001", "check_in_date": "2026-03-12"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False

    @pytest.mark.asyncio
    async def test_execute_amadeus_error(self, mock_amadeus_client, mock_db):
        """Test handling of AmadeusClientError."""
        mock_amadeus_client.search_hotel_offers = AsyncMock(side_effect=AmadeusClientError("Hotel not found"))

        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "hotel_id": "INVALID",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Hotel offer search failed" in result.error

    @pytest.mark.asyncio
    async def test_execute_unexpected_error(self, mock_amadeus_client, mock_db):
        """Test handling of unexpected exceptions."""
        mock_amadeus_client.search_hotel_offers = AsyncMock(side_effect=RuntimeError("Network failure"))

        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "hotel_id": "HLMCO001",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "unexpected error" in result.error.lower()

    @pytest.mark.asyncio
    async def test_execute_with_all_optional_params(self, mock_amadeus_client, mock_db):
        """Test hotel offer search with all optional parameters."""
        mock_amadeus_client.search_hotel_offers = AsyncMock(return_value={"data": []})

        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)
        await tool.execute(
            args={
                "hotel_id": "HLMCO001",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
                "adults": 3,
                "rooms": 2,
                "currency": "EUR",
            },
            user_id="test-user",
            db=mock_db,
        )

        mock_amadeus_client.search_hotel_offers.assert_called_once_with(
            hotel_ids=["HLMCO001"],
            check_in_date="2026-03-12",
            check_out_date="2026-03-14",
            adults=3,
            rooms=2,
            currency="EUR",
        )

    @pytest.mark.asyncio
    async def test_execute_empty_results(self, mock_amadeus_client, mock_db):
        """Test handling of empty search results."""
        mock_amadeus_client.search_hotel_offers = AsyncMock(return_value={"data": []})

        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={
                "hotel_id": "HLMCO001",
                "check_in_date": "2026-03-12",
                "check_out_date": "2026-03-14",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        assert result.data["count"] == 0
        assert result.data["offers"] == []
        assert "No offers found" in result.data["message"]

    def test_format_offer_handles_invalid_data(self, mock_amadeus_client):
        """Test _format_offer handles malformed data."""
        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)

        # Test with None
        result = tool._format_offer(None)
        assert result is None

        # Test with minimal data
        result = tool._format_offer({"id": "test"})
        assert result is not None
        assert result["offer_id"] == "test"

    def test_format_offer_without_variations(self, mock_amadeus_client):
        """Test _format_offer when price variations are missing."""
        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)

        result = tool._format_offer(
            {
                "id": "test",
                "price": {"total": "200.00", "currency": "USD"},
            }
        )
        assert result["price"]["nightly_average"] is None

    def test_format_guarantee_empty(self, mock_amadeus_client):
        """Test _format_guarantee with empty dict."""
        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)

        assert tool._format_guarantee({}) is None
        assert tool._format_guarantee(None) is None

    def test_format_guarantee_complete(self, mock_amadeus_client):
        """Test _format_guarantee with complete data."""
        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)

        result = tool._format_guarantee(
            {
                "description": {"text": "Deposit required"},
                "acceptedPayments": {
                    "creditCards": ["VI", "MC"],
                    "methods": ["CREDIT_CARD", "DEBIT_CARD"],
                },
            }
        )

        assert result["description"] == "Deposit required"
        assert result["accepted_cards"] == ["VI", "MC"]
        assert result["accepted_methods"] == ["CREDIT_CARD", "DEBIT_CARD"]

    def test_format_guarantee_missing_fields(self, mock_amadeus_client):
        """Test _format_guarantee with missing fields."""
        tool = AmadeusHotelOfferTool(client=mock_amadeus_client)

        result = tool._format_guarantee({"description": {}})

        assert result["description"] is None
        assert result["accepted_cards"] == []
        assert result["accepted_methods"] == []


# =============================================================================
# Tool Parameter Schema Tests
# =============================================================================


class TestToolParameterSchemas:
    """Tests for tool parameter JSON schemas."""

    def test_flight_tool_parameters_schema(self):
        """Test AmadeusFlightTool parameter schema is valid."""
        from app.tools.amadeus_flights import AMADEUS_FLIGHT_TOOL_PARAMETERS

        assert AMADEUS_FLIGHT_TOOL_PARAMETERS["type"] == "object"
        assert "origin" in AMADEUS_FLIGHT_TOOL_PARAMETERS["properties"]
        assert "destination" in AMADEUS_FLIGHT_TOOL_PARAMETERS["properties"]
        assert "departure_date" in AMADEUS_FLIGHT_TOOL_PARAMETERS["properties"]
        assert set(AMADEUS_FLIGHT_TOOL_PARAMETERS["required"]) == {
            "origin",
            "destination",
            "departure_date",
        }

    def test_hotel_tool_parameters_schema(self):
        """Test AmadeusHotelTool parameter schema is valid."""
        from app.tools.amadeus_hotels import AMADEUS_HOTEL_TOOL_PARAMETERS

        assert AMADEUS_HOTEL_TOOL_PARAMETERS["type"] == "object"
        assert "city_code" in AMADEUS_HOTEL_TOOL_PARAMETERS["properties"]
        assert "check_in_date" in AMADEUS_HOTEL_TOOL_PARAMETERS["properties"]
        assert "check_out_date" in AMADEUS_HOTEL_TOOL_PARAMETERS["properties"]
        assert set(AMADEUS_HOTEL_TOOL_PARAMETERS["required"]) == {
            "city_code",
            "check_in_date",
            "check_out_date",
        }

    def test_hotel_offer_tool_parameters_schema(self):
        """Test AmadeusHotelOfferTool parameter schema is valid."""
        from app.tools.amadeus_hotel_offers import AMADEUS_HOTEL_OFFER_TOOL_PARAMETERS

        assert AMADEUS_HOTEL_OFFER_TOOL_PARAMETERS["type"] == "object"
        assert "hotel_id" in AMADEUS_HOTEL_OFFER_TOOL_PARAMETERS["properties"]
        assert "check_in_date" in AMADEUS_HOTEL_OFFER_TOOL_PARAMETERS["properties"]
        assert "check_out_date" in AMADEUS_HOTEL_OFFER_TOOL_PARAMETERS["properties"]
        assert set(AMADEUS_HOTEL_OFFER_TOOL_PARAMETERS["required"]) == {
            "hotel_id",
            "check_in_date",
            "check_out_date",
        }


# =============================================================================
# BaseTool Interface Tests
# =============================================================================


class TestBaseToolInterface:
    """Tests verifying tools conform to BaseTool interface."""

    def test_all_tools_inherit_from_base_tool(self):
        """Test all Amadeus tools inherit from BaseTool."""
        from app.tools.base import BaseTool

        assert issubclass(AmadeusFlightTool, BaseTool)
        assert issubclass(AmadeusHotelTool, BaseTool)
        assert issubclass(AmadeusHotelOfferTool, BaseTool)

    def test_all_tools_have_name_and_description(self):
        """Test all tools have required name and description attributes."""
        tools = [AmadeusFlightTool(), AmadeusHotelTool(), AmadeusHotelOfferTool()]

        for tool in tools:
            assert hasattr(tool, "name")
            assert hasattr(tool, "description")
            assert isinstance(tool.name, str)
            assert isinstance(tool.description, str)
            assert len(tool.name) > 0
            assert len(tool.description) > 0

    def test_success_helper_method(self, mock_amadeus_client):
        """Test success helper method creates correct ToolResult."""
        tool = AmadeusFlightTool(client=mock_amadeus_client)

        result = tool.success({"key": "value"})

        assert result.success is True
        assert result.data == {"key": "value"}
        assert result.error is None

    def test_error_helper_method(self, mock_amadeus_client):
        """Test error helper method creates correct ToolResult."""
        tool = AmadeusFlightTool(client=mock_amadeus_client)

        result = tool.error("Something went wrong")

        assert result.success is False
        assert result.data is None
        assert result.error == "Something went wrong"
