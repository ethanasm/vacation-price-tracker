"""fast-flights client (Google Flights scraper) for flight search.

Third flight-provider option next to the Skiplagged and Kiwi MCPs, built on
the ``fast-flights`` library (https://github.com/AWeirdDev/flights), which
queries Google Flights with a protobuf-encoded ``tfs`` parameter and parses
the embedded JS payload.

Provider characteristics, normalized here at the source (never in clients):

- One page of results per query (~10-20 itineraries); no server-side
  pagination — ``search_flights_all`` is a single query.
- Round-trip searches list **outbound** leg options only; the price on each
  is the full round-trip total (matching how the Skiplagged/Kiwi normalizers
  treat round trips). There is no inbound-leg data.
- Segments carry airports, times, and durations but **no flight numbers**;
  airline identity is itinerary-level. ``FlightSegment.flight_number`` is
  therefore absent on this provider's offers.
- The library is synchronous (``primp``) — calls run in a worker thread.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fast_flights import FlightQuery, FlightsNotFound, Passengers, create_query, get_flights

from app.core.airlines import airline_display_name
from app.core.config import settings
from app.core.errors import GlobalBudgetExceeded
from app.core.quota import incr_and_check_global_budget
from app.core.telemetry import langfuse_context, observe
from app.schemas.flight_search import FlightLayover, FlightSearchFlight, FlightSearchResult

logger = logging.getLogger(__name__)

PROVIDER_NAME = "fast_flights"

# Google intermittently serves a consent/challenge page instead of results
# (scraper reality); a couple of quick retries usually recover it.
MAX_TRANSIENT_RETRIES = 2
BASE_BACKOFF_SECONDS = 1.0
MAX_BACKOFF_SECONDS = 4.0

# Our CabinClass enum values -> fast-flights seat types.
CABIN_CLASS_TO_SEAT = {
    "economy": "economy",
    "premium_economy": "premium-economy",
    "business": "business",
    "first": "first",
}

# Our max_stops filter values -> Google's per-query stop ceiling.
MAX_STOPS_TO_INT = {"none": 0, "one": 1}


class FastFlightsError(Exception):
    """Base error for fast-flights client failures."""


class FastFlightsRequestError(FastFlightsError):
    """Raised when a Google Flights query fails."""


class FastFlightsTransientError(FastFlightsRequestError):
    """Raised for failures worth retrying (blocked/parse-failed page)."""


def _to_datetime(simple: Any) -> datetime | None:
    """Convert a fast-flights SimpleDatetime (date/time tuples) to datetime."""
    try:
        year, month, day = simple.date
        hour, minute = simple.time
        return datetime(int(year), int(month), int(day), int(hour), int(minute))
    except (AttributeError, TypeError, ValueError):
        return None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


class FastFlightsClient:
    """Client for Google Flights via the fast-flights scraper (flights only)."""

    def __init__(self, proxy: str | None = None) -> None:
        self._proxy = proxy if proxy is not None else (settings.fast_flights_proxy or None)

    @staticmethod
    async def _enforce_global_budget() -> None:
        """Meter this query against the global daily provider-call budget.

        fast-flights calls count under their own ``fast_flights_calls`` metric
        but share the ceiling with Skiplagged/Kiwi
        (`GLOBAL_DAILY_SKIPLAGGED_CALL_BUDGET`) — the knob bounds external
        provider spend, whichever provider is active.
        """
        within, _ = await incr_and_check_global_budget(
            "fast_flights_calls", 1, settings.global_daily_skiplagged_call_budget
        )
        if not within:
            raise GlobalBudgetExceeded(
                "The flight search service has reached its daily ceiling. "
                "Please try again tomorrow."
            )

    def _build_query(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None,
        adults: int,
        max_stops: str | None,
        cabin: str | None,
    ) -> Any:
        stops_ceiling = MAX_STOPS_TO_INT.get(max_stops or "")
        flights = [
            FlightQuery(
                date=departure_date,
                from_airport=origin.upper(),
                to_airport=destination.upper(),
                max_stops=stops_ceiling,
            )
        ]
        if return_date:
            flights.append(
                FlightQuery(
                    date=return_date,
                    from_airport=destination.upper(),
                    to_airport=origin.upper(),
                    max_stops=stops_ceiling,
                )
            )
        return create_query(
            flights=flights,
            trip="round-trip" if return_date else "one-way",
            seat=CABIN_CLASS_TO_SEAT.get(cabin or "", "economy"),
            passengers=Passengers(adults=max(1, adults)),
            language="en-US",
            currency="USD",
        )

    @observe(name="fast_flights.query")
    async def _fetch(
        self, query: Any, route_label: str, is_round_trip: bool
    ) -> list[FlightSearchFlight]:
        """Run one Google Flights query, normalizing results.

        Returns the normalized flights; an empty list when Google reports no
        flights for the route/dates. Transient scrape failures (blocked or
        unparseable page) are retried a couple of times, then raised.
        """
        langfuse_context.update_current_observation(
            name="fast_flights.get_flights",
            input={"route": route_label},
            metadata={"provider": PROVIDER_NAME},
        )
        await self._enforce_global_budget()

        last_error: Exception | None = None
        for attempt in range(MAX_TRANSIENT_RETRIES + 1):
            if attempt:
                delay = min(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)), MAX_BACKOFF_SECONDS)
                logger.warning(
                    "fast-flights transient failure for %s (%s); backing off %.1fs (attempt %d/%d)",
                    route_label,
                    last_error,
                    delay,
                    attempt,
                    MAX_TRANSIENT_RETRIES,
                    extra={
                        "event": "fast_flights.request.retry",
                        "delay_ms": int(delay * 1000),
                        "attempt": attempt,
                    },
                )
                await asyncio.sleep(delay)
            try:
                result = await asyncio.to_thread(get_flights, query, proxy=self._proxy)
            except FlightsNotFound:
                # Google's explicit "no flights" answer — a legitimate empty
                # result, not a failure.
                langfuse_context.update_current_observation(output={"count": 0})
                return []
            except Exception as exc:  # noqa: BLE001 - scraper failures come in many shapes
                # Anything else (connection error, consent page breaking the
                # parser, payload drift) is treated as transient: Google
                # blocks are intermittent and usually recover on retry.
                last_error = exc
                continue
            flights = self._normalize_results(result, is_round_trip)
            langfuse_context.update_current_observation(output={"count": len(flights)})
            return flights

        logger.warning(
            "fast-flights query failed after retries for %s",
            route_label,
            exc_info=last_error,
            extra={"event": "fast_flights.request.failed"},
        )
        raise FastFlightsTransientError(
            f"Google Flights query failed after retries: {last_error}"
        ) from last_error

    # -------------------------------------------------------------------------
    # Public search methods (interface-compatible with the other clients)
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
        """Search for flights via Google Flights (fast-flights scraper).

        Args:
            origin: Origin airport IATA code.
            destination: Destination airport IATA code.
            departure_date: Departure date (YYYY-MM-DD).
            return_date: Return date for round trips (YYYY-MM-DD).
            adults: Number of adult passengers.
            max_stops: Stop filter ("none", "one", "many") — sent to Google as
                a per-query stop ceiling.
            sort: "price", "duration", or "value" — applied client-side
                ("value" keeps Google's own best-first ordering).
            limit: Max results (client-side slice; Google returns one page).
            offset: Pagination offset (client-side slice).
            cabin: CabinClass value ("economy", "premium_economy", "business",
                "first"); mapped to Google seat types.

        Returns:
            FlightSearchResult with normalized flight data (provider="fast_flights").
        """
        route_label = f"{origin.upper()}-{destination.upper()} {departure_date}"
        try:
            # Query construction is inside the guard: bad inputs (e.g. a
            # passenger count the protobuf layer rejects) must degrade to a
            # failed result, not an unhandled exception.
            query = self._build_query(
                origin, destination, departure_date, return_date, adults, max_stops, cabin
            )
            flights = await self._fetch(query, route_label, return_date is not None)
        except (FastFlightsError, GlobalBudgetExceeded):
            raise
        except Exception as e:
            logger.exception(
                "Unexpected error calling fast-flights",
                extra={"event": "fast_flights.unexpected_error", "error": str(e)},
            )
            return FlightSearchResult(
                flights=[],
                origin=origin.upper(),
                destination=destination.upper(),
                departure_date=departure_date,
                return_date=return_date,
                is_round_trip=return_date is not None,
                provider=PROVIDER_NAME,
                total_results=0,
                currency="USD",
                success=False,
                error=str(e),
            )

        flights = _apply_sort(flights, sort)
        total_results = len(flights)
        flights = flights[offset : offset + limit]

        return FlightSearchResult(
            flights=flights,
            origin=origin.upper(),
            destination=destination.upper(),
            departure_date=departure_date,
            return_date=return_date,
            is_round_trip=return_date is not None,
            provider=PROVIDER_NAME,
            total_results=total_results,
            currency="USD",
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
        max_pages: int = 4,  # noqa: ARG002 - interface compatibility; single page only
        cabin: str | None = None,
    ) -> FlightSearchResult:
        """Search for flights (full set for tracking).

        Google Flights returns its ranked page of itineraries in one response
        and offers no pagination, so the tracking search is a single query.
        """
        return await self.search_flights(
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

    # -------------------------------------------------------------------------
    # Response normalization
    # -------------------------------------------------------------------------

    def _normalize_results(
        self, result: Any, is_round_trip: bool
    ) -> list[FlightSearchFlight]:
        code_to_name, name_to_code = _airline_maps(result)
        flights: list[FlightSearchFlight] = []
        for item in result:
            flight = self._normalize_flight(item, code_to_name, name_to_code, is_round_trip)
            if flight is not None:
                flights.append(flight)
        return flights

    @staticmethod
    def _normalize_flight(
        item: Any,
        code_to_name: dict[str, str],
        name_to_code: dict[str, str],
        is_round_trip: bool,
    ) -> FlightSearchFlight | None:
        """Normalize one fast-flights ``Flights`` itinerary.

        For round trips the itinerary describes the **outbound** leg and the
        price is the round-trip total (matching the other providers'
        normalizers); Google's query protobuf has no selected-flight token, so
        the paired return legs cannot be fetched — ``round_trip_total`` marks
        the offer so clients can say the return is included but not itemized.
        Structured segments ride along in ``raw_data`` for downstream
        itinerary building and airline filtering.
        """
        try:
            price_amount = Decimal(str(item.price))
        except (InvalidOperation, TypeError, ValueError, AttributeError):
            return None
        if price_amount <= 0:
            return None

        segments = list(getattr(item, "flights", None) or [])
        if not segments:
            return None

        carrier_codes, airline_names = _collect_airlines(item, code_to_name, name_to_code)

        first = segments[0]
        last = segments[-1]
        departure_time = _to_datetime(first.departure)
        arrival_time = _to_datetime(last.arrival)

        stops = max(0, len(segments) - 1)
        stops_text = "Direct" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

        # A single-airline itinerary lets each segment carry the carrier; a
        # mixed-airline one can't be attributed per-segment (fast-flights only
        # exposes airline identity at itinerary level).
        segment_carrier = carrier_codes[0] if len(carrier_codes) == 1 else None
        raw_segments, layovers = _build_segments(segments, segment_carrier)

        # Total duration = per-segment flight minutes (Google's own values)
        # plus layover minutes (same-airport local-time diffs, so timezone
        # neutral). The naive endpoint arrival-departure diff is only a
        # fallback: departure/arrival are LOCAL times, so across timezones the
        # diff is off by the origin<->destination UTC offset.
        duration_minutes = _total_duration_minutes(raw_segments, layovers)
        if (
            duration_minutes is None
            and departure_time
            and arrival_time
            and arrival_time > departure_time
        ):
            duration_minutes = int((arrival_time - departure_time).total_seconds()) // 60

        raw_data: dict[str, Any] = {
            "provider": PROVIDER_NAME,
            "type": getattr(item, "type", None),
            "price": item.price,
            "carrier_codes": carrier_codes,
            "airline_names": airline_names,
            "segments": raw_segments,
            "stops": stops,
            "duration_minutes": duration_minutes,
            # Round-trip searches list outbound options priced at the
            # round-trip total; the return leg is not itemized (see docstring).
            "round_trip_total": is_round_trip,
        }

        return FlightSearchFlight(
            departure_airport=str(getattr(first.from_airport, "code", None) or "").upper(),
            arrival_airport=str(getattr(last.to_airport, "code", None) or "").upper(),
            departure_time=departure_time,
            arrival_time=arrival_time,
            airline_name=", ".join(airline_names) if airline_names else None,
            carrier_code=carrier_codes[0] if carrier_codes else None,
            duration_minutes=duration_minutes,
            stops=stops,
            stops_text=stops_text,
            layovers=layovers,
            price_amount=price_amount,
            price_currency="USD",
            price_display=f"${item.price}",
            booking_link=None,
            provider=PROVIDER_NAME,
            raw_data=raw_data,
        )


def _collect_airlines(
    item: Any,
    code_to_name: dict[str, str],
    name_to_code: dict[str, str],
) -> tuple[list[str], list[str]]:
    """Resolve an itinerary's ``airlines`` entries to (carrier codes, display names)."""
    carrier_codes: list[str] = []
    airline_names: list[str] = []
    for entry in getattr(item, "airlines", None) or []:
        code, name = _resolve_airline(str(entry), code_to_name, name_to_code)
        if code and code not in carrier_codes:
            carrier_codes.append(code)
        if name and name not in airline_names:
            airline_names.append(name)
    return carrier_codes, airline_names


def _build_segments(
    segments: list[Any], segment_carrier: str | None
) -> tuple[list[dict[str, Any]], list[FlightLayover]]:
    """Build the raw segment payloads and derived layovers for one itinerary."""
    raw_segments: list[dict[str, Any]] = []
    layovers: list[FlightLayover] = []
    for i, seg in enumerate(segments):
        seg_departure = _to_datetime(seg.departure)
        seg_arrival = _to_datetime(seg.arrival)
        raw_segments.append(
            {
                "carrier": segment_carrier,
                "from": getattr(seg.from_airport, "code", None),
                "from_name": getattr(seg.from_airport, "name", None),
                "to": getattr(seg.to_airport, "code", None),
                "to_name": getattr(seg.to_airport, "name", None),
                "departureTime": _iso(seg_departure),
                "arrivalTime": _iso(seg_arrival),
                "durationMinutes": seg.duration if isinstance(seg.duration, int) else None,
                "planeType": getattr(seg, "plane_type", None),
            }
        )
        if i:
            prev_arrival = _to_datetime(segments[i - 1].arrival)
            layover_minutes = None
            if prev_arrival and seg_departure and seg_departure > prev_arrival:
                layover_minutes = int((seg_departure - prev_arrival).total_seconds()) // 60
            layovers.append(
                FlightLayover(
                    airport=str(getattr(seg.from_airport, "code", None) or ""),
                    arrival_time=prev_arrival,
                    departure_time=seg_departure,
                    duration_minutes=layover_minutes,
                )
            )
    return raw_segments, layovers


def _total_duration_minutes(
    raw_segments: list[dict[str, Any]], layovers: list[FlightLayover]
) -> int | None:
    """Sum segment flight minutes + layover minutes; None if any is unknown."""
    total = 0
    for seg in raw_segments:
        minutes = seg.get("durationMinutes")
        if not isinstance(minutes, int):
            return None
        total += minutes
    for layover in layovers:
        if layover.duration_minutes is None:
            return None
        total += layover.duration_minutes
    return total


def _airline_maps(result: Any) -> tuple[dict[str, str], dict[str, str]]:
    """Build code->name / name->code maps from the result's JS metadata."""
    code_to_name: dict[str, str] = {}
    name_to_code: dict[str, str] = {}
    metadata = getattr(result, "metadata", None)
    for airline in getattr(metadata, "airlines", None) or []:
        code = str(getattr(airline, "code", "") or "").upper()
        name = str(getattr(airline, "name", "") or "")
        if code and name:
            code_to_name[code] = name
            name_to_code[name.lower()] = code
    return code_to_name, name_to_code


def _resolve_airline(
    entry: str,
    code_to_name: dict[str, str],
    name_to_code: dict[str, str],
) -> tuple[str | None, str | None]:
    """Resolve an itinerary ``airlines`` entry to (IATA code, display name).

    Google's payload carries airline identity as strings whose form isn't
    contractual — resolve via the page's own code<->name metadata first, then
    fall back to shape heuristics (2-3 char uppercase == IATA code).
    """
    entry = entry.strip()
    if not entry:
        return None, None
    upper = entry.upper()
    if upper in code_to_name:
        return upper, code_to_name[upper]
    if entry.lower() in name_to_code:
        return name_to_code[entry.lower()], entry
    if 2 <= len(entry) <= 3 and entry == upper:
        return upper, airline_display_name(upper)
    return None, entry


def _apply_sort(flights: list[FlightSearchFlight], sort: str) -> list[FlightSearchFlight]:
    """Client-side sort; "value" preserves Google's own best-first ordering."""
    if sort == "price":
        return sorted(flights, key=lambda f: f.price_amount)
    if sort == "duration":
        return sorted(
            flights,
            key=lambda f: f.duration_minutes if f.duration_minutes is not None else 1 << 30,
        )
    return flights


# Singleton instance for shared use
fast_flights_client = FastFlightsClient()
