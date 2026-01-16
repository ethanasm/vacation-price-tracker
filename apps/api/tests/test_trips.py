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
    return client.post(
        "/v1/trips",
        json=payload,
        headers={"X-Idempotency-Key": idempotency_key},
    )


@pytest.mark.asyncio
async def test_create_trip_success(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="create@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    trigger_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_mock)

    payload = _build_trip_payload()
    response = _create_trip(client, payload, "trip-create-1")

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == payload["name"]
    assert data["notification_prefs"]["threshold_value"] == payload["notification_prefs"]["threshold_value"]
    trigger_mock.assert_called_once()


@pytest.mark.asyncio
async def test_create_trip_reports_price_check_failure(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="create-fail@example.com")
    _authorize_client(client, user)

    async def trigger_error(trip_id):
        raise PriceCheckWorkflowStartFailed(extra={"trip_id": str(trip_id)})

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_error)

    payload = _build_trip_payload(name="Failure Trip")
    response = _create_trip(client, payload, "trip-create-fail-1")

    assert response.status_code == 502
    body = response.json()
    assert body["detail"] == "Trip created, but initial price check failed to start."
    trip_id = body["trip_id"]

    trip = await test_session.get(Trip, uuid.UUID(trip_id))
    assert trip is not None
    assert trip.status == TripStatus.ERROR


@pytest.mark.asyncio
async def test_create_trip_rejects_duplicate_name(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="duplicate@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Duplicate Trip")
    response_one = _create_trip(client, payload, "trip-duplicate-1")
    response_two = _create_trip(client, payload, "trip-duplicate-2")

    assert response_one.status_code == 201
    assert response_two.status_code == 409
    assert response_two.json()["detail"] == "Trip name already exists."


@pytest.mark.asyncio
async def test_create_trip_rejects_when_limit_exceeded(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="limit@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())
    monkeypatch.setattr(settings, "max_trips_per_user", 1)

    payload = _build_trip_payload(name="First Trip")
    response_one = _create_trip(client, payload, "trip-limit-1")
    response_two = _create_trip(client, _build_trip_payload(name="Second Trip"), "trip-limit-2")

    assert response_one.status_code == 201
    assert response_two.status_code == 400
    assert response_two.json()["detail"] == "Trip limit exceeded."

@pytest.mark.asyncio
async def test_create_trip_duplicate_idempotency(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="dupe@example.com")
    _authorize_client(client, user)

    fake_redis = _FakeRedis()
    monkeypatch.setattr(idempotency_module, "redis_client", fake_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload_one = _build_trip_payload(name="First Trip")
    response_one = _create_trip(client, payload_one, "trip-dupe")
    response_two = _create_trip(client, payload_one, "trip-dupe")

    assert response_one.status_code == 201
    assert response_two.status_code == 201
    assert response_one.json()["data"]["id"] == response_two.json()["data"]["id"]


@pytest.mark.asyncio
async def test_create_trip_idempotency_conflict(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="conflict@example.com")
    _authorize_client(client, user)

    fake_redis = _FakeRedis()
    monkeypatch.setattr(idempotency_module, "redis_client", fake_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload_one = _build_trip_payload(name="First Trip")
    payload_two = _build_trip_payload(name="Second Trip")

    response_one = _create_trip(client, payload_one, "trip-conflict")
    response_two = _create_trip(client, payload_two, "trip-conflict")

    assert response_one.status_code == 201
    assert response_two.status_code == 409
    assert response_two.json()["detail"] == "Idempotency key conflict"


@pytest.mark.asyncio
async def test_create_trip_idempotency_returns_cached_response(client, test_session, monkeypatch):
    user = await _create_user(test_session, email="cache@example.com")
    _authorize_client(client, user)

    fake_redis = _FakeRedis()
    monkeypatch.setattr(idempotency_module, "redis_client", fake_redis)
    trigger_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", trigger_mock)

    payload = _build_trip_payload(name="Cached Trip")
    response_one = _create_trip(client, payload, "trip-cache")
    response_two = _create_trip(client, payload, "trip-cache")

    assert response_one.status_code == 201
    assert response_two.status_code == 201
    assert response_one.json()["data"]["id"] == response_two.json()["data"]["id"]
    assert trigger_mock.call_count == 1

    count_stmt = select(func.count()).select_from(Trip).where(Trip.user_id == user.id)
    trip_count = (await test_session.execute(count_stmt)).scalar_one()
    assert trip_count == 1


@pytest.mark.asyncio
async def test_create_trip_requires_idempotency_key(client, test_session, monkeypatch):
    user = User(google_sub=str(uuid.uuid4()), email="missing-key@example.com")
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)

    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Missing Key Trip")
    response = client.post("/v1/trips", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == "X-Idempotency-Key header required"


@pytest.mark.asyncio
async def test_list_trips_includes_latest_snapshot(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="list@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload_one = _build_trip_payload(name="Trip One")
    payload_two = _build_trip_payload(name="Trip Two")

    response_one = _create_trip(client, payload_one, "trip-list-1")
    response_two = _create_trip(client, payload_two, "trip-list-2")

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

    response = client.get("/v1/trips?page=1&limit=10")

    assert response.status_code == 200
    body = response.json()
    trip_map = {trip["id"]: trip for trip in body["data"]}

    assert trip_map[trip_one_id]["total_price"] == "330.00"
    assert trip_map[trip_two_id]["total_price"] == "230.00"
    assert body["meta"]["total"] == 2


@pytest.mark.asyncio
async def test_list_trips_filters_by_status(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="filter@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    response_one = _create_trip(client, _build_trip_payload(name="Active Trip"), "trip-filter-1")
    response_two = _create_trip(client, _build_trip_payload(name="Paused Trip"), "trip-filter-2")

    trip_one_id = response_one.json()["data"]["id"]
    trip_two_id = response_two.json()["data"]["id"]

    pause_response = client.patch(
        f"/v1/trips/{trip_two_id}/status",
        json={"status": TripStatus.PAUSED.value},
    )
    assert pause_response.status_code == 200

    paused_list = client.get("/v1/trips?status=paused")
    assert paused_list.status_code == 200
    paused_ids = {trip["id"] for trip in paused_list.json()["data"]}
    assert paused_ids == {trip_two_id}

    active_list = client.get("/v1/trips?status=active")
    assert active_list.status_code == 200
    active_ids = {trip["id"] for trip in active_list.json()["data"]}
    assert active_ids == {trip_one_id}


@pytest.mark.asyncio
async def test_list_trips_empty_returns_meta(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="empty-list@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client.get("/v1/trips?page=1&limit=10")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == []
    assert body["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_get_trip_details_includes_history(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="detail@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Detail Trip")
    payload["flight_prefs"] = {"airlines": ["UA"]}
    payload["hotel_prefs"] = {"rooms": 2, "preferred_views": ["Ocean"]}

    create_response = _create_trip(client, payload, "trip-detail-1")
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

    response = client.get(f"/v1/trips/{trip_id}?page=1&limit=1")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["total"] == 2
    assert len(body["data"]["price_history"]) == 1
    assert body["data"]["trip"]["flight_prefs"]["airlines"] == ["UA"]
    assert body["data"]["trip"]["hotel_prefs"]["rooms"] == 2
    assert body["data"]["trip"]["current_flight_price"] == "140.00"


@pytest.mark.asyncio
async def test_get_trip_details_not_found(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="detail-missing@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client.get(f"/v1/trips/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found."


@pytest.mark.asyncio
async def test_update_trip_status(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="status@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Status Trip")
    create_response = _create_trip(client, payload, "trip-status-1")
    trip_id = create_response.json()["data"]["id"]

    response = client.patch(
        f"/v1/trips/{trip_id}/status",
        json={"status": TripStatus.PAUSED.value},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == TripStatus.PAUSED.value


@pytest.mark.asyncio
async def test_update_trip_status_not_found(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="status-missing@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client.patch(
        f"/v1/trips/{uuid.uuid4()}/status",
        json={"status": TripStatus.PAUSED.value},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found."


@pytest.mark.asyncio
async def test_delete_trip(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="delete@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "trigger_price_check_workflow", AsyncMock())

    payload = _build_trip_payload(name="Delete Trip")
    create_response = _create_trip(client, payload, "trip-delete-1")
    trip_id = create_response.json()["data"]["id"]

    delete_response = client.delete(f"/v1/trips/{trip_id}")
    assert delete_response.status_code == 204

    fetch_response = client.get(f"/v1/trips/{trip_id}")
    assert fetch_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_trip_not_found(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="delete-missing@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)

    response = client.delete(f"/v1/trips/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found."


@pytest.mark.asyncio
async def test_trip_helpers_handle_missing_data(test_session):
    assert trips_module._flight_prefs_to_schema(None) is None
    assert trips_module._hotel_prefs_to_schema(None) is None
    assert trips_module._notification_prefs_to_schema(None) is None

    latest_snapshot = await trips_module._get_latest_snapshot(test_session, uuid.uuid4())
    assert latest_snapshot is None


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
async def test_refresh_all_trips_starts_workflow(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh@example.com")
    _authorize_client(client, user)

    mock_redis.set = AsyncMock(return_value=True)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    start_mock = AsyncMock()
    monkeypatch.setattr(trips_module, "start_refresh_all_workflow", start_mock)

    response = client.post("/v1/trips/refresh-all")

    assert response.status_code == 200
    refresh_group_id = response.json()["data"]["refresh_group_id"]
    assert refresh_group_id.startswith("refresh-")
    start_mock.assert_called_once()
    called_user_id, called_refresh_id = start_mock.call_args.args
    assert called_user_id == user.id
    assert called_refresh_id == refresh_group_id


@pytest.mark.asyncio
async def test_refresh_all_trips_rejects_when_locked(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-locked@example.com")
    _authorize_client(client, user)

    mock_redis.set = AsyncMock(return_value=None)
    mock_redis.get = AsyncMock(return_value="refresh-existing")
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "start_refresh_all_workflow", AsyncMock())

    response = client.post("/v1/trips/refresh-all")

    assert response.status_code == 409
    assert "refresh-existing" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_all_trips_rejects_when_locked_bytes(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-bytes@example.com")
    _authorize_client(client, user)

    mock_redis.set = AsyncMock(return_value=None)
    mock_redis.get = AsyncMock(return_value=b"refresh-bytes")
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(trips_module, "start_refresh_all_workflow", AsyncMock())

    response = client.post("/v1/trips/refresh-all")

    assert response.status_code == 409
    assert "refresh-bytes" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_all_trips_reports_workflow_already_started(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-already@example.com")
    _authorize_client(client, user)

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

    response = client.post("/v1/trips/refresh-all")

    assert response.status_code == 409
    assert response.json()["detail"] == "Refresh workflow already started."
    mock_redis.delete.assert_awaited_once()


@pytest.mark.asyncio
async def test_refresh_all_trips_reports_start_failure(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-fail@example.com")
    _authorize_client(client, user)

    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.delete = AsyncMock(return_value=1)
    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    monkeypatch.setattr(
        trips_module,
        "start_refresh_all_workflow",
        AsyncMock(side_effect=RuntimeError("boom")),
    )

    response = client.post("/v1/trips/refresh-all")

    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to start refresh workflow."
    mock_redis.delete.assert_awaited_once()

@pytest.mark.asyncio
async def test_refresh_status_returns_progress(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-status@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    progress = {
        "status": "running",
        "total": 3,
        "completed": 1,
        "failed": 0,
        "in_progress": 2,
    }
    monkeypatch.setattr(trips_module, "get_refresh_progress", AsyncMock(return_value=progress))

    response = client.get("/v1/trips/refresh-status?refresh_group_id=refresh-123")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["refresh_group_id"] == "refresh-123"
    assert data["status"] == "running"
    assert data["total"] == 3
    assert data["completed"] == 1
    assert data["in_progress"] == 2


@pytest.mark.asyncio
async def test_refresh_status_not_found_returns_404(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-not-found@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    rpc_error = temporal_client.RPCError(
        "not found", temporal_client.RPCStatusCode.NOT_FOUND, b""
    )
    monkeypatch.setattr(trips_module, "get_refresh_progress", AsyncMock(side_effect=rpc_error))

    response = client.get("/v1/trips/refresh-status?refresh_group_id=refresh-missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Refresh group not found."


@pytest.mark.asyncio
async def test_refresh_status_reports_temporal_error(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-error@example.com")
    _authorize_client(client, user)

    monkeypatch.setattr(trips_module, "redis_client", mock_redis)
    rpc_error = temporal_client.RPCError(
        "unknown", temporal_client.RPCStatusCode.INTERNAL, b""
    )
    monkeypatch.setattr(trips_module, "get_refresh_progress", AsyncMock(side_effect=rpc_error))

    response = client.get("/v1/trips/refresh-status?refresh_group_id=refresh-error")

    assert response.status_code == 502
    assert response.json()["detail"] == "Failed to fetch refresh status."


@pytest.mark.asyncio
async def test_refresh_status_clears_lock_on_completion(client, test_session, mock_redis, monkeypatch):
    user = await _create_user(test_session, email="refresh-complete@example.com")
    _authorize_client(client, user)

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

    response = client.get("/v1/trips/refresh-status?refresh_group_id=refresh-done")

    assert response.status_code == 200
    mock_redis.delete.assert_awaited_once()
