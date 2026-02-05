"""Tests for search MCP tools (airports, kiwi flights).

These tests cover:
- SearchAirportsTool
- SearchFlightsKiwiTool

Target: 95%+ code coverage.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.clients.amadeus import AmadeusClientError
from app.clients.kiwi_mcp import KiwiMCPError
from app.schemas.flight_search import (
    FlightLayover,
    FlightSearchFlight,
    FlightSearchResult,
)
from app.tools.search_airports import SearchAirportsTool
from app.tools.search_flights_kiwi import SearchFlightsKiwiTool

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_amadeus_client():
    """Create a mock AmadeusClient."""
    return MagicMock()


@pytest.fixture
def mock_kiwi_client():
    """Create a mock KiwiMCPClient."""
    return MagicMock()


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    return AsyncMock()


# =============================================================================
# SearchAirportsTool Tests
# =============================================================================


class TestSearchAirportsTool:
    """Tests for SearchAirportsTool."""

    def test_tool_attributes(self):
        """Test tool has correct name and description."""
        tool = SearchAirportsTool()
        assert tool.name == "search_airports"
        assert "airport" in tool.description.lower()

    @pytest.mark.asyncio
    async def test_execute_success(self, mock_amadeus_client, mock_db):
        """Test successful airport search."""
        mock_amadeus_client.search_airports = AsyncMock(
            return_value={
                "data": [
                    {
                        "iataCode": "SFO",
                        "name": "SAN FRANCISCO INTL",
                        "subType": "AIRPORT",
                        "address": {
                            "cityName": "SAN FRANCISCO",
                            "countryName": "UNITED STATES OF AMERICA",
                        },
                    },
                    {
                        "iataCode": "SJC",
                        "name": "NORMAN Y MINETA SAN JOSE INTL",
                        "subType": "AIRPORT",
                        "address": {
                            "cityName": "SAN JOSE",
                            "countryName": "UNITED STATES OF AMERICA",
                        },
                    },
                ],
            }
        )

        tool = SearchAirportsTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={"query": "San Francisco"},
            user_id="test-user-123",
            db=mock_db,
        )

        assert result.success is True
        assert result.data is not None
        assert result.data["count"] == 2
        assert result.data["provider"] == "amadeus"
        assert len(result.data["airports"]) == 2

        airport = result.data["airports"][0]
        assert airport["iata_code"] == "SFO"
        assert airport["name"] == "SAN FRANCISCO INTL"
        assert airport["city"] == "SAN FRANCISCO"
        assert airport["country"] == "UNITED STATES OF AMERICA"
        assert airport["type"] == "AIRPORT"

    @pytest.mark.asyncio
    async def test_execute_missing_query(self, mock_amadeus_client, mock_db):
        """Test error when query parameter is missing."""
        tool = SearchAirportsTool(client=mock_amadeus_client)

        result = await tool.execute(
            args={},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "Missing required parameter" in result.error

    @pytest.mark.asyncio
    async def test_execute_amadeus_error(self, mock_amadeus_client, mock_db):
        """Test handling of AmadeusClientError."""
        mock_amadeus_client.search_airports = AsyncMock(
            side_effect=AmadeusClientError("API rate limit exceeded")
        )

        tool = SearchAirportsTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={"query": "SFO"},
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Airport search failed" in result.error

    @pytest.mark.asyncio
    async def test_execute_unexpected_error(self, mock_amadeus_client, mock_db):
        """Test handling of unexpected exceptions."""
        mock_amadeus_client.search_airports = AsyncMock(
            side_effect=RuntimeError("Network failure")
        )

        tool = SearchAirportsTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={"query": "LAX"},
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "unexpected error" in result.error.lower()

    @pytest.mark.asyncio
    async def test_execute_empty_results(self, mock_amadeus_client, mock_db):
        """Test handling of empty search results."""
        mock_amadeus_client.search_airports = AsyncMock(
            return_value={"data": []}
        )

        tool = SearchAirportsTool(client=mock_amadeus_client)
        result = await tool.execute(
            args={"query": "XYZXYZ"},
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        assert result.data["count"] == 0
        assert result.data["airports"] == []

    def test_format_results_handles_missing_address(self, mock_amadeus_client):
        """Test _format_results handles location entries without address."""
        tool = SearchAirportsTool(client=mock_amadeus_client)

        result = tool._format_results({
            "data": [
                {
                    "iataCode": "SFO",
                    "name": "SAN FRANCISCO INTL",
                    "subType": "AIRPORT",
                    # No address field
                },
            ],
        })

        assert result["count"] == 1
        assert result["airports"][0]["city"] is None
        assert result["airports"][0]["country"] is None


# =============================================================================
# SearchFlightsKiwiTool Tests
# =============================================================================


class TestSearchFlightsKiwiTool:
    """Tests for SearchFlightsKiwiTool."""

    def test_tool_attributes(self):
        """Test tool has correct name and description."""
        tool = SearchFlightsKiwiTool()
        assert tool.name == "search_flights_kiwi"
        assert "kiwi" in tool.description.lower()

    @pytest.mark.asyncio
    async def test_execute_success(self, mock_kiwi_client, mock_db):
        """Test successful flight search."""
        mock_kiwi_client.search_flight = AsyncMock(
            return_value=FlightSearchResult(
                flights=[
                    FlightSearchFlight(
                        departure_airport="SFO",
                        arrival_airport="LAX",
                        departure_time=datetime(2026, 2, 5, 8, 0),
                        arrival_time=datetime(2026, 2, 5, 9, 30),
                        airline_name=None,
                        carrier_code=None,
                        duration_minutes=90,
                        stops=1,
                        stops_text="1 stop",
                        layovers=[
                            FlightLayover(
                                airport="SJC",
                                city="San Jose",
                                duration_minutes=45,
                            ),
                        ],
                        price_amount=Decimal("51.00"),
                        price_currency="EUR",
                        price_display="51 EUR",
                        booking_link="https://on.kiwi.com/abc",
                        provider="kiwi",
                    ),
                ],
                origin="SFO",
                destination="LAX",
                departure_date="2026-02-05",
                return_date=None,
                is_round_trip=False,
                provider="kiwi",
                total_results=1,
                currency="EUR",
                success=True,
            )
        )

        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)
        result = await tool.execute(
            args={
                "fly_from": "SFO",
                "fly_to": "LAX",
                "departure_date": "2026-02-05",
            },
            user_id="test-user-123",
            db=mock_db,
        )

        assert result.success is True
        assert result.data is not None
        assert result.data["count"] == 1
        assert result.data["provider"] == "kiwi"
        assert result.data["origin"] == "SFO"
        assert result.data["destination"] == "LAX"

        flight = result.data["flights"][0]
        assert flight["departure_airport"] == "SFO"
        assert flight["arrival_airport"] == "LAX"
        assert flight["price"] == "51.00"
        assert flight["booking_link"] == "https://on.kiwi.com/abc"
        assert flight["stops"] == 1

        # Verify layover data is present
        assert len(flight["layovers"]) == 1
        assert flight["layovers"][0]["airport"] == "SJC"
        assert flight["layovers"][0]["city"] == "San Jose"
        assert flight["layovers"][0]["duration_minutes"] == 45

    @pytest.mark.asyncio
    async def test_execute_missing_required_params(self, mock_kiwi_client, mock_db):
        """Test error when required parameters are missing."""
        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)

        # Missing fly_from
        result = await tool.execute(
            args={"fly_to": "LAX", "departure_date": "2026-02-05"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "fly_from" in result.error

        # Missing fly_to
        result = await tool.execute(
            args={"fly_from": "SFO", "departure_date": "2026-02-05"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "fly_to" in result.error

        # Missing departure_date
        result = await tool.execute(
            args={"fly_from": "SFO", "fly_to": "LAX"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "departure_date" in result.error

    @pytest.mark.asyncio
    async def test_execute_client_error(self, mock_kiwi_client, mock_db):
        """Test handling of KiwiMCPError."""
        mock_kiwi_client.search_flight = AsyncMock(
            side_effect=KiwiMCPError("Server unavailable")
        )

        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)
        result = await tool.execute(
            args={
                "fly_from": "SFO",
                "fly_to": "LAX",
                "departure_date": "2026-02-05",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Flight search failed" in result.error

    @pytest.mark.asyncio
    async def test_execute_unexpected_error(self, mock_kiwi_client, mock_db):
        """Test handling of unexpected exceptions."""
        mock_kiwi_client.search_flight = AsyncMock(
            side_effect=RuntimeError("Network failure")
        )

        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)
        result = await tool.execute(
            args={
                "fly_from": "SFO",
                "fly_to": "LAX",
                "departure_date": "2026-02-05",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "unexpected error" in result.error.lower()

    @pytest.mark.asyncio
    async def test_execute_client_returns_failure(self, mock_kiwi_client, mock_db):
        """Test handling when client returns a failed FlightSearchResult."""
        mock_kiwi_client.search_flight = AsyncMock(
            return_value=FlightSearchResult(
                flights=[],
                origin="SFO",
                destination="LAX",
                departure_date="2026-02-05",
                provider="kiwi",
                total_results=0,
                currency="EUR",
                success=False,
                error="Route not found",
            )
        )

        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)
        result = await tool.execute(
            args={
                "fly_from": "SFO",
                "fly_to": "LAX",
                "departure_date": "2026-02-05",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Route not found" in result.error

    @pytest.mark.asyncio
    async def test_execute_empty_results(self, mock_kiwi_client, mock_db):
        """Test handling of empty search results."""
        mock_kiwi_client.search_flight = AsyncMock(
            return_value=FlightSearchResult(
                flights=[],
                origin="SFO",
                destination="XYZ",
                departure_date="2026-02-05",
                provider="kiwi",
                total_results=0,
                currency="EUR",
                success=True,
            )
        )

        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)
        result = await tool.execute(
            args={
                "fly_from": "SFO",
                "fly_to": "XYZ",
                "departure_date": "2026-02-05",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        assert result.data["count"] == 0
        assert result.data["flights"] == []

    @pytest.mark.asyncio
    async def test_execute_with_optional_params(self, mock_kiwi_client, mock_db):
        """Test flight search with all optional parameters."""
        mock_kiwi_client.search_flight = AsyncMock(
            return_value=FlightSearchResult(
                flights=[],
                origin="SFO",
                destination="LAX",
                departure_date="2026-02-05",
                return_date="2026-02-10",
                is_round_trip=True,
                provider="kiwi",
                total_results=0,
                currency="USD",
                success=True,
            )
        )

        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)
        await tool.execute(
            args={
                "fly_from": "SFO",
                "fly_to": "LAX",
                "departure_date": "2026-02-05",
                "return_date": "2026-02-10",
                "adults": 3,
                "currency": "USD",
            },
            user_id="test-user",
            db=mock_db,
        )

        mock_kiwi_client.search_flight.assert_called_once_with(
            fly_from="SFO",
            fly_to="LAX",
            departure_date="2026-02-05",
            return_date="2026-02-10",
            adults=3,
            currency="USD",
        )

    def test_format_results_includes_layovers(self, mock_kiwi_client):
        """Test _format_results includes layover data in output."""
        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)

        result = tool._format_results(
            FlightSearchResult(
                flights=[
                    FlightSearchFlight(
                        departure_airport="SFO",
                        arrival_airport="LHR",
                        departure_time=datetime(2026, 2, 5, 8, 0),
                        arrival_time=datetime(2026, 2, 6, 4, 0),
                        duration_minutes=720,
                        stops=2,
                        stops_text="2 stops",
                        layovers=[
                            FlightLayover(
                                airport="DEN",
                                city="Denver",
                                duration_minutes=90,
                            ),
                            FlightLayover(
                                airport="JFK",
                                city="New York",
                                duration_minutes=120,
                            ),
                        ],
                        price_amount=Decimal("350.00"),
                        price_currency="EUR",
                        provider="kiwi",
                    ),
                ],
                origin="SFO",
                destination="LHR",
                departure_date="2026-02-05",
                provider="kiwi",
                total_results=1,
                currency="EUR",
                success=True,
            )
        )

        flight = result["flights"][0]
        assert len(flight["layovers"]) == 2
        assert flight["layovers"][0]["airport"] == "DEN"
        assert flight["layovers"][1]["airport"] == "JFK"

    def test_format_results_handles_none_times(self, mock_kiwi_client):
        """Test _format_results handles None departure/arrival times."""
        tool = SearchFlightsKiwiTool(client=mock_kiwi_client)

        result = tool._format_results(
            FlightSearchResult(
                flights=[
                    FlightSearchFlight(
                        departure_airport="SFO",
                        arrival_airport="LAX",
                        departure_time=None,
                        arrival_time=None,
                        duration_minutes=90,
                        stops=0,
                        price_amount=Decimal("40.00"),
                        price_currency="EUR",
                        provider="kiwi",
                    ),
                ],
                origin="SFO",
                destination="LAX",
                departure_date="2026-02-05",
                provider="kiwi",
                total_results=1,
                currency="EUR",
                success=True,
            )
        )

        assert result["flights"][0]["departure_time"] is None
        assert result["flights"][0]["arrival_time"] is None


# =============================================================================
# BaseTool Interface Tests
# =============================================================================


class TestSearchToolsBaseInterface:
    """Tests verifying search tools conform to BaseTool interface."""

    def test_all_tools_inherit_from_base_tool(self):
        """Test all search tools inherit from BaseTool."""
        from app.tools.base import BaseTool

        assert issubclass(SearchAirportsTool, BaseTool)
        assert issubclass(SearchFlightsKiwiTool, BaseTool)

    def test_all_tools_have_name_and_description(self):
        """Test all tools have required name and description attributes."""
        tools = [
            SearchAirportsTool(),
            SearchFlightsKiwiTool(),
        ]

        for tool in tools:
            assert hasattr(tool, "name")
            assert hasattr(tool, "description")
            assert isinstance(tool.name, str)
            assert isinstance(tool.description, str)
            assert len(tool.name) > 0
            assert len(tool.description) > 0

    def test_success_helper_method(self, mock_amadeus_client):
        """Test success helper method creates correct ToolResult."""
        tool = SearchAirportsTool(client=mock_amadeus_client)

        result = tool.success({"key": "value"})

        assert result.success is True
        assert result.data == {"key": "value"}
        assert result.error is None

    def test_error_helper_method(self, mock_amadeus_client):
        """Test error helper method creates correct ToolResult."""
        tool = SearchAirportsTool(client=mock_amadeus_client)

        result = tool.error("Something went wrong")

        assert result.success is False
        assert result.data is None
        assert result.error == "Something went wrong"
