"""Skiplagged MCP client for flight and hotel search.

This client calls the hosted MCP server at mcp.skiplagged.com/mcp.
No authentication required.

Uses JSON-RPC 2.0 over Streamable HTTP transport.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

import httpx

from app.clients.skiplagged_parser import parse_flight_segments
from app.core.config import settings
from app.core.errors import GlobalBudgetExceeded
from app.core.quota import incr_and_check_global_budget
from app.core.telemetry import langfuse_context, observe
from app.schemas.flight_search import FlightSearchFlight, FlightSearchResult
from app.schemas.hotel_search import HotelRoom, HotelSearchHotel, HotelSearchResult
from app.schemas.skiplagged import SkiplaggedHotelDetail

logger = logging.getLogger(__name__)

DEFAULT_MCP_URL = "https://mcp.skiplagged.com/mcp"
DEFAULT_TIMEOUT_SECONDS = 30.0

# MCP protocol version for Streamable HTTP transport
MCP_PROTOCOL_VERSION = "2024-11-05"

# Transient-failure retry tuning. The hosted Skiplagged MCP server proxies our
# calls to skiplagged.com's fare backend; when that backend throttles the shared
# MCP server we see 429s — surfaced either as an HTTP status or as an in-payload
# error message ("Failed to fetch from search: Request failed with status code
# 429"). Retry a bounded number of times with short backoff so brief throttles
# self-heal without blowing the Temporal activity timeout. Sustained blocks are
# left to the caller (Temporal retry policy) to reschedule.
RETRYABLE_HTTP_STATUS = frozenset({429, 502, 503, 504})
MAX_TRANSIENT_RETRIES = 2
BASE_BACKOFF_SECONDS = 0.5
MAX_BACKOFF_SECONDS = 4.0


class SkiplaggedMCPError(Exception):
    """Base error for Skiplagged MCP client failures."""


class SkiplaggedConnectionError(SkiplaggedMCPError):
    """Raised when connection to Skiplagged MCP server fails."""


class SkiplaggedRequestError(SkiplaggedMCPError):
    """Raised when an MCP request fails."""


class SkiplaggedTransientError(SkiplaggedRequestError):
    """Raised for transient upstream failures (5xx) that are worth retrying."""


class SkiplaggedRateLimitError(SkiplaggedTransientError):
    """Raised when Skiplagged (or its upstream fare backend) returns HTTP 429.

    ``retry_after`` carries the server-advised backoff in seconds when present.
    """

    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


def _is_rate_limit_message(message: str | None) -> bool:
    """Detect a rate-limit signal embedded in an MCP error/tool message."""
    if not message:
        return False
    lowered = message.lower()
    return "429" in lowered or "too many requests" in lowered or "rate limit" in lowered


class SkiplaggedClient:
    """Client for Skiplagged hosted MCP server."""

    def __init__(
        self,
        mcp_url: str = DEFAULT_MCP_URL,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        """
        Initialize the Skiplagged MCP client.

        Args:
            mcp_url: URL of the MCP server endpoint.
            timeout_seconds: Request timeout in seconds.
        """
        self._mcp_url = mcp_url.rstrip("/")
        self._timeout = httpx.Timeout(timeout_seconds)
        self._session_id: str | None = None
        self._initialized: bool = False
        self._request_id: int = 0

    def _next_request_id(self) -> int:
        """Get the next JSON-RPC request ID."""
        self._request_id += 1
        return self._request_id

    async def _ensure_initialized(self) -> None:
        """Ensure the MCP session is initialized.

        Sends the initialize JSON-RPC handshake and captures the session ID
        from the response headers.

        Raises:
            SkiplaggedConnectionError: If connection fails.
            SkiplaggedRequestError: If initialization fails.
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

        # Parse SSE response to verify initialization succeeded
        self._parse_sse_json_rpc(response)
        self._initialized = True
        logger.debug("Skiplagged MCP session initialized: session_id=%s", self._session_id)

    @staticmethod
    async def _enforce_global_budget() -> None:
        """Meter this MCP call against the global daily Skiplagged call budget.

        One increment per logical `_call_mcp` (the internal transient-retry loop is
        not separately counted). Raises GlobalBudgetExceeded once the day's total
        crosses the ceiling so the worker activity / chat tool fails gracefully.
        """
        within, _ = await incr_and_check_global_budget(
            "skiplagged_calls", 1, settings.global_daily_skiplagged_call_budget
        )
        if not within:
            raise GlobalBudgetExceeded(
                "The flight/hotel search service has reached its daily ceiling. "
                "Please try again tomorrow."
            )

    @observe(name="skiplagged.mcp_call")
    async def _call_mcp(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
        """Call the MCP server with JSON-RPC format.

        Args:
            tool_name: Name of the MCP tool to call.
            params: Parameters for the tool.

        Returns:
            Response data from the MCP server.
        """
        langfuse_context.update_current_observation(
            name=f"skiplagged.mcp.{tool_name}",
            input={"tool": tool_name, "arguments": params},
            metadata={"provider": "skiplagged", "mcp_url": self._mcp_url, "tool_name": tool_name},
        )
        await self._ensure_initialized()
        await self._enforce_global_budget()

        payload = {
            "jsonrpc": "2.0",
            "id": self._next_request_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": params,
            },
        }

        for attempt in range(MAX_TRANSIENT_RETRIES + 1):
            try:
                response = await self._send_request(payload)
                data = self._parse_sse_json_rpc(response)
                self._raise_for_tool_error(data)
                result = self._extract_result(data)
            except SkiplaggedTransientError as exc:
                delay = self._backoff_delay(exc, attempt)
                if delay is None or attempt >= MAX_TRANSIENT_RETRIES:
                    raise
                logger.warning(
                    "Skiplagged MCP transient error on %s (%s); backing off %.1fs (attempt %d/%d)",
                    tool_name,
                    exc,
                    delay,
                    attempt + 1,
                    MAX_TRANSIENT_RETRIES,
                )
                await asyncio.sleep(delay)
                continue
            langfuse_context.update_current_observation(output=result)
            return result

        # The loop always returns or raises above; this satisfies type checkers.
        raise SkiplaggedRequestError(f"MCP request for {tool_name} failed after retries")

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
            SkiplaggedConnectionError: If connection fails.
            SkiplaggedRequestError: If the request returns an error status.
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
            logger.error("Failed to connect to Skiplagged MCP: %s", e)
            raise SkiplaggedConnectionError(f"Failed to connect to MCP server: {e}") from e
        except httpx.TimeoutException as e:
            logger.error("Timeout connecting to Skiplagged MCP: %s", e)
            raise SkiplaggedConnectionError(f"Timeout connecting to MCP server: {e}") from e
        except httpx.HTTPError as e:
            logger.error("HTTP error calling Skiplagged MCP: %s", e)
            raise SkiplaggedConnectionError(f"HTTP error: {e}") from e

        if response.status_code >= 400:
            # Reset session on auth/session errors so next call re-initializes
            if response.status_code in (400, 401, 403):
                self._initialized = False
                self._session_id = None
            logger.warning(
                "Skiplagged MCP request failed: status=%s body=%s",
                response.status_code,
                response.text[:500],
            )
            if response.status_code == 429:
                raise SkiplaggedRateLimitError(
                    "MCP request failed with status 429",
                    retry_after=self._parse_retry_after(response),
                )
            if response.status_code in RETRYABLE_HTTP_STATUS:
                raise SkiplaggedTransientError(
                    f"MCP request failed with status {response.status_code}"
                )
            raise SkiplaggedRequestError(f"MCP request failed with status {response.status_code}")

        # Update session ID if server sends a new one
        new_session_id = response.headers.get("mcp-session-id")
        if new_session_id:
            self._session_id = new_session_id

        return response

    def _parse_sse_json_rpc(self, response: httpx.Response) -> dict[str, Any]:
        """Parse JSON-RPC data from an SSE or JSON response.

        Args:
            response: HTTP response to parse.

        Returns:
            Parsed JSON-RPC response data.

        Raises:
            SkiplaggedRequestError: If parsing fails or the response contains an error.
        """
        content_type = response.headers.get("content-type", "")

        if "text/event-stream" in content_type:
            data = self._extract_json_from_sse(response.text)
        else:
            try:
                data = response.json()
            except ValueError as e:
                logger.error("Invalid JSON response from Skiplagged MCP: %s", response.text[:500])
                raise SkiplaggedRequestError("Invalid JSON response from MCP server") from e

        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            logger.warning("Skiplagged MCP returned error: %s", error_msg)
            if _is_rate_limit_message(error_msg):
                raise SkiplaggedRateLimitError(f"MCP error: {error_msg}")
            raise SkiplaggedRequestError(f"MCP error: {error_msg}")

        return data

    @staticmethod
    def _extract_json_from_sse(text: str) -> dict[str, Any]:
        """Extract JSON-RPC payload from SSE event stream text.

        Args:
            text: Raw SSE response text.

        Returns:
            Parsed JSON data from the last ``data:`` line.

        Raises:
            SkiplaggedRequestError: If no valid JSON data line is found.
        """
        import json

        last_data: dict[str, Any] | None = None
        for line in text.splitlines():
            if line.startswith("data: "):
                try:
                    last_data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue

        if last_data is None:
            logger.error("No valid JSON data in SSE response: %s", text[:500])
            raise SkiplaggedRequestError("No valid data in SSE response from MCP server")

        return last_data

    @staticmethod
    def _extract_result(data: dict[str, Any]) -> dict[str, Any]:
        """Extract result from JSON-RPC response, preferring structuredContent."""
        result = data.get("result", {})

        if not isinstance(result, dict):
            return result  # type: ignore[return-value]

        # Prefer structuredContent (typed data) over content (text)
        structured = result.get("structuredContent")
        if structured and isinstance(structured, dict):
            return structured

        # Fall back to parsing text content
        content = result.get("content")
        if isinstance(content, list):
            import json

            for item in content:
                if not isinstance(item, dict) or item.get("type") != "text":
                    continue
                try:
                    return json.loads(item.get("text", "{}"))
                except json.JSONDecodeError:
                    continue

        return result

    @staticmethod
    def _raise_for_tool_error(data: dict[str, Any]) -> None:
        """Raise if a tools/call result is flagged as an error (isError=true).

        MCP tool failures (including upstream 429s) can be returned as a normal
        JSON-RPC result with ``isError`` set rather than a top-level ``error``,
        so this path must be classified too.
        """
        result = data.get("result")
        if not isinstance(result, dict) or not result.get("isError"):
            return

        text_parts: list[str] = []
        content = result.get("content")
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_parts.append(str(item.get("text", "")))
        message = " ".join(text_parts).strip() or "Unknown tool error"

        logger.warning("Skiplagged MCP tool error: %s", message)
        if _is_rate_limit_message(message):
            raise SkiplaggedRateLimitError(f"MCP tool error: {message}")
        raise SkiplaggedRequestError(f"MCP tool error: {message}")

    @staticmethod
    def _parse_retry_after(response: httpx.Response) -> float | None:
        """Parse a numeric ``Retry-After`` header (seconds); ignore HTTP-date form."""
        raw = response.headers.get("retry-after")
        if not raw:
            return None
        try:
            return float(raw)
        except ValueError:
            return None

    @staticmethod
    def _backoff_delay(exc: SkiplaggedTransientError, attempt: int) -> float | None:
        """Compute the backoff before the next retry, or None to stop retrying.

        Honors a server-advised ``Retry-After`` when present, but if that exceeds
        the local cap we return None so the caller (Temporal) reschedules instead
        of blocking the activity for a long throttle window.
        """
        retry_after = getattr(exc, "retry_after", None)
        if retry_after is not None:
            if retry_after > MAX_BACKOFF_SECONDS:
                return None
            return retry_after
        return min(BASE_BACKOFF_SECONDS * (2**attempt), MAX_BACKOFF_SECONDS)

    # -------------------------------------------------------------------------
    # Public search methods
    # -------------------------------------------------------------------------

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        max_stops: str | None = None,
        sort: str = "value",
        limit: int = 75,
        offset: int = 0,
    ) -> FlightSearchResult:
        """Search for flights via Skiplagged MCP.

        Args:
            origin: Origin airport IATA code.
            destination: Destination airport IATA code.
            departure_date: Departure date (YYYY-MM-DD).
            return_date: Return date for round trips (YYYY-MM-DD).
            adults: Number of adult passengers.
            max_stops: Stop filter: "none", "one", or "many".
            sort: Sort order: "price", "duration", or "value".
            limit: Max results per page.
            offset: Pagination offset.

        Returns:
            FlightSearchResult with normalized flight data.
        """
        result, _pagination = await self._search_flights_page(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            return_date=return_date,
            adults=adults,
            max_stops=max_stops,
            sort=sort,
            limit=limit,
            offset=offset,
        )
        return result

    async def _search_flights_page(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        max_stops: str | None = None,
        sort: str = "value",
        limit: int = 75,
        offset: int = 0,
    ) -> tuple[FlightSearchResult, dict[str, Any]]:
        """Internal: search one page of flights, returning (result, pagination)."""
        params: dict[str, Any] = {
            "origin": origin.upper(),
            "destination": destination.upper(),
            "departureDate": departure_date,
            "adults": adults,
            "sort": sort,
            "limit": limit,
            "offset": offset,
            "includeHiddenCity": False,
        }
        if return_date:
            params["returnDate"] = return_date
        if max_stops:
            params["maxStops"] = max_stops

        try:
            response = await self._call_mcp("sk_flights_search", params)
        except SkiplaggedMCPError:
            raise
        except Exception as e:
            logger.exception("Unexpected error calling Skiplagged flights")
            error_result = FlightSearchResult(
                flights=[],
                origin=origin.upper(),
                destination=destination.upper(),
                departure_date=departure_date,
                return_date=return_date,
                is_round_trip=return_date is not None,
                provider="skiplagged",
                total_results=0,
                currency="USD",
                success=False,
                error=str(e),
            )
            return error_result, {}

        return self._parse_flights_response(
            response,
            origin=origin.upper(),
            destination=destination.upper(),
            departure_date=departure_date,
            return_date=return_date,
        )

    async def search_flights_all(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        max_stops: str | None = None,
        sort: str = "value",
        limit: int = 75,
        max_pages: int = 4,
    ) -> FlightSearchResult:
        """Search for flights across multiple pages.

        Args:
            origin: Origin airport IATA code.
            destination: Destination airport IATA code.
            departure_date: Departure date (YYYY-MM-DD).
            return_date: Return date for round trips (YYYY-MM-DD).
            adults: Number of adult passengers.
            max_stops: Stop filter.
            sort: Sort order.
            limit: Results per page.
            max_pages: Maximum number of pages to fetch.

        Returns:
            FlightSearchResult with all flights combined.
        """
        all_flights: list[FlightSearchFlight] = []
        offset = 0

        for page in range(max_pages):
            result, pagination = await self._search_flights_page(
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                return_date=return_date,
                adults=adults,
                max_stops=max_stops,
                sort=sort,
                limit=limit,
                offset=offset,
            )

            if not result.success:
                return FlightSearchResult(
                    flights=all_flights,
                    origin=origin.upper(),
                    destination=destination.upper(),
                    departure_date=departure_date,
                    return_date=return_date,
                    is_round_trip=return_date is not None,
                    provider="skiplagged",
                    total_results=len(all_flights),
                    currency="USD",
                    success=len(all_flights) > 0,
                    error=result.error,
                )

            all_flights.extend(result.flights)

            has_more = pagination.get("hasMoreResults", False)
            if not has_more or page >= max_pages - 1:
                break

            offset += limit

        return FlightSearchResult(
            flights=all_flights,
            origin=origin.upper(),
            destination=destination.upper(),
            departure_date=departure_date,
            return_date=return_date,
            is_round_trip=return_date is not None,
            provider="skiplagged",
            total_results=len(all_flights),
            currency="USD",
            success=True,
            error=None,
        )

    async def search_hotels(
        self,
        city: str,
        checkin: str,
        checkout: str,
        adults: int = 2,
        rooms: int = 1,
        sort: str = "value",
        limit: int = 75,
        offset: int = 0,
    ) -> HotelSearchResult:
        """Search for hotels via Skiplagged MCP.

        Args:
            city: City name (Skiplagged resolves internally).
            checkin: Check-in date (YYYY-MM-DD).
            checkout: Check-out date (YYYY-MM-DD).
            adults: Number of adult guests.
            rooms: Number of rooms.
            sort: Sort order: "price", "ranking", or "value".
            limit: Max results per page.
            offset: Pagination offset.

        Returns:
            HotelSearchResult with normalized hotel data.
        """
        result, _pagination = await self._search_hotels_page(
            city=city,
            checkin=checkin,
            checkout=checkout,
            adults=adults,
            rooms=rooms,
            sort=sort,
            limit=limit,
            offset=offset,
        )
        return result

    async def _search_hotels_page(
        self,
        city: str,
        checkin: str,
        checkout: str,
        adults: int = 2,
        rooms: int = 1,
        sort: str = "value",
        limit: int = 75,
        offset: int = 0,
    ) -> tuple[HotelSearchResult, dict[str, Any]]:
        """Internal: search one page of hotels, returning (result, pagination)."""
        params: dict[str, Any] = {
            "city": city,
            "checkin": checkin,
            "checkout": checkout,
            "numAdults": adults,
            "numRooms": rooms,
            "sort": sort,
            "limit": limit,
            "offset": offset,
        }

        try:
            response = await self._call_mcp("sk_hotels_search", params)
        except SkiplaggedMCPError:
            raise
        except Exception as e:
            logger.exception("Unexpected error calling Skiplagged hotels")
            error_result = HotelSearchResult(
                hotels=[],
                city=city,
                checkin=checkin,
                checkout=checkout,
                provider="skiplagged",
                total_results=0,
                currency="USD",
                success=False,
                error=str(e),
            )
            return error_result, {}

        return self._parse_hotels_response(response, city=city, checkin=checkin, checkout=checkout)

    async def search_hotels_all(
        self,
        city: str,
        checkin: str,
        checkout: str,
        adults: int = 2,
        rooms: int = 1,
        sort: str = "value",
        limit: int = 75,
        max_pages: int = 4,
    ) -> HotelSearchResult:
        """Search for hotels across multiple pages.

        Args:
            city: City name.
            checkin: Check-in date (YYYY-MM-DD).
            checkout: Check-out date (YYYY-MM-DD).
            adults: Number of adult guests.
            rooms: Number of rooms.
            sort: Sort order.
            limit: Results per page.
            max_pages: Maximum number of pages to fetch.

        Returns:
            HotelSearchResult with all hotels combined.
        """
        all_hotels: list[HotelSearchHotel] = []
        offset = 0

        for page in range(max_pages):
            result, pagination = await self._search_hotels_page(
                city=city,
                checkin=checkin,
                checkout=checkout,
                adults=adults,
                rooms=rooms,
                sort=sort,
                limit=limit,
                offset=offset,
            )

            if not result.success:
                return HotelSearchResult(
                    hotels=all_hotels,
                    city=city,
                    checkin=checkin,
                    checkout=checkout,
                    provider="skiplagged",
                    total_results=len(all_hotels),
                    currency="USD",
                    success=len(all_hotels) > 0,
                    error=result.error,
                )

            all_hotels.extend(result.hotels)

            has_more = pagination.get("hasMoreResults", False)
            if not has_more or page >= max_pages - 1:
                break

            offset += limit

        return HotelSearchResult(
            hotels=all_hotels,
            city=city,
            checkin=checkin,
            checkout=checkout,
            provider="skiplagged",
            total_results=len(all_hotels),
            currency="USD",
            success=True,
            error=None,
        )

    async def get_hotel_details(
        self,
        hotel_id: int | str,
        checkin: str,
        checkout: str,
        adults: int = 2,
        rooms: int = 1,
    ) -> SkiplaggedHotelDetail:
        """Get detailed hotel information including room types.

        Args:
            hotel_id: Hotel ID (integer).
            checkin: Check-in date (YYYY-MM-DD).
            checkout: Check-out date (YYYY-MM-DD).
            adults: Number of adult guests.
            rooms: Number of rooms.

        Returns:
            SkiplaggedHotelDetail with full room data.
        """
        numeric_id = int(str(hotel_id).removeprefix("hotel_"))
        params: dict[str, Any] = {
            "hotelId": numeric_id,
            "checkin": checkin,
            "checkout": checkout,
            "numAdults": adults,
            "numRooms": rooms,
        }

        response = await self._call_mcp("sk_hotel_details", params)
        return SkiplaggedHotelDetail.model_validate(response)

    # -------------------------------------------------------------------------
    # Response normalization
    # -------------------------------------------------------------------------

    def _parse_flights_response(
        self,
        response: dict[str, Any],
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None,
    ) -> tuple[FlightSearchResult, dict[str, Any]]:
        """Parse Skiplagged flights response into (FlightSearchResult, pagination)."""
        flights_data = response.get("flights", [])
        pagination = response.get("pagination", {})

        flights: list[FlightSearchFlight] = []
        for flight_data in flights_data:
            try:
                parsed = self._normalize_flight(flight_data)
                if parsed:
                    flights.append(parsed)
            except Exception as e:
                logger.warning("Failed to parse Skiplagged flight: %s - %s", flight_data, e)

        result = FlightSearchResult(
            flights=flights,
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            return_date=return_date,
            is_round_trip=return_date is not None,
            provider="skiplagged",
            total_results=pagination.get("totalAvailable", len(flights)),
            currency="USD",
            success=True,
            error=None,
        )
        return result, pagination

    def _normalize_flight(self, data: dict[str, Any]) -> FlightSearchFlight | None:
        """Normalize a single Skiplagged flight dict to FlightSearchFlight."""
        price_data = data.get("price", {})
        price_amount_raw = price_data.get("amount")
        if price_amount_raw is None:
            return None

        try:
            price_amount = Decimal(str(price_amount_raw))
        except Exception:
            return None

        dep = data.get("departure", {})
        arr = data.get("arrival", {})
        dep_airport = dep.get("airport", "").upper()
        arr_airport = arr.get("airport", "").upper()
        departure_time = self._parse_iso_datetime(dep.get("dateTime"))
        arrival_time = self._parse_iso_datetime(arr.get("dateTime"))

        # Parse flight number from ID
        flight_id = data.get("id", "")
        outbound_segs, _ = parse_flight_segments(flight_id)
        carrier_code = outbound_segs[0].carrier_code if outbound_segs else None

        # Duration — Skiplagged gives human-readable string like "10h 40m"
        duration_minutes = self._parse_duration(data.get("duration", ""))

        layovers_count = data.get("layovers", 0)
        stops_text = "Direct" if layovers_count == 0 else f"{layovers_count} stop{'s' if layovers_count > 1 else ''}"

        currency = price_data.get("currency", "USD")

        return FlightSearchFlight(
            departure_airport=dep_airport,
            arrival_airport=arr_airport,
            departure_time=departure_time,
            arrival_time=arrival_time,
            airline_name=data.get("airlines"),
            carrier_code=carrier_code,
            duration_minutes=duration_minutes,
            stops=layovers_count,
            stops_text=stops_text,
            layovers=[],
            price_amount=price_amount,
            price_currency=currency,
            price_display=f"${price_amount} {currency}",
            booking_link=data.get("deepLink"),
            provider="skiplagged",
            raw_data=data,
        )

    def _parse_hotels_response(
        self,
        response: dict[str, Any],
        city: str,
        checkin: str,
        checkout: str,
    ) -> tuple[HotelSearchResult, dict[str, Any]]:
        """Parse Skiplagged hotels response into (HotelSearchResult, pagination)."""
        hotels_data = response.get("results", [])
        pagination = response.get("pagination", {})

        hotels: list[HotelSearchHotel] = []
        for hotel_data in hotels_data:
            try:
                parsed = self._normalize_hotel(hotel_data)
                if parsed:
                    hotels.append(parsed)
            except Exception as e:
                logger.warning("Failed to parse Skiplagged hotel: %s - %s", hotel_data, e)

        result = HotelSearchResult(
            hotels=hotels,
            city=city,
            checkin=checkin,
            checkout=checkout,
            provider="skiplagged",
            total_results=pagination.get("totalAvailable", len(hotels)),
            currency="USD",
            success=True,
            error=None,
        )
        return result, pagination

    def _normalize_hotel(self, data: dict[str, Any]) -> HotelSearchHotel | None:
        """Normalize a single Skiplagged hotel dict to HotelSearchHotel."""
        price_data = data.get("price", {})
        price_amount_raw = price_data.get("amount")
        if price_amount_raw is None:
            return None

        try:
            price_per_night = Decimal(str(price_amount_raw))
        except Exception:
            return None

        rating_data = data.get("rating", {})
        star_rating = rating_data.get("stars") if rating_data else None

        return HotelSearchHotel(
            id=str(data.get("id", "")),
            name=data.get("name", ""),
            image_url=data.get("imageUrl"),
            star_rating=star_rating,
            review_rating=None,
            review_count=None,
            price_per_night=price_per_night,
            price_total=None,
            price_currency=price_data.get("currency", "USD"),
            chain=data.get("chain"),
            address=data.get("location"),
            amenities=data.get("amenities", []),
            booking_link=data.get("deepLink"),
            rooms=[],
            provider="skiplagged",
            raw_data=data,
        )

    @staticmethod
    def _parse_iso_datetime(value: str | None) -> datetime | None:
        """Parse ISO 8601 datetime string (with timezone offset)."""
        if not value:
            return None

        import re

        # Strip timezone offset or Z for simple parsing
        # e.g., "2026-06-15T20:10:00-07:00" or "2026-06-16T15:50:00+02:00"
        cleaned = re.sub(r"[+-]\d{2}:\d{2}$", "", value).replace("Z", "")

        formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(cleaned, fmt)
            except ValueError:
                continue
        return None

    @staticmethod
    def _parse_duration(duration_str: str) -> int | None:
        """Parse duration string like '10h 40m' into total minutes."""
        if not duration_str:
            return None

        import re

        # Bound the digit quantifier to a fixed upper limit so the engine
        # cannot backtrack across an unbounded run of digits — flight
        # durations comfortably fit in 3 digits each (max 999h / 999m).
        # Sonar S5852: avoid super-linear regex on potentially adversarial input.
        hours = 0
        minutes = 0
        h_match = re.search(r"(\d{1,3})h", duration_str)
        m_match = re.search(r"(\d{1,3})m", duration_str)
        if h_match:
            hours = int(h_match.group(1))
        if m_match:
            minutes = int(m_match.group(1))

        total = hours * 60 + minutes
        return total if total > 0 else None

    @staticmethod
    def _normalize_room(room_data: dict[str, Any]) -> HotelRoom:
        """Normalize a Skiplagged room dict to HotelRoom."""
        return HotelRoom(
            title=room_data.get("title", ""),
            occupancy_limit=room_data.get("occupancyLimit", 2),
            price_per_night=Decimal(str(room_data.get("pricePerNightInDollars", 0))),
            price_total=Decimal(str(room_data.get("totalPriceInDollars", 0))),
            taxes_and_fees=Decimal(str(room_data.get("taxesAndFeesInDollars", 0))),
            currency=room_data.get("currency", "USD"),
            refundable=room_data.get("refundable", False),
            free_cancellation=room_data.get("freeCancellation", False),
            bed_types=room_data.get("bedTypes", []),
            booking_link=room_data.get("bookingLink"),
        )


# Singleton instance for shared use
skiplagged_client = SkiplaggedClient()
