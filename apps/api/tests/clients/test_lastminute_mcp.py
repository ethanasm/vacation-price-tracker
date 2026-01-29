"""Tests for the LastMinute MCP client."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from app.clients.lastminute_mcp import (
    DEFAULT_MCP_URL,
    LastMinuteConnectionError,
    LastMinuteMCPClient,
    LastMinuteRequestError,
)


class TestLastMinuteMCPClient:
    """Tests for LastMinuteMCPClient initialization and configuration."""

    def test_default_configuration(self) -> None:
        """Test client initializes with default configuration."""
        client = LastMinuteMCPClient()
        assert client._mcp_url == DEFAULT_MCP_URL
        assert client._timeout.connect == 30.0

    def test_custom_configuration(self) -> None:
        """Test client accepts custom configuration."""
        client = LastMinuteMCPClient(
            mcp_url="https://custom.mcp.test/api",
            timeout_seconds=60.0,
        )
        assert client._mcp_url == "https://custom.mcp.test/api"
        assert client._timeout.connect == 60.0

    def test_url_trailing_slash_stripped(self) -> None:
        """Test trailing slash is removed from URL."""
        client = LastMinuteMCPClient(mcp_url="https://example.com/mcp/")
        assert client._mcp_url == "https://example.com/mcp"


class TestParseAirportTime:
    """Tests for _parse_airport_time method."""

    def test_parse_valid_airport_time(self) -> None:
        """Test parsing valid airport and time string."""
        client = LastMinuteMCPClient()
        airport, time = client._parse_airport_time("BGY 09:25")
        assert airport == "BGY"
        assert time is not None
        assert time.hour == 9
        assert time.minute == 25

    def test_parse_lowercase_airport(self) -> None:
        """Test airport code is uppercased."""
        client = LastMinuteMCPClient()
        airport, time = client._parse_airport_time("lhr 14:30")
        assert airport == "LHR"
        assert time.hour == 14

    def test_parse_airport_only(self) -> None:
        """Test parsing just airport code without time."""
        client = LastMinuteMCPClient()
        airport, time = client._parse_airport_time("SFO")
        assert airport == "SFO"
        assert time is None

    def test_parse_empty_string(self) -> None:
        """Test parsing empty string returns None."""
        client = LastMinuteMCPClient()
        airport, time = client._parse_airport_time("")
        assert airport is None
        assert time is None

    def test_parse_invalid_time_format(self) -> None:
        """Test parsing invalid time format."""
        client = LastMinuteMCPClient()
        airport, time = client._parse_airport_time("JFK invalid")
        assert airport == "JFK"
        assert time is None


class TestParseDuration:
    """Tests for _parse_duration method."""

    def test_parse_hours_and_minutes(self) -> None:
        """Test parsing 'X hours and Y min' format."""
        client = LastMinuteMCPClient()
        assert client._parse_duration("2 hours and 5 min") == 125
        assert client._parse_duration("1 hour and 30 min") == 90

    def test_parse_short_format(self) -> None:
        """Test parsing 'Xh Ym' format."""
        client = LastMinuteMCPClient()
        assert client._parse_duration("2h 5m") == 125
        assert client._parse_duration("3h 45m") == 225

    def test_parse_hours_only(self) -> None:
        """Test parsing hours only."""
        client = LastMinuteMCPClient()
        assert client._parse_duration("2 hours") == 120
        assert client._parse_duration("5h") == 300

    def test_parse_minutes_only(self) -> None:
        """Test parsing minutes only."""
        client = LastMinuteMCPClient()
        assert client._parse_duration("45 min") == 45
        assert client._parse_duration("90m") == 90

    def test_parse_empty_string(self) -> None:
        """Test parsing empty string returns None."""
        client = LastMinuteMCPClient()
        assert client._parse_duration("") is None
        assert client._parse_duration(None) is None

    def test_parse_invalid_format(self) -> None:
        """Test parsing invalid format returns None."""
        client = LastMinuteMCPClient()
        assert client._parse_duration("invalid") is None


class TestParseStops:
    """Tests for _parse_stops method."""

    def test_parse_direct(self) -> None:
        """Test parsing 'Direct' returns 0."""
        client = LastMinuteMCPClient()
        assert client._parse_stops("Direct") == 0
        assert client._parse_stops("DIRECT") == 0
        assert client._parse_stops("Nonstop") == 0

    def test_parse_stops_count(self) -> None:
        """Test parsing stops count."""
        client = LastMinuteMCPClient()
        assert client._parse_stops("1 stop") == 1
        assert client._parse_stops("2 stops") == 2
        assert client._parse_stops("3 stops") == 3

    def test_parse_empty_string(self) -> None:
        """Test parsing empty string returns 0."""
        client = LastMinuteMCPClient()
        assert client._parse_stops("") == 0
        assert client._parse_stops(None) == 0


class TestParsePriceString:
    """Tests for _parse_price_string method."""

    def test_parse_dollar_suffix(self) -> None:
        """Test parsing price with dollar suffix."""
        client = LastMinuteMCPClient()
        assert client._parse_price_string("35.85 $") == Decimal("35.85")
        assert client._parse_price_string("100.00 $") == Decimal("100.00")

    def test_parse_dollar_prefix(self) -> None:
        """Test parsing price with dollar prefix."""
        client = LastMinuteMCPClient()
        assert client._parse_price_string("$35.85") == Decimal("35.85")
        assert client._parse_price_string("$ 100.00") == Decimal("100.00")

    def test_parse_euro(self) -> None:
        """Test parsing price with EUR currency."""
        client = LastMinuteMCPClient()
        assert client._parse_price_string("35.85 EUR") == Decimal("35.85")
        assert client._parse_price_string("100 EUR") == Decimal("100")

    def test_parse_comma_thousands(self) -> None:
        """Test parsing price with comma thousands separator."""
        client = LastMinuteMCPClient()
        assert client._parse_price_string("1,299.00 $") == Decimal("1299.00")

    def test_parse_empty_string(self) -> None:
        """Test parsing empty string returns None."""
        client = LastMinuteMCPClient()
        assert client._parse_price_string("") is None
        assert client._parse_price_string(None) is None

    def test_parse_invalid_price(self) -> None:
        """Test parsing invalid price returns None."""
        client = LastMinuteMCPClient()
        assert client._parse_price_string("free") is None
        assert client._parse_price_string("N/A") is None


class TestParseFlight:
    """Tests for _parse_flight method."""

    def test_parse_complete_flight(self) -> None:
        """Test parsing a complete flight response."""
        client = LastMinuteMCPClient()
        data = {
            "airline": "Ryanair",
            "carrier_id": "FR",
            "departure": "BGY 09:25",
            "arrival": "STN 10:30",
            "duration": "2 hours and 5 min",
            "stops": "Direct",
            "price": "35.85 $",
            "price_amount": 3585,
            "deeplink": "https://www.lastminute.ie/flights",
        }

        flight = client._parse_flight(data, "EUR")

        assert flight is not None
        assert flight.departure_airport == "BGY"
        assert flight.arrival_airport == "STN"
        assert flight.airline_name == "Ryanair"
        assert flight.carrier_code == "FR"
        assert flight.duration_minutes == 125
        assert flight.stops == 0
        assert flight.stops_text == "Direct"
        assert flight.price_amount == Decimal("35.85")
        assert flight.booking_link == "https://www.lastminute.ie/flights"
        assert flight.provider == "lastminute"

    def test_parse_flight_with_stops(self) -> None:
        """Test parsing flight with stops."""
        client = LastMinuteMCPClient()
        data = {
            "airline": "EasyJet",
            "carrier_id": "U2",
            "departure": "MXP 12:00",
            "arrival": "LHR 15:30",
            "duration": "3 hours and 30 min",
            "stops": "1 stop",
            "price_amount": 5000,
        }

        flight = client._parse_flight(data, "EUR")

        assert flight is not None
        assert flight.stops == 1
        assert flight.price_amount == Decimal("50.00")

    def test_parse_flight_price_from_string(self) -> None:
        """Test parsing flight when only price string is available."""
        client = LastMinuteMCPClient()
        data = {
            "departure": "SFO 08:00",
            "arrival": "LAX 09:30",
            "price": "99.99 $",
        }

        flight = client._parse_flight(data, "USD")

        assert flight is not None
        assert flight.price_amount == Decimal("99.99")

    def test_parse_flight_missing_price(self) -> None:
        """Test parsing flight without price returns None."""
        client = LastMinuteMCPClient()
        data = {
            "departure": "SFO 08:00",
            "arrival": "LAX 09:30",
        }

        flight = client._parse_flight(data, "USD")
        assert flight is None

    def test_parse_flight_stores_raw_data(self) -> None:
        """Test that raw data is stored for debugging."""
        client = LastMinuteMCPClient()
        data = {
            "departure": "JFK 10:00",
            "arrival": "LAX 13:00",
            "price_amount": 15000,
        }

        flight = client._parse_flight(data, "USD")

        assert flight is not None
        assert flight.raw_data == data


class TestParseResponse:
    """Tests for _parse_response method."""

    def test_parse_response_with_flights(self) -> None:
        """Test parsing response with multiple flights."""
        client = LastMinuteMCPClient()
        response = {
            "flights": [
                {"departure": "SFO 08:00", "arrival": "LAX 09:30", "price_amount": 5000},
                {"departure": "SFO 12:00", "arrival": "LAX 13:30", "price_amount": 7500},
            ],
            "total_results": 2,
            "currency": "USD",
            "is_roundtrip": False,
        }

        result = client._parse_response(
            response,
            origin="SFO",
            destination="LAX",
            departure_date="2026-02-01",
            return_date=None,
            currency="USD",
        )

        assert result.success is True
        assert len(result.flights) == 2
        assert result.origin == "SFO"
        assert result.destination == "LAX"
        assert result.total_results == 2
        assert result.provider == "lastminute"

    def test_parse_response_empty_flights(self) -> None:
        """Test parsing response with no flights."""
        client = LastMinuteMCPClient()
        response = {"flights": [], "total_results": 0}

        result = client._parse_response(
            response,
            origin="SFO",
            destination="XYZ",
            departure_date="2026-02-01",
            return_date=None,
            currency="USD",
        )

        assert result.success is True
        assert len(result.flights) == 0
        assert result.total_results == 0

    def test_parse_response_invalid_flight_skipped(self) -> None:
        """Test that invalid flights are skipped during parsing."""
        client = LastMinuteMCPClient()
        response = {
            "flights": [
                {"departure": "SFO 08:00", "arrival": "LAX 09:30", "price_amount": 5000},
                {"departure": "invalid", "arrival": "data"},  # Missing price
                {"departure": "JFK 10:00", "arrival": "BOS 11:30", "price_amount": 8000},
            ],
        }

        result = client._parse_response(
            response,
            origin="SFO",
            destination="LAX",
            departure_date="2026-02-01",
            return_date=None,
            currency="USD",
        )

        assert len(result.flights) == 2

    def test_parse_response_round_trip(self) -> None:
        """Test parsing response for round trip search."""
        client = LastMinuteMCPClient()
        response = {
            "flights": [{"departure": "SFO 08:00", "arrival": "LAX 09:30", "price_amount": 10000}],
            "is_roundtrip": True,
        }

        result = client._parse_response(
            response,
            origin="SFO",
            destination="LAX",
            departure_date="2026-02-01",
            return_date="2026-02-08",
            currency="USD",
        )

        assert result.is_round_trip is True
        assert result.return_date == "2026-02-08"


class TestCallMCP:
    """Tests for _call_mcp method."""

    @pytest.mark.asyncio
    async def test_successful_mcp_call(self) -> None:
        """Test successful MCP API call."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {"flights": [{"price_amount": 5000}]},
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client._call_mcp("search_flights", {"departure": "SFO"})

            assert "flights" in result
            mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_mcp_call_with_nested_content(self) -> None:
        """Test MCP call that returns nested content structure."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {"content": [{"type": "text", "text": '{"flights": [{"price_amount": 7500}]}'}]}
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client._call_mcp("search_flights", {})

            assert result["flights"][0]["price_amount"] == 7500

    @pytest.mark.asyncio
    async def test_mcp_call_connection_error(self) -> None:
        """Test MCP call handles connection errors."""
        client = LastMinuteMCPClient()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(LastMinuteConnectionError) as exc_info:
                await client._call_mcp("search_flights", {})

            assert "Connection refused" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_timeout_error(self) -> None:
        """Test MCP call handles timeout errors."""
        client = LastMinuteMCPClient()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(LastMinuteConnectionError) as exc_info:
                await client._call_mcp("search_flights", {})

            assert "Timeout" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_http_error(self) -> None:
        """Test MCP call handles HTTP errors."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(LastMinuteRequestError) as exc_info:
                await client._call_mcp("search_flights", {})

            assert "500" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_invalid_json(self) -> None:
        """Test MCP call handles invalid JSON responses."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_response.text = "not json"

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(LastMinuteRequestError) as exc_info:
                await client._call_mcp("search_flights", {})

            assert "Invalid JSON" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_jsonrpc_error(self) -> None:
        """Test MCP call handles JSON-RPC error responses."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"error": {"code": -32600, "message": "Invalid Request"}}

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(LastMinuteRequestError) as exc_info:
                await client._call_mcp("search_flights", {})

            assert "Invalid Request" in str(exc_info.value)


class TestSearchFlights:
    """Tests for search_flights method."""

    @pytest.mark.asyncio
    async def test_search_flights_success(self) -> None:
        """Test successful flight search."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {
                "flights": [
                    {
                        "airline": "Ryanair",
                        "carrier_id": "FR",
                        "departure": "MXP 09:25",
                        "arrival": "STN 10:30",
                        "duration": "2 hours and 5 min",
                        "stops": "Direct",
                        "price_amount": 3585,
                        "deeplink": "https://lastminute.ie/book",
                    }
                ],
                "total_results": 1,
                "currency": "EUR",
            }
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client.search_flights(
                departure="MXP",
                arrival="STN",
                start_date="2026-02-15",
            )

            assert result.success is True
            assert len(result.flights) == 1
            assert result.flights[0].airline_name == "Ryanair"
            assert result.flights[0].carrier_code == "FR"
            assert result.origin == "MXP"
            assert result.destination == "STN"
            assert result.provider == "lastminute"

    @pytest.mark.asyncio
    async def test_search_flights_round_trip(self) -> None:
        """Test round trip flight search."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {
                "flights": [{"price_amount": 10000}],
                "is_roundtrip": True,
            }
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client.search_flights(
                departure="MXP",
                arrival="LON",
                start_date="2026-02-15",
                end_date="2026-02-22",
            )

            assert result.is_round_trip is True
            assert result.return_date == "2026-02-22"

            # Verify end_date was passed in parameters
            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["params"]["arguments"]["end_date"] == "2026-02-22"

    @pytest.mark.asyncio
    async def test_search_flights_with_ranking(self) -> None:
        """Test flight search with best ranking."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"flights": []}}

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client.search_flights(
                departure="SFO",
                arrival="JFK",
                start_date="2026-03-01",
                ranking_best=True,
            )

            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["params"]["arguments"]["ranking_best"] is True

    @pytest.mark.asyncio
    async def test_search_flights_connection_error_returns_failed_result(self) -> None:
        """Test search returns failed result on connection error."""
        client = LastMinuteMCPClient()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("Network error"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(LastMinuteConnectionError):
                await client.search_flights(
                    departure="SFO",
                    arrival="LAX",
                    start_date="2026-02-01",
                )

    @pytest.mark.asyncio
    async def test_search_flights_unexpected_error_returns_failed_result(self) -> None:
        """Test search returns failed result on unexpected error."""
        client = LastMinuteMCPClient()

        with patch.object(client, "_call_mcp", side_effect=RuntimeError("Unexpected")):
            result = await client.search_flights(
                departure="SFO",
                arrival="LAX",
                start_date="2026-02-01",
            )

            assert result.success is False
            assert "Unexpected" in result.error
            assert len(result.flights) == 0

    @pytest.mark.asyncio
    async def test_search_flights_parameters_uppercased(self) -> None:
        """Test that airport codes are uppercased."""
        client = LastMinuteMCPClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": {"flights": []}}

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client.search_flights(
                departure="sfo",
                arrival="lax",
                start_date="2026-02-01",
            )

            assert result.origin == "SFO"
            assert result.destination == "LAX"

            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["params"]["arguments"]["departure"] == "SFO"
            assert payload["params"]["arguments"]["arrival"] == "LAX"


class TestSingletonInstance:
    """Tests for singleton instance."""

    def test_singleton_exists(self) -> None:
        """Test that singleton instance is created."""
        from app.clients.lastminute_mcp import lastminute_mcp_client

        assert lastminute_mcp_client is not None
        assert isinstance(lastminute_mcp_client, LastMinuteMCPClient)
