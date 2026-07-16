"""fast-flights client (Google Flights scraper) for flight search.

Third flight-provider option next to the Skiplagged and Kiwi MCPs. Pages are
fetched with the ``fast-flights`` library's fetcher (protobuf ``tfs`` query,
Chrome-impersonating ``primp`` client, no API key) and parsed by our extended
parser (``fast_flights_parser``), which reads both itinerary sections of the
page and the per-segment carrier/flight-number identity that the upstream
library drops.

Provider characteristics, normalized here at the source (never in clients):

- One page of results per query (no pagination) — but the page carries two
  sections ("best" + other departing options) and both are read; the cheapest
  fare regularly hides outside "best".
- Round-trip searches list **outbound** options priced at the round-trip
  total; Google's query protobuf has no selected-flight token, so the exact
  paired return legs cannot be fetched. Tracking searches instead run a
  second **reverse one-way query** for the return date and attach the
  same-airline return options to each outbound offer (``round_trip_total``
  marks the offer so clients can qualify the pairing).
- The library's fetcher is synchronous — calls run in a worker thread.
"""

from __future__ import annotations

import asyncio
import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from fast_flights import FlightQuery, FlightsNotFound, Passengers, create_query
from fast_flights.fetcher import fetch_flights_html

from app.clients.fast_flights_parser import (
    ParsedItinerary,
    ParsedPage,
    ParsedSegment,
    parse_flights_page,
)
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

# How many same-airline return options ride along on each round-trip offer.
MAX_RETURN_OPTIONS = 3

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
    async def _fetch_page(self, query: Any, route_label: str) -> ParsedPage:
        """Run one Google Flights query, returning the parsed page.

        Returns an empty page when Google reports no flights for the
        route/dates. Transient scrape failures (blocked or unparseable page)
        are retried a couple of times, then raised.
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
                html = await asyncio.to_thread(fetch_flights_html, query, proxy=self._proxy)
                page = parse_flights_page(html)
            except FlightsNotFound:
                # Google's explicit "no flights" answer — a legitimate empty
                # result, not a failure.
                langfuse_context.update_current_observation(output={"count": 0})
                return ParsedPage()
            except Exception as exc:  # noqa: BLE001 - scraper failures come in many shapes
                # Anything else (connection error, consent page breaking the
                # parser, payload drift) is treated as transient: Google
                # blocks are intermittent and usually recover on retry.
                last_error = exc
                continue
            langfuse_context.update_current_observation(
                output={"count": len(page.itineraries)}
            )
            return page

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
        include_return_options: bool = False,
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
            include_return_options: For round trips, run a second reverse
                one-way query and attach same-airline return options to each
                offer (costs one extra Google call; the tracking path enables
                it, the chat path doesn't).

        Returns:
            FlightSearchResult with normalized flight data (provider="fast_flights").
        """
        route_label = f"{origin.upper()}-{destination.upper()} {departure_date}"
        is_round_trip = return_date is not None
        try:
            # Query construction is inside the guard: bad inputs (e.g. a
            # passenger count the protobuf layer rejects) must degrade to a
            # failed result, not an unhandled exception.
            query = self._build_query(
                origin, destination, departure_date, return_date, adults, max_stops, cabin
            )
            page = await self._fetch_page(query, route_label)
            flights = [
                flight
                for itinerary in page.itineraries
                if (flight := _normalize_itinerary(itinerary, page, is_round_trip)) is not None
            ]
            if flights and is_round_trip and include_return_options:
                await self._attach_return_options(
                    flights, origin, destination, return_date, adults, max_stops, cabin
                )
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
                is_round_trip=is_round_trip,
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
            is_round_trip=is_round_trip,
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
        and offers no pagination. For round trips the tracking search also
        fetches the reverse one-way page so each offer carries its
        same-airline return options (two Google calls total).
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
            include_return_options=True,
        )

    async def _attach_return_options(
        self,
        flights: list[FlightSearchFlight],
        origin: str,
        destination: str,
        return_date: str,
        adults: int,
        max_stops: str | None,
        cabin: str | None,
    ) -> None:
        """Fetch the reverse one-way page and attach same-airline return options.

        The round-trip page prices outbound options at the round-trip total
        without itemizing returns; the reverse one-way page lists the real
        return-leg flights. Each outbound offer gets the return options whose
        carriers all appear on the outbound (round-trip fares pair within an
        airline), best-ranked first. A failure here degrades gracefully — the
        outbound data (and its prices) stands on its own.
        """
        route_label = f"{destination.upper()}-{origin.upper()} {return_date}"
        try:
            query = self._build_query(
                destination, origin, return_date, None, adults, max_stops, cabin
            )
            page = await self._fetch_page(query, route_label)
        except GlobalBudgetExceeded:
            raise
        except FastFlightsError as exc:
            logger.warning(
                "fast-flights return-leg query failed for %s; offers keep outbound data only",
                route_label,
                exc_info=exc,
                extra={"event": "fast_flights.return_query_failed"},
            )
            return

        options = [
            {
                "carriers": sorted({seg.carrier for seg in itinerary.segments if seg.carrier}),
                "segments": [_segment_payload(seg) for seg in itinerary.segments],
                "duration_minutes": _itinerary_duration_minutes(itinerary.segments),
                "stops": max(0, len(itinerary.segments) - 1),
            }
            for itinerary in page.itineraries
        ]

        for flight in flights:
            raw = flight.raw_data or {}
            offer_carriers = set(raw.get("carrier_codes") or [])
            matches = [
                option
                for option in options
                if option["carriers"] and set(option["carriers"]) <= offer_carriers
            ][:MAX_RETURN_OPTIONS]
            if not matches:
                continue
            chosen = matches[0]
            raw["return_segments"] = chosen["segments"]
            raw["return_duration_minutes"] = chosen["duration_minutes"]
            raw["return_stops"] = chosen["stops"]
            raw["return_options"] = matches
            # Return carriers participate in the airline preference filter,
            # mirroring how Kiwi offers match on both legs.
            raw["carrier_codes"] = sorted(
                offer_carriers | {c for option in matches for c in option["carriers"]}
            )


# -----------------------------------------------------------------------------
# Normalization helpers
# -----------------------------------------------------------------------------


def _segment_payload(seg: ParsedSegment) -> dict[str, Any]:
    return {
        "carrier": seg.carrier,
        "flightNumber": seg.flight_number,
        "from": seg.from_code,
        "from_name": seg.from_name,
        "to": seg.to_code,
        "to_name": seg.to_name,
        "departureTime": seg.departure.isoformat() if seg.departure else None,
        "arrivalTime": seg.arrival.isoformat() if seg.arrival else None,
        "durationMinutes": seg.duration_minutes,
        "planeType": seg.plane_type,
    }


def _build_layovers(segments: list[ParsedSegment]) -> list[FlightLayover]:
    layovers: list[FlightLayover] = []
    for prev, seg in zip(segments, segments[1:], strict=False):
        duration = None
        if prev.arrival and seg.departure and seg.departure > prev.arrival:
            duration = int((seg.departure - prev.arrival).total_seconds()) // 60
        layovers.append(
            FlightLayover(
                airport=str(seg.from_code or ""),
                arrival_time=prev.arrival,
                departure_time=seg.departure,
                duration_minutes=duration,
            )
        )
    return layovers


def _itinerary_duration_minutes(segments: list[ParsedSegment]) -> int | None:
    """Sum segment flight minutes + layover minutes; None if any is unknown.

    Segment departure/arrival are LOCAL times, so an endpoint diff would be
    off by the origin<->destination UTC offset; per-segment durations are
    Google's own values, and layovers are same-airport local-time diffs
    (timezone neutral).
    """
    total = 0
    for seg in segments:
        if not isinstance(seg.duration_minutes, int):
            return None
        total += seg.duration_minutes
    for layover in _build_layovers(segments):
        if layover.duration_minutes is None:
            return None
        total += layover.duration_minutes
    return total


def _airline_identity(
    itinerary: ParsedItinerary, page: ParsedPage
) -> tuple[list[str], list[str]]:
    """Resolve (carrier codes, display names) for an itinerary.

    Codes come from the segments' own identity; names prefer the itinerary's
    display list, then the page's code->name metadata, then the static map.
    """
    codes: list[str] = []
    for seg in itinerary.segments:
        if seg.carrier and seg.carrier not in codes:
            codes.append(seg.carrier)
    names = [n for n in itinerary.airline_names if n]
    if not names:
        for code in codes:
            name = page.airline_code_to_name.get(code) or airline_display_name(code)
            if name and name not in names:
                names.append(name)
    return codes, names


def _normalize_itinerary(
    itinerary: ParsedItinerary, page: ParsedPage, is_round_trip: bool
) -> FlightSearchFlight | None:
    """Normalize one parsed itinerary to a FlightSearchFlight.

    For round trips the itinerary describes the **outbound** leg and the
    price is the round-trip total; ``round_trip_total`` marks the offer and
    the tracking path attaches same-airline return options separately.
    """
    try:
        price_amount = Decimal(str(itinerary.price))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if price_amount <= 0:
        return None

    segments = itinerary.segments
    if not segments:
        return None

    carrier_codes, airline_names = _airline_identity(itinerary, page)
    first, last = segments[0], segments[-1]

    stops = max(0, len(segments) - 1)
    stops_text = "Direct" if stops == 0 else f"{stops} stop{'s' if stops > 1 else ''}"

    duration_minutes = _itinerary_duration_minutes(segments)
    if (
        duration_minutes is None
        and first.departure
        and last.arrival
        and last.arrival > first.departure
    ):
        # Fallback only: naive local-time endpoint diff.
        duration_minutes = int((last.arrival - first.departure).total_seconds()) // 60

    raw_data: dict[str, Any] = {
        "provider": PROVIDER_NAME,
        "price": itinerary.price,
        "is_best": itinerary.is_best,
        "carrier_codes": carrier_codes,
        "airline_names": airline_names,
        "segments": [_segment_payload(seg) for seg in segments],
        "stops": stops,
        "duration_minutes": duration_minutes,
        # Round-trip searches list outbound options priced at the round-trip
        # total; the paired return leg is not itemized by Google (see module
        # docstring).
        "round_trip_total": is_round_trip,
    }

    return FlightSearchFlight(
        departure_airport=str(first.from_code or "").upper(),
        arrival_airport=str(last.to_code or "").upper(),
        departure_time=first.departure,
        arrival_time=last.arrival,
        airline_name=", ".join(airline_names) if airline_names else None,
        carrier_code=carrier_codes[0] if carrier_codes else None,
        duration_minutes=duration_minutes,
        stops=stops,
        stops_text=stops_text,
        layovers=_build_layovers(segments),
        price_amount=price_amount,
        price_currency="USD",
        price_display=f"${itinerary.price}",
        booking_link=None,
        provider=PROVIDER_NAME,
        raw_data=raw_data,
    )


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
