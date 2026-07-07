"""Kiwi.com MCP client for flight search.

This client calls the hosted MCP server at mcp.kiwi.com. No authentication
required. Unlike the Skiplagged MCP, the Kiwi server is **stateless**: there is
no ``initialize`` handshake and no ``mcp-session-id`` header — every
``tools/call`` request stands alone.

The server exposes a single search tool, ``search-flight``, which returns
round-trip itineraries with **structured per-segment data** (carrier code,
flight number, departure/arrival airports and times, durations, stops, cabin
class). It supports no server-side pagination, sorting, or stop filtering, so
those are applied client-side to keep the public interface compatible with
``SkiplaggedClient``.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from app.core.airlines import airline_display_name
from app.core.config import settings
from app.core.errors import GlobalBudgetExceeded
from app.core.quota import incr_and_check_global_budget
from app.core.telemetry import langfuse_context, observe
from app.schemas.flight_search import FlightSearchFlight, FlightSearchResult

logger = logging.getLogger(__name__)

DEFAULT_MCP_URL = "https://mcp.kiwi.com/"
DEFAULT_TIMEOUT_SECONDS = 60.0

# Same transient-retry tuning as the Skiplagged client: brief throttles
# self-heal in-process; sustained blocks are left to the caller (Temporal
# retry policy / chat-tool error) to reschedule.
RETRYABLE_HTTP_STATUS = frozenset({429, 502, 503, 504})
MAX_TRANSIENT_RETRIES = 2
BASE_BACKOFF_SECONDS = 0.5
MAX_BACKOFF_SECONDS = 4.0

# Kiwi's stateless search sometimes returns an empty itinerary list on a cold
# route/date query and results on an immediate re-query (observed in prod
# 2026-07-06: first tracking fetch 0 itineraries, identical query 10s later
# returned 5). Tracking searches re-query a couple of times before accepting
# an empty result as truth.
EMPTY_RESULT_RETRIES = 2
EMPTY_RESULT_BACKOFF_SECONDS = 2.0

# Each stateless call also samples only ~15 itinerary pairings, and the sample
# varies between calls — a single call can miss whole carriers (observed in
# prod 2026-07-07: a refresh lost the route's only Alaska nonstop pairing,
# leaving just identically-priced United combos in the snapshot). Tracking
# searches therefore union the results of this many queries.
COVERAGE_QUERIES = 2

# Our CabinClass enum values -> Kiwi's single-letter cabin codes.
CABIN_CLASS_TO_KIWI = {
    "economy": "M",
    "premium_economy": "W",
    "business": "C",
    "first": "F",
}


class KiwiMCPError(Exception):
    """Base error for Kiwi MCP client failures."""


class KiwiConnectionError(KiwiMCPError):
    """Raised when connection to the Kiwi MCP server fails."""


class KiwiRequestError(KiwiMCPError):
    """Raised when an MCP request fails."""


class KiwiTransientError(KiwiRequestError):
    """Raised for transient upstream failures (429/5xx) worth retrying."""


class KiwiRateLimitError(KiwiTransientError):
    """Raised when Kiwi returns HTTP 429 (``retry_after`` in seconds when advertised)."""

    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


def _is_rate_limit_message(message: str | None) -> bool:
    """Detect a rate-limit signal embedded in an MCP error/tool message."""
    if not message:
        return False
    lowered = message.lower()
    return "429" in lowered or "too many requests" in lowered or "rate limit" in lowered


def _to_kiwi_date(iso_date: str) -> str:
    """Convert YYYY-MM-DD to Kiwi's dd/mm/yyyy format."""
    parsed = datetime.strptime(iso_date, "%Y-%m-%d")
    return parsed.strftime("%d/%m/%Y")


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


class KiwiClient:
    """Client for the Kiwi.com hosted MCP server (flights only)."""

    def __init__(
        self,
        mcp_url: str | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._mcp_url = (mcp_url or settings.kiwi_mcp_url or DEFAULT_MCP_URL).rstrip("/") + "/"
        self._timeout = httpx.Timeout(timeout_seconds)
        self._request_id: int = 0

    def _next_request_id(self) -> int:
        self._request_id += 1
        return self._request_id

    @staticmethod
    async def _enforce_global_budget() -> None:
        """Meter this MCP call against the global daily provider-call budget.

        Kiwi calls count under their own ``kiwi_calls`` metric but share the
        ceiling with Skiplagged (`GLOBAL_DAILY_SKIPLAGGED_CALL_BUDGET`) — the
        knob bounds external provider spend, whichever provider is active.
        """
        within, _ = await incr_and_check_global_budget(
            "kiwi_calls", 1, settings.global_daily_skiplagged_call_budget
        )
        if not within:
            raise GlobalBudgetExceeded(
                "The flight search service has reached its daily ceiling. "
                "Please try again tomorrow."
            )

    @observe(name="kiwi.mcp_call")
    async def _call_mcp(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
        """Call the Kiwi MCP server (stateless JSON-RPC ``tools/call``)."""
        langfuse_context.update_current_observation(
            name=f"kiwi.mcp.{tool_name}",
            input={"tool": tool_name, "arguments": params},
            metadata={"provider": "kiwi", "mcp_url": self._mcp_url, "tool_name": tool_name},
        )
        await self._enforce_global_budget()

        payload = {
            "jsonrpc": "2.0",
            "id": self._next_request_id(),
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": params},
        }

        for attempt in range(MAX_TRANSIENT_RETRIES + 1):
            try:
                response = await self._send_request(payload)
                data = self._parse_sse_json_rpc(response)
                self._raise_for_tool_error(data)
                result = self._extract_result(data)
            except KiwiTransientError as exc:
                delay = self._backoff_delay(exc, attempt)
                if delay is None or attempt >= MAX_TRANSIENT_RETRIES:
                    raise
                logger.warning(
                    "Kiwi MCP transient error on %s (%s); backing off %.1fs (attempt %d/%d)",
                    tool_name,
                    exc,
                    delay,
                    attempt + 1,
                    MAX_TRANSIENT_RETRIES,
                    extra={
                        "event": "kiwi.request.retry",
                        "tool_name": tool_name,
                        "delay_ms": int(delay * 1000),
                        "attempt": attempt + 1,
                    },
                )
                await asyncio.sleep(delay)
                continue
            langfuse_context.update_current_observation(output=result)
            return result

        raise KiwiRequestError(f"MCP request for {tool_name} failed after retries")

    async def _send_request(self, payload: dict[str, Any]) -> httpx.Response:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(self._mcp_url, json=payload, headers=headers)
        except httpx.ConnectError as e:
            logger.warning(
                "Failed to connect to Kiwi MCP: %s",
                e,
                extra={"event": "kiwi.connect.failed", "error": str(e)},
                exc_info=e,
            )
            raise KiwiConnectionError(f"Failed to connect to MCP server: {e}") from e
        except httpx.TimeoutException as e:
            logger.warning(
                "Timeout connecting to Kiwi MCP: %s",
                e,
                extra={"event": "kiwi.timeout", "error": str(e)},
                exc_info=e,
            )
            raise KiwiConnectionError(f"Timeout connecting to MCP server: {e}") from e
        except httpx.HTTPError as e:
            logger.warning(
                "HTTP error calling Kiwi MCP: %s",
                e,
                extra={"event": "kiwi.http_error", "error": str(e)},
                exc_info=e,
            )
            raise KiwiConnectionError(f"HTTP error: {e}") from e

        if response.status_code >= 400:
            logger.warning(
                "Kiwi MCP request failed: status=%s body=%s",
                response.status_code,
                response.text[:500],
                extra={"event": "kiwi.request.failed", "status": response.status_code},
            )
            if response.status_code == 429:
                raise KiwiRateLimitError(
                    "MCP request failed with status 429",
                    retry_after=self._parse_retry_after(response),
                )
            if response.status_code in RETRYABLE_HTTP_STATUS:
                raise KiwiTransientError(
                    f"MCP request failed with status {response.status_code}"
                )
            raise KiwiRequestError(f"MCP request failed with status {response.status_code}")

        return response

    def _parse_sse_json_rpc(self, response: httpx.Response) -> dict[str, Any]:
        """Parse JSON-RPC data from an SSE or JSON response."""
        content_type = response.headers.get("content-type", "")

        if "text/event-stream" in content_type:
            data = self._extract_json_from_sse(response.text)
        else:
            try:
                data = response.json()
            except ValueError as e:
                logger.error(
                    "Invalid JSON response from Kiwi MCP: %s",
                    response.text[:500],
                    extra={"event": "kiwi.response.invalid_json"},
                    exc_info=e,
                )
                raise KiwiRequestError("Invalid JSON response from MCP server") from e

        if "error" in data:
            error_msg = data["error"].get("message", "Unknown error")
            logger.warning(
                "Kiwi MCP returned error: %s",
                error_msg,
                extra={"event": "kiwi.response.error", "error": str(error_msg)},
            )
            if _is_rate_limit_message(error_msg):
                raise KiwiRateLimitError(f"MCP error: {error_msg}")
            raise KiwiRequestError(f"MCP error: {error_msg}")

        return data

    @staticmethod
    def _extract_json_from_sse(text: str) -> dict[str, Any]:
        import json

        last_data: dict[str, Any] | None = None
        for line in text.splitlines():
            if line.startswith("data: "):
                try:
                    last_data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue

        if last_data is None:
            logger.error(
                "No valid JSON data in SSE response: %s",
                text[:500],
                extra={"event": "kiwi.response.no_sse_data"},
            )
            raise KiwiRequestError("No valid data in SSE response from MCP server")

        return last_data

    @staticmethod
    def _extract_result(data: dict[str, Any]) -> dict[str, Any]:
        """Extract result from JSON-RPC response, preferring structuredContent."""
        result = data.get("result", {})

        if not isinstance(result, dict):
            return result  # type: ignore[return-value]

        structured = result.get("structuredContent")
        if structured and isinstance(structured, dict):
            return structured

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
        """Raise if a tools/call result is flagged as an error (isError=true)."""
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

        logger.warning(
            "Kiwi MCP tool error: %s",
            message,
            extra={"event": "kiwi.tool.error", "error": str(message)},
        )
        if _is_rate_limit_message(message):
            raise KiwiRateLimitError(f"MCP tool error: {message}")
        raise KiwiRequestError(f"MCP tool error: {message}")

    @staticmethod
    def _parse_retry_after(response: httpx.Response) -> float | None:
        raw = response.headers.get("retry-after")
        if not raw:
            return None
        try:
            return float(raw)
        except ValueError:
            return None

    @staticmethod
    def _backoff_delay(exc: KiwiTransientError, attempt: int) -> float | None:
        retry_after = getattr(exc, "retry_after", None)
        if retry_after is not None:
            if retry_after > MAX_BACKOFF_SECONDS:
                return None
            return retry_after
        return min(BASE_BACKOFF_SECONDS * (2**attempt), MAX_BACKOFF_SECONDS)

    # -------------------------------------------------------------------------
    # Public search methods (interface-compatible with SkiplaggedClient)
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
        cabin: str | None = None,
    ) -> FlightSearchResult:
        """Search for flights via the Kiwi MCP.

        Args:
            origin: Origin airport IATA code.
            destination: Destination airport IATA code.
            departure_date: Departure date (YYYY-MM-DD).
            return_date: Return date for round trips (YYYY-MM-DD).
            adults: Number of adult passengers.
            max_stops: Stop filter ("none", "one", "many") — applied client-side.
            sort: "price", "duration", or "value" — applied client-side
                ("value" keeps Kiwi's own quality ordering).
            limit: Max results (client-side slice; Kiwi returns ~15).
            offset: Pagination offset (client-side slice).
            cabin: CabinClass value ("economy", "premium_economy", "business",
                "first"); mapped to Kiwi's M/W/C/F codes.

        Returns:
            FlightSearchResult with normalized flight data (provider="kiwi").
        """
        params: dict[str, Any] = {
            "flyFrom": origin.upper(),
            "flyTo": destination.upper(),
            "departureDate": _to_kiwi_date(departure_date),
            "adults": adults,
            "currency": "USD",
            "locale": "en",
        }
        if return_date:
            params["returnDate"] = _to_kiwi_date(return_date)
        kiwi_cabin = CABIN_CLASS_TO_KIWI.get(cabin or "")
        if kiwi_cabin:
            params["cabinClass"] = kiwi_cabin

        try:
            response = await self._call_mcp("search-flight", params)
        except KiwiMCPError:
            raise
        except GlobalBudgetExceeded:
            raise
        except Exception as e:
            logger.exception(
                "Unexpected error calling Kiwi flights",
                extra={"event": "kiwi.flights.unexpected_error", "error": str(e)},
            )
            return FlightSearchResult(
                flights=[],
                origin=origin.upper(),
                destination=destination.upper(),
                departure_date=departure_date,
                return_date=return_date,
                is_round_trip=return_date is not None,
                provider="kiwi",
                total_results=0,
                currency="USD",
                success=False,
                error=str(e),
            )

        currency = str(response.get("currency") or "USD")
        flights = self._parse_flights_response(response, currency)
        flights = _apply_max_stops(flights, max_stops)
        flights = _apply_sort(flights, sort)
        total_results = len(flights)  # full post-filter count, before the page slice
        flights = flights[offset : offset + limit]

        return FlightSearchResult(
            flights=flights,
            origin=origin.upper(),
            destination=destination.upper(),
            departure_date=departure_date,
            return_date=return_date,
            is_round_trip=return_date is not None,
            provider="kiwi",
            total_results=total_results,
            currency=currency,
            success=True,
            error=None,
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
        limit: int = 100,
        max_pages: int = 4,  # noqa: ARG002 - interface compatibility; Kiwi has no pagination
        cabin: str | None = None,
    ) -> FlightSearchResult:
        """Search for flights (full set for tracking).

        The Kiwi MCP has no server-side pagination, and each stateless call
        samples only ~15 itinerary pairings — a sample that varies between
        calls and can miss whole carriers. Tracking searches therefore run
        ``COVERAGE_QUERIES`` queries and union the results, deduplicating by
        segment fingerprint and keeping the cheapest price per pairing.

        An empty union is re-queried up to ``EMPTY_RESULT_RETRIES`` extra
        times: cold searches can legitimately come back empty and fill in
        seconds later, and a tracking run that accepts the empty answer
        records a misleading no-offer snapshot.
        """
        merged: dict[str, FlightSearchFlight] = {}
        result: FlightSearchResult | None = None
        max_attempts = max(COVERAGE_QUERIES, 1 + EMPTY_RESULT_RETRIES)
        for attempt in range(max_attempts):
            # Back off only before genuine empty-retries (cold searches fill in
            # seconds). A coverage re-sample of an already-populated result
            # runs immediately — no dead time on the happy path.
            if attempt and not merged:
                await asyncio.sleep(EMPTY_RESULT_BACKOFF_SECONDS * attempt)
            try:
                result = await self.search_flights(
                    origin=origin,
                    destination=destination,
                    departure_date=departure_date,
                    return_date=return_date,
                    adults=adults,
                    max_stops=max_stops,
                    sort=sort,
                    limit=limit,
                    offset=0,
                    cabin=cabin,
                )
            except KiwiMCPError:
                # A coverage/retry query failing must not discard pairings an
                # earlier query already returned — return the partial union.
                # (GlobalBudgetExceeded intentionally propagates even then:
                # a tripped breaker is a hard stop, not a partial result.)
                if not merged:
                    raise
                logger.warning(
                    "Kiwi coverage query %d failed for %s-%s %s; keeping %d pairings from earlier queries",
                    attempt + 1,
                    origin,
                    destination,
                    departure_date,
                    len(merged),
                    extra={"event": "kiwi.flights.coverage_query_failed", "attempt": attempt + 1},
                )
                break
            if not result.success:
                if merged:
                    break
                return result
            added = self._merge_flights(merged, result.flights)
            self._log_coverage_progress(
                attempt, max_attempts, added, bool(merged), origin, destination, departure_date
            )
            if attempt + 1 >= COVERAGE_QUERIES and merged:
                break

        if result is None:  # pragma: no cover - the loop always runs at least one query
            raise KiwiRequestError("Flight search yielded no result")
        flights = _apply_sort(list(merged.values()), sort)[:limit]
        return FlightSearchResult(
            flights=flights,
            origin=result.origin,
            destination=result.destination,
            departure_date=result.departure_date,
            return_date=result.return_date,
            is_round_trip=result.is_round_trip,
            provider="kiwi",
            total_results=len(merged),
            currency=result.currency,
            success=True,
            error=None,
        )

    @staticmethod
    def _log_coverage_progress(
        attempt: int,
        max_attempts: int,
        added: int,
        has_results: bool,
        origin: str,
        destination: str,
        departure_date: str,
    ) -> None:
        """Log what a coverage/retry query contributed to the running union."""
        if attempt and added:
            logger.info(
                "Kiwi coverage query %d added %d pairing(s) for %s-%s %s",
                attempt + 1,
                added,
                origin,
                destination,
                departure_date,
                extra={"event": "kiwi.flights.coverage_merge", "attempt": attempt + 1, "added": added},
            )
        if attempt + 1 < max_attempts and not has_results:
            logger.warning(
                "Kiwi returned no itineraries for %s-%s %s; retrying (%d/%d)",
                origin,
                destination,
                departure_date,
                attempt + 1,
                max_attempts - 1,
                extra={
                    "event": "kiwi.flights.empty_retry",
                    "attempt": attempt + 1,
                },
            )

    @staticmethod
    def _merge_flights(
        merged: dict[str, FlightSearchFlight], flights: list[FlightSearchFlight]
    ) -> int:
        """Union ``flights`` into ``merged`` by fingerprint, keeping the cheapest
        price per pairing. Returns how many new pairings were added."""
        added = 0
        for flight in flights:
            key = _flight_fingerprint(flight)
            existing = merged.get(key)
            if existing is None:
                added += 1
                merged[key] = flight
            elif flight.price_amount < existing.price_amount:
                merged[key] = flight
        return added

    # -------------------------------------------------------------------------
    # Response normalization
    # -------------------------------------------------------------------------

    def _parse_flights_response(
        self, response: dict[str, Any], currency: str
    ) -> list[FlightSearchFlight]:
        itineraries = response.get("itineraries")
        if not isinstance(itineraries, list):
            return []
        flights: list[FlightSearchFlight] = []
        for itinerary in itineraries:
            if not isinstance(itinerary, dict):
                continue
            flight = self._normalize_itinerary(itinerary, currency)
            if flight is not None:
                flights.append(flight)
        return flights

    @staticmethod
    def _normalize_itinerary(
        itinerary: dict[str, Any], currency: str
    ) -> FlightSearchFlight | None:
        """Normalize one Kiwi itinerary to a FlightSearchFlight.

        Top-level fields describe the **outbound** leg (matching how the
        Skiplagged normalizer treats round trips); the full structured
        itinerary — including inbound segments — rides along in ``raw_data``
        for downstream itinerary building and airline filtering.
        """
        try:
            price_amount = Decimal(str(itinerary.get("price")))
        except (InvalidOperation, TypeError, ValueError):
            return None
        if price_amount <= 0:
            return None

        outbound = itinerary.get("outbound")
        if not isinstance(outbound, dict):
            return None
        segments = outbound.get("segments")
        first_segment = segments[0] if isinstance(segments, list) and segments else {}
        carrier_code = first_segment.get("carrier")

        duration_seconds = outbound.get("durationSeconds")
        duration_minutes = (
            int(duration_seconds) // 60 if isinstance(duration_seconds, (int, float)) else None
        )
        stops = outbound.get("stops", 0)
        stops = stops if isinstance(stops, int) else 0
        stops_text = "Direct" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

        raw_data = dict(itinerary)
        raw_data["provider"] = "kiwi"

        return FlightSearchFlight(
            departure_airport=str(outbound.get("from") or "").upper(),
            arrival_airport=str(outbound.get("to") or "").upper(),
            departure_time=_parse_iso_datetime(outbound.get("departureTime")),
            arrival_time=_parse_iso_datetime(outbound.get("arrivalTime")),
            airline_name=airline_display_name(carrier_code),
            carrier_code=carrier_code,
            duration_minutes=duration_minutes,
            stops=stops,
            stops_text=stops_text,
            layovers=[],
            price_amount=price_amount,
            price_currency=currency,
            price_display=itinerary.get("priceFormatted"),
            booking_link=itinerary.get("bookingUrl"),
            provider="kiwi",
            raw_data=raw_data,
        )


def _flight_fingerprint(flight: FlightSearchFlight) -> str:
    """Identity of an itinerary pairing, stable across separate Kiwi queries.

    Kiwi's ``id`` strings carry a per-query prefix, so the same pairing gets a
    different id on every search — fingerprint the actual segments (carrier,
    flight number, departure time) across both legs instead.
    """
    raw = flight.raw_data or {}
    parts: list[str] = []
    for leg_key in ("outbound", "inbound"):
        leg = raw.get(leg_key)
        if not isinstance(leg, dict):
            continue
        for seg in leg.get("segments") or []:
            if isinstance(seg, dict):
                parts.append(
                    f"{leg_key}:{seg.get('carrier')}-{seg.get('flightNumber')}@{seg.get('departureTime')}"
                )
    if parts:
        return "|".join(parts)
    # No structured segments — fall back to endpoint-level identity.
    dep = flight.departure_time.isoformat() if flight.departure_time else ""
    return f"{flight.carrier_code}|{flight.departure_airport}-{flight.arrival_airport}@{dep}"


def _apply_max_stops(
    flights: list[FlightSearchFlight], max_stops: str | None
) -> list[FlightSearchFlight]:
    """Client-side stop filter over both legs (Kiwi has no server-side filter)."""
    if max_stops not in ("none", "one"):
        return flights
    ceiling = 0 if max_stops == "none" else 1

    def _within(flight: FlightSearchFlight) -> bool:
        legs = []
        raw = flight.raw_data or {}
        for key in ("outbound", "inbound"):
            leg = raw.get(key)
            if isinstance(leg, dict):
                legs.append(leg.get("stops", 0))
        if not legs:
            legs = [flight.stops]
        return all(isinstance(s, int) and s <= ceiling for s in legs)

    return [f for f in flights if _within(f)]


def _apply_sort(flights: list[FlightSearchFlight], sort: str) -> list[FlightSearchFlight]:
    """Client-side sort; "value" preserves Kiwi's own quality ordering."""
    if sort == "price":
        return sorted(flights, key=lambda f: f.price_amount)
    if sort == "duration":
        return sorted(
            flights,
            key=lambda f: f.duration_minutes if f.duration_minutes is not None else 1 << 30,
        )
    return flights


# Singleton instance for shared use
kiwi_client = KiwiClient()
