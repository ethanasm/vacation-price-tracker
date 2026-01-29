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

DEFAULT_MCP_URL = "https://mcp.kiwi.com"
DEFAULT_TIMEOUT_SECONDS = 30.0


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

    async def _call_mcp(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        Call the MCP server with JSON-RPC format.

        Args:
            tool_name: Name of the MCP tool to call.
            params: Parameters for the tool.

        Returns:
            Response data from the MCP server.

        Raises:
            KiwiConnectionError: If connection fails.
            KiwiRequestError: If the request fails.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": params,
            },
        }

        response = await self._send_request(payload)
        data = self._parse_json_response(response)
        return self._extract_result(data)

    async def _send_request(self, payload: dict[str, Any]) -> httpx.Response:
        """Send HTTP request to MCP server."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    self._mcp_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
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
            logger.warning(
                "Kiwi MCP request failed: status=%s body=%s",
                response.status_code,
                response.text[:500],
            )
            raise KiwiRequestError(f"MCP request failed with status {response.status_code}")

        return response

    def _parse_json_response(self, response: httpx.Response) -> dict[str, Any]:
        """Parse JSON from response and check for JSON-RPC errors."""
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
    def _extract_result(data: dict[str, Any]) -> dict[str, Any]:
        """Extract result from JSON-RPC response, handling nested content."""
        import json

        result = data.get("result", {})

        if isinstance(result, dict) and "content" in result:
            content = result["content"]
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        try:
                            return json.loads(item.get("text", "{}"))
                        except json.JSONDecodeError:
                            pass
            return result

        return result

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
        # Parse airports
        dep_airport = data.get("flyFrom", "").upper()
        arr_airport = data.get("flyTo", "").upper()

        # Parse times - Kiwi provides both UTC and local
        departure_time = self._parse_kiwi_datetime(data.get("departure"))
        arrival_time = self._parse_kiwi_datetime(data.get("arrival"))

        # Parse duration - Kiwi provides seconds
        duration_seconds = data.get("totalDurationInSeconds") or data.get("durationInSeconds")
        duration_minutes = duration_seconds // 60 if duration_seconds else None

        # Parse layovers to determine stops
        layovers_data = data.get("layovers", [])
        stops = len(layovers_data) if isinstance(layovers_data, list) else 0

        # Parse layover details
        layovers = self._parse_layovers(layovers_data)

        # Generate stops text
        stops_text = "Direct" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

        # Parse price
        price_value = data.get("price")
        if price_value is None:
            logger.warning("No price in Kiwi flight data: %s", data)
            return None

        try:
            price_amount = Decimal(str(price_value))
        except Exception:
            logger.warning("Invalid price in Kiwi flight: %s", price_value)
            return None

        currency = data.get("currency", default_currency)

        return FlightSearchFlight(
            departure_airport=dep_airport,
            arrival_airport=arr_airport,
            departure_time=departure_time,
            arrival_time=arrival_time,
            airline_name=None,  # Kiwi doesn't provide airline names
            carrier_code=None,  # Kiwi doesn't provide carrier codes
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
