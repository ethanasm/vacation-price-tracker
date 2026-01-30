"""LastMinute.com MCP client for flight search.

This client calls the free hosted MCP server at mcp.lastminute.com/mcp.
No authentication required.

Response format (from doc/research/MCP_FLIGHT_SERVERS.md):
{
  "airline": "Ryanair",
  "carrier_id": "FR",
  "departure": "BGY 09:25",
  "arrival": "STN 10:30",
  "duration": "2 hours and 5 min",
  "stops": "Direct",
  "price": "35.85 $",
  "price_amount": 3585,
  "deeplink": "https://www.lastminute.ie/...",
  "is_roundtrip": false
}
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from decimal import Decimal
from typing import Any

import httpx

from app.schemas.flight_search import FlightSearchFlight, FlightSearchResult

logger = logging.getLogger(__name__)

DEFAULT_MCP_URL = "https://mcp.lastminute.com/mcp"
DEFAULT_TIMEOUT_SECONDS = 30.0


class LastMinuteMCPError(Exception):
    """Base error for LastMinute MCP client failures."""


class LastMinuteConnectionError(LastMinuteMCPError):
    """Raised when connection to LastMinute MCP server fails."""


class LastMinuteRequestError(LastMinuteMCPError):
    """Raised when an MCP request fails."""


class LastMinuteMCPClient:
    """Client for lastminute.com hosted MCP server."""

    def __init__(
        self,
        mcp_url: str = DEFAULT_MCP_URL,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        """
        Initialize the LastMinute MCP client.

        Args:
            mcp_url: URL of the MCP server endpoint.
            timeout_seconds: Request timeout in seconds.
        """
        self._mcp_url = mcp_url.rstrip("/")
        self._timeout = httpx.Timeout(timeout_seconds)

    async def search_flights(
        self,
        departure: str,
        arrival: str,
        start_date: str,
        end_date: str | None = None,
        adults: int = 1,
        max_results: int = 10,
        ranking_best: bool = False,
        currency: str = "EUR",
        language: str | None = None,
    ) -> FlightSearchResult:
        """
        Search for flights using lastminute.com MCP server.

        Args:
            departure: Origin airport IATA code (e.g., 'MIL', 'MXP').
            arrival: Destination airport IATA code (e.g., 'LON', 'JFK').
            start_date: Departure date in YYYY-MM-DD format.
            end_date: Return date for round trips (optional).
            adults: Number of adult passengers (default: 1).
            max_results: Maximum number of results (default: 10).
            ranking_best: If True, sort by best value instead of price.
            currency: Currency code (default: 'EUR').
            language: Language code (default: None, auto-detected).

        Returns:
            FlightSearchResult with normalized flight data.

        Raises:
            LastMinuteConnectionError: If connection to MCP server fails.
            LastMinuteRequestError: If the MCP request fails.
        """
        params: dict[str, Any] = {
            "departure": departure.upper(),
            "arrival": arrival.upper(),
            "start_date": start_date,
            "adults": adults,
            "max_results": max_results,
            "currency": currency,
        }
        if end_date:
            params["end_date"] = end_date
        if ranking_best:
            params["ranking_best"] = True
        if language:
            params["language"] = language

        try:
            response = await self._call_mcp("search_flights", params)
        except LastMinuteMCPError:
            raise
        except Exception as e:
            logger.exception("Unexpected error calling LastMinute MCP")
            return FlightSearchResult(
                flights=[],
                origin=departure.upper(),
                destination=arrival.upper(),
                departure_date=start_date,
                return_date=end_date,
                is_round_trip=end_date is not None,
                provider="lastminute",
                total_results=0,
                currency=currency,
                success=False,
                error=str(e),
            )

        return self._parse_response(
            response,
            origin=departure.upper(),
            destination=arrival.upper(),
            departure_date=start_date,
            return_date=end_date,
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
            LastMinuteConnectionError: If connection fails.
            LastMinuteRequestError: If the request fails.
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
            logger.error("Failed to connect to LastMinute MCP: %s", e)
            raise LastMinuteConnectionError(f"Failed to connect to MCP server: {e}") from e
        except httpx.TimeoutException as e:
            logger.error("Timeout connecting to LastMinute MCP: %s", e)
            raise LastMinuteConnectionError(f"Timeout connecting to MCP server: {e}") from e
        except httpx.HTTPError as e:
            logger.error("HTTP error calling LastMinute MCP: %s", e)
            raise LastMinuteConnectionError(f"HTTP error: {e}") from e

        if response.status_code >= 400:
            logger.warning(
                "LastMinute MCP request failed: status=%s body=%s",
                response.status_code,
                response.text[:500],
            )
            raise LastMinuteRequestError(f"MCP request failed with status {response.status_code}")

        return response

    def _parse_json_response(self, response: httpx.Response) -> dict[str, Any]:
        """Parse JSON from response and check for JSON-RPC errors."""
        try:
            data = response.json()
        except ValueError as e:
            logger.error("Invalid JSON response from LastMinute MCP: %s", response.text[:500])
            raise LastMinuteRequestError("Invalid JSON response from MCP server") from e

        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            logger.warning("LastMinute MCP returned error: %s", error_msg)
            raise LastMinuteRequestError(f"MCP error: {error_msg}")

        return data

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

        parsed = LastMinuteMCPClient._try_parse_text_content(content)
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
            origin: Search origin airport.
            destination: Search destination airport.
            departure_date: Search departure date.
            return_date: Search return date (if round trip).
            currency: Currency code.

        Returns:
            Normalized FlightSearchResult.
        """
        flights_data = response.get("flights", [])
        if not isinstance(flights_data, list):
            flights_data = []

        flights: list[FlightSearchFlight] = []
        for flight_data in flights_data:
            try:
                parsed = self._parse_flight(flight_data, currency)
                if parsed:
                    flights.append(parsed)
            except Exception as e:
                logger.warning("Failed to parse flight data: %s - %s", flight_data, e)
                continue

        return FlightSearchResult(
            flights=flights,
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            return_date=return_date,
            is_round_trip=response.get("is_roundtrip", return_date is not None),
            provider="lastminute",
            total_results=response.get("total_results", len(flights)),
            currency=response.get("currency", currency),
            success=True,
            error=None,
        )

    def _extract_price(self, data: dict[str, Any]) -> Decimal | None:
        """Extract and parse price from flight data."""
        price_amount_cents = data.get("price_amount")
        if price_amount_cents is not None:
            return Decimal(price_amount_cents) / 100
        return self._parse_price_string(data.get("price", ""))

    def _parse_flight(
        self,
        data: dict[str, Any],
        default_currency: str,
    ) -> FlightSearchFlight | None:
        """
        Parse a single flight from MCP response.

        Args:
            data: Raw flight data from MCP response.
            default_currency: Default currency if not in response.

        Returns:
            Parsed FlightSearchFlight or None if parsing fails.
        """
        price_amount = self._extract_price(data)
        if price_amount is None:
            logger.warning("Could not parse price from: %s", data)
            return None

        dep_airport, dep_time = self._parse_airport_time(data.get("departure", ""))
        arr_airport, arr_time = self._parse_airport_time(data.get("arrival", ""))
        duration_minutes = self._parse_duration(data.get("duration", ""))
        stops_str = data.get("stops", "")
        stops = self._parse_stops(stops_str)

        return FlightSearchFlight(
            departure_airport=dep_airport or "",
            arrival_airport=arr_airport or "",
            departure_time=dep_time,
            arrival_time=arr_time,
            airline_name=data.get("airline"),
            carrier_code=data.get("carrier_id"),
            duration_minutes=duration_minutes,
            stops=stops,
            stops_text=stops_str or None,
            layovers=[],
            price_amount=price_amount,
            price_currency=default_currency,
            price_display=data.get("price") or None,
            booking_link=data.get("deeplink"),
            provider="lastminute",
            raw_data=data,
        )

    @staticmethod
    def _parse_airport_time(value: str) -> tuple[str | None, datetime | None]:
        """
        Parse airport and time from format "BGY 09:25".

        Args:
            value: String in format "AIRPORT HH:MM".

        Returns:
            Tuple of (airport_code, datetime) or (None, None) if parsing fails.
        """
        if not value:
            return None, None

        parts = value.strip().split()
        if len(parts) >= 2:
            airport = parts[0].upper()
            time_str = parts[-1]
            try:
                # Parse time, use today's date as placeholder
                time_obj = datetime.strptime(time_str, "%H:%M")
                return airport, time_obj.replace(year=2026, month=1, day=1)
            except ValueError:
                return airport, None
        elif len(parts) == 1:
            # Just airport code
            return parts[0].upper(), None
        return None, None

    @staticmethod
    def _parse_duration(value: str) -> int | None:
        """
        Parse duration string into minutes.

        Handles formats like:
        - "2 hours and 5 min"
        - "2h 5m"
        - "125 min"

        Args:
            value: Duration string.

        Returns:
            Duration in minutes or None if parsing fails.
        """
        if not value:
            return None

        # Limit input length to prevent ReDoS attacks on malformed input
        if len(value) > 100:
            logger.warning("Duration string too long, truncating: %d chars", len(value))
            value = value[:100]

        total_minutes = 0
        value = value.lower()

        # Extract hours using simple patterns to avoid backtracking
        # Match: "2 hours", "2hours", "2h" (with optional whitespace)
        hours_match = re.search(r"(\d{1,4}) *(hours?|h)\b", value)
        if hours_match:
            total_minutes += int(hours_match.group(1)) * 60

        # Extract minutes using simple patterns to avoid backtracking
        # Match: "5 minutes", "5 min", "5m" (with optional whitespace)
        mins_match = re.search(r"(\d{1,4}) *(minutes?|min|m)\b", value)
        if mins_match:
            total_minutes += int(mins_match.group(1))

        return total_minutes if total_minutes > 0 else None

    @staticmethod
    def _parse_stops(value: str) -> int:
        """
        Parse stops string into number.

        Handles formats like:
        - "Direct" -> 0
        - "1 stop" -> 1
        - "2 stops" -> 2

        Args:
            value: Stops string.

        Returns:
            Number of stops (0 for direct).
        """
        if not value:
            return 0

        value = value.lower()
        if "direct" in value or "nonstop" in value:
            return 0

        # Extract number from "1 stop", "2 stops"
        match = re.search(r"(\d+)", value)
        if match:
            return int(match.group(1))

        return 0

    @staticmethod
    def _parse_price_string(value: str) -> Decimal | None:
        """
        Parse price string into Decimal.

        Handles formats like:
        - "35.85 $"
        - "$35.85"
        - "35.85 EUR"

        Args:
            value: Price string.

        Returns:
            Price as Decimal or None if parsing fails.
        """
        if not value:
            return None

        # Extract numeric value
        match = re.search(r"[\d,]+\.?\d*", value.replace(",", ""))
        if match:
            try:
                return Decimal(match.group())
            except Exception:
                pass
        return None


# Singleton instance for shared use
lastminute_mcp_client = LastMinuteMCPClient()
