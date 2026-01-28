import logging
import uuid
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from app.clients.amadeus import AmadeusClient, AmadeusClientError
from app.clients.amadeus_mock import mock_flight_search, mock_hotel_search
from app.clients.flight_provider import get_provider_name
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from sqlmodel import select
from temporalio import activity

from worker.types import FetchResult, FilterInput, FilterOutput, SaveSnapshotInput, TripDetails

logger = logging.getLogger(__name__)

VIEW_KEYWORDS = {
    "ocean": ["ocean", "sea", "water", "beach"],
    "city": ["city", "skyline", "urban"],
    "garden": ["garden", "courtyard", "pool"],
}

PRICE_FIELDS = ("price", "total_price", "amount")
NESTED_PRICE_FIELDS = ("total", "total_price", "amount", "grandTotal", "base")

# Cabin class mapping from internal format to Amadeus API format
CABIN_CLASS_MAP = {
    "economy": "ECONOMY",
    "premium_economy": "PREMIUM_ECONOMY",
    "business": "BUSINESS",
    "first": "FIRST",
}

# Flight provider is lazily initialized to avoid import errors when fast-flights isn't installed
_flight_provider = None


def _get_flight_provider():
    """Lazily get the flight provider to avoid import errors at module load time."""
    global _flight_provider
    if _flight_provider is None:
        from app.clients.flight_provider import get_flight_provider
        _flight_provider = get_flight_provider()
    return _flight_provider


# Amadeus HTTP client for hotel searches
_amadeus_client = AmadeusClient()


@activity.defn
async def load_trip_details(trip_id: str) -> TripDetails:
    logger.info("Loading trip details for trip_id=%s", trip_id)
    async with AsyncSessionLocal() as session:
        trip = await session.get(Trip, uuid.UUID(trip_id))
        if not trip:
            logger.info("Trip not found for trip_id=%s", trip_id)
            raise ValueError(f"Trip not found for id={trip_id}")

        flight_prefs = (
            (await session.execute(select(TripFlightPrefs).where(TripFlightPrefs.trip_id == trip.id))).scalars().first()
        )
        hotel_prefs = (
            (await session.execute(select(TripHotelPrefs).where(TripHotelPrefs.trip_id == trip.id))).scalars().first()
        )

        return {
            "trip_id": str(trip.id),
            "origin_airport": trip.origin_airport,
            "destination_code": trip.destination_code,
            "is_round_trip": trip.is_round_trip,
            "depart_date": trip.depart_date.isoformat(),
            "return_date": trip.return_date.isoformat(),
            "adults": trip.adults,
            "flight_prefs": {
                "airlines": flight_prefs.airlines if flight_prefs else [],
                "stops_mode": (flight_prefs.stops_mode.value if flight_prefs else "any"),
                "max_stops": flight_prefs.max_stops if flight_prefs else None,
                "cabin": flight_prefs.cabin.value if flight_prefs else "economy",
            },
            "hotel_prefs": {
                "rooms": hotel_prefs.rooms if hotel_prefs else 1,
                "adults_per_room": hotel_prefs.adults_per_room if hotel_prefs else 2,
                "room_selection_mode": (hotel_prefs.room_selection_mode.value if hotel_prefs else "cheapest"),
                "preferred_room_types": hotel_prefs.preferred_room_types if hotel_prefs else [],
                "preferred_views": hotel_prefs.preferred_views if hotel_prefs else [],
            },
        }


@activity.defn
async def fetch_flights_activity(trip: TripDetails) -> FetchResult:
    """Fetch flight offers from configured flight provider or mock data."""
    travel_class = _map_cabin_class(trip["flight_prefs"]["cabin"])
    non_stop = trip["flight_prefs"]["stops_mode"] == "nonstop"
    provider_name = get_provider_name()

    # Use mock data if configured (only for Amadeus provider)
    if settings.mock_amadeus_api and provider_name == "amadeus":
        logger.info("Using mock Amadeus flights for trip_id=%s", trip["trip_id"])
        response = mock_flight_search(
            origin=trip["origin_airport"],
            destination=trip["destination_code"],
            departure_date=trip["depart_date"],
            return_date=trip["return_date"] if trip["is_round_trip"] else None,
            adults=trip["adults"],
            travel_class=travel_class,
            non_stop=non_stop,
        )
        offers = _extract_offers(response)
        return {
            "offers": offers,
            "raw": _normalize_raw(response, "amadeus_mock"),
            "error": None,
        }

    # Use configured flight provider
    logger.info(
        "Fetching flights for trip_id=%s via %s provider",
        trip["trip_id"],
        provider_name,
    )
    try:
        response = await _get_flight_provider().search_flights(
            origin=trip["origin_airport"],
            destination=trip["destination_code"],
            departure_date=trip["depart_date"],
            return_date=trip["return_date"] if trip["is_round_trip"] else None,
            adults=trip["adults"],
            travel_class=travel_class,
            non_stop=non_stop,
        )
    except AmadeusClientError as exc:
        logger.warning("Flight fetch failed for trip_id=%s", trip["trip_id"], exc_info=exc)
        return {
            "offers": [],
            "raw": {"status": "error", "provider": provider_name},
            "error": str(exc),
        }
    except Exception as exc:
        # Catch errors from other providers (e.g., GoogleFlightsError)
        logger.warning(
            "Flight fetch failed for trip_id=%s (provider=%s)",
            trip["trip_id"],
            provider_name,
            exc_info=exc,
        )
        return {
            "offers": [],
            "raw": {"status": "error", "provider": provider_name},
            "error": str(exc),
        }

    offers = _extract_offers(response)
    logger.info(
        "Fetched %d flight offers for trip_id=%s via %s",
        len(offers),
        trip["trip_id"],
        provider_name,
    )
    return {
        "offers": offers,
        "raw": _normalize_raw(response, provider_name),
        "error": None,
    }


def _map_cabin_class(cabin: str) -> str:
    """Map internal cabin class to Amadeus travelClass parameter."""
    return CABIN_CLASS_MAP.get(cabin.lower(), "ECONOMY")


@activity.defn
async def fetch_hotels_activity(trip: TripDetails) -> FetchResult:
    """Fetch hotel offers from Amadeus HTTP API or mock data."""
    if settings.mock_amadeus_api:
        logger.info("Using mock Amadeus hotels for trip_id=%s", trip["trip_id"])
        adults = trip["hotel_prefs"]["rooms"] * trip["hotel_prefs"]["adults_per_room"]
        response = mock_hotel_search(
            city_code=trip["destination_code"],
            check_in_date=trip["depart_date"],
            check_out_date=trip["return_date"],
            adults=adults,
            rooms=trip["hotel_prefs"]["rooms"],
        )
        offers = _extract_offers(response)
        return {
            "offers": offers,
            "raw": _normalize_raw(response, "amadeus_mock"),
            "error": None,
        }

    logger.info("Fetching hotels for trip_id=%s via Amadeus HTTP", trip["trip_id"])
    adults = trip["hotel_prefs"]["adults_per_room"]

    try:
        response = await _amadeus_client.search_hotels(
            city_code=trip["destination_code"],
            check_in_date=trip["depart_date"],
            check_out_date=trip["return_date"],
            adults=adults,
            rooms=trip["hotel_prefs"]["rooms"],
        )
    except AmadeusClientError as exc:
        logger.warning("Hotel fetch failed for trip_id=%s", trip["trip_id"], exc_info=exc)
        return {
            "offers": [],
            "raw": {"status": "error", "provider": "amadeus"},
            "error": str(exc),
        }

    offers = _extract_offers(response)
    logger.info("Fetched %d hotel offers for trip_id=%s", len(offers), trip["trip_id"])
    return {
        "offers": offers,
        "raw": _normalize_raw(response, "amadeus"),
        "error": None,
    }


@activity.defn
async def filter_results_activity(payload: FilterInput) -> FilterOutput:
    flights = _filter_flights(payload["flight_result"]["offers"], payload["flight_prefs"])
    hotels = _filter_hotels(payload["hotel_result"]["offers"], payload["hotel_prefs"])
    logger.info("Filtered results flights=%d hotels=%d", len(flights), len(hotels))
    if payload["flight_result"]["error"] or payload["hotel_result"]["error"]:
        logger.debug(
            "Filter input errors flight_error=%s hotel_error=%s",
            payload["flight_result"]["error"],
            payload["hotel_result"]["error"],
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
    logger.info("Saving price snapshot for trip_id=%s", payload["trip_id"])
    trip_uuid = uuid.UUID(payload["trip_id"])

    async with AsyncSessionLocal() as session:
        # Check for recent snapshots to prevent duplicates
        cutoff = datetime.utcnow() - timedelta(seconds=SNAPSHOT_DEDUP_WINDOW_SECONDS)
        existing_result = await session.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.trip_id == trip_uuid)
            .where(PriceSnapshot.created_at >= cutoff)
            .order_by(PriceSnapshot.created_at.desc())
            .limit(1)
        )
        recent_snapshot = existing_result.scalars().first()

        if recent_snapshot:
            seconds_ago = (datetime.utcnow() - recent_snapshot.created_at).total_seconds()

            # Check if recent snapshot contains errors - if so, allow retry with better data
            raw_data = recent_snapshot.raw_data or {}
            has_errors = bool(raw_data.get("errors"))

            if has_errors:
                logger.info(
                    "Recent snapshot %s had errors; allowing new snapshot for trip_id=%s",
                    recent_snapshot.id,
                    payload["trip_id"],
                )
            else:
                # Recent snapshot was successful - skip duplicate
                logger.warning(
                    "Skipping duplicate snapshot for trip_id=%s; existing snapshot_id=%s created %.1f seconds ago",
                    payload["trip_id"],
                    recent_snapshot.id,
                    seconds_ago,
                )
                return str(recent_snapshot.id)

        # Proceed with normal snapshot creation
        flight_price = _extract_min_price(payload["flights"])
        hotel_price = _extract_min_price(payload["hotels"])
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
        )

        snapshot = PriceSnapshot(
            trip_id=trip_uuid,
            flight_price=flight_price,
            hotel_price=hotel_price,
            total_price=total_price,
            raw_data=payload["raw_data"],
        )
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        logger.info(
            "Saved price snapshot for trip_id=%s snapshot_id=%s",
            payload["trip_id"],
            snapshot.id,
        )
        return str(snapshot.id)


def _extract_carrier_codes(flight: dict[str, Any]) -> list[str]:
    """Extract all carrier codes from a flight offer.

    Supports both Amadeus format (validatingAirlineCodes, itineraries.segments.carrierCode)
    and legacy formats (carrier, operating_carrier, airline).
    """
    carrier_codes: list[str] = []

    # Amadeus format: validatingAirlineCodes array
    validating_codes = flight.get("validatingAirlineCodes", [])
    if isinstance(validating_codes, list):
        carrier_codes.extend([str(code).upper() for code in validating_codes])

    # Amadeus format: extract from itinerary segments
    for itinerary in flight.get("itineraries", []):
        for segment in itinerary.get("segments", []):
            if segment.get("carrierCode"):
                carrier_codes.append(str(segment["carrierCode"]).upper())
            operating = segment.get("operating", {})
            if operating.get("carrierCode"):
                carrier_codes.append(str(operating["carrierCode"]).upper())

    # Legacy format fallback
    if not carrier_codes:
        carrier = flight.get("operating_carrier") or flight.get("carrier") or flight.get("airline")
        if isinstance(carrier, list):
            carrier_codes = [str(code).upper() for code in carrier]
        elif carrier:
            carrier_codes = [str(carrier).upper()]

    return carrier_codes


def _filter_flights(flights: list[dict[str, Any]], prefs: dict[str, Any]) -> list[dict[str, Any]]:
    """Filter flights by preferred airlines."""
    airlines = [code.upper() for code in prefs.get("airlines", []) if isinstance(code, str)]
    if not airlines:
        return flights

    return [flight for flight in flights if any(code in _extract_carrier_codes(flight) for code in airlines)]


def _filter_hotels(hotels: list[dict[str, Any]], prefs: dict[str, Any]) -> list[dict[str, Any]]:
    filtered = hotels
    preferred_room_types = [t.lower() for t in prefs.get("preferred_room_types", []) if isinstance(t, str)]
    if preferred_room_types:
        filtered = [room for room in filtered if _matches_keywords(room.get("description"), preferred_room_types)]

    preferred_views = [v.lower() for v in prefs.get("preferred_views", []) if isinstance(v, str)]
    if preferred_views:
        filtered = [room for room in filtered if _matches_view(room.get("description"), preferred_views)]

    return filtered


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
    prices: list[Decimal] = []
    for item in items:
        value = _extract_price_value(item)
        if value is not None:
            prices.append(value)
    return min(prices) if prices else None


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
    # Amadeus V3 hotel-offers: price is nested in offers[0].price.total
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
