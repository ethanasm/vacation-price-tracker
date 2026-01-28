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
            return price_val.get("total") or price_val.get("grandTotal") or price_val.get("amount")
        return str(price_val)
    if "total_price" in item:
        return str(item["total_price"])
    # Amadeus V3 hotel-offers: price is nested in offers[0].price.total
    offers = item.get("offers")
    if isinstance(offers, list) and offers:
        first_offer = offers[0]
        if isinstance(first_offer, dict) and "price" in first_offer:
            price_val = first_offer["price"]
            if isinstance(price_val, dict):
                return price_val.get("total") or price_val.get("grandTotal")
            return str(price_val)
    return None


def _extract_amadeus_airline_code(item: dict) -> str | None:
    """Extract airline code from Amadeus flight offer structure."""
    # Try validatingAirlineCodes first (primary carrier)
    validating_codes = item.get("validatingAirlineCodes")
    if validating_codes and isinstance(validating_codes, list) and len(validating_codes) > 0:
        return validating_codes[0]
    # Fall back to first segment's carrier code
    itineraries = item.get("itineraries")
    if itineraries and isinstance(itineraries, list) and len(itineraries) > 0:
        segments = itineraries[0].get("segments")
        if segments and isinstance(segments, list) and len(segments) > 0:
            return segments[0].get("carrierCode")
    # Legacy flat fields
    return item.get("carrier") or item.get("operating_carrier") or item.get("airline")


def _extract_amadeus_flight_number(item: dict) -> str | None:
    """Extract flight number (e.g., 'UA1234') from Amadeus flight offer structure."""
    itineraries = item.get("itineraries")
    if not itineraries or not isinstance(itineraries, list) or len(itineraries) == 0:
        # Fall back to legacy flat field
        return item.get("flight_number")

    first_itinerary = itineraries[0]
    segments = first_itinerary.get("segments")
    if not segments or not isinstance(segments, list) or len(segments) == 0:
        return None

    # Get first segment's carrier code and flight number
    first_segment = segments[0]
    carrier_code = first_segment.get("carrierCode")
    number = first_segment.get("number")

    if carrier_code and number:
        return f"{carrier_code}{number}"
    return None


def _extract_amadeus_times(item: dict) -> tuple[str | None, str | None]:
    """Extract departure and arrival times from Amadeus flight offer structure."""
    itineraries = item.get("itineraries")
    if not itineraries or not isinstance(itineraries, list) or len(itineraries) == 0:
        # Fall back to legacy flat fields
        return item.get("departure_time") or item.get("departureTime"), item.get("arrival_time") or item.get("arrivalTime")

    first_itinerary = itineraries[0]
    segments = first_itinerary.get("segments")
    if not segments or not isinstance(segments, list) or len(segments) == 0:
        return None, None

    # Departure time from first segment
    first_segment = segments[0]
    departure = first_segment.get("departure", {})
    departure_time = departure.get("at") if isinstance(departure, dict) else None

    # Arrival time from last segment
    last_segment = segments[-1]
    arrival = last_segment.get("arrival", {})
    arrival_time = arrival.get("at") if isinstance(arrival, dict) else None

    return departure_time, arrival_time


def _parse_amadeus_duration(item: dict) -> int | None:
    """Parse Amadeus ISO 8601 duration (e.g., 'PT1H6M') to minutes."""
    itineraries = item.get("itineraries")
    if not itineraries or not isinstance(itineraries, list) or len(itineraries) == 0:
        # Fall back to legacy flat field
        duration = item.get("duration") or item.get("duration_minutes")
        if isinstance(duration, int):
            return duration
        return None

    duration_str = itineraries[0].get("duration")
    if not duration_str or not isinstance(duration_str, str):
        return None

    # Parse ISO 8601 duration format (e.g., "PT1H6M", "PT2H", "PT45M")
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration_str)
    if not match:
        return None

    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    return hours * 60 + minutes


def _count_amadeus_stops(item: dict) -> int:
    """Count total stops from Amadeus flight offer structure."""
    itineraries = item.get("itineraries")
    if not itineraries or not isinstance(itineraries, list) or len(itineraries) == 0:
        # Fall back to legacy flat field
        return item.get("stops", 0)

    # Count stops in outbound itinerary only for display
    first_itinerary = itineraries[0]
    segments = first_itinerary.get("segments")
    if not segments or not isinstance(segments, list):
        return 0

    # Number of stops = number of segments - 1
    return max(0, len(segments) - 1)


def _get_airline_name(item: dict, flights_data: dict) -> str | None:
    """Get airline name from dictionaries or item itself."""
    airline_code = _extract_amadeus_airline_code(item)
    if not airline_code:
        return item.get("airline_name") or item.get("carrierName")

    # Check dictionaries in the response
    dictionaries = flights_data.get("dictionaries", {})
    carriers = dictionaries.get("carriers", {})
    if airline_code in carriers:
        return carriers[airline_code]

    return item.get("airline_name") or item.get("carrierName")


def _extract_return_flight(item: dict) -> dict | None:
    """Extract return leg info from second itinerary if present."""
    itineraries = item.get("itineraries")
    if not itineraries or not isinstance(itineraries, list) or len(itineraries) < 2:
        return item.get("return_flight")

    return_itinerary = itineraries[1]
    segments = return_itinerary.get("segments")
    if not segments or not isinstance(segments, list) or len(segments) == 0:
        return None

    first_segment = segments[0]
    last_segment = segments[-1]

    departure = first_segment.get("departure", {})
    arrival = last_segment.get("arrival", {})

    departure_time = departure.get("at") if isinstance(departure, dict) else None
    arrival_time = arrival.get("at") if isinstance(arrival, dict) else None

    # Extract flight number (carrier + number)
    carrier_code = first_segment.get("carrierCode")
    number = first_segment.get("number")
    flight_number = f"{carrier_code}{number}" if carrier_code and number else None

    # Parse return duration
    duration_str = return_itinerary.get("duration")
    duration_minutes = None
    if duration_str and isinstance(duration_str, str):
        match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration_str)
        if match:
            hours = int(match.group(1)) if match.group(1) else 0
            minutes = int(match.group(2)) if match.group(2) else 0
            duration_minutes = hours * 60 + minutes

    stops = max(0, len(segments) - 1)

    return {
        "flight_number": flight_number,
        "departure_time": departure_time,
        "arrival_time": arrival_time,
        "duration_minutes": duration_minutes,
        "stops": stops,
    }


def _extract_itineraries(item: dict) -> list[FlightItinerary]:
    """Extract full itinerary data with all segments."""
    itineraries_data = item.get("itineraries", [])
    if not itineraries_data or not isinstance(itineraries_data, list):
        return []

    result = []
    directions = ["outbound", "return"]

    for idx, itinerary in enumerate(itineraries_data):
        segments = itinerary.get("segments", [])
        if not segments:
            continue

        # Parse total duration for this itinerary
        duration_str = itinerary.get("duration")
        total_duration = None
        if duration_str and isinstance(duration_str, str):
            match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration_str)
            if match:
                hours = int(match.group(1)) if match.group(1) else 0
                minutes = int(match.group(2)) if match.group(2) else 0
                total_duration = hours * 60 + minutes

        extracted_segments = []
        for seg in segments:
            dep = seg.get("departure", {})
            arr = seg.get("arrival", {})
            carrier = seg.get("carrierCode")
            number = seg.get("number")

            # Parse segment duration
            seg_dur = None
            if seg.get("duration"):
                match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", seg.get("duration", ""))
                if match:
                    seg_dur = (int(match.group(1) or 0) * 60) + int(match.group(2) or 0)

            extracted_segments.append(FlightSegment(
                carrier_code=carrier,
                flight_number=f"{carrier}{number}" if carrier and number else None,
                departure_airport=dep.get("iataCode"),
                arrival_airport=arr.get("iataCode"),
                departure_time=dep.get("at"),
                arrival_time=arr.get("at"),
                duration_minutes=seg_dur,
            ))

        result.append(FlightItinerary(
            direction=directions[idx] if idx < len(directions) else f"leg_{idx}",
            segments=extracted_segments,
            total_duration_minutes=total_duration,
            stops=len(extracted_segments) - 1,
        ))

    return result


def _snapshot_to_response(snapshot: PriceSnapshot) -> PriceSnapshotResponse:
    """Convert a snapshot to response, extracting offers from raw_data."""
    flight_offers: list[FlightOffer] = []
    hotel_offers: list[HotelOffer] = []

    raw = snapshot.raw_data or {}

    # Extract flight offers
    flights_data = raw.get("flights", {})
    if isinstance(flights_data, dict):
        flight_list = flights_data.get("data") or flights_data.get("offers") or []
        for i, item in enumerate(flight_list[:10]):  # Limit to top 10
            if not isinstance(item, dict):
                continue
            price = _extract_price(item)
            if price is None:
                continue
            departure_time, arrival_time = _extract_amadeus_times(item)
            flight_offers.append(FlightOffer(
                id=item.get("id") or str(i),
                airline_code=_extract_amadeus_airline_code(item),
                flight_number=_extract_amadeus_flight_number(item),
                airline_name=_get_airline_name(item, flights_data),
                price=price,
                departure_time=departure_time,
                arrival_time=arrival_time,
                duration_minutes=_parse_amadeus_duration(item),
                stops=_count_amadeus_stops(item),
                return_flight=_extract_return_flight(item),
                itineraries=_extract_itineraries(item),
            ))

    # Extract hotel offers
    hotels_data = raw.get("hotels", {})
    if isinstance(hotels_data, dict):
        hotel_list = hotels_data.get("data") or hotels_data.get("offers") or []
        for i, item in enumerate(hotel_list[:10]):  # Limit to top 10
            if not isinstance(item, dict):
                continue
            price = _extract_price(item)
            if price is None:
                continue
            hotel_offers.append(HotelOffer(
                id=item.get("id") or item.get("hotelId") or str(i),
                name=item.get("name") or item.get("hotel", {}).get("name", f"Hotel {i + 1}"),
                price=price,
                rating=item.get("rating") or item.get("hotel", {}).get("rating"),
                address=item.get("address") or item.get("hotel", {}).get("address"),
                description=item.get("description") or item.get("room", {}).get("description"),
            ))

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
    )
    db.add(trip)
    await db.flush()

    flight_prefs = None
    if payload.flight_prefs:
        flight_prefs = TripFlightPrefs(trip_id=trip.id, **payload.flight_prefs.model_dump())
        db.add(flight_prefs)

    hotel_prefs = None
    if payload.hotel_prefs:
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

    refresh_group_id = f"refresh-trip-{trip_id}-{uuid.uuid4()}"

    try:
        await trigger_price_check_workflow(trip_id)
    except PriceCheckWorkflowStartFailed:
        raise

    return APIResponse(data=RefreshStartResponse(refresh_group_id=refresh_group_id))


# =============================================================================
# DEBUG ENDPOINTS (for API testing)
# =============================================================================


@router.get("/v1/debug/fast-flights")
async def debug_fast_flights(
    origin: str = Query(..., description="Origin airport code (e.g., SFO)"),
    destination: str = Query(..., description="Destination airport code (e.g., MCO)"),
    departure_date: str = Query(..., description="Departure date (YYYY-MM-DD)"),
    return_date: str | None = Query(None, description="Return date for round trip (YYYY-MM-DD)"),
    adults: int = Query(1, ge=1, le=9, description="Number of adults"),
    cabin: str = Query("ECONOMY", description="Cabin class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST"),
    max_results: int = Query(10, ge=1, le=50, description="Max number of results"),
    fetch_mode: str = Query(
        "common",
        description="Fetch mode: 'common' (direct requests), 'fallback' (tries direct first, serverless if fails), 'local' (local Playwright)"
    ),
):
    """
    Debug endpoint to test fast-flights (Google Flights scraper) directly.

    Returns raw fast-flights response in Amadeus-compatible format.

    Fetch modes:
    - common: Direct requests only (your IP exposed)
    - fallback: Tries direct first, serverless if fails
    - local: Uses local Playwright installation
    """
    from app.clients.google_flights import GoogleFlightsClient, GoogleFlightsError

    try:
        client = GoogleFlightsClient(fetch_mode=fetch_mode)
        result = await client.search_flights(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            return_date=return_date,
            adults=adults,
            travel_class=cabin.upper(),
            max_results=max_results,
        )
        return result
    except GoogleFlightsError as e:
        return {
            "error": True,
            "provider": "fast-flights",
            "fetch_mode": fetch_mode,
            "message": str(e),
        }
    except Exception as e:
        return {
            "error": True,
            "provider": "fast-flights",
            "fetch_mode": fetch_mode,
            "message": str(e),
            "type": type(e).__name__,
        }


@router.get("/v1/debug/amadeus")
async def debug_amadeus(
    origin: str = Query(..., description="Origin airport code (e.g., SFO)"),
    destination: str = Query(..., description="Destination airport code (e.g., MCO)"),
    departure_date: str = Query(..., description="Departure date (YYYY-MM-DD)"),
    return_date: str | None = Query(None, description="Return date for round trip (YYYY-MM-DD)"),
    adults: int = Query(1, ge=1, le=9, description="Number of adults"),
    cabin: str = Query("ECONOMY", description="Cabin class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST"),
    non_stop: bool = Query(False, description="Only return non-stop flights"),
    max_results: int = Query(10, ge=1, le=50, description="Max number of results"),
):
    """
    Debug endpoint to test Amadeus Flight Offers Search API directly.

    Returns raw Amadeus response.
    """
    from app.clients.amadeus import AmadeusClientError, amadeus_client

    try:
        result = await amadeus_client.search_flights(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            return_date=return_date,
            adults=adults,
            travel_class=cabin.upper(),
            non_stop=non_stop,
            max_results=max_results,
        )
        return result
    except AmadeusClientError as e:
        return {
            "error": True,
            "provider": "amadeus",
            "message": str(e),
        }
    except Exception as e:
        return {
            "error": True,
            "provider": "amadeus",
            "message": str(e),
            "type": type(e).__name__,
        }
