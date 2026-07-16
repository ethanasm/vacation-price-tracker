"""Tests for the fast-flights (Google Flights scraper) client."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from app.clients.fast_flights import (
    FastFlightsClient,
    FastFlightsTransientError,
    _apply_sort,
    _resolve_airline,
    _to_datetime,
)
from fast_flights import FlightsNotFound, ResultList
from fast_flights.model import (
    Airline,
    Airport,
    CarbonEmission,
    Flights,
    JsMetadata,
    SimpleDatetime,
    SingleFlight,
)


def _segment(
    from_code: str = "SFO",
    to_code: str = "LAX",
    dep: tuple = ((2026, 9, 15), (8, 30)),
    arr: tuple = ((2026, 9, 15), (10, 5)),
    duration: int = 95,
) -> SingleFlight:
    return SingleFlight(
        from_airport=Airport(name=f"{from_code} airport", code=from_code),
        to_airport=Airport(name=f"{to_code} airport", code=to_code),
        departure=SimpleDatetime(date=dep[0], time=dep[1]),
        arrival=SimpleDatetime(date=arr[0], time=arr[1]),
        duration=duration,
        plane_type="Boeing 737",
    )


def _itinerary(
    price: int = 187,
    airlines: list[str] | None = None,
    segments: list[SingleFlight] | None = None,
    typ: str = "best",
) -> Flights:
    return Flights(
        type=typ,
        price=price,
        airlines=airlines if airlines is not None else ["AS"],
        flights=segments if segments is not None else [_segment()],
        carbon=CarbonEmission(typical_on_route=100_000, emission=90_000),
    )


def _result(flights: list[Flights], airlines: list[Airline] | None = None) -> ResultList:
    result = ResultList(flights)
    result.metadata = JsMetadata(
        airlines=airlines
        if airlines is not None
        else [Airline(code="AS", name="Alaska Airlines"), Airline(code="UA", name="United")],
        alliances=[],
    )
    return result


def _client() -> FastFlightsClient:
    return FastFlightsClient(proxy=None)


def _patch_get_flights(return_value=None, side_effect=None):
    return patch(
        "app.clients.fast_flights.get_flights",
        return_value=return_value,
        side_effect=side_effect,
    )


class TestQueryConstruction:
    def test_one_way_query(self):
        query = _client()._build_query("sfo", "lax", "2026-09-15", None, 1, None, None)
        assert query.get_trip_type() == "one-way"
        assert query.get_seat_type() == "economy"
        assert len(query.flight_data) == 1
        leg = query.flight_data[0]
        assert leg.date == "2026-09-15"
        assert leg.from_airport.airport == "SFO"
        assert leg.to_airport.airport == "LAX"

    def test_round_trip_query_reverses_second_leg(self):
        query = _client()._build_query(
            "SFO", "CDG", "2026-09-15", "2026-09-22", 2, "none", "business"
        )
        assert query.get_trip_type() == "round-trip"
        assert query.get_seat_type() == "business"
        assert len(query.flight_data) == 2
        assert len(query.passengers) == 2
        outbound, inbound = query.flight_data
        assert (outbound.from_airport.airport, outbound.to_airport.airport) == ("SFO", "CDG")
        assert (inbound.from_airport.airport, inbound.to_airport.airport) == ("CDG", "SFO")
        assert inbound.date == "2026-09-22"
        # "none" maps to a 0-stop ceiling on both legs
        assert outbound.max_stops == 0
        assert inbound.max_stops == 0

    def test_max_stops_one_and_many(self):
        query = _client()._build_query("SFO", "LAX", "2026-09-15", None, 1, "one", None)
        assert query.flight_data[0].max_stops == 1
        query = _client()._build_query("SFO", "LAX", "2026-09-15", None, 1, "many", None)
        assert not query.flight_data[0].HasField("max_stops")

    def test_unknown_cabin_defaults_to_economy(self):
        query = _client()._build_query("SFO", "LAX", "2026-09-15", None, 1, None, "suite")
        assert query.get_seat_type() == "economy"


class TestSearchFlights:
    @pytest.mark.asyncio
    async def test_normalizes_direct_flight(self):
        with _patch_get_flights(return_value=_result([_itinerary()])):
            result = await _client().search_flights("SFO", "LAX", "2026-09-15")

        assert result.success is True
        assert result.provider == "fast_flights"
        assert result.origin == "SFO"
        assert result.destination == "LAX"
        assert result.is_round_trip is False
        assert result.total_results == 1
        flight = result.flights[0]
        assert flight.provider == "fast_flights"
        assert flight.departure_airport == "SFO"
        assert flight.arrival_airport == "LAX"
        assert flight.price_amount == Decimal("187")
        assert flight.price_currency == "USD"
        assert flight.price_display == "$187"
        assert flight.carrier_code == "AS"
        assert flight.airline_name == "Alaska Airlines"
        assert flight.stops == 0
        assert flight.stops_text == "Direct"
        assert flight.duration_minutes == 95
        assert flight.departure_time.isoformat() == "2026-09-15T08:30:00"
        assert flight.arrival_time.isoformat() == "2026-09-15T10:05:00"
        raw = flight.raw_data
        assert raw["provider"] == "fast_flights"
        assert raw["round_trip_total"] is False  # one-way search
        assert raw["carrier_codes"] == ["AS"]
        assert raw["airline_names"] == ["Alaska Airlines"]
        assert raw["segments"][0]["carrier"] == "AS"
        assert raw["segments"][0]["from"] == "SFO"
        assert raw["segments"][0]["to"] == "LAX"
        assert raw["segments"][0]["durationMinutes"] == 95

    @pytest.mark.asyncio
    async def test_connecting_flight_builds_layovers(self):
        # Times are LOCAL (DEN->JFK arrival is EDT), so the naive endpoint
        # diff (08:00 -> 18:45 = 645) overstates the trip; the total must be
        # segment flight minutes + layover minutes instead.
        segments = [
            _segment("SFO", "DEN", ((2026, 9, 15), (8, 0)), ((2026, 9, 15), (11, 30)), 210),
            _segment("DEN", "JFK", ((2026, 9, 15), (13, 0)), ((2026, 9, 15), (18, 45)), 225),
        ]
        with _patch_get_flights(return_value=_result([_itinerary(segments=segments)])):
            result = await _client().search_flights("SFO", "JFK", "2026-09-15")

        flight = result.flights[0]
        assert flight.departure_airport == "SFO"
        assert flight.arrival_airport == "JFK"
        assert flight.stops == 1
        assert flight.stops_text == "1 stop"
        # 210 + 225 flight minutes + 90 layover minutes (11:30 -> 13:00 at DEN)
        assert flight.duration_minutes == 525
        assert len(flight.layovers) == 1
        layover = flight.layovers[0]
        assert layover.airport == "DEN"
        assert layover.duration_minutes == 90
        assert len(flight.raw_data["segments"]) == 2

    @pytest.mark.asyncio
    async def test_duration_falls_back_to_endpoint_diff_when_segment_minutes_missing(self):
        segments = [
            _segment("SFO", "DEN", ((2026, 9, 15), (8, 0)), ((2026, 9, 15), (11, 30)), None),
            _segment("DEN", "JFK", ((2026, 9, 15), (13, 0)), ((2026, 9, 15), (18, 45)), 225),
        ]
        with _patch_get_flights(return_value=_result([_itinerary(segments=segments)])):
            result = await _client().search_flights("SFO", "JFK", "2026-09-15")

        # Missing per-segment minutes -> naive endpoint diff (08:00 -> 18:45)
        assert result.flights[0].duration_minutes == 645

    @pytest.mark.asyncio
    async def test_mixed_airline_itinerary_has_no_segment_carrier(self):
        itinerary = _itinerary(airlines=["AS", "UA"], segments=[_segment(), _segment()])
        with _patch_get_flights(return_value=_result([itinerary])):
            result = await _client().search_flights("SFO", "LAX", "2026-09-15")

        flight = result.flights[0]
        assert flight.raw_data["carrier_codes"] == ["AS", "UA"]
        assert flight.airline_name == "Alaska Airlines, United"
        # Google exposes airline identity at itinerary level only — a mixed
        # itinerary can't attribute a carrier per segment.
        assert all(seg["carrier"] is None for seg in flight.raw_data["segments"])

    @pytest.mark.asyncio
    async def test_airline_names_resolved_via_metadata_name_entries(self):
        # Google sometimes labels itineraries with display names, not codes.
        itinerary = _itinerary(airlines=["Alaska Airlines"])
        with _patch_get_flights(return_value=_result([itinerary])):
            result = await _client().search_flights("SFO", "LAX", "2026-09-15")

        flight = result.flights[0]
        assert flight.carrier_code == "AS"
        assert flight.airline_name == "Alaska Airlines"

    @pytest.mark.asyncio
    async def test_unpriced_and_segmentless_itineraries_dropped(self):
        priced = _itinerary(price=250)
        unpriced = _itinerary(price=0)
        segmentless = _itinerary(price=100, segments=[])
        with _patch_get_flights(return_value=_result([unpriced, priced, segmentless])):
            result = await _client().search_flights("SFO", "LAX", "2026-09-15")

        assert result.total_results == 1
        assert result.flights[0].price_amount == Decimal("250")

    @pytest.mark.asyncio
    async def test_round_trip_metadata(self):
        with _patch_get_flights(return_value=_result([_itinerary()])):
            result = await _client().search_flights(
                "SFO", "CDG", "2026-09-15", return_date="2026-09-22"
            )
        assert result.is_round_trip is True
        assert result.return_date == "2026-09-22"
        # Round-trip searches list outbound options at the round-trip total;
        # the marker lets downstream layers say the return is included.
        assert result.flights[0].raw_data["round_trip_total"] is True

    @pytest.mark.asyncio
    async def test_invalid_passenger_count_degrades_to_failed_result(self):
        # The fast-flights protobuf layer asserts <= 9 passengers; a bad input
        # must come back as success=False, never an unhandled exception.
        with _patch_get_flights(return_value=_result([_itinerary()])) as mock_get:
            result = await _client().search_flights("SFO", "LAX", "2026-09-15", adults=99)
        assert result.success is False
        assert result.error
        assert result.flights == []
        mock_get.assert_not_called()

    @pytest.mark.asyncio
    async def test_flights_not_found_is_empty_success(self):
        with _patch_get_flights(side_effect=FlightsNotFound("no flights")):
            result = await _client().search_flights("SFO", "LAX", "2026-09-15")
        assert result.success is True
        assert result.flights == []
        assert result.total_results == 0

    @pytest.mark.asyncio
    async def test_sort_and_pagination(self):
        itineraries = [
            _itinerary(price=300),
            _itinerary(price=100),
            _itinerary(price=200),
        ]
        with _patch_get_flights(return_value=_result(itineraries)):
            result = await _client().search_flights(
                "SFO", "LAX", "2026-09-15", sort="price", limit=2, offset=1
            )
        assert result.total_results == 3
        assert [f.price_amount for f in result.flights] == [Decimal("200"), Decimal("300")]

    @pytest.mark.asyncio
    async def test_transient_failure_retries_then_succeeds(self, monkeypatch):
        monkeypatch.setattr("app.clients.fast_flights.BASE_BACKOFF_SECONDS", 0.0)
        calls = {"n": 0}

        def flaky(query, proxy=None):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("blocked page")
            return _result([_itinerary()])

        with _patch_get_flights(side_effect=flaky):
            result = await _client().search_flights("SFO", "LAX", "2026-09-15")
        assert calls["n"] == 2
        assert result.total_results == 1

    @pytest.mark.asyncio
    async def test_transient_failure_exhausts_retries(self, monkeypatch):
        monkeypatch.setattr("app.clients.fast_flights.BASE_BACKOFF_SECONDS", 0.0)
        with _patch_get_flights(side_effect=RuntimeError("blocked page")) as mock_get:
            with pytest.raises(FastFlightsTransientError):
                await _client().search_flights("SFO", "LAX", "2026-09-15")
        assert mock_get.call_count == 3  # initial + MAX_TRANSIENT_RETRIES

    @pytest.mark.asyncio
    async def test_global_budget_exceeded_propagates(self):
        from app.core.errors import GlobalBudgetExceeded

        with patch(
            "app.clients.fast_flights.incr_and_check_global_budget",
            new=AsyncMock(return_value=(False, 50_001)),
        ):
            with pytest.raises(GlobalBudgetExceeded):
                await _client().search_flights("SFO", "LAX", "2026-09-15")

    @pytest.mark.asyncio
    async def test_budget_metered_under_fast_flights_metric(self):
        mock_budget = AsyncMock(return_value=(True, 1))
        with (
            patch("app.clients.fast_flights.incr_and_check_global_budget", new=mock_budget),
            _patch_get_flights(return_value=_result([_itinerary()])),
        ):
            await _client().search_flights("SFO", "LAX", "2026-09-15")
        assert mock_budget.call_args[0][0] == "fast_flights_calls"

    @pytest.mark.asyncio
    async def test_proxy_forwarded_to_get_flights(self):
        client = FastFlightsClient(proxy="http://proxy.example:8080")
        with _patch_get_flights(return_value=_result([_itinerary()])) as mock_get:
            await client.search_flights("SFO", "LAX", "2026-09-15")
        assert mock_get.call_args.kwargs["proxy"] == "http://proxy.example:8080"


class TestSearchFlightsAll:
    @pytest.mark.asyncio
    async def test_single_query_full_set(self):
        with _patch_get_flights(return_value=_result([_itinerary()])) as mock_get:
            result = await _client().search_flights_all(
                "SFO", "CDG", "2026-09-15", return_date="2026-09-22", cabin="economy"
            )
        assert mock_get.call_count == 1  # no pagination on Google's side
        assert result.provider == "fast_flights"
        assert result.success is True
        assert result.total_results == 1


class TestHelpers:
    def test_to_datetime_invalid_shapes(self):
        assert _to_datetime(None) is None
        assert _to_datetime(SimpleDatetime(date=(2026, 13, 1), time=(0, 0))) is None

    def test_resolve_airline_paths(self):
        code_to_name = {"AS": "Alaska Airlines"}
        name_to_code = {"alaska airlines": "AS"}
        assert _resolve_airline("AS", code_to_name, name_to_code) == ("AS", "Alaska Airlines")
        assert _resolve_airline("Alaska Airlines", code_to_name, name_to_code) == (
            "AS",
            "Alaska Airlines",
        )
        # Unmapped 2-3 char uppercase token treated as an IATA code
        code, name = _resolve_airline("UA", {}, {})
        assert code == "UA"
        assert name  # display name from the static airline map
        # Anything else is a display name with no code
        assert _resolve_airline("Some Airline", {}, {}) == (None, "Some Airline")
        assert _resolve_airline("  ", {}, {}) == (None, None)

    def test_apply_sort_value_keeps_order_and_duration_sorts(self):
        from app.schemas.flight_search import FlightSearchFlight

        def flight(duration):
            return FlightSearchFlight(
                departure_airport="SFO",
                arrival_airport="LAX",
                price_amount=Decimal("100"),
                duration_minutes=duration,
                provider="fast_flights",
            )

        flights = [flight(300), flight(None), flight(120)]
        assert _apply_sort(flights, "value") == flights
        by_duration = _apply_sort(flights, "duration")
        assert [f.duration_minutes for f in by_duration] == [120, 300, None]
