from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from app.core.constants import CabinClass, RoomSelectionMode, StopsMode
from worker.activities import price_check as pc
from worker.types import TripDetails


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
        "track_flights": True,
        "track_hotels": True,
        "flight_prefs": {
            "airlines": ["UA"],
            "stops_mode": "any",
            "max_stops": None,
            "cabin": "economy",
        },
        "hotel_prefs": {
            "rooms": 1,
            "adults_per_room": 2,
            "city": None,
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
        track_flights=True,
        track_hotels=True,
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
        city=None,
        room_selection_mode=RoomSelectionMode.CHEAPEST,
        preferred_room_types=["King"],
        preferred_views=["Ocean"],
        min_star_rating=None,
    )

    session = DummySession(trip, [DummyResult(flight_prefs), DummyResult(hotel_prefs)])
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManager(session))

    result = await pc.load_trip_details(str(trip_id))

    assert result["trip_id"] == str(trip_id)
    assert result["track_flights"] is True
    assert result["track_hotels"] is True
    assert result["flight_prefs"]["stops_mode"] == "any"
    assert result["hotel_prefs"]["room_selection_mode"] == "cheapest"
    assert result["hotel_prefs"]["preferred_views"] == ["Ocean"]
    assert result["hotel_prefs"]["city"] is None


@pytest.mark.asyncio
async def test_load_trip_details_returns_track_flags_and_city(monkeypatch):
    trip_id = uuid.uuid4()
    trip = SimpleNamespace(
        id=trip_id,
        origin_airport="SFO",
        destination_code="MCO",
        is_round_trip=True,
        depart_date=date(2026, 5, 1),
        return_date=date(2026, 5, 8),
        adults=2,
        track_flights=False,
        track_hotels=True,
    )
    hotel_prefs = SimpleNamespace(
        rooms=1,
        adults_per_room=2,
        city="Downtown Orlando",
        room_selection_mode=RoomSelectionMode.CHEAPEST,
        preferred_room_types=[],
        preferred_views=[],
        min_star_rating=None,
    )

    session = DummySession(trip, [DummyResult(None), DummyResult(hotel_prefs)])
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManager(session))

    result = await pc.load_trip_details(str(trip_id))
    assert result["trip_id"] == str(trip_id)
    assert result["track_flights"] is False
    assert result["track_hotels"] is True
    assert result["hotel_prefs"]["city"] == "Downtown Orlando"


@pytest.mark.asyncio
async def test_load_trip_details_one_way(monkeypatch):
    """One-way trip: return_date is None, no hotel_prefs attached."""
    trip_id = uuid.uuid4()
    trip = SimpleNamespace(
        id=trip_id,
        origin_airport="SFO",
        destination_code="MCO",
        is_round_trip=False,
        depart_date=date(2026, 2, 1),
        return_date=None,
        adults=1,
        track_flights=True,
        track_hotels=False,
    )
    flight_prefs = SimpleNamespace(
        airlines=[],
        stops_mode=StopsMode.ANY,
        max_stops=None,
        cabin=CabinClass.ECONOMY,
    )

    session = DummySession(trip, [DummyResult(flight_prefs), DummyResult(None)])
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManager(session))

    result = await pc.load_trip_details(str(trip_id))

    assert result["return_date"] is None
    assert result["is_round_trip"] is False
    assert result["hotel_prefs"] is None
    assert result["track_flights"] is True
    assert result["track_hotels"] is False


@pytest.mark.asyncio
async def test_fetch_hotels_skips_for_one_way(monkeypatch):
    """fetch_hotels_activity returns empty offers when return_date is None."""
    trip = _trip_details()
    trip["is_round_trip"] = False
    trip["return_date"] = None
    trip["hotel_prefs"] = None

    result = await pc.fetch_hotels_activity(trip)

    assert result["offers"] == []
    assert result["error"] is None
    assert result["raw"]["status"] == "skipped"


@pytest.mark.asyncio
async def test_load_trip_details_not_found(monkeypatch):
    session = DummySession(None, [])
    monkeypatch.setattr(pc, "AsyncSessionLocal", lambda: DummySessionManager(session))

    with pytest.raises(ValueError, match="Trip not found"):
        await pc.load_trip_details(str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_fetch_flights_activity_mock_mode(monkeypatch):
    """Test that mock mode returns mock data without calling the Skiplagged API."""
    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", True)
    result = await pc.fetch_flights_activity(_trip_details())

    assert len(result["offers"]) > 0
    assert result["error"] is None
    assert result["raw"]["provider"] == "skiplagged_mock"


@pytest.mark.asyncio
async def test_fetch_flights_activity_success(monkeypatch):
    """Test successful flight search via Skiplagged client."""
    from decimal import Decimal
    from unittest.mock import AsyncMock, patch

    from app.schemas.flight_search import FlightSearchFlight, FlightSearchResult

    mock_flight = FlightSearchFlight(
        departure_airport="SFO",
        arrival_airport="MCO",
        price_amount=Decimal("199.99"),
        price_currency="USD",
        price_display="$199.99 USD",
        provider="skiplagged",
        raw_data={"id": "SFO-MCO-2026-02-01-trip=UA200"},
    )
    mock_result = FlightSearchResult(
        flights=[mock_flight],
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
        return_date="2026-02-08",
        is_round_trip=True,
        provider="skiplagged",
        total_results=1,
        currency="USD",
        success=True,
        error=None,
    )
    mock_client = AsyncMock()
    mock_client.search_flights_all = AsyncMock(return_value=mock_result)

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)
    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        result = await pc.fetch_flights_activity(_trip_details())

    assert len(result["offers"]) == 1
    assert result["offers"][0]["price"] == "199.99"
    assert result["error"] is None


@pytest.mark.asyncio
async def test_fetch_flights_activity_error(monkeypatch):
    """Skiplagged failures propagate so Temporal can retry / fail the workflow."""
    from unittest.mock import AsyncMock, patch

    from app.clients.skiplagged import SkiplaggedConnectionError

    mock_client = AsyncMock()
    mock_client.search_flights_all = AsyncMock(side_effect=SkiplaggedConnectionError("API error"))

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)
    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(SkiplaggedConnectionError, match="API error"):
            await pc.fetch_flights_activity(_trip_details())


@pytest.mark.asyncio
async def test_fetch_hotels_activity_success(monkeypatch):
    """Test successful hotel search via Skiplagged client."""
    from decimal import Decimal
    from unittest.mock import AsyncMock, patch

    from app.schemas.hotel_search import HotelSearchHotel, HotelSearchResult
    from app.schemas.skiplagged import SkiplaggedHotelDetail, SkiplaggedRoom

    hotels = [
        HotelSearchHotel(
            id="hotel_1",
            name="Ocean View Hotel",
            price_per_night=Decimal("499.99"),
            price_currency="USD",
            provider="skiplagged",
        )
    ]
    mock_hotel_result = HotelSearchResult(
        hotels=hotels,
        city="MCO",
        checkin="2026-02-01",
        checkout="2026-02-08",
        total_results=1,
        success=True,
    )
    mock_detail = SkiplaggedHotelDetail(
        hotelId="hotel_1",
        hotelName="Ocean View Hotel",
        totalPriceInDollars=499.99,
        checkinDate="2026-02-01",
        checkoutDate="2026-02-08",
        rooms=[
            SkiplaggedRoom(
                id="r1",
                title="Ocean View Suite",
                occupancyLimit=2,
                pricePerNightInDollars=499.99,
                totalPriceInDollars=3499.93,
                taxesAndFeesInDollars=350.0,
                currency="USD",
                refundable=True,
                freeCancellation=True,
                bookingLink="https://example.com",
            )
        ],
    )

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(return_value=mock_hotel_result)
    mock_client.get_hotel_details = AsyncMock(return_value=mock_detail)

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)
    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        result = await pc.fetch_hotels_activity(_trip_details())

    assert len(result["offers"]) == 1
    assert result["offers"][0]["name"] == "Ocean View Hotel"
    assert result["error"] is None


@pytest.mark.asyncio
async def test_fetch_hotels_activity_error(monkeypatch):
    """Skiplagged hotel failures propagate to the workflow rather than being swallowed."""
    from unittest.mock import AsyncMock, patch

    from app.clients.skiplagged import SkiplaggedConnectionError

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(side_effect=SkiplaggedConnectionError("API error"))

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)
    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(SkiplaggedConnectionError, match="API error"):
            await pc.fetch_hotels_activity(_trip_details())


@pytest.mark.asyncio
async def test_fetch_hotels_activity_mock_mode(monkeypatch):
    """Test that mock mode returns mock data without calling the Skiplagged API."""
    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", True)
    result = await pc.fetch_hotels_activity(_trip_details())

    assert len(result["offers"]) > 0
    assert result["error"] is None
    assert result["raw"]["provider"] == "skiplagged_mock"


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
    # Skiplagged hotel format: filtering by room titles
    hotels = [
        {
            "rooms": [{"title": "Ocean View Suite"}, {"title": "Standard Room"}],
            "amenities": ["Pool"],
            "price": {"total": "300"},
        },
        {
            "rooms": [{"title": "Garden Room"}],
            "amenities": ["Gym"],
            "price": {"total": "200"},
        },
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
    assert pc._normalize_raw([{"ok": True}], "skiplagged")["provider"] == "skiplagged"
    assert pc._normalize_raw("raw", "skiplagged")["response"] == "raw"
    assert pc._matches_keywords(None, ["suite"]) is False
    assert pc._matches_view("standard room", ["ocean"]) is False
    assert pc._matches_view(None, ["ocean"]) is False
    assert pc._to_decimal(None) is None
    assert pc._to_decimal("nope") is None
    # Nested price extraction (offers array)
    nested_hotel = {"hotel": {"name": "Test"}, "offers": [{"price": {"total": "289.00"}}]}
    assert pc._extract_price_value(nested_hotel) == Decimal("289.00")
    assert pc._extract_min_price([nested_hotel]) == Decimal("289.00")
    # No offers array
    assert pc._extract_price_value({"hotel": {"name": "Test"}}) is None


# ---------------------------------------------------------------------------
# Task 9: fetch_flights_activity uses SkiplaggedClient
# ---------------------------------------------------------------------------

sample_trip_details = _trip_details()


@pytest.mark.asyncio
async def test_fetch_flights_uses_skiplagged(monkeypatch):
    """Verify fetch_flights_activity calls SkiplaggedClient.search_flights_all."""
    from unittest.mock import AsyncMock, patch

    from app.schemas.flight_search import FlightSearchResult

    mock_result = FlightSearchResult(
        flights=[],
        origin="SFO",
        destination="CDG",
        departure_date="2026-06-15",
        return_date="2026-06-22",
        is_round_trip=True,
        provider="skiplagged",
        total_results=0,
        currency="USD",
        success=True,
        error=None,
    )
    mock_client = AsyncMock()
    mock_client.search_flights_all = AsyncMock(return_value=mock_result)

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        await pc.fetch_flights_activity(sample_trip_details)

    mock_client.search_flights_all.assert_called_once()
    call_kwargs = mock_client.search_flights_all.call_args
    assert call_kwargs.kwargs.get("max_pages") == 4 or (
        call_kwargs[1].get("max_pages") == 4 if call_kwargs[1] else False
    )


@pytest.mark.asyncio
async def test_fetch_flights_skiplagged_error(monkeypatch):
    """SkiplaggedClient errors propagate so Temporal retries / fails the workflow."""
    from unittest.mock import AsyncMock, patch

    from app.clients.skiplagged import SkiplaggedConnectionError

    mock_client = AsyncMock()
    mock_client.search_flights_all = AsyncMock(side_effect=SkiplaggedConnectionError("connection refused"))

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(SkiplaggedConnectionError, match="connection refused"):
            await pc.fetch_flights_activity(sample_trip_details)


@pytest.mark.asyncio
async def test_fetch_flights_mock_mode_skiplagged(monkeypatch):
    """Verify mock mode returns mock data when mock_skiplagged_api is True."""
    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", True)
    result = await pc.fetch_flights_activity(sample_trip_details)

    assert len(result["offers"]) > 0
    assert result["error"] is None
    assert result["raw"]["provider"] == "skiplagged_mock"


# ---------------------------------------------------------------------------
# Task 10: fetch_hotels_activity uses SkiplaggedClient with details cap at 20
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_hotels_uses_skiplagged_with_details(monkeypatch):
    """Verify fetch_hotels_activity calls search_hotels_all then get_hotel_details for top 20."""
    from decimal import Decimal
    from unittest.mock import AsyncMock, patch

    from app.schemas.hotel_search import HotelSearchHotel, HotelSearchResult
    from app.schemas.skiplagged import SkiplaggedHotelDetail, SkiplaggedRoom

    # Create 25 mock hotels (should only detail-check top 20)
    hotels = [
        HotelSearchHotel(
            id=f"hotel_{i}",
            name=f"Hotel {i}",
            price_per_night=Decimal(str(50 + i * 10)),
            price_currency="USD",
            provider="skiplagged",
        )
        for i in range(25)
    ]
    mock_hotel_result = HotelSearchResult(
        hotels=hotels,
        city="PAR",
        checkin="2026-06-15",
        checkout="2026-06-22",
        total_results=25,
        success=True,
    )
    mock_detail = SkiplaggedHotelDetail(
        hotelId="1",
        hotelName="Test",
        totalPriceInDollars=500.0,
        checkinDate="2026-06-15",
        checkoutDate="2026-06-22",
        rooms=[
            SkiplaggedRoom(
                id="r1",
                title="Standard Room",
                occupancyLimit=2,
                pricePerNightInDollars=70.0,
                totalPriceInDollars=490.0,
                taxesAndFeesInDollars=50.0,
                currency="USD",
                refundable=False,
                freeCancellation=False,
                bookingLink="https://example.com",
            )
        ],
    )

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(return_value=mock_hotel_result)
    mock_client.get_hotel_details = AsyncMock(return_value=mock_detail)

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        result = await pc.fetch_hotels_activity(sample_trip_details)

    # Should call get_hotel_details exactly 20 times (capped)
    assert mock_client.get_hotel_details.call_count == 20
    assert result["error"] is None


@pytest.mark.asyncio
async def test_fetch_hotels_detail_cap_respects_fewer_than_20(monkeypatch):
    """Verify when fewer than 20 hotels returned, details called for each."""
    from decimal import Decimal
    from unittest.mock import AsyncMock, patch

    from app.schemas.hotel_search import HotelSearchHotel, HotelSearchResult
    from app.schemas.skiplagged import SkiplaggedHotelDetail, SkiplaggedRoom

    hotels = [
        HotelSearchHotel(
            id=f"hotel_{i}",
            name=f"Hotel {i}",
            price_per_night=Decimal(str(100 + i * 10)),
            price_currency="USD",
            provider="skiplagged",
        )
        for i in range(5)
    ]
    mock_hotel_result = HotelSearchResult(
        hotels=hotels, city="PAR", checkin="2026-06-15", checkout="2026-06-22", total_results=5, success=True
    )
    mock_detail = SkiplaggedHotelDetail(
        hotelId="1",
        hotelName="Test",
        totalPriceInDollars=200.0,
        checkinDate="2026-06-15",
        checkoutDate="2026-06-22",
        rooms=[
            SkiplaggedRoom(
                id="r1",
                title="Deluxe Room",
                occupancyLimit=2,
                pricePerNightInDollars=100.0,
                totalPriceInDollars=200.0,
                taxesAndFeesInDollars=20.0,
                currency="USD",
                refundable=True,
                freeCancellation=True,
                bookingLink="https://example.com",
            )
        ],
    )

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(return_value=mock_hotel_result)
    mock_client.get_hotel_details = AsyncMock(return_value=mock_detail)

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        result = await pc.fetch_hotels_activity(sample_trip_details)

    assert mock_client.get_hotel_details.call_count == 5
    assert result["error"] is None


# ---------------------------------------------------------------------------
# Task 11: Updated filter functions for Skiplagged format
# ---------------------------------------------------------------------------


def test_extract_carrier_codes_skiplagged_format():
    """Carrier codes extracted from Skiplagged flight ID."""
    flight = {"id": "SFO-CDG-2026-06-15-trip=AF81-LH200,TS251"}
    codes = pc._extract_carrier_codes(flight)
    assert "AF" in codes
    assert "LH" in codes


def test_extract_carrier_codes_skiplagged_single():
    """Single segment Skiplagged flight ID."""
    flight = {"id": "SFO-CDG-2026-06-15-trip=UA200"}
    codes = pc._extract_carrier_codes(flight)
    assert "UA" in codes


def test_filter_hotels_by_room_title():
    """Hotels filtered by room title matching preferred_room_types."""
    hotels = [
        {"rooms": [{"title": "Deluxe Suite"}, {"title": "Standard Room"}]},
        {"rooms": [{"title": "Standard Room"}]},
    ]
    prefs = {"preferred_room_types": ["suite"], "preferred_views": []}
    result = pc._filter_hotels(hotels, prefs)
    assert len(result) == 1  # Only the one with "Deluxe Suite"


def test_filter_hotels_by_view_in_amenities():
    """Hotels filtered by view keyword in amenities when no room title match."""
    hotels = [
        {"rooms": [{"title": "Standard Room"}], "amenities": ["Ocean View", "Pool"]},
        {"rooms": [{"title": "Standard Room"}], "amenities": ["Gym"]},
    ]
    prefs = {"preferred_room_types": [], "preferred_views": ["ocean"]}
    result = pc._filter_hotels(hotels, prefs)
    assert len(result) == 1


def test_filter_hotels_no_prefs_returns_all():
    """Hotels are all returned when no room type or view prefs."""
    hotels = [
        {"rooms": [{"title": "Standard Room"}]},
        {"rooms": [{"title": "Suite"}]},
    ]
    prefs = {"preferred_room_types": [], "preferred_views": []}
    result = pc._filter_hotels(hotels, prefs)
    assert len(result) == 2


def test_filter_hotels_by_min_star_rating():
    """Hotels below min_star_rating are dropped; missing ratings are dropped."""
    hotels = [
        {"name": "Budget Inn", "star_rating": 2},
        {"name": "Comfort Hotel", "star_rating": 3},
        {"name": "Grand Resort", "star_rating": 5},
        {"name": "Unrated Lodge"},
    ]
    prefs = {"preferred_room_types": [], "preferred_views": [], "min_star_rating": 4}
    result = pc._filter_hotels(hotels, prefs)
    assert [h["name"] for h in result] == ["Grand Resort"]


def test_filter_hotels_min_star_rating_none_skipped():
    """min_star_rating=None applies no threshold filter."""
    hotels = [
        {"name": "Budget Inn", "star_rating": 2},
        {"name": "Unrated Lodge"},
    ]
    prefs = {"preferred_room_types": [], "preferred_views": [], "min_star_rating": None}
    result = pc._filter_hotels(hotels, prefs)
    assert len(result) == 2


# ---------------------------------------------------------------------------
# Coverage: generic-Exception fallback branches in fetch_*_activity and the
# per-hotel details fallback. The SkiplaggedMCPError paths are covered
# elsewhere; these tests pin the broader `except Exception` catch-alls so
# unexpected runtime errors (TypeError, ValueError, etc.) degrade to an empty
# result with error metadata rather than crashing the workflow.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_flights_generic_exception_propagates(monkeypatch):
    """Non-SkiplaggedMCPError exceptions propagate so Temporal fails the workflow."""
    from unittest.mock import AsyncMock, patch

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)

    mock_client = AsyncMock()
    mock_client.search_flights_all = AsyncMock(side_effect=RuntimeError("boom"))

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(RuntimeError, match="boom"):
            await pc.fetch_flights_activity(sample_trip_details)


@pytest.mark.asyncio
async def test_fetch_hotels_generic_exception_propagates(monkeypatch):
    """Non-SkiplaggedMCPError exceptions in hotel search propagate to Temporal."""
    from unittest.mock import AsyncMock, patch

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(side_effect=RuntimeError("kaboom"))

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(RuntimeError, match="kaboom"):
            await pc.fetch_hotels_activity(sample_trip_details)


@pytest.mark.asyncio
async def test_fetch_hotels_details_failure_falls_back_to_search_data(monkeypatch):
    """When get_hotel_details raises, the offer is built from search-level data."""
    from decimal import Decimal
    from unittest.mock import AsyncMock, patch

    from app.schemas.hotel_search import HotelSearchHotel, HotelSearchResult

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)

    hotel = HotelSearchHotel(
        id="hotel-1",
        name="Fallback Hotel",
        star_rating=3,
        price_per_night=Decimal("120"),
        price_currency="USD",
        amenities=["WiFi"],
    )
    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(
        return_value=HotelSearchResult(
            hotels=[hotel],
            city="YYZ",
            checkin="2026-09-10",
            checkout="2026-09-15",
            total_results=1,
        )
    )
    mock_client.get_hotel_details = AsyncMock(side_effect=RuntimeError("details blew up"))

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        result = await pc.fetch_hotels_activity(sample_trip_details)

    assert result["error"] is None
    assert len(result["offers"]) == 1
    offer = result["offers"][0]
    assert offer["id"] == "hotel-1"
    assert offer["name"] == "Fallback Hotel"
    # Fallback offer is built from search data (no rooms list populated)
    assert offer["rooms"] == []


# ---------------------------------------------------------------------------
# Coverage: helper branches for carrier extraction and hotel matching
# ---------------------------------------------------------------------------


def test_extract_carrier_codes_legacy_flat_field():
    """A legacy offer dict with a `carrier_code` string returns that code upper-cased."""
    flight = {"carrier_code": "dl"}
    assert pc._extract_carrier_codes(flight) == ["DL"]


def test_hotel_matches_room_types_empty_rooms_returns_false():
    """Hotels without any rooms never match room-type filters."""
    assert pc._hotel_matches_room_types({"rooms": []}, ["king"]) is False


def test_hotel_matches_views_via_description():
    """View keywords present only in the description field still match."""
    hotel = {
        "rooms": [{"title": "Standard Room"}],
        "amenities": ["Pool"],
        "description": "Stunning ocean view from the balcony.",
    }
    assert pc._hotel_matches_views(hotel, ["ocean"]) is True


# ---------------------------------------------------------------------------
# Task 6: fetch_hotels_activity uses hotel_prefs.city (with fallback)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_hotels_activity_uses_city_field(monkeypatch):
    trip: TripDetails = {
        "trip_id": "t-city",
        "origin_airport": "SFO",
        "destination_code": "MCO",
        "is_round_trip": True,
        "depart_date": "2026-06-01",
        "return_date": "2026-06-08",
        "adults": 2,
        "track_flights": True,
        "track_hotels": True,
        "flight_prefs": {
            "airlines": [], "stops_mode": "any", "max_stops": None, "cabin": "economy",
        },
        "hotel_prefs": {
            "rooms": 1,
            "adults_per_room": 2,
            "city": "Downtown Orlando",
            "room_selection_mode": "cheapest",
            "preferred_room_types": [],
            "preferred_views": [],
        },
    }

    captured: dict = {}

    class FakeClient:
        async def search_hotels_all(self, *, city, checkin, checkout, adults, rooms, max_pages):
            captured["city"] = city
            return SimpleNamespace(hotels=[], total_results=0)

        async def get_hotel_details(self, **kwargs):
            raise AssertionError("Should not be called when no hotels are returned")

    monkeypatch.setattr(pc, "SkiplaggedClient", lambda: FakeClient())
    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)

    await pc.fetch_hotels_activity(trip)

    assert captured["city"] == "Downtown Orlando"


@pytest.mark.asyncio
@pytest.mark.parametrize("blank_city", [None, "", "   "])
async def test_fetch_hotels_activity_falls_back_to_destination_code(monkeypatch, blank_city):
    trip: TripDetails = {
        "trip_id": "t-fallback",
        "origin_airport": "SFO",
        "destination_code": "MCO",
        "is_round_trip": True,
        "depart_date": "2026-06-01",
        "return_date": "2026-06-08",
        "adults": 2,
        "track_flights": True,
        "track_hotels": True,
        "flight_prefs": {
            "airlines": [], "stops_mode": "any", "max_stops": None, "cabin": "economy",
        },
        "hotel_prefs": {
            "rooms": 1,
            "adults_per_room": 2,
            "city": blank_city,
            "room_selection_mode": "cheapest",
            "preferred_room_types": [],
            "preferred_views": [],
        },
    }

    captured: dict = {}

    class FakeClient:
        async def search_hotels_all(self, *, city, checkin, checkout, adults, rooms, max_pages):
            captured["city"] = city
            return SimpleNamespace(hotels=[], total_results=0)

    monkeypatch.setattr(pc, "SkiplaggedClient", lambda: FakeClient())
    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)

    await pc.fetch_hotels_activity(trip)

    assert captured["city"] == "MCO"


@pytest.mark.asyncio
async def test_fetch_flights_budget_exceeded_is_non_retryable(monkeypatch):
    """A tripped global budget surfaces as a non-retryable Temporal error."""
    from unittest.mock import AsyncMock, patch

    from app.core.errors import GlobalBudgetExceeded
    from temporalio.exceptions import ApplicationError

    mock_client = AsyncMock()
    mock_client.search_flights_all = AsyncMock(
        side_effect=GlobalBudgetExceeded("daily ceiling reached")
    )

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)
    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(ApplicationError) as exc_info:
            await pc.fetch_flights_activity(_trip_details())

    assert exc_info.value.non_retryable is True
    assert exc_info.value.type == "GlobalBudgetExceeded"


@pytest.mark.asyncio
async def test_fetch_hotels_budget_exceeded_is_non_retryable(monkeypatch):
    """Hotel fetch also marks a tripped budget non-retryable."""
    from unittest.mock import AsyncMock, patch

    from app.core.errors import GlobalBudgetExceeded
    from temporalio.exceptions import ApplicationError

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(
        side_effect=GlobalBudgetExceeded("daily ceiling reached")
    )

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)
    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(ApplicationError) as exc_info:
            await pc.fetch_hotels_activity(_trip_details())

    assert exc_info.value.non_retryable is True
    assert exc_info.value.type == "GlobalBudgetExceeded"


def test_budget_application_error_is_non_retryable():
    from app.core.errors import GlobalBudgetExceeded
    from temporalio.exceptions import ApplicationError

    err = pc._budget_application_error(GlobalBudgetExceeded("ceiling"))
    assert isinstance(err, ApplicationError)
    assert err.non_retryable is True
    assert err.type == "GlobalBudgetExceeded"


@pytest.mark.asyncio
async def test_fetch_hotels_budget_trip_during_details_is_non_retryable(monkeypatch):
    """A budget trip mid get_hotel_details must surface, not be swallowed by the
    per-hotel fallback."""
    from decimal import Decimal
    from unittest.mock import AsyncMock, patch

    from app.core.errors import GlobalBudgetExceeded
    from app.schemas.hotel_search import HotelSearchHotel, HotelSearchResult
    from temporalio.exceptions import ApplicationError

    hotels = [
        HotelSearchHotel(
            id=f"hotel_{i}",
            name=f"Hotel {i}",
            price_per_night=Decimal(str(50 + i * 10)),
            price_currency="USD",
            provider="skiplagged",
        )
        for i in range(3)
    ]
    mock_hotel_result = HotelSearchResult(
        hotels=hotels,
        city="PAR",
        checkin="2026-06-15",
        checkout="2026-06-22",
        total_results=3,
        success=True,
    )

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(return_value=mock_hotel_result)
    # search_hotels_all passed the gate; the breaker trips during details.
    mock_client.get_hotel_details = AsyncMock(
        side_effect=GlobalBudgetExceeded("daily ceiling reached")
    )

    monkeypatch.setattr(pc.settings, "mock_skiplagged_api", False)
    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        with pytest.raises(ApplicationError) as exc_info:
            await pc.fetch_hotels_activity(sample_trip_details)

    assert exc_info.value.non_retryable is True
    assert exc_info.value.type == "GlobalBudgetExceeded"
