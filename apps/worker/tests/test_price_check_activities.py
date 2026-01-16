from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
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
async def test_fetch_flights_activity_not_configured(monkeypatch):
    monkeypatch.setattr(pc, "KIWI_CLIENT", None)
    result = await pc.fetch_flights_activity(_trip_details())
    assert result["error"] == "Kiwi MCP server is not configured"


@pytest.mark.asyncio
async def test_fetch_flights_activity_success(monkeypatch):
    class DummyClient:
        async def call_tool(self, _tool, _args):
            return {"data": [{"price": "199.99", "carrier": "UA"}]}

    monkeypatch.setattr(pc, "KIWI_CLIENT", DummyClient())
    result = await pc.fetch_flights_activity(_trip_details())

    assert result["offers"][0]["price"] == "199.99"
    assert result["error"] is None


@pytest.mark.asyncio
async def test_fetch_flights_activity_error(monkeypatch):
    class DummyClient:
        async def call_tool(self, _tool, _args):
            raise RuntimeError("boom")

    monkeypatch.setattr(pc, "KIWI_CLIENT", DummyClient())
    result = await pc.fetch_flights_activity(_trip_details())

    assert result["error"] == "boom"


@pytest.mark.asyncio
async def test_fetch_hotels_activity_not_configured(monkeypatch):
    monkeypatch.setattr(pc, "AMADEUS_CLIENT", None)
    result = await pc.fetch_hotels_activity(_trip_details())
    assert result["error"] == "Amadeus MCP server is not configured"


@pytest.mark.asyncio
async def test_fetch_hotels_activity_success(monkeypatch):
    class DummyClient:
        async def call_tool(self, _tool, _args):
            return {"data": [{"price": {"total": "499.99"}, "description": "Ocean view suite"}]}

    monkeypatch.setattr(pc, "AMADEUS_CLIENT", DummyClient())
    result = await pc.fetch_hotels_activity(_trip_details())

    assert result["offers"][0]["price"]["total"] == "499.99"
    assert result["error"] is None


@pytest.mark.asyncio
async def test_fetch_hotels_activity_error(monkeypatch):
    class DummyClient:
        async def call_tool(self, _tool, _args):
            raise RuntimeError("boom")

    monkeypatch.setattr(pc, "AMADEUS_CLIENT", DummyClient())
    result = await pc.fetch_hotels_activity(_trip_details())

    assert result["error"] == "boom"


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


@pytest.mark.asyncio
async def test_save_snapshot_activity(monkeypatch):
    trip_id = str(uuid.uuid4())
    session = DummySession(None, [])
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManager(session))

    payload = {
        "trip_id": trip_id,
        "flights": [{"price": "100.00"}],
        "hotels": [{"price": {"total": "200.00"}}],
        "raw_data": {"ok": True},
    }

    snapshot_id = await pc.save_snapshot_activity(payload)

    assert snapshot_id
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
    assert pc._format_kiwi_date("2026-02-15") == "15/02/2026"
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
