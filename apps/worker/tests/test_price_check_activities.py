from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from app.core.constants import CabinClass, RoomSelectionMode, StopsMode
from worker.activities import price_check as pc


@dataclass
class DummyResult:
    value: object

    def scalars(self) -> DummyResult:
        return self

    def first(self) -> object:
        return self.value


class DummySession:
    def __init__(self, trip, results) -> None:
        self._trip = trip
        self._results = iter(results)
        self.added = None

    async def get(self, _model, _id):
        return self._trip

    async def execute(self, *_args, **_kwargs):
        return next(self._results)

    def add(self, item) -> None:
        self.added = item

    async def commit(self) -> None:
        return None

    async def refresh(self, _item) -> None:
        return None


class DummySessionManager:
    def __init__(self, session: DummySession) -> None:
        self._session = session

    async def __aenter__(self) -> DummySession:
        return self._session

    async def __aexit__(self, *_exc) -> None:
        return None


def _trip_details() -> dict:
    return {
        "trip_id": str(uuid.uuid4()),
        "origin_airport": "SFO",
        "destination_code": "MCO",
        "is_round_trip": True,
        "depart_date": "2026-02-01",
        "return_date": "2026-02-08",
        "adults": 2,
        "flight_prefs": {
            "airlines": ["UA"],
            "stops_mode": "any",
            "max_stops": None,
            "cabin": "economy",
        },
        "hotel_prefs": {
            "rooms": 1,
            "adults_per_room": 2,
            "room_selection_mode": "cheapest",
            "preferred_room_types": [],
            "preferred_views": [],
        },
    }


@pytest.mark.asyncio
async def test_load_trip_details(monkeypatch):
    trip_id = uuid.uuid4()
    trip = SimpleNamespace(
        id=trip_id,
        origin_airport="SFO",
        destination_code="MCO",
        is_round_trip=True,
        depart_date=date(2026, 2, 1),
        return_date=date(2026, 2, 8),
        adults=2,
    )
    flight_prefs = SimpleNamespace(
        airlines=["UA"],
        stops_mode=StopsMode.ANY,
        max_stops=None,
        cabin=CabinClass.ECONOMY,
    )
    hotel_prefs = SimpleNamespace(
        rooms=1,
        adults_per_room=2,
        room_selection_mode=RoomSelectionMode.CHEAPEST,
        preferred_room_types=["King"],
        preferred_views=["Ocean"],
    )

    session = DummySession(trip, [DummyResult(flight_prefs), DummyResult(hotel_prefs)])
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManager(session))

    result = await pc.load_trip_details(str(trip_id))

    assert result["trip_id"] == str(trip_id)
    assert result["flight_prefs"]["stops_mode"] == "any"
    assert result["hotel_prefs"]["room_selection_mode"] == "cheapest"
    assert result["hotel_prefs"]["preferred_views"] == ["Ocean"]


@pytest.mark.asyncio
async def test_load_trip_details_not_found(monkeypatch):
    session = DummySession(None, [])
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManager(session))

    with pytest.raises(ValueError, match="Trip not found"):
        await pc.load_trip_details(str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_fetch_flights_activity_mock_mode(monkeypatch):
    """Test that mock mode returns mock data without calling the API."""
    monkeypatch.setattr(pc.settings, "mock_amadeus_api", True)
    result = await pc.fetch_flights_activity(_trip_details())

    assert len(result["offers"]) > 0
    assert result["error"] is None
    assert result["raw"]["provider"] == "amadeus_mock"


@pytest.mark.asyncio
async def test_fetch_flights_activity_success(monkeypatch):
    """Test successful flight search via configured flight provider."""

    class DummyClient:
        async def search_flights(self, **_kwargs):
            return {"data": [{"price": {"total": "199.99"}, "validatingAirlineCodes": ["UA"]}]}

    monkeypatch.setattr(pc.settings, "mock_amadeus_api", False)
    monkeypatch.setattr(pc, "_flight_provider", DummyClient())
    result = await pc.fetch_flights_activity(_trip_details())

    assert result["offers"][0]["price"]["total"] == "199.99"
    assert result["error"] is None


@pytest.mark.asyncio
async def test_fetch_flights_activity_error(monkeypatch):
    """Test error handling when flight provider fails."""

    class DummyClient:
        async def search_flights(self, **_kwargs):
            raise pc.AmadeusClientError("API error")

    monkeypatch.setattr(pc.settings, "mock_amadeus_api", False)
    monkeypatch.setattr(pc, "_flight_provider", DummyClient())
    result = await pc.fetch_flights_activity(_trip_details())

    assert result["error"] == "API error"


@pytest.mark.asyncio
async def test_fetch_hotels_activity_success(monkeypatch):
    """Test successful hotel search via Amadeus HTTP client."""

    class DummyClient:
        async def search_hotels(self, **_kwargs):
            return {"data": [{"price": {"total": "499.99"}, "description": "Ocean view suite"}]}

    monkeypatch.setattr(pc.settings, "mock_amadeus_api", False)
    monkeypatch.setattr(pc, "_amadeus_client", DummyClient())
    result = await pc.fetch_hotels_activity(_trip_details())

    assert result["offers"][0]["price"]["total"] == "499.99"
    assert result["error"] is None


@pytest.mark.asyncio
async def test_fetch_hotels_activity_error(monkeypatch):
    """Test error handling when Amadeus HTTP client fails."""

    class DummyClient:
        async def search_hotels(self, **_kwargs):
            raise pc.AmadeusClientError("API error")

    monkeypatch.setattr(pc.settings, "mock_amadeus_api", False)
    monkeypatch.setattr(pc, "_amadeus_client", DummyClient())
    result = await pc.fetch_hotels_activity(_trip_details())

    assert result["error"] == "API error"


@pytest.mark.asyncio
async def test_fetch_hotels_activity_mock_mode(monkeypatch):
    """Test that mock mode returns mock data without calling the API."""
    monkeypatch.setattr(pc.settings, "mock_amadeus_api", True)
    result = await pc.fetch_hotels_activity(_trip_details())

    assert len(result["offers"]) > 0
    assert result["error"] is None
    assert result["raw"]["provider"] == "amadeus_mock"


@pytest.mark.asyncio
async def test_filter_results_activity_builds_summary():
    payload = {
        "flight_result": {"offers": [{"price": "100"}], "raw": {"ok": True}, "error": None},
        "hotel_result": {"offers": [{"price": "200"}], "raw": {"ok": True}, "error": "fail"},
        "flight_prefs": {"airlines": []},
        "hotel_prefs": {"preferred_room_types": [], "preferred_views": []},
    }

    result = await pc.filter_results_activity(payload)

    assert result["raw_data"]["errors"]["hotels"] == "fail"
    assert result["raw_data"]["filtered_counts"] == {"flights": 1, "hotels": 1}


class DummySessionWithDedup:
    """Session mock that supports deduplication queries."""

    def __init__(self, trip, results, recent_snapshot=None) -> None:
        self._trip = trip
        self._results = iter(results)
        self._recent_snapshot = recent_snapshot
        self.added = None
        self._execute_count = 0

    async def get(self, _model, _id):
        return self._trip

    async def execute(self, *_args, **_kwargs):
        # First execute call is for dedup check
        self._execute_count += 1
        if self._execute_count == 1 and self._recent_snapshot is not None:
            return DummyResult(self._recent_snapshot)
        if self._execute_count == 1:
            return DummyResult(None)  # No recent snapshot
        return next(self._results)

    def add(self, item) -> None:
        self.added = item

    async def commit(self) -> None:
        return None

    async def refresh(self, _item) -> None:
        return None


class DummySessionManagerWithDedup:
    def __init__(self, session: DummySessionWithDedup) -> None:
        self._session = session

    async def __aenter__(self) -> DummySessionWithDedup:
        return self._session

    async def __aexit__(self, *_exc) -> None:
        return None


@pytest.mark.asyncio
async def test_save_snapshot_activity(monkeypatch):
    trip_id = str(uuid.uuid4())
    session = DummySessionWithDedup(None, [], recent_snapshot=None)
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManagerWithDedup(session))

    payload = {
        "trip_id": trip_id,
        "flights": [{"price": "100.00"}],
        "hotels": [{"price": {"total": "200.00"}}],
        "raw_data": {"ok": True},
    }

    snapshot_id = await pc.save_snapshot_activity(payload)

    assert snapshot_id
    assert session.added.total_price == Decimal("300.00")


@pytest.mark.asyncio
async def test_save_snapshot_activity_dedup_skips_recent(monkeypatch):
    """Test that duplicate snapshots within window are skipped."""
    trip_id = str(uuid.uuid4())
    existing_snapshot_id = uuid.uuid4()
    recent_snapshot = SimpleNamespace(
        id=existing_snapshot_id,
        created_at=datetime.now(UTC) - timedelta(seconds=30),  # 30 seconds ago
        raw_data={"ok": True},  # No errors, so dedup should skip
    )
    session = DummySessionWithDedup(None, [], recent_snapshot=recent_snapshot)
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManagerWithDedup(session))

    payload = {
        "trip_id": trip_id,
        "flights": [{"price": "100.00"}],
        "hotels": [{"price": {"total": "200.00"}}],
        "raw_data": {"ok": True},
    }

    snapshot_id = await pc.save_snapshot_activity(payload)

    # Should return existing snapshot ID without creating new one
    assert snapshot_id == str(existing_snapshot_id)
    assert session.added is None  # No new snapshot was added


@pytest.mark.asyncio
async def test_save_snapshot_activity_dedup_allows_after_window(monkeypatch):
    """Test that snapshots are allowed after dedup window expires."""
    trip_id = str(uuid.uuid4())
    # This simulates a query that finds nothing (the snapshot is outside the 60 second window)
    session = DummySessionWithDedup(None, [], recent_snapshot=None)
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManagerWithDedup(session))

    payload = {
        "trip_id": trip_id,
        "flights": [{"price": "150.00"}],
        "hotels": [{"price": {"total": "250.00"}}],
        "raw_data": {"ok": True},
    }

    snapshot_id = await pc.save_snapshot_activity(payload)

    # Should create a new snapshot
    assert snapshot_id
    assert session.added is not None
    assert session.added.total_price == Decimal("400.00")


@pytest.mark.asyncio
async def test_save_snapshot_activity_allows_retry_after_error(monkeypatch):
    """Test that a new snapshot is allowed when recent snapshot had errors."""
    trip_id = str(uuid.uuid4())
    existing_snapshot_id = uuid.uuid4()
    # Recent snapshot that had errors (flight fetch failed)
    recent_snapshot = SimpleNamespace(
        id=existing_snapshot_id,
        created_at=datetime.now(UTC) - timedelta(seconds=30),  # 30 seconds ago
        raw_data={"errors": {"flights": "Failed to fetch flights: No flights found"}},
    )
    session = DummySessionWithDedup(None, [], recent_snapshot=recent_snapshot)
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManagerWithDedup(session))

    payload = {
        "trip_id": trip_id,
        "flights": [{"price": "100.00"}],
        "hotels": [{"price": {"total": "200.00"}}],
        "raw_data": {"ok": True},  # This attempt has good data
    }

    snapshot_id = await pc.save_snapshot_activity(payload)

    # Should create a NEW snapshot (not return the error snapshot)
    assert snapshot_id != str(existing_snapshot_id)
    assert session.added is not None
    assert session.added.total_price == Decimal("300.00")


def test_filter_helpers_and_price_extraction():
    flights = [
        {"operating_carrier": "UA", "price": "120"},
        {"carrier": ["AA", "DL"], "price": "140"},
        {"price": "160"},
    ]
    hotels = [
        {"description": "Ocean view suite", "price": {"total": "300"}},
        {"description": "Garden room", "price": {"total": "200"}},
    ]
    flight_prefs = {"airlines": ["UA"]}
    hotel_prefs = {"preferred_room_types": ["Suite"], "preferred_views": ["Ocean"]}

    filtered_flights = pc._filter_flights(flights, flight_prefs)
    filtered_hotels = pc._filter_hotels(hotels, hotel_prefs)

    assert len(filtered_flights) == 1
    assert len(filtered_hotels) == 1
    assert pc._filter_flights(flights, {"airlines": []}) == flights
    assert pc._extract_min_price([]) is None
    assert pc._extract_min_price(flights) == Decimal("120")
    assert pc._extract_price_value({"price": None}) is None
    assert pc._extract_price_value({"note": "no price"}) is None
    assert pc._extract_price_value({"price": {"total": "55.50"}}) == Decimal("55.50")
    assert pc._extract_offers({"data": [{"price": "100"}]})[0]["price"] == "100"
    assert pc._extract_offers([{"price": "90"}, "bad"]) == [{"price": "90"}]
    assert pc._extract_offers({"data": {"offers": [{"price": "75"}]}})[0]["price"] == "75"
    assert pc._extract_offers({"data": {"note": "none"}}) == []
    assert pc._extract_offers("bad") == []
    assert pc._normalize_raw([{"ok": True}], "kiwi")["provider"] == "kiwi"
    assert pc._normalize_raw("raw", "kiwi")["response"] == "raw"
    assert pc._matches_keywords(None, ["suite"]) is False
    assert pc._matches_view("standard room", ["ocean"]) is False
    assert pc._matches_view(None, ["ocean"]) is False
    assert pc._to_decimal(None) is None
    assert pc._to_decimal("nope") is None
    # Amadeus V3 hotel-offers nested price extraction
    v3_hotel = {"hotel": {"name": "Test"}, "offers": [{"price": {"total": "289.00"}}]}
    assert pc._extract_price_value(v3_hotel) == Decimal("289.00")
    assert pc._extract_min_price([v3_hotel]) == Decimal("289.00")
    # No offers array
    assert pc._extract_price_value({"hotel": {"name": "Test"}}) is None
