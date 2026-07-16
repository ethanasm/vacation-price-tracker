import logging
import uuid
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from temporalio import client as temporal_client
from temporalio import exceptions as temporal_exceptions

from app.clients.skiplagged_parser import parse_flight_segments
from app.core.airlines import airline_display_name
from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.config import settings
from app.core.constants import TripStatus
from app.core.errors import (
    ConflictError,
    DuplicateTripName,
    PriceCheckWorkflowStartFailed,
    RefreshGroupNotFound,
    RefreshInProgress,
    RefreshWorkflowStartFailed,
    TemporalServiceError,
    TripLimitExceeded,
    TripNotFound,
)
from app.db.deps import get_db
from app.db.redis import redis_client
from app.models.notification_rule import NotificationRule
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.trip_prefs import TripFlightPrefs, TripHotelPrefs
from app.routers.auth import UserResponse, get_current_user
from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.trip import (
    BulkDeleteResponse,
    FlightItinerary,
    FlightOffer,
    FlightPrefs,
    FlightSegment,
    HotelOffer,
    HotelPrefs,
    NotificationPrefs,
    PriceSnapshotResponse,
    RefreshStartResponse,
    RefreshStatusResponse,
    TripCreate,
    TripDetail,
    TripDetailResponse,
    TripResponse,
    TripStatusUpdate,
    TripUpdate,
)
from app.services.temporal import (
    get_refresh_progress,
    start_refresh_all_workflow,
    trigger_price_check_workflow,
)

logger = logging.getLogger(__name__)

router = APIRouter()

def _pagination_meta(page: int, limit: int, total: int) -> dict:
    total_pages = (total + limit - 1) // limit if total else 0
    return PaginationMeta(page=page, limit=limit, total=total, total_pages=total_pages).model_dump()


def _flight_prefs_to_schema(prefs: TripFlightPrefs | None) -> FlightPrefs | None:
    if not prefs:
        return None
    return FlightPrefs(
        airlines=prefs.airlines,
        stops_mode=prefs.stops_mode,
        max_stops=prefs.max_stops,
        cabin=prefs.cabin,
    )


def _hotel_prefs_to_schema(prefs: TripHotelPrefs | None) -> HotelPrefs | None:
    if not prefs:
        return None
    return HotelPrefs(
        rooms=prefs.rooms,
        adults_per_room=prefs.adults_per_room,
        city=prefs.city,
        room_selection_mode=prefs.room_selection_mode,
        preferred_room_types=prefs.preferred_room_types,
        preferred_views=prefs.preferred_views,
        min_star_rating=prefs.min_star_rating,
    )


def _notification_prefs_to_schema(prefs: NotificationRule | None) -> NotificationPrefs | None:
    if not prefs:
        return None
    return NotificationPrefs(
        threshold_type=prefs.threshold_type,
        threshold_value=prefs.threshold_value,
        notify_without_threshold=prefs.notify_without_threshold,
        email_enabled=prefs.email_enabled,
        sms_enabled=prefs.sms_enabled,
    )


def _build_trip_response(trip: Trip, snapshot: PriceSnapshot | None) -> TripResponse:
    return TripResponse(
        id=trip.id,
        name=trip.name,
        origin_airport=trip.origin_airport,
        destination_code=trip.destination_code,
        depart_date=trip.depart_date,
        return_date=trip.return_date,
        status=trip.status,
        track_flights=trip.track_flights,
        track_hotels=trip.track_hotels,
        current_flight_price=snapshot.flight_price if snapshot else None,
        current_hotel_price=snapshot.hotel_price if snapshot else None,
        total_price=snapshot.total_price if snapshot else None,
        last_refreshed=snapshot.created_at if snapshot else None,
    )


def _build_trip_detail(
    trip: Trip,
    snapshot: PriceSnapshot | None,
    flight_prefs: TripFlightPrefs | None,
    hotel_prefs: TripHotelPrefs | None,
    notification_rule: NotificationRule | None,
) -> TripDetail:
    return TripDetail(
        **_build_trip_response(trip, snapshot).model_dump(),
        is_round_trip=trip.is_round_trip,
        adults=trip.adults,
        flight_prefs=_flight_prefs_to_schema(flight_prefs),
        hotel_prefs=_hotel_prefs_to_schema(hotel_prefs),
        notification_prefs=_notification_prefs_to_schema(notification_rule),
        created_at=trip.created_at,
        updated_at=trip.updated_at,
    )


async def _get_latest_snapshot(db: AsyncSession, trip_id: uuid.UUID) -> PriceSnapshot | None:
    result = await db.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.trip_id == trip_id)
        .order_by(PriceSnapshot.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


def _extract_price(item: dict) -> str | None:
    """Extract price from various API response formats."""
    if "price" in item:
        price_val = item["price"]
        if isinstance(price_val, dict):
            # `amount` may legitimately be 0 — use an explicit None check so a
            # zero price isn't silently swallowed by an `or` and mistaken for a
            # missing one. `_coerce_positive_price` rejects the zero downstream.
            # `amount` is authoritative: a present `amount` (even 0) intentionally
            # shadows `total`; `total` is only the fallback when `amount` is
            # absent. Don't "fix" this into an `amount or total` fallback — that
            # reintroduces the falsy-zero bug this change exists to kill.
            amount = price_val.get("amount")
            return amount if amount is not None else price_val.get("total")
        return str(price_val)
    if "total_price" in item:
        return str(item["total_price"])
    # Hotel offers may nest cheapest room pricing
    rooms = item.get("rooms")
    if isinstance(rooms, list) and rooms:
        prices = [r.get("price_total") for r in rooms if isinstance(r, dict) and r.get("price_total") is not None]
        if prices:
            return str(min(prices))
    return None


def _coerce_positive_price(raw: object) -> Decimal | None:
    """Coerce an extracted price to a positive Decimal, else None.

    A missing, unparseable, zero, or negative price means the provider returned
    an unpriced/degraded offer (e.g. Skiplagged occasionally returns itineraries
    with ``amount: 0``). Such offers must not render as a real $0 fare, so they
    are dropped from the offer list.
    """
    if raw is None:
        return None
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, ValueError, TypeError):
        return None
    return value if value > 0 else None


def _parse_skiplagged_trip_segments(flight_id: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Parse a Skiplagged flight ID into outbound and return segment tuples.

    Delegates to the canonical parser in skiplagged_parser.py and converts
    SkiplaggedFlightSegment objects to (carrier_code, flight_number) tuples.
    """
    outbound, ret = parse_flight_segments(flight_id)
    return (
        [(s.carrier_code, s.flight_number) for s in outbound],
        [(s.carrier_code, s.flight_number) for s in ret],
    )


def _opt_str(value: object) -> str | None:
    """Coerce a provider-native value to str, preserving None.

    Kiwi raw payloads are stored in snapshots as-is; a field that arrives as a
    number (e.g. a bare flight number) must not fail FlightSegment's str-typed
    validation and 500 the whole trip-detail response.
    """
    return None if value is None else str(value)


def _flight_designator(carrier: object, number: object) -> str | None:
    """Normalize a provider flight number to the full designator ("AS3361").

    `flight_number` is contractually the carrier-prefixed designator on every
    provider path: Skiplagged ids parse into f"{code}{num}", and Kiwi usually
    sends "AS3361" but has been observed sending a bare number. Provider
    quirks are normalized here at the source so clients render flight_number
    as-is and never concatenate carrier_code themselves (which double-prefixes
    to "AS AS3361"). A bare number is only prefixed when the carrier looks
    like a real IATA designator (2-3 chars, at least one letter).
    """
    num = (_opt_str(number) or "").strip()
    if not num:
        return None
    code = (_opt_str(carrier) or "").strip().upper()
    looks_iata = 2 <= len(code) <= 3 and any(ch.isalpha() for ch in code)
    if num[0].isdigit() and looks_iata:
        return f"{code}{num}"
    return num


def _parse_kiwi_itinerary(direction: str, leg: dict) -> FlightItinerary:
    """Build a FlightItinerary from a Kiwi structured leg (outbound/inbound).

    Kiwi exposes full per-segment detail (carrier, flight number, airports,
    times, durations), so unlike Skiplagged every segment gets real timestamps.
    """
    segments: list[FlightSegment] = []
    for seg in leg.get("segments") or []:
        if not isinstance(seg, dict):
            continue
        duration_seconds = seg.get("durationSeconds")
        segments.append(FlightSegment(
            carrier_code=_opt_str(seg.get("carrier")),
            flight_number=_flight_designator(seg.get("carrier"), seg.get("flightNumber")),
            departure_airport=_opt_str(seg.get("from")),
            arrival_airport=_opt_str(seg.get("to")),
            departure_time=_opt_str(seg.get("departureTime")),
            arrival_time=_opt_str(seg.get("arrivalTime")),
            duration_minutes=int(duration_seconds) // 60
            if isinstance(duration_seconds, (int, float))
            else None,
        ))
    total_seconds = leg.get("durationSeconds")
    stops = leg.get("stops")
    return FlightItinerary(
        direction=direction,
        segments=segments,
        total_duration_minutes=int(total_seconds) // 60
        if isinstance(total_seconds, (int, float))
        else None,
        stops=stops if isinstance(stops, int) else max(0, len(segments) - 1),
    )


def _parse_kiwi_flight_offer(item: dict, index: int) -> FlightOffer | None:
    """Parse a Kiwi-shaped flight offer (structured outbound/inbound legs)."""
    price = _coerce_positive_price(_extract_price(item))
    if price is None:
        return None

    outbound = item.get("outbound") if isinstance(item.get("outbound"), dict) else {}
    inbound = item.get("inbound") if isinstance(item.get("inbound"), dict) else None

    itineraries: list[FlightItinerary] = []
    if outbound.get("segments"):
        itineraries.append(_parse_kiwi_itinerary("outbound", outbound))
    if inbound and inbound.get("segments"):
        itineraries.append(_parse_kiwi_itinerary("return", inbound))

    out_segments = outbound.get("segments") or []
    first_seg = out_segments[0] if isinstance(out_segments, list) and out_segments and isinstance(out_segments[0], dict) else {}
    carrier_code = _opt_str(item.get("carrier_code") or first_seg.get("carrier"))

    return_flight_payload = None
    if inbound:
        in_segments = inbound.get("segments") or []
        in_first = in_segments[0] if isinstance(in_segments, list) and in_segments and isinstance(in_segments[0], dict) else {}
        in_duration = inbound.get("durationSeconds")
        return_flight_payload = {
            "flight_number": _flight_designator(in_first.get("carrier"), in_first.get("flightNumber")),
            "departure_time": _opt_str(inbound.get("departureTime")),
            "arrival_time": _opt_str(inbound.get("arrivalTime")),
            "duration_minutes": int(in_duration) // 60
            if isinstance(in_duration, (int, float))
            else None,
            "stops": inbound.get("stops", 0),
        }

    out_duration = outbound.get("durationSeconds")
    return FlightOffer(
        id=str(item.get("id") or index),
        airline_code=carrier_code,
        flight_number=_flight_designator(
            first_seg.get("carrier") or carrier_code,
            first_seg.get("flightNumber") or item.get("flight_number"),
        ),
        airline_name=_opt_str(item.get("airlines")) or airline_display_name(carrier_code),
        price=price,
        departure_time=_opt_str(item.get("departure_time") or outbound.get("departureTime")),
        arrival_time=_opt_str(item.get("arrival_time") or outbound.get("arrivalTime")),
        duration_minutes=item.get("duration_minutes")
        or (int(out_duration) // 60 if isinstance(out_duration, (int, float)) else None),
        stops=item.get("stops", outbound.get("stops", 0) or 0),
        return_flight=return_flight_payload,
        itineraries=itineraries,
    )


def _parse_kiwi_flight_offer_safe(item: dict, index: int) -> FlightOffer | None:
    """Parse a Kiwi offer, dropping (not raising on) malformed stored data.

    Snapshots persist provider payloads as-is; one bad offer must drop just
    that offer, never 500 the whole trip-detail response.
    """
    try:
        return _parse_kiwi_flight_offer(item, index)
    except Exception:  # noqa: BLE001 - one bad snapshot offer must not sink the response
        logger.warning(
            "Skipping unparseable Kiwi flight offer at index %d",
            index,
            extra={"event": "trips.kiwi_offer.unparseable", "offer_index": index},
        )
        return None


def _parse_fast_flights_itinerary(segments: list) -> FlightItinerary:
    """Build the outbound FlightItinerary from fast-flights structured segments.

    fast-flights exposes airports, times, and durations per segment but no
    flight numbers (Google's payload carries airline identity at itinerary
    level only), so ``flight_number`` is absent on this provider's segments.
    """
    parsed: list[FlightSegment] = []
    total_minutes = 0
    have_all_durations = True
    for seg in segments:
        if not isinstance(seg, dict):
            continue
        duration = seg.get("durationMinutes")
        if isinstance(duration, int):
            total_minutes += duration
        else:
            have_all_durations = False
        parsed.append(FlightSegment(
            carrier_code=_opt_str(seg.get("carrier")),
            flight_number=None,
            departure_airport=_opt_str(seg.get("from")),
            arrival_airport=_opt_str(seg.get("to")),
            departure_time=_opt_str(seg.get("departureTime")),
            arrival_time=_opt_str(seg.get("arrivalTime")),
            duration_minutes=duration if isinstance(duration, int) else None,
        ))
    return FlightItinerary(
        direction="outbound",
        segments=parsed,
        total_duration_minutes=total_minutes if parsed and have_all_durations else None,
        stops=max(0, len(parsed) - 1),
    )


def _parse_fast_flights_offer(item: dict, index: int) -> FlightOffer | None:
    """Parse a fast-flights-shaped offer (structured ``segments`` list).

    Round-trip snapshots from this provider list outbound options only, with
    the round-trip total as the price — there is no return-leg payload.
    """
    price = _coerce_positive_price(_extract_price(item))
    if price is None:
        return None

    segments = item.get("segments") if isinstance(item.get("segments"), list) else []
    itinerary = _parse_fast_flights_itinerary(segments)

    carrier_codes = item.get("carrier_codes")
    first_code = None
    if isinstance(carrier_codes, list) and carrier_codes:
        first_code = _opt_str(carrier_codes[0])
    airline_names = item.get("airline_names")
    airline_name = (
        ", ".join(str(n) for n in airline_names)
        if isinstance(airline_names, list) and airline_names
        else _opt_str(item.get("airlines")) or airline_display_name(first_code)
    )

    total_duration = item.get("duration_minutes")
    return FlightOffer(
        id=str(item.get("id") or index),
        airline_code=first_code or _opt_str(item.get("carrier_code")),
        flight_number=None,
        airline_name=airline_name,
        price=price,
        departure_time=_opt_str(item.get("departure_time")),
        arrival_time=_opt_str(item.get("arrival_time")),
        duration_minutes=total_duration
        if isinstance(total_duration, int)
        else itinerary.total_duration_minutes,
        stops=item.get("stops") if isinstance(item.get("stops"), int) else itinerary.stops,
        return_flight=None,
        itineraries=[itinerary] if itinerary.segments else [],
    )


def _parse_fast_flights_offer_safe(item: dict, index: int) -> FlightOffer | None:
    """Parse a fast-flights offer, dropping (not raising on) malformed stored data."""
    try:
        return _parse_fast_flights_offer(item, index)
    except Exception:  # noqa: BLE001 - one bad snapshot offer must not sink the response
        logger.warning(
            "Skipping unparseable fast-flights offer at index %d",
            index,
            extra={"event": "trips.fast_flights_offer.unparseable", "offer_index": index},
        )
        return None


def _parse_flight_offer(item: dict, index: int, flights_data: dict) -> FlightOffer | None:
    """Parse a single Skiplagged-shaped flight offer from raw data.

    Skiplagged offers have flattened fields:
        id, airlines, carrier_code, departure_airport, arrival_airport,
        departure_time, arrival_time, duration_minutes, stops, price,
        price_currency, booking_link, provider

    Flight numbers are embedded in the id field (e.g., "trip=AC744-LH6825,TS251").
    """
    if not isinstance(item, dict):
        return None

    # fast-flights offers carry a flat structured ``segments`` list.
    if item.get("provider") == "fast_flights":
        return _parse_fast_flights_offer_safe(item, index)

    # Kiwi offers carry structured outbound/inbound legs with full segment
    # data — no flight-id string parsing needed.
    if item.get("provider") == "kiwi" or isinstance(item.get("outbound"), dict):
        return _parse_kiwi_flight_offer_safe(item, index)

    price = _coerce_positive_price(_extract_price(item))
    if price is None:
        return None

    flight_id = item.get("id") or str(index)
    outbound_segs, return_segs = _parse_skiplagged_trip_segments(str(flight_id))

    # Primary flight number from first outbound segment
    first_flight_number = None
    if outbound_segs:
        code, num = outbound_segs[0]
        first_flight_number = f"{code}{num}"

    # Build full itineraries from parsed segments + endpoint data
    itineraries: list[FlightItinerary] = []
    if outbound_segs:
        itineraries.append(_build_skiplagged_itinerary(
            direction="outbound",
            parsed_segs=outbound_segs,
            departure_airport=item.get("departure_airport"),
            arrival_airport=item.get("arrival_airport"),
            departure_time=item.get("departure_time"),
            arrival_time=item.get("arrival_time"),
            duration_minutes=item.get("duration_minutes"),
        ))

    return_flight_payload = None
    if return_segs:
        return_flight_payload, return_itinerary = _build_skiplagged_return(item, return_segs)
        itineraries.append(return_itinerary)

    return FlightOffer(
        id=str(flight_id),
        airline_code=item.get("carrier_code") or (outbound_segs[0][0] if outbound_segs else None),
        flight_number=first_flight_number or item.get("flight_number"),
        airline_name=item.get("airlines") or item.get("airline_name"),
        price=price,
        departure_time=item.get("departure_time"),
        arrival_time=item.get("arrival_time"),
        duration_minutes=item.get("duration_minutes"),
        stops=item.get("stops", 0),
        return_flight=return_flight_payload,
        itineraries=itineraries,
    )


def _build_skiplagged_return(
    item: dict, return_segs: list[tuple[str, str]]
) -> tuple[dict, FlightItinerary]:
    """Build the return-leg payload + itinerary for a Skiplagged-shaped offer."""
    return_raw = item.get("return_flight") or item.get("returnFlight") or {}
    if not isinstance(return_raw, dict):
        return_raw = {}
    # Skiplagged nests times under departure/arrival sub-dicts
    if "departure" in return_raw and isinstance(return_raw["departure"], dict):
        return_raw.setdefault("departure_time", return_raw["departure"].get("dateTime"))
        return_raw.setdefault("departure_airport", return_raw["departure"].get("airport"))
    if "arrival" in return_raw and isinstance(return_raw["arrival"], dict):
        return_raw.setdefault("arrival_time", return_raw["arrival"].get("dateTime"))
        return_raw.setdefault("arrival_airport", return_raw["arrival"].get("airport"))
    return_code, return_num = return_segs[0]
    return_flight_payload = {
        "flight_number": f"{return_code}{return_num}",
        "departure_time": return_raw.get("departure_time"),
        "arrival_time": return_raw.get("arrival_time"),
        "duration_minutes": return_raw.get("duration_minutes"),
        "stops": max(0, len(return_segs) - 1),
    }
    return_itinerary = _build_skiplagged_itinerary(
        direction="return",
        parsed_segs=return_segs,
        departure_airport=return_raw.get("departure_airport"),
        arrival_airport=return_raw.get("arrival_airport"),
        departure_time=return_raw.get("departure_time"),
        arrival_time=return_raw.get("arrival_time"),
        duration_minutes=return_raw.get("duration_minutes"),
    )
    return return_flight_payload, return_itinerary


def _build_skiplagged_itinerary(
    *,
    direction: str,
    parsed_segs: list[tuple[str, str]],
    departure_airport: str | None,
    arrival_airport: str | None,
    departure_time: str | None,
    arrival_time: str | None,
    duration_minutes: int | None,
) -> FlightItinerary:
    """Build a FlightItinerary from parsed segment codes and endpoint data.

    Skiplagged exposes endpoint-level times only; intermediate segments are
    represented without precise timestamps (None) since the API doesn't surface them.
    """
    segments: list[FlightSegment] = []
    n = len(parsed_segs)
    for i, (code, num) in enumerate(parsed_segs):
        is_first = i == 0
        is_last = i == n - 1
        segments.append(FlightSegment(
            carrier_code=code,
            flight_number=f"{code}{num}",
            departure_airport=departure_airport if is_first else None,
            arrival_airport=arrival_airport if is_last else None,
            departure_time=departure_time if is_first else None,
            arrival_time=arrival_time if is_last else None,
            duration_minutes=duration_minutes if n == 1 else None,
        ))
    return FlightItinerary(
        direction=direction,
        segments=segments,
        total_duration_minutes=duration_minutes,
        stops=max(0, n - 1),
    )


def _parse_hotel_offer(item: dict, index: int) -> HotelOffer | None:
    """Parse a single Skiplagged-shaped hotel offer from raw data.

    Hotel offers include rooms array with per-room pricing; we take the cheapest
    room total as the representative price.
    """
    if not isinstance(item, dict):
        return None
    price = _coerce_positive_price(_extract_price(item))
    if price is None:
        return None
    # Description: concatenate room titles if present, else fallback to top-level fields
    description = item.get("description")
    if not description:
        rooms = item.get("rooms")
        if isinstance(rooms, list) and rooms:
            titles = [r.get("title") for r in rooms if isinstance(r, dict) and r.get("title")]
            if titles:
                description = ", ".join(titles[:3])
    return HotelOffer(
        id=str(item.get("id") or item.get("hotelId") or index),
        name=item.get("name") or item.get("hotelName", f"Hotel {index + 1}"),
        price=price,
        rating=item.get("rating") or item.get("star_rating"),
        address=item.get("address") or item.get("location"),
        description=description,
    )


def _snapshot_to_response(snapshot: PriceSnapshot) -> PriceSnapshotResponse:
    """Convert a snapshot to response, extracting offers from raw_data."""
    raw = snapshot.raw_data or {}

    # Extract flight offers
    flight_offers: list[FlightOffer] = []
    flights_data = raw.get("flights", {})
    if isinstance(flights_data, dict):
        flight_list = flights_data.get("data") or flights_data.get("offers") or []
        for i, item in enumerate(flight_list):
            offer = _parse_flight_offer(item, i, flights_data)
            if offer:
                flight_offers.append(offer)

    # Extract hotel offers
    hotel_offers: list[HotelOffer] = []
    hotels_data = raw.get("hotels", {})
    if isinstance(hotels_data, dict):
        hotel_list = hotels_data.get("data") or hotels_data.get("offers") or []
        for i, item in enumerate(hotel_list):
            offer = _parse_hotel_offer(item, i)
            if offer:
                hotel_offers.append(offer)

    # Rows predating the provider column fall back to the marker the worker
    # has always stamped into raw_data["flights"]["provider"].
    provider = snapshot.provider
    if provider is None and isinstance(flights_data, dict):
        raw_provider = flights_data.get("provider")
        provider = raw_provider if isinstance(raw_provider, str) else None

    return PriceSnapshotResponse(
        id=snapshot.id,
        flight_price=snapshot.flight_price,
        hotel_price=snapshot.hotel_price,
        total_price=snapshot.total_price,
        created_at=snapshot.created_at,
        provider=provider,
        flight_offers=flight_offers,
        hotel_offers=hotel_offers,
    )


@router.get("/v1/trips", response_model=APIResponse[list[TripResponse]])
async def list_trips(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status_filter: TripStatus | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """List trips for the current user with latest snapshot prices."""
    user_id = uuid.UUID(current_user.id)

    count_stmt = select(func.count()).select_from(Trip).where(Trip.user_id == user_id)
    if status_filter:
        count_stmt = count_stmt.where(Trip.status == status_filter)
    total = (await db.execute(count_stmt)).scalar_one()

    latest_snapshot_at = (
        select(
            PriceSnapshot.trip_id,
            func.max(PriceSnapshot.created_at).label("latest_created_at"),
        )
        .group_by(PriceSnapshot.trip_id)
        .subquery()
    )
    latest_snapshot = aliased(PriceSnapshot)

    stmt = (
        select(Trip, latest_snapshot)
        .outerjoin(latest_snapshot_at, latest_snapshot_at.c.trip_id == Trip.id)
        .outerjoin(
            latest_snapshot,
            (latest_snapshot.trip_id == Trip.id)
            & (latest_snapshot.created_at == latest_snapshot_at.c.latest_created_at),
        )
        .where(Trip.user_id == user_id)
        .order_by(Trip.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(Trip.status == status_filter)

    rows = (await db.execute(stmt)).all()
    trips = [_build_trip_response(trip, snapshot) for trip, snapshot in rows]

    return APIResponse(
        data=trips,
        meta=_pagination_meta(page, limit, total),
    )


@router.post("/v1/trips", status_code=status.HTTP_201_CREATED, response_model=APIResponse[TripDetail])
async def create_trip(
    payload: TripCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Create a new trip for the current user."""

    user_id = uuid.UUID(current_user.id)

    count_stmt = select(func.count()).select_from(Trip).where(Trip.user_id == user_id)
    trip_count = (await db.execute(count_stmt)).scalar_one()
    if trip_count >= settings.max_trips_per_user:
        raise TripLimitExceeded()

    existing = await db.execute(
        select(Trip.id).where(Trip.user_id == user_id, Trip.name == payload.name)
    )
    if existing.first():
        raise DuplicateTripName()

    trip = Trip(
        user_id=user_id,
        name=payload.name,
        origin_airport=payload.origin_airport,
        destination_code=payload.destination_code,
        is_round_trip=payload.is_round_trip,
        depart_date=payload.depart_date,
        return_date=payload.return_date,
        adults=payload.adults,
        track_flights=payload.track_flights,
        track_hotels=payload.track_hotels,
    )
    db.add(trip)
    await db.flush()

    flight_prefs = None
    if payload.track_flights and payload.flight_prefs:
        flight_prefs = TripFlightPrefs(trip_id=trip.id, **payload.flight_prefs.model_dump())
        db.add(flight_prefs)

    hotel_prefs = None
    if payload.track_hotels and payload.hotel_prefs:
        hotel_prefs = TripHotelPrefs(trip_id=trip.id, **payload.hotel_prefs.model_dump())
        db.add(hotel_prefs)

    notification_rule = NotificationRule(trip_id=trip.id, **payload.notification_prefs.model_dump())
    db.add(notification_rule)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Trip could not be created.") from exc

    await db.refresh(trip)
    try:
        await trigger_price_check_workflow(trip.id)
    except PriceCheckWorkflowStartFailed:
        trip.status = TripStatus.ERROR
        await db.commit()
        raise

    detail = _build_trip_detail(trip, None, flight_prefs, hotel_prefs, notification_rule)
    return APIResponse(data=detail)


async def _upsert_prefs(db: AsyncSession, model_cls, trip_id: uuid.UUID, payload_prefs):
    """Load existing prefs row and upsert with new data, or create if missing."""
    row = (
        await db.execute(select(model_cls).where(model_cls.trip_id == trip_id))
    ).scalars().first()
    if payload_prefs is None:
        return row
    prefs_data = payload_prefs.model_dump()
    if row:
        for k, v in prefs_data.items():
            setattr(row, k, v)
    else:
        row = model_cls(trip_id=trip_id, **prefs_data)
        db.add(row)
    return row


_TRIP_UPDATE_FIELDS = {
    "name", "origin_airport", "destination_code", "is_round_trip",
    "depart_date", "return_date", "adults", "track_flights", "track_hotels",
}


@router.patch("/v1/trips/{trip_id}", response_model=APIResponse[TripDetail])
async def update_trip(
    trip_id: uuid.UUID,
    payload: TripUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update an existing trip's details, preferences, and notifications."""
    user_id = uuid.UUID(current_user.id)
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))
    trip = result.scalars().first()
    if not trip:
        raise TripNotFound()

    if payload.name is not None and payload.name != trip.name:
        existing = await db.execute(
            select(Trip.id).where(Trip.user_id == user_id, Trip.name == payload.name)
        )
        if existing.first():
            raise DuplicateTripName()

    for field in _TRIP_UPDATE_FIELDS:
        value = getattr(payload, field, None)
        if value is not None:
            setattr(trip, field, value)
    if payload.is_round_trip is False:
        trip.return_date = None

    flight_prefs_row = await _upsert_prefs(db, TripFlightPrefs, trip.id, payload.flight_prefs)
    hotel_prefs_row = await _upsert_prefs(db, TripHotelPrefs, trip.id, payload.hotel_prefs)
    notification_row = await _upsert_prefs(db, NotificationRule, trip.id, payload.notification_prefs)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError("Trip could not be updated.") from exc

    await db.refresh(trip)

    snapshot = await _get_latest_snapshot(db, trip.id)
    detail = _build_trip_detail(trip, snapshot, flight_prefs_row, hotel_prefs_row, notification_row)
    return APIResponse(data=detail)


@router.post("/v1/trips/refresh-all", response_model=APIResponse[RefreshStartResponse])
async def refresh_all_trips(
    current_user: UserResponse = Depends(get_current_user),
):
    """Trigger a manual refresh for all active trips."""
    user_id = uuid.UUID(current_user.id)
    refresh_group_id = f"refresh-{uuid.uuid4()}"
    lock_key = CacheKeys.refresh_lock(str(user_id))

    lock_set = await redis_client.set(
        lock_key,
        refresh_group_id,
        ex=CacheTTL.REFRESH_LOCK,
        nx=True,
    )
    if not lock_set:
        existing = await redis_client.get(lock_key)
        if isinstance(existing, (bytes, bytearray)):
            existing = existing.decode("utf-8")
        detail = "Refresh already in progress."
        if existing:
            detail = f"{detail} (refresh_group_id={existing})"
        raise RefreshInProgress(detail, extra={"refresh_group_id": existing})

    try:
        await start_refresh_all_workflow(user_id, refresh_group_id)
    except temporal_exceptions.WorkflowAlreadyStartedError as exc:
        await redis_client.delete(lock_key)
        raise RefreshInProgress("Refresh workflow already started.") from exc
    except Exception as exc:
        await redis_client.delete(lock_key)
        raise RefreshWorkflowStartFailed() from exc

    return APIResponse(data=RefreshStartResponse(refresh_group_id=refresh_group_id))


@router.get("/v1/trips/refresh-status", response_model=APIResponse[RefreshStatusResponse])
async def refresh_status(
    refresh_group_id: str = Query(..., min_length=1),
    current_user: UserResponse = Depends(get_current_user),
):
    """Check refresh workflow progress."""
    user_id = uuid.UUID(current_user.id)

    try:
        progress = await get_refresh_progress(refresh_group_id)
    except temporal_client.RPCError as exc:
        if exc.status == temporal_client.RPCStatusCode.NOT_FOUND:
            raise RefreshGroupNotFound() from exc
        raise TemporalServiceError("Failed to fetch refresh status.") from exc

    if progress["status"] in {"completed", "failed", "canceled", "terminated", "timed_out"}:
        await redis_client.delete(CacheKeys.refresh_lock(str(user_id)))

    return APIResponse(data=RefreshStatusResponse(refresh_group_id=refresh_group_id, **progress))


@router.get("/v1/trips/{trip_id}", response_model=APIResponse[TripDetailResponse])
async def get_trip_details(
    trip_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get trip details including prefs, notification rules, and price history."""
    user_id = uuid.UUID(current_user.id)
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))
    trip = result.scalars().first()
    if not trip:
        raise TripNotFound()

    flight_prefs = (
        await db.execute(select(TripFlightPrefs).where(TripFlightPrefs.trip_id == trip_id))
    ).scalars().first()
    hotel_prefs = (
        await db.execute(select(TripHotelPrefs).where(TripHotelPrefs.trip_id == trip_id))
    ).scalars().first()
    notification_rule = (
        await db.execute(select(NotificationRule).where(NotificationRule.trip_id == trip_id))
    ).scalars().first()

    total_snapshots = (
        await db.execute(
            select(func.count()).select_from(PriceSnapshot).where(PriceSnapshot.trip_id == trip_id)
        )
    ).scalar_one()
    snapshots = (
        await db.execute(
            select(PriceSnapshot)
            .where(PriceSnapshot.trip_id == trip_id)
            .order_by(PriceSnapshot.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).scalars().all()

    latest_snapshot = await _get_latest_snapshot(db, trip_id)
    detail = _build_trip_detail(trip, latest_snapshot, flight_prefs, hotel_prefs, notification_rule)

    data = TripDetailResponse(
        trip=detail,
        price_history=[_snapshot_to_response(snapshot) for snapshot in snapshots],
    )
    return APIResponse(
        data=data,
        meta=_pagination_meta(page, limit, total_snapshots),
    )


@router.delete("/v1/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete a trip and all associated records."""
    user_id = uuid.UUID(current_user.id)
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))
    trip = result.scalars().first()
    if not trip:
        raise TripNotFound()

    await db.delete(trip)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/v1/trips", response_model=APIResponse[BulkDeleteResponse])
async def delete_all_trips(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete all trips for the current user."""
    user_id = uuid.UUID(current_user.id)
    result = await db.execute(select(Trip).where(Trip.user_id == user_id))
    trips = result.scalars().all()

    for trip in trips:
        await db.delete(trip)

    await db.commit()
    return APIResponse(data=BulkDeleteResponse(deleted_count=len(trips)))


@router.patch("/v1/trips/{trip_id}/status", response_model=APIResponse[TripResponse])
async def update_trip_status(
    trip_id: uuid.UUID,
    payload: TripStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Pause or resume trip tracking."""
    user_id = uuid.UUID(current_user.id)
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))
    trip = result.scalars().first()
    if not trip:
        raise TripNotFound()

    trip.status = payload.status
    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    latest_snapshot = await _get_latest_snapshot(db, trip_id)
    return APIResponse(data=_build_trip_response(trip, latest_snapshot))


@router.post("/v1/trips/{trip_id}/refresh", response_model=APIResponse[RefreshStartResponse])
async def refresh_trip(
    trip_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Trigger a manual price refresh for a single trip."""
    user_id = uuid.UUID(current_user.id)
    result = await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))
    trip = result.scalars().first()
    if not trip:
        raise TripNotFound()

    # Return the real workflow id so the UI can poll `/v1/trips/refresh-status`
    # and see whether the run succeeded, is pending, or failed upstream.
    refresh_group_id = f"price-check-{trip_id}"

    try:
        await trigger_price_check_workflow(trip_id)
    except PriceCheckWorkflowStartFailed:
        raise

    return APIResponse(data=RefreshStartResponse(refresh_group_id=refresh_group_id))
