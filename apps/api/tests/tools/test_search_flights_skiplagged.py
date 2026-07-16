"""Tests for SearchFlightsSkiplaggedTool.

Tests follow the exact pattern of test_search_tools.py (TestSearchFlightsKiwiTool).
Target: 95%+ code coverage.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.clients.skiplagged import SkiplaggedConnectionError, SkiplaggedMCPError
from app.schemas.flight_search import FlightSearchFlight, FlightSearchResult
from app.tools.search_flights_skiplagged import SearchFlightsSkiplaggedTool

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_skiplagged_client():
    """Create a mock SkiplaggedClient."""
    return MagicMock()


@pytest.fixture
def mock_db():
    """Create a mock database session.

    `session.get(AppSetting, name)` must return None so the provider setting
    falls back to its registry default (Skiplagged) — a bare AsyncMock would
    return a truthy mock whose value never matches a provider name.
    """
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    return db


def _make_flight(
    carrier_code: str = "AF",
    airline_name: str = "Air France",
    price: str = "1200.00",
    stops: int = 0,
    booking_link: str = "https://skiplagged.com/flights/test",
) -> FlightSearchFlight:
    return FlightSearchFlight(
        departure_airport="SFO",
        arrival_airport="CDG",
        departure_time=datetime(2026, 6, 15, 20, 10),
        arrival_time=datetime(2026, 6, 16, 15, 50),
        airline_name=airline_name,
        carrier_code=carrier_code,
        duration_minutes=640,
        stops=stops,
        stops_text="Direct" if stops == 0 else f"{stops} stop",
        layovers=[],
        price_amount=Decimal(price),
        price_currency="USD",
        price_display=f"${price} USD",
        booking_link=booking_link,
        provider="skiplagged",
    )


def _make_result(flights=None, success=True, error=None, provider="skiplagged") -> FlightSearchResult:
    return FlightSearchResult(
        flights=flights or [],
        origin="SFO",
        destination="CDG",
        departure_date="2026-06-15",
        return_date=None,
        is_round_trip=False,
        provider=provider,
        total_results=len(flights) if flights else 0,
        currency="USD",
        success=success,
        error=error,
    )


# =============================================================================
# SearchFlightsSkiplaggedTool Tests
# =============================================================================


class TestSearchFlightsSkiplaggedTool:
    """Tests for SearchFlightsSkiplaggedTool."""

    def test_tool_attributes(self):
        """Test tool has correct name and description."""
        tool = SearchFlightsSkiplaggedTool()
        assert tool.name == "search_flights"
        assert len(tool.description) > 0

    @pytest.mark.asyncio
    async def test_execute_success(self, mock_skiplagged_client, mock_db):
        """Test successful flight search with formatted output."""
        flight = _make_flight(
            carrier_code="AF",
            airline_name="Air France",
            price="1200.00",
            booking_link="https://skiplagged.com/flights/af81",
        )
        mock_skiplagged_client.search_flights = AsyncMock(
            return_value=_make_result(flights=[flight])
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "CDG",
                "departure_date": "2026-06-15",
            },
            user_id="test-user-123",
            db=mock_db,
        )

        assert result.success is True
        assert result.data is not None
        assert result.data["count"] == 1
        assert result.data["provider"] == "skiplagged"
        assert result.data["origin"] == "SFO"
        assert result.data["destination"] == "CDG"

        f = result.data["flights"][0]
        assert f["departure_airport"] == "SFO"
        assert f["arrival_airport"] == "CDG"
        assert f["price"] == "1200.00"
        assert f["booking_link"] == "https://skiplagged.com/flights/af81"
        assert f["stops"] == 0
        assert f["airline_name"] == "Air France"
        assert f["carrier_code"] == "AF"

    @pytest.mark.asyncio
    async def test_execute_missing_required_params(self, mock_skiplagged_client, mock_db):
        """Test error when required parameters are missing."""
        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)

        # Missing origin
        result = await tool.execute(
            args={"destination": "CDG", "departure_date": "2026-06-15"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "origin" in result.error

        # Missing destination
        result = await tool.execute(
            args={"origin": "SFO", "departure_date": "2026-06-15"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "destination" in result.error

        # Missing departure_date
        result = await tool.execute(
            args={"origin": "SFO", "destination": "CDG"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "departure_date" in result.error

    @pytest.mark.asyncio
    async def test_execute_client_error(self, mock_skiplagged_client, mock_db):
        """Test handling of SkiplaggedConnectionError."""
        mock_skiplagged_client.search_flights = AsyncMock(
            side_effect=SkiplaggedConnectionError("Server unavailable")
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "CDG",
                "departure_date": "2026-06-15",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Flight search failed" in result.error

    @pytest.mark.asyncio
    async def test_execute_empty_results(self, mock_skiplagged_client, mock_db):
        """Test handling of zero results returns success with empty list."""
        mock_skiplagged_client.search_flights = AsyncMock(
            return_value=_make_result(flights=[])
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "XYZ",
                "departure_date": "2026-06-15",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        assert result.data["count"] == 0
        assert result.data["flights"] == []

    @pytest.mark.asyncio
    async def test_execute_with_optional_params(self, mock_skiplagged_client, mock_db):
        """Test optional params are forwarded to the client."""
        mock_skiplagged_client.search_flights = AsyncMock(
            return_value=_make_result()
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)
        await tool.execute(
            args={
                "origin": "SFO",
                "destination": "CDG",
                "departure_date": "2026-06-15",
                "return_date": "2026-06-22",
                "adults": 2,
                "max_stops": "one",
                "sort": "price",
                "limit": 50,
                "offset": 75,
            },
            user_id="test-user",
            db=mock_db,
        )

        mock_skiplagged_client.search_flights.assert_called_once_with(
            origin="SFO",
            destination="CDG",
            departure_date="2026-06-15",
            return_date="2026-06-22",
            adults=2,
            max_stops="one",
            sort="price",
            limit=50,
            offset=75,
        )

    @pytest.mark.asyncio
    async def test_execute_client_returns_failure(self, mock_skiplagged_client, mock_db):
        """Test handling when client returns a failed FlightSearchResult."""
        mock_skiplagged_client.search_flights = AsyncMock(
            return_value=_make_result(success=False, error="Route not found")
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "CDG",
                "departure_date": "2026-06-15",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Route not found" in result.error

    @pytest.mark.asyncio
    async def test_execute_unexpected_error(self, mock_skiplagged_client, mock_db):
        """Test handling of unexpected exceptions."""
        mock_skiplagged_client.search_flights = AsyncMock(
            side_effect=RuntimeError("Unexpected failure")
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "CDG",
                "departure_date": "2026-06-15",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "unexpected error" in result.error.lower()

    def test_format_includes_flight_numbers(self, mock_skiplagged_client):
        """Test _format_results includes airline names and carrier codes."""
        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)

        result = tool._format_results(
            _make_result(
                flights=[
                    _make_flight(carrier_code="AF", airline_name="Air France"),
                    _make_flight(carrier_code="UA", airline_name="United Airlines"),
                ]
            )
        )

        assert result["count"] == 2
        assert result["flights"][0]["airline_name"] == "Air France"
        assert result["flights"][0]["carrier_code"] == "AF"
        assert result["flights"][1]["airline_name"] == "United Airlines"
        assert result["flights"][1]["carrier_code"] == "UA"

    def test_format_handles_none_times(self, mock_skiplagged_client):
        """Test _format_results handles None departure/arrival times."""
        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)

        flight = FlightSearchFlight(
            departure_airport="SFO",
            arrival_airport="CDG",
            departure_time=None,
            arrival_time=None,
            duration_minutes=640,
            stops=0,
            price_amount=Decimal("900.00"),
            price_currency="USD",
            provider="skiplagged",
        )
        result = tool._format_results(_make_result(flights=[flight]))

        assert result["flights"][0]["departure_time"] is None
        assert result["flights"][0]["arrival_time"] is None

    @pytest.mark.asyncio
    async def test_execute_mcp_base_error(self, mock_skiplagged_client, mock_db):
        """Test handling of base SkiplaggedMCPError."""
        mock_skiplagged_client.search_flights = AsyncMock(
            side_effect=SkiplaggedMCPError("Generic MCP error")
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "origin": "SFO",
                "destination": "CDG",
                "departure_date": "2026-06-15",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Flight search failed" in result.error


# =============================================================================
# Provider dispatch (flight_provider app setting)
# =============================================================================


def _provider_db(provider: str):
    """Mock DB session whose app-setting row selects the given provider."""
    db = AsyncMock()
    setting_row = MagicMock()
    setting_row.value = provider
    db.get = AsyncMock(return_value=setting_row)
    return db


class TestProviderDispatch:
    """The tool routes to the client selected by the flight_provider setting."""

    @pytest.fixture
    def kiwi_flag_db(self):
        """Mock DB session whose setting row selects Kiwi."""
        return _provider_db("kiwi")

    @pytest.mark.asyncio
    async def test_flag_on_routes_to_kiwi_client(self, mock_skiplagged_client, kiwi_flag_db):
        kiwi = MagicMock()
        kiwi.search_flights = AsyncMock(
            return_value=_make_result(flights=[_make_flight()], provider="kiwi")
        )
        mock_skiplagged_client.search_flights = AsyncMock()

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client, kiwi=kiwi)
        result = await tool.execute(
            args={"origin": "SFO", "destination": "RDM", "departure_date": "2026-08-22"},
            user_id="test-user",
            db=kiwi_flag_db,
        )

        assert result.success is True
        kiwi.search_flights.assert_awaited_once()
        mock_skiplagged_client.search_flights.assert_not_called()
        assert result.data["provider"] == "kiwi"

    @pytest.mark.asyncio
    async def test_fast_flights_setting_routes_to_fast_flights_client(
        self, mock_skiplagged_client
    ):
        fast = MagicMock()
        fast.search_flights = AsyncMock(
            return_value=_make_result(flights=[_make_flight()], provider="fast_flights")
        )
        mock_skiplagged_client.search_flights = AsyncMock()

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client, fast_flights=fast)
        result = await tool.execute(
            args={"origin": "SFO", "destination": "RDM", "departure_date": "2026-08-22"},
            user_id="test-user",
            db=_provider_db("fast_flights"),
        )

        assert result.success is True
        fast.search_flights.assert_awaited_once()
        mock_skiplagged_client.search_flights.assert_not_called()
        assert result.data["provider"] == "fast_flights"

    @pytest.mark.asyncio
    async def test_fast_flights_error_returns_tool_error(self, mock_skiplagged_client):
        from app.clients.fast_flights import FastFlightsTransientError

        fast = MagicMock()
        fast.search_flights = AsyncMock(
            side_effect=FastFlightsTransientError("google blocked us")
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client, fast_flights=fast)
        result = await tool.execute(
            args={"origin": "SFO", "destination": "RDM", "departure_date": "2026-08-22"},
            user_id="test-user",
            db=_provider_db("fast_flights"),
        )

        assert result.success is False
        assert "google blocked us" in result.error

    @pytest.mark.asyncio
    async def test_flag_off_routes_to_skiplagged_client(self, mock_skiplagged_client, mock_db):
        kiwi = MagicMock()
        kiwi.search_flights = AsyncMock()
        mock_skiplagged_client.search_flights = AsyncMock(
            return_value=_make_result(flights=[_make_flight()])
        )

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client, kiwi=kiwi)
        result = await tool.execute(
            args={"origin": "SFO", "destination": "CDG", "departure_date": "2026-06-15"},
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        mock_skiplagged_client.search_flights.assert_awaited_once()
        kiwi.search_flights.assert_not_called()
        assert result.data["provider"] == "skiplagged"

    @pytest.mark.asyncio
    async def test_kiwi_mcp_error_returns_tool_error(self, mock_skiplagged_client, kiwi_flag_db):
        from app.clients.kiwi import KiwiMCPError

        kiwi = MagicMock()
        kiwi.search_flights = AsyncMock(side_effect=KiwiMCPError("kiwi down"))

        tool = SearchFlightsSkiplaggedTool(client=mock_skiplagged_client, kiwi=kiwi)
        result = await tool.execute(
            args={"origin": "SFO", "destination": "RDM", "departure_date": "2026-08-22"},
            user_id="test-user",
            db=kiwi_flag_db,
        )

        assert result.success is False
        assert "kiwi down" in result.error
