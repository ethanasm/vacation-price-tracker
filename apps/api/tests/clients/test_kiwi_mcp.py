"""Tests for the Kiwi MCP client."""

from __future__ import annotations

import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from app.clients.kiwi_mcp import (
    DEFAULT_MCP_URL,
    KiwiConnectionError,
    KiwiMCPClient,
    KiwiRequestError,
)


def _make_mock_response(
    status_code: int = 200,
    json_data: dict | None = None,
    text: str = "",
    content_type: str = "application/json",
    session_id: str | None = None,
) -> MagicMock:
    """Build a mock httpx.Response with the given attributes."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.text = text or (json.dumps(json_data) if json_data else "")

    headers: dict[str, str] = {"content-type": content_type}
    if session_id:
        headers["mcp-session-id"] = session_id
    mock_response.headers = headers

    if json_data is not None:
        mock_response.json.return_value = json_data
    else:
        mock_response.json.side_effect = ValueError("No JSON data")

    return mock_response


def _pre_initialize(client: KiwiMCPClient) -> None:
    """Mark client as already initialized so tests skip the handshake."""
    client._initialized = True
    client._session_id = "test-session-id"


class TestKiwiMCPClient:
    """Tests for KiwiMCPClient initialization and configuration."""

    def test_default_configuration(self) -> None:
        """Test client initializes with default configuration."""
        client = KiwiMCPClient()
        assert client._mcp_url == DEFAULT_MCP_URL
        assert client._timeout.connect == 30.0

    def test_custom_configuration(self) -> None:
        """Test client accepts custom configuration."""
        client = KiwiMCPClient(
            mcp_url="https://custom.kiwi.test/api",
            timeout_seconds=60.0,
        )
        assert client._mcp_url == "https://custom.kiwi.test/api"
        assert client._timeout.connect == 60.0

    def test_url_trailing_slash_stripped(self) -> None:
        """Test trailing slash is removed from URL."""
        client = KiwiMCPClient(mcp_url="https://example.com/mcp/")
        assert client._mcp_url == "https://example.com/mcp"

    def test_initial_state(self) -> None:
        """Test client starts uninitialized with no session."""
        client = KiwiMCPClient()
        assert client._initialized is False
        assert client._session_id is None
        assert client._request_id == 0


class TestConvertDateFormat:
    """Tests for _convert_date_format method."""

    def test_convert_valid_date(self) -> None:
        """Test converting YYYY-MM-DD to dd/mm/yyyy."""
        client = KiwiMCPClient()
        assert client._convert_date_format("2026-02-15") == "15/02/2026"
        assert client._convert_date_format("2026-12-01") == "01/12/2026"

    def test_convert_none(self) -> None:
        """Test converting None returns None."""
        client = KiwiMCPClient()
        assert client._convert_date_format(None) is None

    def test_convert_invalid_date(self) -> None:
        """Test converting invalid date returns original string."""
        client = KiwiMCPClient()
        assert client._convert_date_format("invalid") == "invalid"
        assert client._convert_date_format("15/02/2026") == "15/02/2026"


class TestParseIsoDatetime:
    """Tests for _parse_iso_datetime method."""

    def test_parse_with_milliseconds(self) -> None:
        """Test parsing ISO datetime with milliseconds."""
        client = KiwiMCPClient()
        result = client._parse_iso_datetime("2026-02-15T06:50:00.000")
        assert result is not None
        assert result.year == 2026
        assert result.month == 2
        assert result.day == 15
        assert result.hour == 6
        assert result.minute == 50

    def test_parse_with_z_suffix(self) -> None:
        """Test parsing ISO datetime with Z suffix."""
        client = KiwiMCPClient()
        result = client._parse_iso_datetime("2026-02-15T06:50:00.000Z")
        assert result is not None
        assert result.hour == 6

    def test_parse_without_milliseconds(self) -> None:
        """Test parsing ISO datetime without milliseconds."""
        client = KiwiMCPClient()
        result = client._parse_iso_datetime("2026-02-15T14:30:00")
        assert result is not None
        assert result.hour == 14

    def test_parse_date_only(self) -> None:
        """Test parsing date only."""
        client = KiwiMCPClient()
        result = client._parse_iso_datetime("2026-02-15")
        assert result is not None
        assert result.day == 15

    def test_parse_empty_string(self) -> None:
        """Test parsing empty string returns None."""
        client = KiwiMCPClient()
        assert client._parse_iso_datetime("") is None
        assert client._parse_iso_datetime(None) is None

    def test_parse_invalid_format(self) -> None:
        """Test parsing invalid format returns None."""
        client = KiwiMCPClient()
        assert client._parse_iso_datetime("invalid") is None


class TestParseKiwiDatetime:
    """Tests for _parse_kiwi_datetime method."""

    def test_parse_dict_with_local(self) -> None:
        """Test parsing dict with local time (preferred)."""
        client = KiwiMCPClient()
        data = {
            "utc": "2026-02-15T06:50:00.000Z",
            "local": "2026-02-15T07:50:00.000",
        }
        result = client._parse_kiwi_datetime(data)
        assert result is not None
        assert result.hour == 7  # Local time is preferred

    def test_parse_dict_with_utc_only(self) -> None:
        """Test parsing dict with only UTC time."""
        client = KiwiMCPClient()
        data = {"utc": "2026-02-15T06:50:00.000Z"}
        result = client._parse_kiwi_datetime(data)
        assert result is not None
        assert result.hour == 6

    def test_parse_string_directly(self) -> None:
        """Test parsing string directly."""
        client = KiwiMCPClient()
        result = client._parse_kiwi_datetime("2026-02-15T10:30:00")
        assert result is not None
        assert result.hour == 10

    def test_parse_none(self) -> None:
        """Test parsing None returns None."""
        client = KiwiMCPClient()
        assert client._parse_kiwi_datetime(None) is None

    def test_parse_empty_dict(self) -> None:
        """Test parsing empty dict returns None."""
        client = KiwiMCPClient()
        assert client._parse_kiwi_datetime({}) is None


class TestParseLayovers:
    """Tests for _parse_layovers method."""

    def test_parse_valid_layovers(self) -> None:
        """Test parsing valid layover data."""
        client = KiwiMCPClient()
        data = [
            {
                "at": "MUC",
                "city": "Munich",
                "arrival": {"local": "2026-02-15T09:10:00.000"},
                "departure": {"local": "2026-02-15T12:00:00.000"},
            }
        ]

        layovers = client._parse_layovers(data)

        assert len(layovers) == 1
        assert layovers[0].airport == "MUC"
        assert layovers[0].city == "Munich"
        assert layovers[0].duration_minutes == 170  # 2h 50m

    def test_parse_multiple_layovers(self) -> None:
        """Test parsing multiple layovers."""
        client = KiwiMCPClient()
        data = [
            {"at": "FRA", "city": "Frankfurt"},
            {"at": "AMS", "city": "Amsterdam"},
        ]

        layovers = client._parse_layovers(data)
        assert len(layovers) == 2
        assert layovers[0].airport == "FRA"
        assert layovers[1].airport == "AMS"

    def test_parse_empty_list(self) -> None:
        """Test parsing empty list returns empty list."""
        client = KiwiMCPClient()
        assert client._parse_layovers([]) == []

    def test_parse_non_list(self) -> None:
        """Test parsing non-list returns empty list."""
        client = KiwiMCPClient()
        assert client._parse_layovers(None) == []
        assert client._parse_layovers("invalid") == []

    def test_parse_layover_lowercase_airport(self) -> None:
        """Test airport code is uppercased."""
        client = KiwiMCPClient()
        data = [{"at": "cdg", "city": "Paris"}]
        layovers = client._parse_layovers(data)
        assert layovers[0].airport == "CDG"


class TestParseFlight:
    """Tests for _parse_flight method."""

    def test_parse_complete_flight(self) -> None:
        """Test parsing a complete Kiwi flight response."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "MXP",
            "flyTo": "LGW",
            "cityFrom": "Milan",
            "cityTo": "London",
            "departure": {"utc": "2026-02-15T06:50:00.000Z", "local": "2026-02-15T07:50:00.000"},
            "arrival": {"utc": "2026-02-15T08:50:00.000Z", "local": "2026-02-15T08:50:00.000"},
            "totalDurationInSeconds": 7200,
            "price": 51,
            "deepLink": "https://on.kiwi.com/42QuYx",
            "currency": "USD",
            "layovers": [],
        }

        flight = client._parse_flight(data, "EUR")

        assert flight is not None
        assert flight.departure_airport == "MXP"
        assert flight.arrival_airport == "LGW"
        assert flight.airline_name is None  # Kiwi doesn't provide this
        assert flight.carrier_code is None  # Kiwi doesn't provide this
        assert flight.duration_minutes == 120
        assert flight.stops == 0
        assert flight.stops_text == "Direct"
        assert flight.price_amount == Decimal("51")
        assert flight.price_currency == "USD"
        assert flight.booking_link == "https://on.kiwi.com/42QuYx"
        assert flight.provider == "kiwi"

    def test_parse_flight_with_layovers(self) -> None:
        """Test parsing flight with layovers."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "SFO",
            "flyTo": "LHR",
            "totalDurationInSeconds": 36000,  # 10 hours
            "price": 450,
            "currency": "USD",
            "layovers": [
                {"at": "JFK", "city": "New York"},
                {"at": "DUB", "city": "Dublin"},
            ],
        }

        flight = client._parse_flight(data, "USD")

        assert flight is not None
        assert flight.stops == 2
        assert flight.stops_text == "2 stops"
        assert len(flight.layovers) == 2
        assert flight.layovers[0].airport == "JFK"

    def test_parse_flight_single_stop(self) -> None:
        """Test parsing flight with single stop."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "LAX",
            "flyTo": "CDG",
            "price": 600,
            "layovers": [{"at": "ORD"}],
        }

        flight = client._parse_flight(data, "EUR")

        assert flight.stops == 1
        assert flight.stops_text == "1 stop"

    def test_parse_flight_duration_in_seconds(self) -> None:
        """Test parsing flight uses durationInSeconds as fallback."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "BOS",
            "flyTo": "MIA",
            "durationInSeconds": 10800,  # 3 hours
            "price": 150,
        }

        flight = client._parse_flight(data, "USD")

        assert flight is not None
        assert flight.duration_minutes == 180

    def test_parse_flight_missing_price(self) -> None:
        """Test parsing flight without price returns None."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "SFO",
            "flyTo": "LAX",
        }

        flight = client._parse_flight(data, "USD")
        assert flight is None

    def test_parse_flight_invalid_price(self) -> None:
        """Test parsing flight with invalid price returns None."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "SFO",
            "flyTo": "LAX",
            "price": "invalid",
        }

        flight = client._parse_flight(data, "USD")
        assert flight is None

    def test_parse_flight_stores_raw_data(self) -> None:
        """Test that raw data is stored for debugging."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "JFK",
            "flyTo": "LAX",
            "price": 200,
        }

        flight = client._parse_flight(data, "USD")

        assert flight is not None
        assert flight.raw_data == data

    def test_parse_flight_uppercase_airports(self) -> None:
        """Test airport codes are uppercased."""
        client = KiwiMCPClient()
        data = {
            "flyFrom": "sfo",
            "flyTo": "lax",
            "price": 100,
        }

        flight = client._parse_flight(data, "USD")

        assert flight.departure_airport == "SFO"
        assert flight.arrival_airport == "LAX"


class TestParseResponse:
    """Tests for _parse_response method."""

    def test_parse_response_with_flights_list(self) -> None:
        """Test parsing response that is a list of flights."""
        client = KiwiMCPClient()
        response = [
            {"flyFrom": "SFO", "flyTo": "LAX", "price": 100},
            {"flyFrom": "SFO", "flyTo": "LAX", "price": 150},
        ]

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
        assert result.provider == "kiwi"

    def test_parse_response_with_data_key(self) -> None:
        """Test parsing response with 'data' key."""
        client = KiwiMCPClient()
        response = {
            "data": [
                {"flyFrom": "MXP", "flyTo": "LON", "price": 200},
            ]
        }

        result = client._parse_response(
            response,
            origin="MXP",
            destination="LON",
            departure_date="2026-02-15",
            return_date=None,
            currency="EUR",
        )

        assert len(result.flights) == 1

    def test_parse_response_with_flights_key(self) -> None:
        """Test parsing response with 'flights' key."""
        client = KiwiMCPClient()
        response = {
            "flights": [
                {"flyFrom": "JFK", "flyTo": "LAX", "price": 300},
            ]
        }

        result = client._parse_response(
            response,
            origin="JFK",
            destination="LAX",
            departure_date="2026-03-01",
            return_date=None,
            currency="USD",
        )

        assert len(result.flights) == 1

    def test_parse_response_empty(self) -> None:
        """Test parsing empty response."""
        client = KiwiMCPClient()
        response = {"data": []}

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

    def test_parse_response_invalid_flight_skipped(self) -> None:
        """Test that invalid flights are skipped during parsing."""
        client = KiwiMCPClient()
        response = [
            {"flyFrom": "SFO", "flyTo": "LAX", "price": 100},
            {"flyFrom": "invalid"},  # Missing price
            {"flyFrom": "JFK", "flyTo": "BOS", "price": 200},
        ]

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
        """Test parsing response for round trip."""
        client = KiwiMCPClient()
        response = [{"flyFrom": "MXP", "flyTo": "LON", "price": 400}]

        result = client._parse_response(
            response,
            origin="MXP",
            destination="LON",
            departure_date="2026-02-15",
            return_date="2026-02-22",
            currency="EUR",
        )

        assert result.is_round_trip is True
        assert result.return_date == "2026-02-22"


class TestInitialization:
    """Tests for MCP session initialization (Streamable HTTP handshake)."""

    @pytest.mark.asyncio
    async def test_ensure_initialized_sends_handshake(self) -> None:
        """Test that _ensure_initialized sends the initialize handshake."""
        client = KiwiMCPClient()

        init_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05"}},
            content_type="application/json",
            session_id="new-session-123",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=init_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client._ensure_initialized()

            assert client._initialized is True
            assert client._session_id == "new-session-123"
            mock_client.post.assert_called_once()

            # Verify it was an initialize request
            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["method"] == "initialize"
            assert "protocolVersion" in payload["params"]

    @pytest.mark.asyncio
    async def test_ensure_initialized_skips_when_already_initialized(self) -> None:
        """Test that _ensure_initialized is a no-op when already initialized."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client

            await client._ensure_initialized()

            # Should not have created an HTTP client at all
            mock_client.post.assert_not_called()

    @pytest.mark.asyncio
    async def test_ensure_initialized_handles_sse_response(self) -> None:
        """Test initialization handles SSE content-type response."""
        client = KiwiMCPClient()

        sse_text = (
            "event: message\n"
            'data: {"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05"}}\n\n'
        )
        init_response = _make_mock_response(
            status_code=200,
            text=sse_text,
            content_type="text/event-stream",
            session_id="sse-session-456",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=init_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client._ensure_initialized()

            assert client._initialized is True
            assert client._session_id == "sse-session-456"

    @pytest.mark.asyncio
    async def test_ensure_initialized_no_session_id(self) -> None:
        """Test initialization succeeds even without session ID header."""
        client = KiwiMCPClient()

        init_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05"}},
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=init_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client._ensure_initialized()

            assert client._initialized is True
            assert client._session_id is None

    @pytest.mark.asyncio
    async def test_session_reset_on_400_error(self) -> None:
        """Test that 400 errors reset session state."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        error_response = _make_mock_response(
            status_code=400,
            text="Bad Request",
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=error_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiRequestError):
                await client._send_request({"jsonrpc": "2.0", "method": "test"})

            assert client._initialized is False
            assert client._session_id is None

    @pytest.mark.asyncio
    async def test_session_reset_on_401_error(self) -> None:
        """Test that 401 errors reset session state."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        error_response = _make_mock_response(
            status_code=401,
            text="Unauthorized",
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=error_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiRequestError):
                await client._send_request({"jsonrpc": "2.0", "method": "test"})

            assert client._initialized is False
            assert client._session_id is None

    @pytest.mark.asyncio
    async def test_session_reset_on_403_error(self) -> None:
        """Test that 403 errors reset session state."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        error_response = _make_mock_response(
            status_code=403,
            text="Forbidden",
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=error_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiRequestError):
                await client._send_request({"jsonrpc": "2.0", "method": "test"})

            assert client._initialized is False
            assert client._session_id is None

    @pytest.mark.asyncio
    async def test_session_not_reset_on_500_error(self) -> None:
        """Test that 500 errors do NOT reset session state."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        error_response = _make_mock_response(
            status_code=500,
            text="Internal Server Error",
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=error_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiRequestError):
                await client._send_request({"jsonrpc": "2.0", "method": "test"})

            # Session should NOT be reset for 500 errors
            assert client._initialized is True
            assert client._session_id == "test-session-id"

    @pytest.mark.asyncio
    async def test_send_request_includes_session_header(self) -> None:
        """Test that _send_request includes mcp-session-id header."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        ok_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 1, "result": {}},
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=ok_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client._send_request({"jsonrpc": "2.0", "method": "test"})

            call_args = mock_client.post.call_args
            headers = call_args.kwargs["headers"]
            assert headers["mcp-session-id"] == "test-session-id"
            assert "application/json" in headers["Accept"]
            assert "text/event-stream" in headers["Accept"]

    @pytest.mark.asyncio
    async def test_send_request_omits_session_header_when_none(self) -> None:
        """Test that _send_request omits session header when no session."""
        client = KiwiMCPClient()
        client._initialized = True
        client._session_id = None

        ok_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 1, "result": {}},
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=ok_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client._send_request({"jsonrpc": "2.0", "method": "test"})

            call_args = mock_client.post.call_args
            headers = call_args.kwargs["headers"]
            assert "mcp-session-id" not in headers

    @pytest.mark.asyncio
    async def test_send_request_updates_session_id_from_response(self) -> None:
        """Test that _send_request updates session ID from response headers."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        ok_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 1, "result": {}},
            content_type="application/json",
            session_id="updated-session-789",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=ok_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client._send_request({"jsonrpc": "2.0", "method": "test"})

            assert client._session_id == "updated-session-789"


class TestSSEParsing:
    """Tests for SSE (Server-Sent Events) response parsing."""

    def test_extract_json_from_sse_single_event(self) -> None:
        """Test extracting JSON from a single SSE event."""
        sse_text = (
            "event: message\n"
            'data: {"jsonrpc": "2.0", "id": 1, "result": {"status": "ok"}}\n\n'
        )
        result = KiwiMCPClient._extract_json_from_sse(sse_text)
        assert result["jsonrpc"] == "2.0"
        assert result["result"]["status"] == "ok"

    def test_extract_json_from_sse_multiple_events(self) -> None:
        """Test extracting JSON from multiple SSE events (uses last one)."""
        sse_text = (
            "event: message\n"
            'data: {"jsonrpc": "2.0", "id": 1, "result": {"first": true}}\n\n'
            "event: message\n"
            'data: {"jsonrpc": "2.0", "id": 1, "result": {"second": true}}\n\n'
        )
        result = KiwiMCPClient._extract_json_from_sse(sse_text)
        assert result["result"]["second"] is True

    def test_extract_json_from_sse_no_data_line(self) -> None:
        """Test extracting JSON from SSE with no data line raises error."""
        sse_text = "event: message\n\n"
        with pytest.raises(KiwiRequestError, match="No valid data"):
            KiwiMCPClient._extract_json_from_sse(sse_text)

    def test_extract_json_from_sse_invalid_json(self) -> None:
        """Test extracting JSON from SSE with invalid JSON raises error."""
        sse_text = "data: not valid json\n\n"
        with pytest.raises(KiwiRequestError, match="No valid data"):
            KiwiMCPClient._extract_json_from_sse(sse_text)

    def test_extract_json_from_sse_skips_invalid_lines(self) -> None:
        """Test that invalid data lines are skipped and valid ones extracted."""
        sse_text = (
            "data: this is not json\n"
            'data: {"jsonrpc": "2.0", "id": 1, "result": "ok"}\n\n'
        )
        result = KiwiMCPClient._extract_json_from_sse(sse_text)
        assert result["result"] == "ok"

    def test_parse_sse_json_rpc_with_json_content_type(self) -> None:
        """Test _parse_sse_json_rpc handles application/json responses."""
        client = KiwiMCPClient()

        response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 1, "result": {"data": "test"}},
            content_type="application/json",
        )

        data = client._parse_sse_json_rpc(response)
        assert data["result"]["data"] == "test"

    def test_parse_sse_json_rpc_with_sse_content_type(self) -> None:
        """Test _parse_sse_json_rpc handles text/event-stream responses."""
        client = KiwiMCPClient()

        sse_text = (
            "event: message\n"
            'data: {"jsonrpc": "2.0", "id": 1, "result": {"flights": []}}\n\n'
        )
        response = _make_mock_response(
            status_code=200,
            text=sse_text,
            content_type="text/event-stream",
        )

        data = client._parse_sse_json_rpc(response)
        assert data["result"]["flights"] == []

    def test_parse_sse_json_rpc_raises_on_invalid_json(self) -> None:
        """Test _parse_sse_json_rpc raises KiwiRequestError on invalid JSON."""
        client = KiwiMCPClient()

        response = _make_mock_response(
            status_code=200,
            text="not json",
            content_type="application/json",
        )
        response.json.side_effect = ValueError("Invalid JSON")

        with pytest.raises(KiwiRequestError, match="Invalid JSON"):
            client._parse_sse_json_rpc(response)

    def test_parse_sse_json_rpc_raises_on_jsonrpc_error(self) -> None:
        """Test _parse_sse_json_rpc raises KiwiRequestError on JSON-RPC error."""
        client = KiwiMCPClient()

        response = _make_mock_response(
            status_code=200,
            json_data={"error": {"code": -32600, "message": "Invalid Request"}},
            content_type="application/json",
        )

        with pytest.raises(KiwiRequestError, match="Invalid Request"):
            client._parse_sse_json_rpc(response)


class TestCallMCP:
    """Tests for _call_mcp method."""

    @pytest.mark.asyncio
    async def test_successful_mcp_call(self) -> None:
        """Test successful MCP API call."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={
                "jsonrpc": "2.0",
                "id": 2,
                "result": [{"flyFrom": "SFO", "flyTo": "LAX", "price": 100}],
            },
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client._call_mcp("search-flight", {"flyFrom": "SFO"})

            assert isinstance(result, list)
            mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_mcp_call_with_nested_content(self) -> None:
        """Test MCP call that returns nested content structure."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={
                "jsonrpc": "2.0",
                "id": 2,
                "result": {"content": [{"type": "text", "text": '[{"flyFrom": "MXP", "flyTo": "LON", "price": 200}]'}]},
            },
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client._call_mcp("search-flight", {})

            assert isinstance(result, list)
            assert result[0]["flyFrom"] == "MXP"

    @pytest.mark.asyncio
    async def test_mcp_call_connection_error(self) -> None:
        """Test MCP call handles connection errors."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiConnectionError) as exc_info:
                await client._call_mcp("search-flight", {})

            assert "Connection refused" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_timeout_error(self) -> None:
        """Test MCP call handles timeout errors."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiConnectionError) as exc_info:
                await client._call_mcp("search-flight", {})

            assert "Timeout" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_http_error(self) -> None:
        """Test MCP call handles HTTP errors."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=500,
            text="Internal Server Error",
            content_type="application/json",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiRequestError) as exc_info:
                await client._call_mcp("search-flight", {})

            assert "500" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_invalid_json(self) -> None:
        """Test MCP call handles invalid JSON responses."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            text="not json",
            content_type="application/json",
        )
        mock_response.json.side_effect = ValueError("Invalid JSON")

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiRequestError) as exc_info:
                await client._call_mcp("search-flight", {})

            assert "Invalid JSON" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_jsonrpc_error(self) -> None:
        """Test MCP call handles JSON-RPC error responses."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={"error": {"code": -32600, "message": "Invalid Request"}},
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiRequestError) as exc_info:
                await client._call_mcp("search-flight", {})

            assert "Invalid Request" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mcp_call_triggers_initialization(self) -> None:
        """Test that _call_mcp triggers initialization when not initialized."""
        client = KiwiMCPClient()
        # Deliberately NOT pre-initializing

        init_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "2024-11-05"}},
            content_type="application/json",
            session_id="auto-init-session",
        )

        tool_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 2, "result": [{"flyFrom": "SFO", "flyTo": "LAX", "price": 99}]},
            content_type="application/json",
            session_id="auto-init-session",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=[init_response, tool_response])
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client._call_mcp("search-flight", {"flyFrom": "SFO"})

            assert client._initialized is True
            assert client._session_id == "auto-init-session"
            assert isinstance(result, list)
            # Two calls: initialize + tool call
            assert mock_client.post.call_count == 2

    @pytest.mark.asyncio
    async def test_mcp_call_with_sse_response(self) -> None:
        """Test _call_mcp handles SSE response from tool call."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        sse_text = (
            "event: message\n"
            'data: {"jsonrpc": "2.0", "id": 2, "result": [{"flyFrom": "JFK", "flyTo": "LAX", "price": 250}]}\n\n'
        )
        mock_response = _make_mock_response(
            status_code=200,
            text=sse_text,
            content_type="text/event-stream",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client._call_mcp("search-flight", {"flyFrom": "JFK"})

            assert isinstance(result, list)
            assert result[0]["flyFrom"] == "JFK"


class TestSearchFlight:
    """Tests for search_flight method."""

    @pytest.mark.asyncio
    async def test_search_flight_success(self) -> None:
        """Test successful flight search."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={
                "jsonrpc": "2.0",
                "id": 2,
                "result": [
                    {
                        "flyFrom": "MXP",
                        "flyTo": "LGW",
                        "cityFrom": "Milan",
                        "cityTo": "London",
                        "totalDurationInSeconds": 7200,
                        "price": 51,
                        "currency": "EUR",
                        "deepLink": "https://on.kiwi.com/test",
                        "layovers": [],
                    }
                ],
            },
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client.search_flight(
                fly_from="MXP",
                fly_to="LGW",
                departure_date="2026-02-15",
            )

            assert result.success is True
            assert len(result.flights) == 1
            assert result.flights[0].departure_airport == "MXP"
            assert result.flights[0].arrival_airport == "LGW"
            assert result.provider == "kiwi"

    @pytest.mark.asyncio
    async def test_search_flight_round_trip(self) -> None:
        """Test round trip flight search."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={
                "jsonrpc": "2.0",
                "id": 2,
                "result": [{"flyFrom": "SFO", "flyTo": "JFK", "price": 400}],
            },
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client.search_flight(
                fly_from="SFO",
                fly_to="JFK",
                departure_date="2026-03-01",
                return_date="2026-03-08",
            )

            assert result.is_round_trip is True
            assert result.return_date == "2026-03-08"

            # Verify date conversion
            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["params"]["arguments"]["departureDate"] == "01/03/2026"
            assert payload["params"]["arguments"]["returnDate"] == "08/03/2026"

    @pytest.mark.asyncio
    async def test_search_flight_with_passengers(self) -> None:
        """Test flight search with multiple passengers."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 2, "result": []},
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client.search_flight(
                fly_from="LAX",
                fly_to="CDG",
                departure_date="2026-04-01",
                adults=2,
                children=1,
                infants=1,
            )

            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            passengers = payload["params"]["arguments"]["passengers"]
            assert passengers["adults"] == 2
            assert passengers["children"] == 1
            assert passengers["infants"] == 1

    @pytest.mark.asyncio
    async def test_search_flight_with_cabin_class(self) -> None:
        """Test flight search with cabin class."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 2, "result": []},
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client.search_flight(
                fly_from="JFK",
                fly_to="LHR",
                departure_date="2026-05-01",
                cabin_class="C",  # Business
            )

            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["params"]["arguments"]["cabinClass"] == "C"

    @pytest.mark.asyncio
    async def test_search_flight_connection_error_raises(self) -> None:
        """Test search raises on connection error."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("Network error"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with pytest.raises(KiwiConnectionError):
                await client.search_flight(
                    fly_from="SFO",
                    fly_to="LAX",
                    departure_date="2026-02-01",
                )

    @pytest.mark.asyncio
    async def test_search_flight_unexpected_error_returns_failed_result(self) -> None:
        """Test search returns failed result on unexpected error."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        with patch.object(client, "_call_mcp", side_effect=RuntimeError("Unexpected")):
            result = await client.search_flight(
                fly_from="SFO",
                fly_to="LAX",
                departure_date="2026-02-01",
            )

            assert result.success is False
            assert "Unexpected" in result.error
            assert len(result.flights) == 0

    @pytest.mark.asyncio
    async def test_search_flight_parameters_uppercased(self) -> None:
        """Test that airport codes are uppercased in result."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 2, "result": []},
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            result = await client.search_flight(
                fly_from="sfo",
                fly_to="lax",
                departure_date="2026-02-01",
            )

            assert result.origin == "SFO"
            assert result.destination == "LAX"

    @pytest.mark.asyncio
    async def test_search_flight_sort_parameter(self) -> None:
        """Test flight search with sort parameter."""
        client = KiwiMCPClient()
        _pre_initialize(client)

        mock_response = _make_mock_response(
            status_code=200,
            json_data={"jsonrpc": "2.0", "id": 2, "result": []},
            content_type="application/json",
            session_id="test-session-id",
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            await client.search_flight(
                fly_from="SFO",
                fly_to="JFK",
                departure_date="2026-06-01",
                sort="duration",
            )

            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["params"]["arguments"]["sort"] == "duration"


class TestSingletonInstance:
    """Tests for singleton instance."""

    def test_singleton_exists(self) -> None:
        """Test that singleton instance is created."""
        from app.clients.kiwi_mcp import kiwi_mcp_client

        assert kiwi_mcp_client is not None
        assert isinstance(kiwi_mcp_client, KiwiMCPClient)
