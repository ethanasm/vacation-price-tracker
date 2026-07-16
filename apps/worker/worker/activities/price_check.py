import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from app.clients.fast_flights import FastFlightsClient, FastFlightsError
from app.clients.kiwi import KiwiClient, KiwiMCPError
from app.clients.skiplagged import SkiplaggedClient, SkiplaggedMCPError
from app.clients.skiplagged_mock import mock_flight_search, mock_hotel_search
from app.clients.skiplagged_parser import parse_flight_segments
from app.core.config import settings
from app.core.errors import GlobalBudgetExceeded
from app.core.telemetry import langfuse_context, observe
from app.db.session import AsyncSessionLocal
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from app.services.flight_provider import (
    PROVIDER_FAST_FLIGHTS,
    PROVIDER_KIWI,
    get_flight_provider_name,
)
from sqlmodel import select
from temporalio import activity
from temporalio.exceptions import ApplicationError

from worker.types import FetchResult, FilterInput, FilterOutput, SaveSnapshotInput, TripDetails

logger = logging.getLogger(__name__)

VIEW_KEYWORDS = {
    "ocean": ["ocean", "sea", "water", "beach"],
    "city": ["city", "skyline", "urban"],
    "garden": ["garden", "courtyard", "pool"],
}

PRICE_FIELDS = ("price", "total_price", "amount")
NESTED_PRICE_FIELDS = ("total", "total_price", "amount", "grandTotal", "base")

# Maximum number of hotels to fetch full details for (avoids API abuse)
MAX_HOTEL_DETAIL_CALLS = 20


def _budget_application_error(exc: GlobalBudgetExceeded) -> ApplicationError:
    """Wrap a tripped global budget breaker as a non-retriable Temporal error.

    Retrying won't help while the breaker is tripped (it resets at UTC midnight),
    so we mark it non-retryable. With the workflow's `return_exceptions=True`, a
    one-sided trip still snapshots the other side's data with this error recorded.
    """
    logger.warning("Global budget breaker tripped during fetch: %s", exc)
    return ApplicationError(str(exc), type="GlobalBudgetExceeded", non_retryable=True)


@activity.defn
async def load_trip_details(trip_id: str) -> TripDetails:
    logger.info(
        "Loading trip details for trip_id=%s",
        trip_id,
        extra={"event": "activity.load_trip.start", "trip_id": trip_id},
    )
    async with AsyncSessionLocal() as session:
        trip = await session.get(Trip, uuid.UUID(trip_id))
        if not trip:
            logger.info(
                "Trip not found for trip_id=%s",
                trip_id,
                extra={"event": "activity.load_trip.not_found", "trip_id": trip_id},
            )
            raise ValueError(f"Trip not found for id={trip_id}")

        flight_prefs = (
            (await session.execute(select(TripFlightPrefs).where(TripFlightPrefs.trip_id == trip.id))).scalars().first()
        )
        hotel_prefs = (
            (await session.execute(select(TripHotelPrefs).where(TripHotelPrefs.trip_id == trip.id))).scalars().first()
        )

        logger.info(
            "Loaded trip details for trip_id=%s",
            trip_id,
            extra={"event": "activity.load_trip.ok", "trip_id": trip_id},
        )
        return {
            "trip_id": str(trip.id),
            "origin_airport": trip.origin_airport,
            "destination_code": trip.destination_code,
            "is_round_trip": trip.is_round_trip,
            "depart_date": trip.depart_date.isoformat(),
            "return_date": trip.return_date.isoformat() if trip.return_date else None,
            "adults": trip.adults,
            "track_flights": trip.track_flights,
            "track_hotels": trip.track_hotels,
            "flight_prefs": {
                "airlines": flight_prefs.airlines if flight_prefs else [],
                "stops_mode": (flight_prefs.stops_mode.value if flight_prefs else "any"),
                "max_stops": flight_prefs.max_stops if flight_prefs else None,
                "cabin": flight_prefs.cabin.value if flight_prefs else "economy",
            },
            "hotel_prefs": {
                "rooms": hotel_prefs.rooms,
                "adults_per_room": hotel_prefs.adults_per_room,
                "city": hotel_prefs.city,
                "room_selection_mode": hotel_prefs.room_selection_mode.value,
                "preferred_room_types": hotel_prefs.preferred_room_types,
                "preferred_views": hotel_prefs.preferred_views,
                "min_star_rating": hotel_prefs.min_star_rating,
            } if hotel_prefs else None,
        }


def _set_trip_trace_context(trip: TripDetails, activity_name: str) -> None:
    """Tag the current Langfuse trace with workflow + trip context."""
    try:
        info = activity.info()
        workflow_id = info.workflow_id
    except Exception:
        workflow_id = None
    langfuse_context.update_current_trace(
        tags=["worker", activity_name],
        session_id=workflow_id,
        metadata={
            "trip_id": trip["trip_id"],
            "origin": trip["origin_airport"],
            "destination": trip["destination_code"],
            "workflow_id": workflow_id,
        },
    )


@activity.defn
@observe(name="worker.fetch_flights")
async def fetch_flights_activity(trip: TripDetails) -> FetchResult:
    """Fetch flight offers from Skiplagged MCP or mock data."""
    _set_trip_trace_context(trip, "fetch_flights")
    # Use mock data if configured
    if settings.mock_skiplagged_api:
        logger.info(
            "Using mock Skiplagged flights for trip_id=%s",
            trip["trip_id"],
            extra={"event": "activity.fetch_flights.start", "trip_id": trip["trip_id"], "mock": True},
        )
        non_stop = trip["flight_prefs"]["stops_mode"] == "nonstop"
        max_stops = "none" if non_stop else None
        response = mock_flight_search(
            origin=trip["origin_airport"],
            destination=trip["destination_code"],
            departure_date=trip["depart_date"],
            return_date=trip["return_date"] if trip["is_round_trip"] else None,
            adults=trip["adults"],
            max_stops=max_stops,
        )
        # mock_flight_search returns raw Skiplagged-shaped dict; normalize to offers
        offers = _extract_skiplagged_flight_offers(response)
        return {
            "offers": offers,
            "raw": _normalize_raw(response, "skiplagged_mock"),
            "error": None,
        }

    # Provider selection is an operator-level runtime choice (`flight_provider`
    # app setting in the DB) — read per-fetch so a change applies to the very
    # next refresh, no worker restart.
    async with AsyncSessionLocal() as session:
        provider = await get_flight_provider_name(session)

    logger.info(
        "Fetching flights for trip_id=%s via %s MCP",
        trip["trip_id"],
        provider,
        extra={
            "event": "activity.fetch_flights.start",
            "trip_id": trip["trip_id"],
            "mock": False,
            "provider": provider,
        },
    )
    non_stop = trip["flight_prefs"]["stops_mode"] == "nonstop"
    max_stops = "none" if non_stop else None

    try:
        if provider == PROVIDER_KIWI:
            result = await KiwiClient().search_flights_all(
                origin=trip["origin_airport"],
                destination=trip["destination_code"],
                departure_date=trip["depart_date"],
                return_date=trip["return_date"] if trip["is_round_trip"] else None,
                adults=trip["adults"],
                max_stops=max_stops,
                cabin=trip["flight_prefs"].get("cabin"),
            )
        elif provider == PROVIDER_FAST_FLIGHTS:
            result = await FastFlightsClient().search_flights_all(
                origin=trip["origin_airport"],
                destination=trip["destination_code"],
                departure_date=trip["depart_date"],
                return_date=trip["return_date"] if trip["is_round_trip"] else None,
                adults=trip["adults"],
                max_stops=max_stops,
                cabin=trip["flight_prefs"].get("cabin"),
            )
        else:
            result = await SkiplaggedClient().search_flights_all(
                origin=trip["origin_airport"],
                destination=trip["destination_code"],
                departure_date=trip["depart_date"],
                return_date=trip["return_date"] if trip["is_round_trip"] else None,
                adults=trip["adults"],
                max_stops=max_stops,
                max_pages=4,
            )
    except GlobalBudgetExceeded as exc:
        raise _budget_application_error(exc) from exc
    except (SkiplaggedMCPError, KiwiMCPError, FastFlightsError) as exc:
        logger.warning(
            "Flight fetch failed for trip_id=%s via %s",
            trip["trip_id"],
            provider,
            exc_info=exc,
            extra={
                "event": "activity.fetch_flights.failed",
                "trip_id": trip["trip_id"],
                "provider": provider,
            },
        )
        raise

    # Normalize FlightSearchResult to list of offer dicts
    offers = [_flight_to_offer_dict(flight) for flight in result.flights]
    logger.info(
        "Fetched %d flight offers for trip_id=%s via %s",
        len(offers),
        trip["trip_id"],
        provider,
        extra={
            "event": "activity.fetch_flights.ok",
            "trip_id": trip["trip_id"],
            "count": len(offers),
            "provider": provider,
        },
    )
    return {
        "offers": offers,
        "raw": {"provider": provider, "total_results": result.total_results},
        "error": None,
    }


def _flight_to_offer_dict(flight: Any) -> dict[str, Any]:
    """Convert a FlightSearchFlight to a normalized offer dict."""
    return {
        "id": flight.raw_data.get("id") if flight.raw_data else None,
        "airlines": flight.airline_name,
        "carrier_code": flight.carrier_code,
        "departure_airport": flight.departure_airport,
        "arrival_airport": flight.arrival_airport,
        "departure_time": flight.departure_time.isoformat() if flight.departure_time else None,
        "arrival_time": flight.arrival_time.isoformat() if flight.arrival_time else None,
        "duration_minutes": flight.duration_minutes,
        "stops": flight.stops,
        "price": str(flight.price_amount) if flight.price_amount is not None else None,
        "price_currency": flight.price_currency,
        "booking_link": flight.booking_link,
        "provider": flight.provider,
        # Keep raw for downstream use (a raw `provider` key, when present,
        # matches flight.provider — the Kiwi client stamps it in raw_data)
        **(flight.raw_data or {}),
    }


def _extract_skiplagged_flight_offers(response: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract flight list from a raw Skiplagged mock response dict."""
    flights_raw = response.get("flights", [])
    return [f for f in flights_raw if isinstance(f, dict)]


@activity.defn
@observe(name="worker.fetch_hotels")
async def fetch_hotels_activity(trip: TripDetails) -> FetchResult:
    """Fetch hotel offers from Skiplagged MCP or mock data."""
    _set_trip_trace_context(trip, "fetch_hotels")
    hotel_prefs = trip.get("hotel_prefs")
    if not hotel_prefs or not trip.get("return_date"):
        logger.info(
            "Skipping hotel fetch for trip_id=%s (hotel_prefs=%s, return_date=%s)",
            trip["trip_id"],
            bool(hotel_prefs),
            trip.get("return_date"),
            extra={
                "event": "activity.fetch_hotels.skipped",
                "trip_id": trip["trip_id"],
                "has_hotel_prefs": bool(hotel_prefs),
                "return_date": str(trip.get("return_date")),
            },
        )
        return {
            "offers": [],
            "raw": {"status": "skipped", "provider": "skiplagged"},
            "error": None,
        }

    if settings.mock_skiplagged_api:
        logger.info(
            "Using mock Skiplagged hotels for trip_id=%s",
            trip["trip_id"],
            extra={"event": "activity.fetch_hotels.start", "trip_id": trip["trip_id"], "mock": True},
        )
        adults = hotel_prefs["rooms"] * hotel_prefs["adults_per_room"]
        city_query = (hotel_prefs.get("city") or "").strip() or trip["destination_code"]
        response = mock_hotel_search(
            city=city_query,
            checkin=trip["depart_date"],
            checkout=trip["return_date"],
            adults=adults,
            rooms=hotel_prefs["rooms"],
        )
        offers = _extract_skiplagged_hotel_offers(response)
        return {
            "offers": offers,
            "raw": _normalize_raw(response, "skiplagged_mock"),
            "error": None,
        }

    logger.info(
        "Fetching hotels for trip_id=%s via Skiplagged MCP",
        trip["trip_id"],
        extra={"event": "activity.fetch_hotels.start", "trip_id": trip["trip_id"], "mock": False},
    )
    adults = hotel_prefs["adults_per_room"]
    city_query = (hotel_prefs.get("city") or "").strip() or trip["destination_code"]

    try:
        client = SkiplaggedClient()
        hotel_result = await client.search_hotels_all(
            city=city_query,
            checkin=trip["depart_date"],
            checkout=trip["return_date"],
            adults=adults,
            rooms=hotel_prefs["rooms"],
            max_pages=4,
        )
    except GlobalBudgetExceeded as exc:
        raise _budget_application_error(exc) from exc
    except SkiplaggedMCPError as exc:
        logger.warning(
            "Hotel search failed for trip_id=%s",
            trip["trip_id"],
            exc_info=exc,
            extra={"event": "activity.fetch_hotels.failed", "trip_id": trip["trip_id"]},
        )
        raise

    # Sort by price ascending and cap at MAX_HOTEL_DETAIL_CALLS
    sorted_hotels = sorted(hotel_result.hotels, key=lambda h: h.price_per_night)
    top_hotels = sorted_hotels[:MAX_HOTEL_DETAIL_CALLS]

    logger.info(
        "Fetching details for %d/%d hotels for trip_id=%s",
        len(top_hotels),
        len(hotel_result.hotels),
        trip["trip_id"],
        extra={
            "event": "activity.fetch_hotels.details",
            "trip_id": trip["trip_id"],
            "detail_count": len(top_hotels),
            "total_count": len(hotel_result.hotels),
        },
    )

    # Fetch details concurrently (with fallback to search-level data on failure).
    # A tripped global budget must NOT be swallowed by the fallback — let it
    # propagate so the remaining detail calls are abandoned (no further
    # increments) and the activity fails non-retriably.
    async def _fetch_one(hotel):
        try:
            detail = await client.get_hotel_details(
                hotel_id=hotel.id,
                checkin=trip["depart_date"],
                checkout=trip["return_date"],
                adults=adults,
                rooms=hotel_prefs["rooms"],
            )
            return _normalize_hotel_detail(detail, hotel)
        except GlobalBudgetExceeded:
            raise
        except Exception as exc:
            logger.warning(
                "Failed to get details for hotel_id=%s: %s",
                hotel.id,
                exc,
                exc_info=exc,
                extra={"event": "activity.fetch_hotels.detail_failed", "hotel_id": str(hotel.id)},
            )
            return _hotel_to_offer_dict(hotel)

    try:
        offers = await asyncio.gather(*[_fetch_one(h) for h in top_hotels])
    except GlobalBudgetExceeded as exc:
        raise _budget_application_error(exc) from exc

    logger.info(
        "Fetched %d hotel offers for trip_id=%s",
        len(offers),
        trip["trip_id"],
        extra={"event": "activity.fetch_hotels.ok", "trip_id": trip["trip_id"], "count": len(offers)},
    )
    return {
        "offers": offers,
        "raw": {"provider": "skiplagged", "total_results": hotel_result.total_results},
        "error": None,
    }


def _normalize_hotel_detail(detail: Any, hotel: Any) -> dict[str, Any]:
    """Normalize SkiplaggedHotelDetail + HotelSearchHotel to offer dict."""
    rooms = [
        {
            "id": room.id,
            "title": room.title,
            "occupancy_limit": room.occupancyLimit,
            "price_per_night": room.pricePerNightInDollars,
            "price_total": room.totalPriceInDollars,
            "taxes_and_fees": room.taxesAndFeesInDollars,
            "currency": room.currency,
            "refundable": room.refundable,
            "free_cancellation": room.freeCancellation,
            "bed_types": room.bedTypes,
        }
        for room in (detail.rooms or [])
    ]
    cheapest_room_price = min((r["price_total"] for r in rooms), default=None)

    return {
        "id": detail.hotelId,
        "name": detail.hotelName,
        "star_rating": detail.starRating,
        "review_rating": detail.reviewRating,
        "review_count": detail.reviewCount,
        "price": cheapest_room_price or detail.totalPriceInDollars,
        "total_price": detail.totalPriceInDollars,
        "amenities": detail.amenityNames,
        "address": detail.address,
        "city": detail.cityName,
        "rooms": rooms,
        "provider": "skiplagged",
    }


def _hotel_to_offer_dict(hotel: Any) -> dict[str, Any]:
    """Convert HotelSearchHotel (no detail) to offer dict."""
    return {
        "id": hotel.id,
        "name": hotel.name,
        "star_rating": hotel.star_rating,
        "price": float(hotel.price_per_night),
        "amenities": hotel.amenities,
        "rooms": [],
        "provider": "skiplagged",
    }


def _extract_skiplagged_hotel_offers(response: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract hotel list from a raw Skiplagged mock response dict."""
    results_raw = response.get("results", [])
    return [h for h in results_raw if isinstance(h, dict)]


@activity.defn
async def filter_results_activity(payload: FilterInput) -> FilterOutput:
    flights = _filter_flights(payload["flight_result"]["offers"], payload["flight_prefs"])
    hotels = _filter_hotels(payload["hotel_result"]["offers"], payload.get("hotel_prefs") or {})
    logger.info(
        "Filtered results flights=%d hotels=%d",
        len(flights),
        len(hotels),
        extra={
            "event": "activity.filter_results.ok",
            "flight_count": len(flights),
            "hotel_count": len(hotels),
        },
    )
    if payload["flight_result"]["error"] or payload["hotel_result"]["error"]:
        logger.debug(
            "Filter input errors flight_error=%s hotel_error=%s",
            payload["flight_result"]["error"],
            payload["hotel_result"]["error"],
            extra={
                "event": "activity.filter_results.input_errors",
                "flight_error": str(payload["flight_result"]["error"]),
                "hotel_error": str(payload["hotel_result"]["error"]),
            },
        )
    raw_data = {
        "flights": payload["flight_result"]["raw"],
        "hotels": payload["hotel_result"]["raw"],
        "errors": {
            "flights": payload["flight_result"]["error"],
            "hotels": payload["hotel_result"]["error"],
        },
        "filtered_counts": {"flights": len(flights), "hotels": len(hotels)},
    }
    return {"flights": flights, "hotels": hotels, "raw_data": raw_data}


# Deduplication window to prevent duplicate snapshots when workflows run in quick succession
SNAPSHOT_DEDUP_WINDOW_SECONDS = 60


@activity.defn
async def save_snapshot_activity(payload: SaveSnapshotInput) -> str:
    logger.info(
        "Saving price snapshot for trip_id=%s",
        payload["trip_id"],
        extra={"event": "activity.save_snapshot.start", "trip_id": payload["trip_id"]},
    )
    trip_uuid = uuid.UUID(payload["trip_id"])

    async with AsyncSessionLocal() as session:
        # Check for recent snapshots to prevent duplicates
        cutoff = datetime.now(UTC) - timedelta(seconds=SNAPSHOT_DEDUP_WINDOW_SECONDS)
        existing_result = await session.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.trip_id == trip_uuid)
            .where(PriceSnapshot.created_at >= cutoff)
            .order_by(PriceSnapshot.created_at.desc())
            .limit(1)
        )
        recent_snapshot = existing_result.scalars().first()

        if recent_snapshot:
            seconds_ago = (datetime.now(UTC) - recent_snapshot.created_at).total_seconds()

            # Allow a retry to supersede a recent snapshot that is degraded:
            # an upstream fetch recorded an error, or no offers came back at
            # all (a provider blip can return an empty-but-"successful" search;
            # observed with Kiwi in prod 2026-07-06). Note `errors` is always
            # a dict with (possibly null) flights/hotels keys — check the
            # values, not the dict's truthiness.
            raw_data = recent_snapshot.raw_data or {}
            errors = raw_data.get("errors")
            has_errors = any(errors.values()) if isinstance(errors, dict) else bool(errors)
            raw_flights = raw_data.get("flights")
            raw_hotels = raw_data.get("hotels")
            flight_data = raw_flights.get("data") if isinstance(raw_flights, dict) else None
            hotel_data = raw_hotels.get("data") if isinstance(raw_hotels, dict) else None
            has_no_offers = not flight_data and not hotel_data

            if has_errors or has_no_offers:
                logger.info(
                    "Recent snapshot %s was degraded (%s); allowing new snapshot for trip_id=%s",
                    recent_snapshot.id,
                    "errors" if has_errors else "no offers",
                    payload["trip_id"],
                    extra={
                        "event": "activity.save_snapshot.retry_after_errors",
                        "trip_id": payload["trip_id"],
                        "snapshot_id": str(recent_snapshot.id),
                        "reason": "errors" if has_errors else "no_offers",
                    },
                )
            else:
                # Recent snapshot was successful - skip duplicate
                logger.warning(
                    "Skipping duplicate snapshot for trip_id=%s; existing snapshot_id=%s created %.1f seconds ago",
                    payload["trip_id"],
                    recent_snapshot.id,
                    seconds_ago,
                    extra={
                        "event": "activity.save_snapshot.duplicate_skipped",
                        "trip_id": payload["trip_id"],
                        "snapshot_id": str(recent_snapshot.id),
                        "seconds_ago": seconds_ago,
                    },
                )
                return str(recent_snapshot.id)

        # Proceed with normal snapshot creation
        flight_items = payload["flights"]
        hotel_items = payload["hotels"]
        flight_price = _extract_min_price(flight_items)
        hotel_price = _extract_min_price(hotel_items)
        flight_priced = len(_priced_values(flight_items))
        hotel_priced = len(_priced_values(hotel_items))

        # A provider can return results that all carry a 0/unpriced amount
        # (degraded response). Persist the snapshot with a null price rather than
        # a misleading $0 fare, and surface the degradation so a daily/manual
        # retry can recover it. The marker counts let the API/UI tell "no offers"
        # apart from "offers came back but none were priced".
        if flight_items and flight_price is None:
            logger.warning(
                "Provider returned %d flight result(s) for trip_id=%s but none were priced",
                len(flight_items),
                payload["trip_id"],
                extra={
                    "event": "activity.save_snapshot.no_priced_flights",
                    "trip_id": payload["trip_id"],
                    "result_count": len(flight_items),
                },
            )
        if hotel_items and hotel_price is None:
            logger.warning(
                "Provider returned %d hotel result(s) for trip_id=%s but none were priced",
                len(hotel_items),
                payload["trip_id"],
                extra={
                    "event": "activity.save_snapshot.no_priced_hotels",
                    "trip_id": payload["trip_id"],
                    "result_count": len(hotel_items),
                },
            )

        # Calculate total from whatever prices are available
        total_price = None
        if flight_price is not None or hotel_price is not None:
            total_price = (flight_price or Decimal(0)) + (hotel_price or Decimal(0))
        logger.debug(
            "Snapshot prices for trip_id=%s flight=%s hotel=%s total=%s",
            payload["trip_id"],
            flight_price,
            hotel_price,
            total_price,
            extra={
                "event": "activity.save_snapshot.prices",
                "trip_id": payload["trip_id"],
                "flight_price": str(flight_price),
                "hotel_price": str(hotel_price),
                "total_price": str(total_price),
            },
        )

        raw_data = dict(payload["raw_data"] or {})
        raw_flights = dict(raw_data.get("flights") or {})
        raw_flights["data"] = flight_items
        raw_flights["priced_count"] = flight_priced
        raw_flights["unpriced_count"] = len(flight_items) - flight_priced
        raw_data["flights"] = raw_flights
        raw_hotels = dict(raw_data.get("hotels") or {})
        raw_hotels["data"] = hotel_items
        raw_hotels["priced_count"] = hotel_priced
        raw_hotels["unpriced_count"] = len(hotel_items) - hotel_priced
        raw_data["hotels"] = raw_hotels

        # Every snapshot carries a marker for the flight provider it was taken
        # from — the fetch activity stamps it into raw flights metadata.
        provider = raw_flights.get("provider")

        snapshot = PriceSnapshot(
            trip_id=trip_uuid,
            flight_price=flight_price,
            hotel_price=hotel_price,
            total_price=total_price,
            raw_data=raw_data,
            provider=provider if isinstance(provider, str) else None,
        )
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        logger.info(
            "Saved price snapshot for trip_id=%s snapshot_id=%s",
            payload["trip_id"],
            snapshot.id,
            extra={
                "event": "activity.save_snapshot.ok",
                "trip_id": payload["trip_id"],
                "snapshot_id": str(snapshot.id),
            },
        )
        return str(snapshot.id)


def _extract_carrier_codes(flight: dict[str, Any]) -> list[str]:
    """Extract all carrier codes from a flight offer.

    Supports Skiplagged format (flight id field with trip= segments)
    and legacy formats (carrier, operating_carrier, airline).
    """
    # Kiwi format: structured outbound/inbound legs with per-segment carriers
    kiwi_codes = _extract_kiwi_carrier_codes(flight)
    if kiwi_codes:
        return kiwi_codes

    # fast-flights format: itinerary-level carrier_codes list (Google exposes
    # no per-segment airline identity)
    fast_flights_codes = _extract_fast_flights_carrier_codes(flight)
    if fast_flights_codes:
        return fast_flights_codes

    carrier_codes: list[str] = []

    # Skiplagged format: parse from flight id field
    flight_id = flight.get("id", "")
    if flight_id and "trip=" in flight_id:
        outbound_segs, return_segs = parse_flight_segments(flight_id)
        for seg in outbound_segs + return_segs:
            code = seg.carrier_code.upper()
            if code not in carrier_codes:
                carrier_codes.append(code)
        return carrier_codes

    # Legacy format: carrier_code field (from normalized offer dict)
    carrier_code = flight.get("carrier_code")
    if carrier_code:
        carrier_codes.append(str(carrier_code).upper())

    # Legacy format fallback
    if not carrier_codes:
        carrier = flight.get("operating_carrier") or flight.get("carrier") or flight.get("airline")
        if isinstance(carrier, list):
            carrier_codes = [str(code).upper() for code in carrier]
        elif carrier:
            carrier_codes = [str(carrier).upper()]

    return carrier_codes


def _extract_fast_flights_carrier_codes(flight: dict[str, Any]) -> list[str]:
    """Collect carrier codes from a fast-flights offer's carrier_codes list."""
    raw_codes = flight.get("carrier_codes")
    if not isinstance(raw_codes, list):
        return []
    codes: list[str] = []
    for code in raw_codes:
        upper = str(code).upper()
        if upper and upper not in codes:
            codes.append(upper)
    return codes


def _extract_kiwi_carrier_codes(flight: dict[str, Any]) -> list[str]:
    """Collect carrier codes from Kiwi's structured outbound/inbound legs."""
    codes: list[str] = []
    for leg_key in ("outbound", "inbound"):
        leg = flight.get(leg_key)
        if not isinstance(leg, dict):
            continue
        for seg in leg.get("segments") or []:
            if not isinstance(seg, dict):
                continue
            carrier = seg.get("carrier")
            if carrier:
                code = str(carrier).upper()
                if code not in codes:
                    codes.append(code)
    return codes


def _filter_flights(flights: list[dict[str, Any]], prefs: dict[str, Any]) -> list[dict[str, Any]]:
    """Filter flights by preferred airlines."""
    airlines = [code.upper() for code in prefs.get("airlines", []) if isinstance(code, str)]
    if not airlines:
        return flights

    return [flight for flight in flights if any(code in _extract_carrier_codes(flight) for code in airlines)]


def _filter_hotels(hotels: list[dict[str, Any]], prefs: dict[str, Any]) -> list[dict[str, Any]]:
    """Filter hotels by preferred room types, views, and minimum star rating.

    Matches against:
    - room 'title' field in hotel['rooms'] list for room types
    - room 'title' field and hotel 'amenities' for views
    - hotel 'star_rating' field for minimum star threshold
    """
    filtered = hotels

    preferred_room_types = [t.lower() for t in prefs.get("preferred_room_types", []) if isinstance(t, str)]
    if preferred_room_types:
        filtered = [
            hotel for hotel in filtered
            if _hotel_matches_room_types(hotel, preferred_room_types)
        ]

    preferred_views = [v.lower() for v in prefs.get("preferred_views", []) if isinstance(v, str)]
    if preferred_views:
        filtered = [
            hotel for hotel in filtered
            if _hotel_matches_views(hotel, preferred_views)
        ]

    min_star_rating = prefs.get("min_star_rating")
    if isinstance(min_star_rating, int) and min_star_rating > 0:
        filtered = [
            hotel for hotel in filtered
            if _hotel_meets_min_stars(hotel, min_star_rating)
        ]

    return filtered


def _hotel_meets_min_stars(hotel: dict[str, Any], min_stars: int) -> bool:
    """Check if a hotel's star rating is at least min_stars. Hotels without a rating are dropped."""
    stars = hotel.get("star_rating")
    if not isinstance(stars, (int, float)):
        return False
    return stars >= min_stars


def _hotel_matches_room_types(hotel: dict[str, Any], preferred_types: list[str]) -> bool:
    """Check if any room title in the hotel matches preferred room types."""
    rooms = hotel.get("rooms", [])
    if not rooms:
        return False
    for room in rooms:
        title = room.get("title", "")
        if title and _matches_keywords(title, preferred_types):
            return True
    return False


def _hotel_matches_views(hotel: dict[str, Any], preferred_views: list[str]) -> bool:
    """Check if hotel has a matching view via room titles or amenities."""
    # Check room titles
    rooms = hotel.get("rooms", [])
    for room in rooms:
        title = room.get("title", "")
        if title and _matches_view(title, preferred_views):
            return True

    # Check amenities list
    amenities = hotel.get("amenities", [])
    for amenity in amenities:
        if _matches_view(str(amenity), preferred_views):
            return True

    # Check description field if present
    description = hotel.get("description")
    if description and _matches_view(description, preferred_views):
        return True

    return False


def _matches_keywords(description: Any, keywords: list[str]) -> bool:
    if not description or not isinstance(description, str):
        return False
    lower_desc = description.lower()
    return any(keyword in lower_desc for keyword in keywords)


def _matches_view(description: Any, views: list[str]) -> bool:
    if not description or not isinstance(description, str):
        return False
    lower_desc = description.lower()
    for view in views:
        keywords = VIEW_KEYWORDS.get(view, [view])
        if any(keyword in lower_desc for keyword in keywords):
            return True
    return False


def _extract_min_price(items: list[dict[str, Any]]) -> Decimal | None:
    prices = _priced_values(items)
    return min(prices) if prices else None


def _priced_values(items: list[dict[str, Any]]) -> list[Decimal]:
    """Return the strictly-positive prices among the given offers.

    A price of 0 (or negative) means the provider returned an unpriced/degraded
    offer — Skiplagged occasionally returns itineraries with ``amount: 0``. These
    must not be counted as a real $0 fare, so they are excluded from both the
    minimum-price calculation and the priced-offer count.
    """
    return [
        value
        for item in items
        if (value := _extract_price_value(item)) is not None and value > 0
    ]


def _extract_from_fields(obj: dict[str, Any]) -> Decimal | None:
    """Extract a price decimal from known price fields in a dict."""
    for field in PRICE_FIELDS:
        if field in obj:
            value = obj.get(field)
            if isinstance(value, dict):
                for nested in NESTED_PRICE_FIELDS:
                    if nested in value:
                        return _to_decimal(value.get(nested))
            return _to_decimal(value)
    return None


def _extract_price_value(item: dict[str, Any]) -> Decimal | None:
    result = _extract_from_fields(item)
    if result is not None:
        return result
    # Hotel offers may nest price in offers[0].price.total (legacy shape)
    offers = item.get("offers")
    if isinstance(offers, list) and offers:
        first_offer = offers[0]
        if isinstance(first_offer, dict):
            return _extract_from_fields(first_offer)
    return None


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _normalize_raw(response: Any, provider: str) -> dict[str, Any]:
    if isinstance(response, dict):
        payload = response.copy()
    elif isinstance(response, list):
        payload = {"data": response}
    else:
        payload = {"response": response}
    payload.setdefault("provider", provider)
    return payload


def _extract_offers(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    if not isinstance(response, dict):
        return []

    for key in ("data", "offers", "results"):
        value = response.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]

    nested = response.get("data")
    if isinstance(nested, dict):
        for key in ("offers", "results", "data"):
            value = nested.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]

    return []
