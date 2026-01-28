"""Tests for trip CRUD endpoints."""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims, TripStatus
from app.core.errors import PriceCheckWorkflowStartFailed
from app.core.security import create_access_token
from app.middleware import idempotency as idempotency_module
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.models.user import User
from app.routers import trips as trips_module
from app.schemas.trip import TripCreate, TripStatusUpdate
from sqlalchemy import func
from sqlmodel import select
from temporalio import client as temporal_client
from temporalio import exceptions as temporal_exceptions

from tests.test_models import set_test_timestamps


class _FakeRedis:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def get(self, key: str):
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool = False):
        if nx and key in self._store:
            return None
        self._store[key] = value
        return True

    async def delete(self, key: str):
        existed = key in self._store
        self._store.pop(key, None)
        return 1 if existed else 0


def _authorize_client(client, user: User) -> None:
    access_token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})
    client.cookies.set(CookieNames.ACCESS_TOKEN, access_token)


def _build_trip_payload(name: str = "Hawaii Vacation") -> dict:
    today = date.today()
    return {
        "name": name,
        "origin_airport": "SFO",
        "destination_code": "HNL",
        "depart_date": (today + timedelta(days=30)).isoformat(),
        "return_date": (today + timedelta(days=37)).isoformat(),
        "notification_prefs": {"threshold_value": "2000.00"},
    }


async def _create_user(test_session, email: str = "user@example.com") -> User:
    user = User(google_sub=str(uuid.uuid4()), email=email)
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


def _create_trip(client, payload: dict, idempotency_key: str):
    csrf_token = client.headers.get("X-CSRF-Token")
    headers = {"X-Idempotency-Key": idempotency_key}
    if csrf_token:
        headers["X-CSRF-Token"] = csrf_token
    return client.post(
        "/v1/trips",
        json=payload,
        headers=headers,
    )


@pytest.mark.asyncio
async def test_create_trip_success(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="create@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    trigger_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_mock)

    payload = _build_trip_payload()
    response = _create_trip(client_with_csrf, payload, "trip-create-1")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == payload["name"]
    assert data["notification_prefs"]["threshold_value"] == payload["notification_prefs"]["threshold_value"]
    trigger_mock.assert_called_once()


@pytest.mark.asyncio
async def test_create_trip_reports_price_check_failure(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="create-fail@example.com")
    _authorize_client(client_with_csrf, user)

    async def trigger_error(trip_id):
        raise PriceCheckWorkflowStartFailed(extra={"trip_id": str(trip_id)})

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_error)

    payload = _build_trip_payload(name="Failure Trip")
    response = _create_trip(client_with_csrf, payload, "trip-create-fail-1")

    assert response.status_code == 502
    body = response.json()
    assert body["detail"] == "Trip created, but initial price check failed to start."
    trip_id = body["trip_id"]

    trip = await test_session.get(Trip, uuid.UUID(trip_id))
    assert trip is not None
    assert trip.status == TripStatus.ERROR


@pytest.mark.asyncio
async def test_create_trip_rejects_duplicate_name(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="duplicate@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Duplicate Trip")
    response_one = _create_trip(client_with_csrf, payload, "trip-duplicate-1")
    response_two = _create_trip(client_with_csrf, payload, "trip-duplicate-2")

    assert response_one.status_code == 201
    assert response_two.status_code == 409
    assert response_two.json()["detail"] == "Trip name already exists."


@pytest.mark.asyncio
async def test_create_trip_rejects_when_limit_exceeded(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="limit@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())
    monkeypatch.setattr(settings, "max_trips_per_user", 1)

    payload = _build_trip_payload(name="First Trip")
    response_one = _create_trip(client_with_csrf, payload, "trip-limit-1")
    response_two = _create_trip(client_with_csrf, _build_trip_payload(name="Second Trip"), "trip-limit-2")

    assert response_one.status_code == 201
    assert response_two.status_code == 400
    assert response_two.json()["detail"] == "Trip limit exceeded."

@pytest.mark.asyncio
async def test_create_trip_duplicate_idempotency(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="dupe@example.com")
    _authorize_client(client_with_csrf, user)

    fake_redis = _FakeRedis()
    monkeypatch.setattr(idempotency_module, "redis_client", fake_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload_one = _build_trip_payload(name="First Trip")
    response_one = _create_trip(client_with_csrf, payload_one, "trip-dupe")
    response_two = _create_trip(client_with_csrf, payload_one, "trip-dupe")

    assert response_one.status_code == 201
    assert response_two.status_code == 201
    assert response_one.json()["data"]["id"] == response_two.json()["data"]["id"]


@pytest.mark.asyncio
async def test_create_trip_idempotency_conflict(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="conflict@example.com")
    _authorize_client(client_with_csrf, user)

    fake_redis = _FakeRedis()
    monkeypatch.setattr(idempotency_module, "redis_client", fake_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload_one = _build_trip_payload(name="First Trip")
    payload_two = _build_trip_payload(name="Second Trip")

    response_one = _create_trip(client_with_csrf, payload_one, "trip-conflict")
    response_two = _create_trip(client_with_csrf, payload_two, "trip-conflict")

    assert response_one.status_code == 201
    assert response_two.status_code == 409
    assert response_two.json()["detail"] == "Idempotency key conflict"


@pytest.mark.asyncio
async def test_create_trip_idempotency_returns_cached_response(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session, email="cache@example.com")
    _authorize_client(client_with_csrf, user)

    fake_redis = _FakeRedis()
    monkeypatch.setattr(idempotency_module, "redis_client", fake_redis)
    trigger_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_mock)

    payload = _build_trip_payload(name="Cached Trip")
    response_one = _create_trip(client_with_csrf, payload, "trip-cache")
    response_two = _create_trip(client_with_csrf, payload, "trip-cache")

    assert response_one.status_code == 201
    assert response_two.status_code == 201
    assert response_one.json()["data"]["id"] == response_two.json()["data"]["id"]
    assert trigger_mock.call_count == 1

    count_stmt = select(func.count()).select_from(Trip).where(Trip.user_id == user.id)
    trip_count = (await test_session.execute(count_stmt)).scalar_one()
    assert trip_count == 1


@pytest.mark.asyncio
async def test_create_trip_requires_idempotency_key(client_with_csrf, test_session, monkeypatch):
    user = User(google_sub=str(uuid.uuid4()), email="missing-key@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Missing Key Trip")
    response = client_with_csrf.post("/v1/trips", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == "X-Idempotency-Key header required"


@pytest.mark.asyncio
async def test_list_trips_includes_latest_snapshot(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="list@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload_one = _build_trip_payload(name="Trip One")
    payload_two = _build_trip_payload(name="Trip Two")

    response_one = _create_trip(client_with_csrf, payload_one, "trip-list-1")
    response_two = _create_trip(client_with_csrf, payload_two, "trip-list-2")

    trip_one_id = response_one.json()["data"]["id"]
    trip_two_id = response_two.json()["data"]["id"]

    now = datetime.now(UTC)
    snapshots = [
        PriceSnapshot(
            trip_id=uuid.UUID(trip_one_id),
            flight_price=Decimal("100.00"),
            hotel_price=Decimal("200.00"),
            total_price=Decimal("300.00"),
            created_at=now - timedelta(days=1),
        ),
        PriceSnapshot(
            trip_id=uuid.UUID(trip_one_id),
            flight_price=Decimal("120.00"),
            hotel_price=Decimal("210.00"),
            total_price=Decimal("330.00"),
            created_at=now,
        ),
        PriceSnapshot(
            trip_id=uuid.UUID(trip_two_id),
            flight_price=Decimal("80.00"),
            hotel_price=Decimal("150.00"),
            total_price=Decimal("230.00"),
            created_at=now - timedelta(hours=2),
        ),
    ]

    test_session.add_all(snapshots)
    await test_session.commit()

    response = client_with_csrf.get("/v1/trips?page=1&limit=10")

    assert response.status_code == 200
    body = response.json()
    trip_map = {trip["id"]: trip for trip in body["data"]}

    assert trip_map[trip_one_id]["total_price"] == "330.00"
    assert trip_map[trip_two_id]["total_price"] == "230.00"
    assert body["meta"]["total"] == 2


@pytest.mark.asyncio
async def test_list_trips_filters_by_status(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="filter@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    response_one = _create_trip(client_with_csrf, _build_trip_payload(name="Active Trip"), "trip-filter-1")
    response_two = _create_trip(client_with_csrf, _build_trip_payload(name="Paused Trip"), "trip-filter-2")

    trip_one_id = response_one.json()["data"]["id"]
    trip_two_id = response_two.json()["data"]["id"]

    pause_response = client_with_csrf.patch(
        f"/v1/trips/{trip_two_id}/status",
        json={"status": TripStatus.PAUSED.value},
    )
    assert pause_response.status_code == 200

    paused_list = client_with_csrf.get("/v1/trips?status=paused")
    assert paused_list.status_code == 200
    paused_ids = {trip["id"] for trip in paused_list.json()["data"]}
    assert paused_ids == {trip_two_id}

    active_list = client_with_csrf.get("/v1/trips?status=active")
    assert active_list.status_code == 200
    active_ids = {trip["id"] for trip in active_list.json()["data"]}
    assert active_ids == {trip_one_id}


@pytest.mark.asyncio
async def test_list_trips_empty_returns_meta(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="empty-list@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client_with_csrf.get("/v1/trips?page=1&limit=10")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []
    assert body["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_get_trip_details_includes_history(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="detail@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Detail Trip")
    payload["flight_prefs"] = {"airlines": ["UA"]}
    payload["hotel_prefs"] = {"rooms": 2, "preferred_views": ["Ocean"]}

    create_response = _create_trip(client_with_csrf, payload, "trip-detail-1")
    trip_id = create_response.json()["data"]["id"]

    now = datetime.now(UTC)
    test_session.add_all(
        [
            PriceSnapshot(
                trip_id=uuid.UUID(trip_id),
                flight_price=Decimal("150.00"),
                hotel_price=Decimal("250.00"),
                total_price=Decimal("400.00"),
                created_at=now - timedelta(days=1),
            ),
            PriceSnapshot(
                trip_id=uuid.UUID(trip_id),
                flight_price=Decimal("140.00"),
                hotel_price=Decimal("240.00"),
                total_price=Decimal("380.00"),
                created_at=now,
            ),
        ]
    )
    await test_session.commit()

    response = client_with_csrf.get(f"/v1/trips/{trip_id}?page=1&limit=1")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] == 2
    assert len(body["data"]["price_history"]) == 1
    assert body["data"]["trip"]["flight_prefs"]["airlines"] == ["UA"]
    assert body["data"]["trip"]["hotel_prefs"]["rooms"] == 2
    assert body["data"]["trip"]["current_flight_price"] == "140.00"


@pytest.mark.asyncio
async def test_get_trip_details_not_found(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="detail-missing@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client_with_csrf.get(f"/v1/trips/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found."


@pytest.mark.asyncio
async def test_update_trip_status(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="status@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Status Trip")
    create_response = _create_trip(client_with_csrf, payload, "trip-status-1")
    trip_id = create_response.json()["data"]["id"]

    response = client_with_csrf.patch(
        f"/v1/trips/{trip_id}/status",
        json={"status": TripStatus.PAUSED.value},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == TripStatus.PAUSED.value


@pytest.mark.asyncio
async def test_update_trip_status_not_found(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="status-missing@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client_with_csrf.patch(
        f"/v1/trips/{uuid.uuid4()}/status",
        json={"status": TripStatus.PAUSED.value},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found."


@pytest.mark.asyncio
async def test_delete_trip(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="delete@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Delete Trip")
    create_response = _create_trip(client_with_csrf, payload, "trip-delete-1")
    trip_id = create_response.json()["data"]["id"]

    delete_response = client_with_csrf.delete(f"/v1/trips/{trip_id}")
    assert delete_response.status_code == 204

    fetch_response = client_with_csrf.get(f"/v1/trips/{trip_id}")
    assert fetch_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_trip_not_found(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="delete-missing@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client_with_csrf.delete(f"/v1/trips/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found."


@pytest.mark.asyncio
async def test_delete_all_trips(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="delete-all@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    # Create 3 trips
    for i in range(3):
        _create_trip(client_with_csrf, _build_trip_payload(name=f"Trip {i}"), f"bulk-del-{i}")

    # Verify they exist
    list_response = client_with_csrf.get("/v1/trips")
    assert len(list_response.json()["data"]) == 3

    # Delete all
    delete_response = client_with_csrf.delete("/v1/trips")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted_count"] == 3

    # Verify none remain
    list_response = client_with_csrf.get("/v1/trips")
    assert len(list_response.json()["data"]) == 0


@pytest.mark.asyncio
async def test_delete_all_trips_empty(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="delete-all-empty@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    delete_response = client_with_csrf.delete("/v1/trips")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted_count"] == 0


@pytest.mark.asyncio
async def test_delete_all_trips_only_own(client_with_csrf, test_session, mock_redis, monkeypatch):
    """Bulk delete should only delete the current user's trips."""
    user_a = await _create_user(test_session, email="bulk-a@example.com")
    user_b = await _create_user(test_session, email="bulk-b@example.com")

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    # User A creates 2 trips
    _authorize_client(client_with_csrf, user_a)
    _create_trip(client_with_csrf, _build_trip_payload(name="A Trip 1"), "bulk-own-a1")
    _create_trip(client_with_csrf, _build_trip_payload(name="A Trip 2"), "bulk-own-a2")

    # User B creates 1 trip
    _authorize_client(client_with_csrf, user_b)
    _create_trip(client_with_csrf, _build_trip_payload(name="B Trip 1"), "bulk-own-b1")

    # User B deletes all — should only delete their 1 trip
    delete_response = client_with_csrf.delete("/v1/trips")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted_count"] == 1

    # User A's trips should still exist
    _authorize_client(client_with_csrf, user_a)
    list_response = client_with_csrf.get("/v1/trips")
    assert len(list_response.json()["data"]) == 2


@pytest.mark.asyncio
async def test_trip_helpers_handle_missing_data(test_session):
    assert trips_module._flight_prefs_to_schema(None) is None
    assert trips_module._hotel_prefs_to_schema(None) is None
    assert trips_module._notification_prefs_to_schema(None) is None

    latest_snapshot = await trips_module._get_latest_snapshot(test_session, uuid.uuid4())
    assert latest_snapshot is None


def test_amadeus_flight_parsing_helpers():
    """Test Amadeus flight data extraction helpers."""
    # Test _extract_amadeus_airline_code
    # From validatingAirlineCodes
    item_with_validating = {"validatingAirlineCodes": ["UA", "AA"]}
    assert trips_module._extract_amadeus_airline_code(item_with_validating) == "UA"

    # From itineraries
    item_with_itineraries = {
        "itineraries": [{"segments": [{"carrierCode": "DL"}]}]
    }
    assert trips_module._extract_amadeus_airline_code(item_with_itineraries) == "DL"

    # Fallback to legacy fields
    item_legacy = {"carrier": "AA"}
    assert trips_module._extract_amadeus_airline_code(item_legacy) == "AA"

    # Empty item
    assert trips_module._extract_amadeus_airline_code({}) is None

    # Test _extract_amadeus_flight_number
    item_with_number = {
        "itineraries": [{"segments": [{"carrierCode": "UA", "number": "1234"}]}]
    }
    assert trips_module._extract_amadeus_flight_number(item_with_number) == "UA1234"

    # Missing number
    item_no_number = {
        "itineraries": [{"segments": [{"carrierCode": "UA"}]}]
    }
    assert trips_module._extract_amadeus_flight_number(item_no_number) is None

    # Empty itineraries
    assert trips_module._extract_amadeus_flight_number({}) is None
    assert trips_module._extract_amadeus_flight_number({"itineraries": []}) is None

    # Legacy fallback
    item_legacy_number = {"flight_number": "DL567"}
    assert trips_module._extract_amadeus_flight_number(item_legacy_number) == "DL567"

    # Test _extract_amadeus_times
    item_with_times = {
        "itineraries": [{
            "segments": [
                {"departure": {"at": "2024-03-15T09:30:00"}, "arrival": {"at": "2024-03-15T10:00:00"}},
                {"departure": {"at": "2024-03-15T11:00:00"}, "arrival": {"at": "2024-03-15T12:30:00"}},
            ]
        }]
    }
    dep, arr = trips_module._extract_amadeus_times(item_with_times)
    assert dep == "2024-03-15T09:30:00"
    assert arr == "2024-03-15T12:30:00"

    # Legacy fields fallback
    item_legacy_times = {"departure_time": "10:00", "arrival_time": "12:00"}
    dep, arr = trips_module._extract_amadeus_times(item_legacy_times)
    assert dep == "10:00"
    assert arr == "12:00"

    # Empty item
    dep, arr = trips_module._extract_amadeus_times({})
    assert dep is None
    assert arr is None

    # Test _parse_amadeus_duration
    item_duration = {"itineraries": [{"duration": "PT1H6M"}]}
    assert trips_module._parse_amadeus_duration(item_duration) == 66

    item_hours_only = {"itineraries": [{"duration": "PT2H"}]}
    assert trips_module._parse_amadeus_duration(item_hours_only) == 120

    item_minutes_only = {"itineraries": [{"duration": "PT45M"}]}
    assert trips_module._parse_amadeus_duration(item_minutes_only) == 45

    # Invalid duration
    item_invalid = {"itineraries": [{"duration": "invalid"}]}
    assert trips_module._parse_amadeus_duration(item_invalid) is None

    # Legacy int fallback
    item_legacy_duration = {"duration": 90}
    assert trips_module._parse_amadeus_duration(item_legacy_duration) == 90

    # Empty item
    assert trips_module._parse_amadeus_duration({}) is None

    # Test _count_amadeus_stops
    item_nonstop = {"itineraries": [{"segments": [{"carrierCode": "UA"}]}]}
    assert trips_module._count_amadeus_stops(item_nonstop) == 0

    item_one_stop = {"itineraries": [{"segments": [{"carrierCode": "UA"}, {"carrierCode": "UA"}]}]}
    assert trips_module._count_amadeus_stops(item_one_stop) == 1

    item_two_stops = {"itineraries": [{"segments": [{}, {}, {}]}]}
    assert trips_module._count_amadeus_stops(item_two_stops) == 2

    # Legacy fallback
    item_legacy_stops = {"stops": 3}
    assert trips_module._count_amadeus_stops(item_legacy_stops) == 3

    # Empty item
    assert trips_module._count_amadeus_stops({}) == 0

    # Test _get_airline_name
    flights_data = {
        "dictionaries": {"carriers": {"UA": "United Airlines", "DL": "Delta Air Lines"}}
    }
    item = {"validatingAirlineCodes": ["UA"]}
    assert trips_module._get_airline_name(item, flights_data) == "United Airlines"

    # From item itself
    item_with_name = {"validatingAirlineCodes": ["XX"], "airline_name": "Unknown Airline"}
    assert trips_module._get_airline_name(item_with_name, {}) == "Unknown Airline"

    # Test _extract_return_flight
    item_round_trip = {
        "itineraries": [
            {"segments": [{"departure": {"at": "2024-03-15T09:00:00"}, "arrival": {"at": "2024-03-15T11:00:00"}}]},
            {
                "duration": "PT2H30M",
                "segments": [
                    {"carrierCode": "DL", "number": "456", "departure": {"at": "2024-03-20T14:00:00"}, "arrival": {"at": "2024-03-20T15:00:00"}},
                    {"departure": {"at": "2024-03-20T16:00:00"}, "arrival": {"at": "2024-03-20T17:30:00"}},
                ]
            }
        ]
    }
    return_flight = trips_module._extract_return_flight(item_round_trip)
    assert return_flight is not None
    assert return_flight["flight_number"] == "DL456"
    assert return_flight["departure_time"] == "2024-03-20T14:00:00"
    assert return_flight["arrival_time"] == "2024-03-20T17:30:00"
    assert return_flight["duration_minutes"] == 150
    assert return_flight["stops"] == 1

    # One-way flight (no return)
    item_one_way = {"itineraries": [{"segments": [{}]}]}
    assert trips_module._extract_return_flight(item_one_way) is None

    # Legacy fallback
    item_legacy_return = {"return_flight": {"departure": "15:00"}}
    assert trips_module._extract_return_flight(item_legacy_return) == {"departure": "15:00"}


def test_extract_price_helper():
    """Test _extract_price helper."""
    # From price.total
    assert trips_module._extract_price({"price": {"total": "199.99"}}) == "199.99"

    # From price.grandTotal
    assert trips_module._extract_price({"price": {"grandTotal": "299.99"}}) == "299.99"

    # From price.amount
    assert trips_module._extract_price({"price": {"amount": "399.99"}}) == "399.99"

    # Direct price value
    assert trips_module._extract_price({"price": "99.99"}) == "99.99"

    # From total_price
    assert trips_module._extract_price({"total_price": 149.99}) == "149.99"

    # Missing price
    assert trips_module._extract_price({}) is None

    # Amadeus V3 hotel-offers nested price
    assert trips_module._extract_price({"hotel": {"name": "Test"}, "offers": [{"price": {"total": "289.00"}}]}) == "289.00"

    # No offers array
    assert trips_module._extract_price({"hotel": {"name": "Test"}}) is None


def test_snapshot_to_response_with_amadeus_data(test_session):
    """Test _snapshot_to_response extracts Amadeus flight data correctly."""
    snapshot = PriceSnapshot(
        id=uuid.uuid4(),
        trip_id=uuid.uuid4(),
        flight_price=Decimal("350.00"),
        hotel_price=Decimal("500.00"),
        total_price=Decimal("850.00"),
        created_at=datetime.now(UTC),
        raw_data={
            "flights": {
                "data": [
                    {
                        "id": "1",
                        "price": {"total": "350.00"},
                        "validatingAirlineCodes": ["UA"],
                        "itineraries": [
                            {
                                "duration": "PT1H6M",
                                "segments": [
                                    {
                                        "carrierCode": "UA",
                                        "number": "1234",
                                        "departure": {"at": "2024-03-15T21:30:00"},
                                        "arrival": {"at": "2024-03-15T22:36:00"},
                                    }
                                ]
                            },
                            {
                                "duration": "PT1H10M",
                                "segments": [
                                    {
                                        "carrierCode": "UA",
                                        "number": "5678",
                                        "departure": {"at": "2024-03-20T14:00:00"},
                                        "arrival": {"at": "2024-03-20T15:10:00"},
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "dictionaries": {"carriers": {"UA": "United Airlines"}}
            },
            "hotels": {
                "data": [
                    {
                        "id": "H1",
                        "price": {"total": "500.00"},
                        "name": "Grand Hotel",
                        "rating": 4,
                    }
                ]
            }
        }
    )

    response = trips_module._snapshot_to_response(snapshot)

    assert len(response.flight_offers) == 1
    flight = response.flight_offers[0]
    assert flight.id == "1"
    assert flight.airline_code == "UA"
    assert flight.flight_number == "UA1234"
    assert flight.airline_name == "United Airlines"
    assert flight.price == Decimal("350.00")
    assert flight.departure_time == "2024-03-15T21:30:00"
    assert flight.arrival_time == "2024-03-15T22:36:00"
    assert flight.duration_minutes == 66
    assert flight.stops == 0
    assert flight.return_flight is not None
    assert flight.return_flight["flight_number"] == "UA5678"
    assert flight.return_flight["departure_time"] == "2024-03-20T14:00:00"

    assert len(response.hotel_offers) == 1
    hotel = response.hotel_offers[0]
    assert hotel.id == "H1"
    assert hotel.name == "Grand Hotel"
    assert hotel.price == Decimal("500.00")
    assert hotel.rating == 4


def test_snapshot_to_response_handles_empty_raw_data():
    """Test _snapshot_to_response handles missing/empty raw_data."""
    snapshot = PriceSnapshot(
        id=uuid.uuid4(),
        trip_id=uuid.uuid4(),
        flight_price=Decimal("100.00"),
        hotel_price=Decimal("200.00"),
        total_price=Decimal("300.00"),
        created_at=datetime.now(UTC),
        raw_data=None,
    )

    response = trips_module._snapshot_to_response(snapshot)

    assert len(response.flight_offers) == 0
    assert len(response.hotel_offers) == 0


@pytest.mark.asyncio
async def test_trip_routes_direct_calls(test_session, monkeypatch):
    user = await _create_user(test_session, email="direct@example.com")
    user_response = trips_module.UserResponse(id=str(user.id), email=user.email)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = TripCreate(**_build_trip_payload(name="Direct Trip"))
    create_response = await trips_module.create_trip(
        payload,
        db=test_session,
        current_user=user_response,
    )

    trip_id = create_response.data.id
    list_response = await trips_module.list_trips(
        page=1,
        limit=10,
        status_filter=None,
        db=test_session,
        current_user=user_response,
    )
    assert list_response.meta["total"] == 1

    snapshot = PriceSnapshot(
        trip_id=trip_id,
        flight_price=Decimal("99.00"),
        hotel_price=Decimal("199.00"),
        total_price=Decimal("298.00"),
        created_at=datetime.now(UTC),
    )
    test_session.add(snapshot)
    await test_session.commit()

    details_response = await trips_module.get_trip_details(
        trip_id=trip_id,
        page=1,
        limit=10,
        db=test_session,
        current_user=user_response,
    )
    assert details_response.data.trip.id == trip_id

    update_response = await trips_module.update_trip_status(
        trip_id=trip_id,
        payload=TripStatusUpdate(status=TripStatus.PAUSED),
        db=test_session,
        current_user=user_response,
    )
    assert update_response.data.status == TripStatus.PAUSED

    delete_response = await trips_module.delete_trip(
        trip_id=trip_id,
        db=test_session,
        current_user=user_response,
    )
    assert delete_response.status_code == 204


@pytest.mark.asyncio
async def test_refresh_all_trips_starts_workflow(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh@example.com")
    _authorize_client(client_with_csrf, user)

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    start_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "start_refresh_all_workflow", start_mock)

    response = client_with_csrf.post("/v1/trips/refresh-all")

    assert response.status_code == 200
    refresh_group_id = response.json()["data"]["refresh_group_id"]
    assert refresh_group_id.startswith("refresh-")
    start_mock.assert_called_once()
    called_user_id, called_refresh_id = start_mock.call_args.args
    assert called_user_id == user.id
    assert called_refresh_id == refresh_group_id


@pytest.mark.asyncio
async def test_refresh_all_trips_rejects_when_locked(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-locked@example.com")
    _authorize_client(client_with_csrf, user)

    mock_redis.set = AsyncMock(return_value=None)
    mock_redis.get = AsyncMock(return_value="refresh-existing")
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "start_refresh_all_workflow", AsyncMock())

    response = client_with_csrf.post("/v1/trips/refresh-all")

    assert response.status_code == 409
    assert "refresh-existing" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_all_trips_rejects_when_locked_bytes(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-bytes@example.com")
    _authorize_client(client_with_csrf, user)

    mock_redis.set = AsyncMock(return_value=None)
    mock_redis.get = AsyncMock(return_value=b"refresh-bytes")
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "start_refresh_all_workflow", AsyncMock())

    response = client_with_csrf.post("/v1/trips/refresh-all")

    assert response.status_code == 409
    assert "refresh-bytes" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_all_trips_reports_workflow_already_started(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-already@example.com")
    _authorize_client(client_with_csrf, user)

    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.delete = AsyncMock(return_value=1)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(
        trips_module,
        "start_refresh_all_workflow",
        AsyncMock(
            side_effect=temporal_exceptions.WorkflowAlreadyStartedError(
                "refresh-id", "RefreshAllTripsWorkflow"
            )
        ),
    )

    response = client_with_csrf.post("/v1/trips/refresh-all")

    assert response.status_code == 409
    assert response.json()["detail"] == "Refresh workflow already started."
    mock_redis.delete.assert_awaited_once()


@pytest.mark.asyncio
async def test_refresh_all_trips_reports_start_failure(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-fail@example.com")
    _authorize_client(client_with_csrf, user)

    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.delete = AsyncMock(return_value=1)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(
        trips_module,
        "start_refresh_all_workflow",
        AsyncMock(side_effect=RuntimeError("boom")),
    )

    response = client_with_csrf.post("/v1/trips/refresh-all")

    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to start refresh workflow."
    mock_redis.delete.assert_awaited_once()

@pytest.mark.asyncio
async def test_refresh_status_returns_progress(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-status@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    progress = {
        "status": "running",
        "total": 3,
        "completed": 1,
        "failed": 0,
        "in_progress": 2,
    }
    monkeypatch.setattr(trips_module, "get_refresh_progress", AsyncMock(return_value=progress))

    response = client_with_csrf.get("/v1/trips/refresh-status?refresh_group_id=refresh-123")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["refresh_group_id"] == "refresh-123"
    assert data["status"] == "running"
    assert data["total"] == 3
    assert data["completed"] == 1
    assert data["in_progress"] == 2


@pytest.mark.asyncio
async def test_refresh_status_not_found_returns_404(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-not-found@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    rpc_error = temporal_client.RPCError(
        "not found", temporal_client.RPCStatusCode.NOT_FOUND, b""
    )
    monkeypatch.setattr(trips_module, "get_refresh_progress", AsyncMock(side_effect=rpc_error))

    response = client_with_csrf.get("/v1/trips/refresh-status?refresh_group_id=refresh-missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Refresh group not found."


@pytest.mark.asyncio
async def test_refresh_status_reports_temporal_error(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-error@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    rpc_error = temporal_client.RPCError(
        "unknown", temporal_client.RPCStatusCode.INTERNAL, b""
    )
    monkeypatch.setattr(trips_module, "get_refresh_progress", AsyncMock(side_effect=rpc_error))

    response = client_with_csrf.get("/v1/trips/refresh-status?refresh_group_id=refresh-error")

    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to fetch refresh status."


@pytest.mark.asyncio
async def test_refresh_status_clears_lock_on_completion(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-complete@example.com")
    _authorize_client(client_with_csrf, user)

    mock_redis.delete = AsyncMock(return_value=1)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    progress = {
        "status": "completed",
        "total": 2,
        "completed": 2,
        "failed": 0,
        "in_progress": 0,
    }
    monkeypatch.setattr(trips_module, "get_refresh_progress", AsyncMock(return_value=progress))

    response = client_with_csrf.get("/v1/trips/refresh-status?refresh_group_id=refresh-done")

    assert response.status_code == 200
    mock_redis.delete.assert_awaited_once()


@pytest.mark.asyncio
async def test_refresh_trip_starts_workflow(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-single@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    trigger_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_mock)

    payload = _build_trip_payload(name="Refresh Single Trip")
    create_response = _create_trip(client_with_csrf, payload, "trip-refresh-single-1")
    trip_id = create_response.json()["data"]["id"]

    response = client_with_csrf.post(f"/v1/trips/{trip_id}/refresh")

    assert response.status_code == 200
    data = response.json()["data"]
    assert "refresh_group_id" in data
    assert data["refresh_group_id"].startswith("refresh-trip-")
    trigger_mock.assert_called()
    called_trip_id = trigger_mock.call_args.args[0]
    assert str(called_trip_id) == trip_id


@pytest.mark.asyncio
async def test_refresh_trip_not_found(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-single-missing@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client_with_csrf.post(f"/v1/trips/{uuid.uuid4()}/refresh")

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found."


@pytest.mark.asyncio
async def test_refresh_trip_workflow_failure(client_with_csrf, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-single-fail@example.com")
    _authorize_client(client_with_csrf, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    # First create a trip successfully
    trigger_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_mock)

    payload = _build_trip_payload(name="Refresh Fail Trip")
    create_response = _create_trip(client_with_csrf, payload, "trip-refresh-fail-1")
    trip_id = create_response.json()["data"]["id"]

    # Now make the trigger fail for the refresh call
    async def trigger_error(trip_id):
        raise PriceCheckWorkflowStartFailed(extra={"trip_id": str(trip_id)})

    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_error)

    response = client_with_csrf.post(f"/v1/trips/{trip_id}/refresh")

    assert response.status_code == 502
    assert response.json()["detail"] == "Trip created, but initial price check failed to start."


@pytest.mark.asyncio
async def test_refresh_trip_direct_call(test_session, monkeypatch):
    user = await _create_user(test_session, email="refresh-direct@example.com")
    user_response = trips_module.UserResponse(id=str(user.id), email=user.email)
    trigger_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_mock)

    payload = TripCreate(**_build_trip_payload(name="Direct Refresh Trip"))
    create_response = await trips_module.create_trip(
        payload,
        db=test_session,
        current_user=user_response,
    )
    trip_id = create_response.data.id

    refresh_response = await trips_module.refresh_trip(
        trip_id=trip_id,
        db=test_session,
        current_user=user_response,
    )

    assert refresh_response.data.refresh_group_id.startswith("refresh-trip-")
    # trigger was called twice: once for create, once for refresh
    assert trigger_mock.call_count == 2
