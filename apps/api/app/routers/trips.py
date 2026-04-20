import re
import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from temporalio import client as temporal_client
from temporalio import exceptions as temporal_exceptions

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
)
from app.services.temporal import (
    get_refresh_progress,
    start_refresh_all_workflow,
    trigger_price_check_workflow,
)

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
            return price_val.get("amount") or price_val.get("total")
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


def _parse_skiplagged_segment_id(segment_raw: str) -> tuple[str | None, str | None]:
    """Parse a segment string like 'AF81' or 'AC744~' into (carrier_code, flight_number)."""
    cleaned = segment_raw.strip().rstrip("~")
    if not cleaned:
        return None, None
    match = re.match(r"^([A-Z]{2,3})(\d+)$", cleaned)
    if not match:
        return None, None
    return match.group(1), match.group(2)


def _parse_skiplagged_trip_segments(flight_id: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Parse a Skiplagged flight ID into outbound and return segment lists.

    Format: "...trip={outbound joined by -},{return joined by -}"
    Returns tuples of (carrier_code, flight_number) for each segment.
    """
    if "trip=" not in flight_id:
        return [], []
    trip_part = flight_id.split("trip=", 1)[1]

    if "," in trip_part:
        outbound_str, return_str = trip_part.split(",", 1)
    else:
        outbound_str, return_str = trip_part, ""

    def parse_leg(leg: str) -> list[tuple[str, str]]:
        segments = []
        for raw in leg.split("-"):
            code, num = _parse_skiplagged_segment_id(raw)
            if code and num:
                segments.append((code, num))
        return segments

    return parse_leg(outbound_str), parse_leg(return_str)


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
    price = _extract_price(item)
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
        itineraries.append(_build_skiplagged_itinerary(
            direction="return",
            parsed_segs=return_segs,
            departure_airport=return_raw.get("departure_airport"),
            arrival_airport=return_raw.get("arrival_airport"),
            departure_time=return_raw.get("departure_time"),
            arrival_time=return_raw.get("arrival_time"),
            duration_minutes=return_raw.get("duration_minutes"),
        ))

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
    price = _extract_price(item)
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

    return PriceSnapshotResponse(
        id=snapshot.id,
        flight_price=snapshot.flight_price,
        hotel_price=snapshot.hotel_price,
        total_price=snapshot.total_price,
        created_at=snapshot.created_at,
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
