import logging
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from app.db.session import AsyncSessionLocal
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from sqlmodel import select
from temporalio import activity

from worker.clients.mcp import build_amadeus_client, build_kiwi_client
from worker.types import FetchResult, FilterInput, FilterOutput, SaveSnapshotInput, TripDetails

logger = logging.getLogger(__name__)

VIEW_KEYWORDS = {
    "ocean": ["ocean", "sea", "water", "beach"],
    "city": ["city", "skyline", "urban"],
    "garden": ["garden", "courtyard", "pool"],
}

PRICE_FIELDS = ("price", "total_price", "amount")
NESTED_PRICE_FIELDS = ("total", "total_price", "amount", "grandTotal", "base")

KIWI_CLIENT = build_kiwi_client()
AMADEUS_CLIENT = build_amadeus_client()


@activity.defn
async def load_trip_details(trip_id: str) -> TripDetails:
    logger.info("Loading trip details for trip_id=%s", trip_id)
    async with AsyncSessionLocal() as session:
        trip = await session.get(Trip, uuid.UUID(trip_id))
        if not trip:
            logger.info("Trip not found for trip_id=%s", trip_id)
            raise ValueError(f"Trip not found for id={trip_id}")

        flight_prefs = (
            await session.execute(select(TripFlightPrefs).where(TripFlightPrefs.trip_id == trip.id))
        ).scalars().first()
        hotel_prefs = (
            await session.execute(select(TripHotelPrefs).where(TripHotelPrefs.trip_id == trip.id))
        ).scalars().first()

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
                "stops_mode": (
                    flight_prefs.stops_mode.value if flight_prefs else "any"
                ),
                "max_stops": flight_prefs.max_stops if flight_prefs else None,
                "cabin": flight_prefs.cabin.value if flight_prefs else "economy",
            },
            "hotel_prefs": {
                "rooms": hotel_prefs.rooms if hotel_prefs else 1,
                "adults_per_room": hotel_prefs.adults_per_room if hotel_prefs else 2,
                "room_selection_mode": (
                    hotel_prefs.room_selection_mode.value if hotel_prefs else "cheapest"
                ),
                "preferred_room_types": hotel_prefs.preferred_room_types if hotel_prefs else [],
                "preferred_views": hotel_prefs.preferred_views if hotel_prefs else [],
            },
        }


@activity.defn
async def fetch_flights_activity(trip: TripDetails) -> FetchResult:
    if not KIWI_CLIENT:
        logger.info(
            "Skipping flight fetch for trip_id=%s; Kiwi MCP server not configured",
            trip["trip_id"],
        )
        return {
            "offers": [],
            "raw": {"status": "not_configured", "provider": "kiwi"},
            "error": "Kiwi MCP server is not configured",
        }

    logger.info("Fetching flights for trip_id=%s", trip["trip_id"])
    args = {
        "flyFrom": trip["origin_airport"],
        "flyTo": trip["destination_code"],
        "departureDate": _format_kiwi_date(trip["depart_date"]),
        "adults": trip["adults"],
    }
    if trip["is_round_trip"]:
        args["returnDate"] = _format_kiwi_date(trip["return_date"])
    logger.debug("Flight search args for trip_id=%s: %s", trip["trip_id"], args)

    try:
        response = await KIWI_CLIENT.call_tool("search-flight", args)
    except Exception as exc:
        logger.warning("Flight fetch failed for trip_id=%s", trip["trip_id"], exc_info=exc)
        return {
            "offers": [],
            "raw": {"status": "error", "provider": "kiwi"},
            "error": str(exc),
        }

    offers = _extract_offers(response)
    logger.info("Fetched %d flight offers for trip_id=%s", len(offers), trip["trip_id"])
    return {
        "offers": offers,
        "raw": _normalize_raw(response, "kiwi"),
        "error": None,
    }


@activity.defn
async def fetch_hotels_activity(trip: TripDetails) -> FetchResult:
    if not AMADEUS_CLIENT:
        logger.info(
            "Skipping hotel fetch for trip_id=%s; Amadeus MCP server not configured",
            trip["trip_id"],
        )
        return {
            "offers": [],
            "raw": {"status": "not_configured", "provider": "amadeus"},
            "error": "Amadeus MCP server is not configured",
        }

    logger.info("Fetching hotels for trip_id=%s", trip["trip_id"])
    adults = trip["hotel_prefs"]["rooms"] * trip["hotel_prefs"]["adults_per_room"]
    args = {
        "cityCode": trip["destination_code"],
        "checkInDate": trip["depart_date"],
        "checkOutDate": trip["return_date"],
        "adults": adults,
        "rooms": trip["hotel_prefs"]["rooms"],
    }
    logger.debug("Hotel search args for trip_id=%s: %s", trip["trip_id"], args)

    try:
        response = await AMADEUS_CLIENT.call_tool("amadeus_hotel_search", args)
    except Exception as exc:
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


@activity.defn
async def save_snapshot_activity(payload: SaveSnapshotInput) -> str:
    logger.info("Saving price snapshot for trip_id=%s", payload["trip_id"])
    flight_price = _extract_min_price(payload["flights"])
    hotel_price = _extract_min_price(payload["hotels"])
    total_price = None
    if flight_price is not None and hotel_price is not None:
        total_price = flight_price + hotel_price
    logger.debug(
        "Snapshot prices for trip_id=%s flight=%s hotel=%s total=%s",
        payload["trip_id"],
        flight_price,
        hotel_price,
        total_price,
    )

    snapshot = PriceSnapshot(
        trip_id=uuid.UUID(payload["trip_id"]),
        flight_price=flight_price,
        hotel_price=hotel_price,
        total_price=total_price,
        raw_data=payload["raw_data"],
    )
    async with AsyncSessionLocal() as session:
        session.add(snapshot)
        await session.commit()
        await session.refresh(snapshot)
        logger.info(
            "Saved price snapshot for trip_id=%s snapshot_id=%s",
            payload["trip_id"],
            snapshot.id,
        )
        return str(snapshot.id)


def _filter_flights(flights: list[dict[str, Any]], prefs: dict[str, Any]) -> list[dict[str, Any]]:
    airlines = [code.upper() for code in prefs.get("airlines", []) if isinstance(code, str)]
    if not airlines:
        return flights

    filtered: list[dict[str, Any]] = []
    for flight in flights:
        carrier = flight.get("operating_carrier") or flight.get("carrier") or flight.get("airline")
        if isinstance(carrier, list):
            carriers = [str(code).upper() for code in carrier]
        elif carrier:
            carriers = [str(carrier).upper()]
        else:
            carriers = []

        if any(code in carriers for code in airlines):
            filtered.append(flight)

    return filtered


def _filter_hotels(hotels: list[dict[str, Any]], prefs: dict[str, Any]) -> list[dict[str, Any]]:
    filtered = hotels
    preferred_room_types = [t.lower() for t in prefs.get("preferred_room_types", []) if isinstance(t, str)]
    if preferred_room_types:
        filtered = [
            room
            for room in filtered
            if _matches_keywords(room.get("description"), preferred_room_types)
        ]

    preferred_views = [v.lower() for v in prefs.get("preferred_views", []) if isinstance(v, str)]
    if preferred_views:
        filtered = [
            room
            for room in filtered
            if _matches_view(room.get("description"), preferred_views)
        ]

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


def _extract_price_value(item: dict[str, Any]) -> Decimal | None:
    for field in PRICE_FIELDS:
        if field in item:
            value = item.get(field)
            if isinstance(value, dict):
                for nested in NESTED_PRICE_FIELDS:
                    if nested in value:
                        return _to_decimal(value.get(nested))
            return _to_decimal(value)
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


def _format_kiwi_date(value: str) -> str:
    year, month, day = value.split("-")
    return f"{day}/{month}/{year}"
