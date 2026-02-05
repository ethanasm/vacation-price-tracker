"""Kiwi.com MCP client for flight search.

This client calls the free hosted MCP server at mcp.kiwi.com.
No authentication required.

Response format (from doc/research/MCP_FLIGHT_SERVERS.md):
{
  "flyFrom": "MXP",
  "flyTo": "LGW",
  "cityFrom": "Milan",
  "cityTo": "London",
  "departure": {
    "utc": "2026-02-15T06:50:00.000Z",
    "local": "2026-02-15T07:50:00.000"
  },
  "arrival": {
    "utc": "2026-02-15T08:50:00.000Z",
    "local": "2026-02-15T08:50:00.000"
  },
  "totalDurationInSeconds": 7200,
  "durationInSeconds": 7200,
  "price": 51,
  "deepLink": "https://on.kiwi.com/42QuYx",
  "currency": "USD",
  "layovers": [...]
}

Note: Kiwi MCP does NOT provide airline names or carrier codes.
"""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

import httpx

from app.schemas.flight_search import FlightLayover, FlightSearchFlight, FlightSearchResult

logger = logging.getLogger(__name__)

DEFAULT_MCP_URL = "https://mcp.kiwi.com/mcp"
DEFAULT_TIMEOUT_SECONDS = 30.0

# MCP protocol version for Streamable HTTP transport
MCP_PROTOCOL_VERSION = "2024-11-05"


class KiwiMCPError(Exception):
    """Base error for Kiwi MCP client failures."""


class KiwiConnectionError(KiwiMCPError):
    """Raised when connection to Kiwi MCP server fails."""


class KiwiRequestError(KiwiMCPError):
    """Raised when an MCP request fails."""


class KiwiMCPClient:
    """Client for Kiwi.com hosted MCP server."""

    def __init__(
        self,
        mcp_url: str = DEFAULT_MCP_URL,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        """
        Initialize the Kiwi MCP client.

        Args:
            mcp_url: URL of the MCP server endpoint.
            timeout_seconds: Request timeout in seconds.
        """
        self._mcp_url = mcp_url.rstrip("/")
        self._timeout = httpx.Timeout(timeout_seconds)
        self._session_id: str | None = None
        self._initialized: bool = False
        self._request_id: int = 0

    async def search_flight(
        self,
        fly_from: str,
        fly_to: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        children: int = 0,
        infants: int = 0,
        cabin_class: str = "M",
        currency: str = "EUR",
        locale: str = "en",
        sort: str = "price",
    ) -> FlightSearchResult:
        """
        Search for flights using Kiwi MCP server.

        Args:
            fly_from: Origin airport/city (e.g., 'MXP', 'Milan').
            fly_to: Destination airport/city (e.g., 'LGW', 'London').
            departure_date: Departure date in dd/mm/yyyy format.
            return_date: Return date for round trips (dd/mm/yyyy format).
            adults: Number of adult passengers (default: 1).
            children: Number of children 2-11 (default: 0).
            infants: Number of infants 0-1 (default: 0).
            cabin_class: M (economy), W (economy premium), C (business), F (first).
            currency: Currency code (default: 'EUR').
            locale: Language code (default: 'en').
            sort: Sort order: price, duration, quality, or date.

        Returns:
            FlightSearchResult with normalized flight data.

        Raises:
            KiwiConnectionError: If connection to MCP server fails.
            KiwiRequestError: If the MCP request fails.
        """
        # Convert date format from YYYY-MM-DD to dd/mm/yyyy
        departure_date_kiwi = self._convert_date_format(departure_date)
        return_date_kiwi = self._convert_date_format(return_date) if return_date else None

        params: dict[str, Any] = {
            "flyFrom": fly_from,
            "flyTo": fly_to,
            "departureDate": departure_date_kiwi,
            "cabinClass": cabin_class,
            "curr": currency,
            "locale": locale,
            "sort": sort,
            "passengers": {
                "adults": adults,
                "children": children,
                "infants": infants,
            },
        }
        if return_date_kiwi:
            params["returnDate"] = return_date_kiwi

        try:
            response = await self._call_mcp("search-flight", params)
        except KiwiMCPError:
            raise
        except Exception as e:
            logger.exception("Unexpected error calling Kiwi MCP")
            return FlightSearchResult(
                flights=[],
                origin=fly_from.upper(),
                destination=fly_to.upper(),
                departure_date=departure_date,
                return_date=return_date,
                is_round_trip=return_date is not None,
                provider="kiwi",
                total_results=0,
                currency=currency,
                success=False,
                error=str(e),
            )

        return self._parse_response(
            response,
            origin=fly_from.upper(),
            destination=fly_to.upper(),
            departure_date=departure_date,
            return_date=return_date,
            currency=currency,
        )

    def _next_request_id(self) -> int:
        """Get the next JSON-RPC request ID."""
        self._request_id += 1
        return self._request_id

    async def _ensure_initialized(self) -> None:
        """Ensure the MCP session is initialized.

        The Streamable HTTP MCP transport requires an initialize handshake
        before any tool calls can be made. This sends the initialize request
        and captures the session ID from the response headers.

        Raises:
            KiwiConnectionError: If connection fails.
            KiwiRequestError: If initialization fails.
        """
        if self._initialized:
            return

        payload = {
            "jsonrpc": "2.0",
            "id": self._next_request_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {
                    "name": "vacation-price-tracker",
                    "version": "1.0.0",
                },
            },
        }

        response = await self._send_request(payload, include_session=False)
        session_id = response.headers.get("mcp-session-id")
        if session_id:
            self._session_id = session_id

        # Parse the SSE response to verify initialization succeeded
        self._parse_sse_json_rpc(response)
        self._initialized = True
        logger.debug("Kiwi MCP session initialized: session_id=%s", self._session_id)

    async def _call_mcp(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        Call the MCP server with JSON-RPC format.

        Ensures the session is initialized before making the tool call.

        Args:
            tool_name: Name of the MCP tool to call.
            params: Parameters for the tool.

        Returns:
            Response data from the MCP server.

        Raises:
            KiwiConnectionError: If connection fails.
            KiwiRequestError: If the request fails.
        """
        await self._ensure_initialized()

        payload = {
            "jsonrpc": "2.0",
            "id": self._next_request_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": params,
            },
        }

        response = await self._send_request(payload)
        data = self._parse_sse_json_rpc(response)
        return self._extract_result(data)

    async def _send_request(
        self,
        payload: dict[str, Any],
        *,
        include_session: bool = True,
    ) -> httpx.Response:
        """Send HTTP request to MCP server.

        Args:
            payload: JSON-RPC payload to send.
            include_session: Whether to include the session ID header.

        Returns:
            HTTP response from the MCP server.

        Raises:
            KiwiConnectionError: If connection fails.
            KiwiRequestError: If the request returns an error status.
        """
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if include_session and self._session_id:
            headers["mcp-session-id"] = self._session_id

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    self._mcp_url,
                    json=payload,
                    headers=headers,
                )
        except httpx.ConnectError as e:
            logger.error("Failed to connect to Kiwi MCP: %s", e)
            raise KiwiConnectionError(f"Failed to connect to MCP server: {e}") from e
        except httpx.TimeoutException as e:
            logger.error("Timeout connecting to Kiwi MCP: %s", e)
            raise KiwiConnectionError(f"Timeout connecting to MCP server: {e}") from e
        except httpx.HTTPError as e:
            logger.error("HTTP error calling Kiwi MCP: %s", e)
            raise KiwiConnectionError(f"HTTP error: {e}") from e

        if response.status_code >= 400:
            # Reset session on auth/session errors so next call re-initializes
            if response.status_code in (400, 401, 403):
                self._initialized = False
                self._session_id = None
            logger.warning(
                "Kiwi MCP request failed: status=%s body=%s",
                response.status_code,
                response.text[:500],
            )
            raise KiwiRequestError(f"MCP request failed with status {response.status_code}")

        # Update session ID if server sends a new one
        new_session_id = response.headers.get("mcp-session-id")
        if new_session_id:
            self._session_id = new_session_id

        return response

    def _parse_sse_json_rpc(self, response: httpx.Response) -> dict[str, Any]:
        """Parse JSON-RPC data from an SSE or JSON response.

        The Kiwi MCP server uses Streamable HTTP transport, which returns
        responses as Server-Sent Events (SSE) with ``text/event-stream``
        content type. Each event has the format::

            event: message
            data: {"jsonrpc": "2.0", ...}

        This method handles both SSE and plain JSON responses.

        Args:
            response: HTTP response to parse.

        Returns:
            Parsed JSON-RPC response data.

        Raises:
            KiwiRequestError: If parsing fails or the response contains an error.
        """
        content_type = response.headers.get("content-type", "")

        if "text/event-stream" in content_type:
            data = self._extract_json_from_sse(response.text)
        else:
            try:
                data = response.json()
            except ValueError as e:
                logger.error("Invalid JSON response from Kiwi MCP: %s", response.text[:500])
                raise KiwiRequestError("Invalid JSON response from MCP server") from e

        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            logger.warning("Kiwi MCP returned error: %s", error_msg)
            raise KiwiRequestError(f"MCP error: {error_msg}")

        return data

    @staticmethod
    def _extract_json_from_sse(text: str) -> dict[str, Any]:
        """Extract JSON-RPC payload from SSE event stream text.

        Args:
            text: Raw SSE response text.

        Returns:
            Parsed JSON data from the last ``data:`` line.

        Raises:
            KiwiRequestError: If no valid JSON data line is found.
        """
        import json

        # Extract data lines from SSE (may have multiple events; use last one)
        last_data: dict[str, Any] | None = None
        for line in text.splitlines():
            if line.startswith("data: "):
                try:
                    last_data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue

        if last_data is None:
            logger.error("No valid JSON data in SSE response: %s", text[:500])
            raise KiwiRequestError("No valid data in SSE response from MCP server")

        return last_data

    @staticmethod
    def _try_parse_text_content(content: list[Any]) -> dict[str, Any] | None:
        """Try to parse text content from a list of content items."""
        import json

        for item in content:
            if not isinstance(item, dict) or item.get("type") != "text":
                continue
            try:
                return json.loads(item.get("text", "{}"))
            except json.JSONDecodeError:
                continue
        return None

    @staticmethod
    def _extract_result(data: dict[str, Any]) -> dict[str, Any]:
        """Extract result from JSON-RPC response, handling nested content."""
        result = data.get("result", {})

        if not isinstance(result, dict) or "content" not in result:
            return result

        content = result["content"]
        if not isinstance(content, list):
            return result

        parsed = KiwiMCPClient._try_parse_text_content(content)
        return parsed if parsed is not None else result

    def _parse_response(
        self,
        response: dict[str, Any],
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None,
        currency: str,
    ) -> FlightSearchResult:
        """
        Parse MCP response into normalized FlightSearchResult.

        Args:
            response: Raw response from MCP server.
            origin: Search origin.
            destination: Search destination.
            departure_date: Search departure date.
            return_date: Search return date (if round trip).
            currency: Currency code.

        Returns:
            Normalized FlightSearchResult.
        """
        # Response may be a list of flights or have a 'data' key
        flights_data = response
        if isinstance(response, dict):
            flights_data = response.get("data") or response.get("flights") or []
        if not isinstance(flights_data, list):
            flights_data = []

        flights: list[FlightSearchFlight] = []
        for flight_data in flights_data:
            try:
                parsed = self._parse_flight(flight_data, currency)
                if parsed:
                    flights.append(parsed)
            except Exception as e:
                logger.warning("Failed to parse Kiwi flight data: %s - %s", flight_data, e)
                continue

        return FlightSearchResult(
            flights=flights,
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            return_date=return_date,
            is_round_trip=return_date is not None,
            provider="kiwi",
            total_results=len(flights),
            currency=currency,
            success=True,
            error=None,
        )

    def _parse_flight(
        self,
        data: dict[str, Any],
        default_currency: str,
    ) -> FlightSearchFlight | None:
        """
        Parse a single flight from Kiwi MCP response.

        Args:
            data: Raw flight data from MCP response.
            default_currency: Default currency if not in response.

        Returns:
            Parsed FlightSearchFlight or None if parsing fails.
        """
        price_amount = self._parse_price_value(data.get("price"))
        if price_amount is None:
            return None

        dep_airport = data.get("flyFrom", "").upper()
        arr_airport = data.get("flyTo", "").upper()
        departure_time = self._parse_kiwi_datetime(data.get("departure"))
        arrival_time = self._parse_kiwi_datetime(data.get("arrival"))

        duration_seconds = data.get("totalDurationInSeconds") or data.get("durationInSeconds")
        duration_minutes = duration_seconds // 60 if duration_seconds else None

        layovers_data = data.get("layovers", [])
        stops = len(layovers_data) if isinstance(layovers_data, list) else 0
        layovers = self._parse_layovers(layovers_data)
        stops_text = "Direct" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

        currency = data.get("currency", default_currency)

        return FlightSearchFlight(
            departure_airport=dep_airport,
            arrival_airport=arr_airport,
            departure_time=departure_time,
            arrival_time=arrival_time,
            airline_name=None,
            carrier_code=None,
            duration_minutes=duration_minutes,
            stops=stops,
            stops_text=stops_text,
            layovers=layovers,
            price_amount=price_amount,
            price_currency=currency,
            price_display=f"{price_amount} {currency}",
            booking_link=data.get("deepLink"),
            provider="kiwi",
            raw_data=data,
        )

    def _parse_price_value(self, price_value: Any) -> Decimal | None:
        """Parse a price value to Decimal."""
        if price_value is None:
            return None
        try:
            return Decimal(str(price_value))
        except Exception:
            logger.warning("Invalid price value: %s", price_value)
            return None

    def _parse_layovers(self, layovers_data: list[dict[str, Any]] | Any) -> list[FlightLayover]:
        """
        Parse layover information from Kiwi response.

        Args:
            layovers_data: List of layover dictionaries.

        Returns:
            List of FlightLayover objects.
        """
        if not isinstance(layovers_data, list):
            return []

        layovers = []
        for layover in layovers_data:
            if not isinstance(layover, dict):
                continue

            arrival_time = self._parse_kiwi_datetime(layover.get("arrival"))
            departure_time = self._parse_kiwi_datetime(layover.get("departure"))

            duration_minutes = None
            if arrival_time and departure_time:
                delta = departure_time - arrival_time
                duration_minutes = int(delta.total_seconds() / 60)

            layovers.append(
                FlightLayover(
                    airport=layover.get("at", "").upper(),
                    city=layover.get("city"),
                    arrival_time=arrival_time,
                    departure_time=departure_time,
                    duration_minutes=duration_minutes,
                )
            )

        return layovers

    @staticmethod
    def _parse_kiwi_datetime(data: dict[str, str] | str | None) -> datetime | None:
        """
        Parse Kiwi datetime format.

        Kiwi provides times as:
        {
            "utc": "2026-02-15T06:50:00.000Z",
            "local": "2026-02-15T07:50:00.000"
        }

        Args:
            data: Dictionary with 'utc' and 'local' keys, or ISO string.

        Returns:
            Parsed datetime (preferring local) or None.
        """
        if not data:
            return None

        # Handle string input
        if isinstance(data, str):
            return KiwiMCPClient._parse_iso_datetime(data)

        # Handle dict input - prefer local time
        time_str = data.get("local") or data.get("utc")
        if not time_str:
            return None

        return KiwiMCPClient._parse_iso_datetime(time_str)

    @staticmethod
    def _parse_iso_datetime(value: str) -> datetime | None:
        """
        Parse ISO datetime string.

        Args:
            value: ISO datetime string.

        Returns:
            Parsed datetime or None.
        """
        if not value:
            return None

        # Remove trailing Z if present
        value = value.replace("Z", "")

        # Try various formats
        formats = [
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue

        return None

    @staticmethod
    def _convert_date_format(date_str: str | None) -> str | None:
        """
        Convert date from YYYY-MM-DD to dd/mm/yyyy (Kiwi format).

        Args:
            date_str: Date in YYYY-MM-DD format.

        Returns:
            Date in dd/mm/yyyy format or None.
        """
        if not date_str:
            return None

        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.strftime("%d/%m/%Y")
        except ValueError:
            # Already in correct format or invalid
            return date_str


# Singleton instance for shared use
kiwi_mcp_client = KiwiMCPClient()
