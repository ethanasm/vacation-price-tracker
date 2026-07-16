"""Tests for the fast-flights (Google Flights scraper) client."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from app.clients.fast_flights import (
    FastFlightsClient,
    FastFlightsTransientError,
    _apply_sort,
)

from tests.clients.ff_fixtures import error_page_html, itin_array, page_html, seg_array


def _client() -> FastFlightsClient:
    return FastFlightsClient(proxy=None)


def _patch_fetch(return_value=None, side_effect=None):
    return patch(
        "app.clients.fast_flights.fetch_flights_html",
        return_value=return_value,
        side_effect=side_effect,
    )


def _as_direct(price=1585):
    """A direct SFO->OGG Alaska itinerary (AS943)."""
    return itin_array(
        price,
        [seg_array(frm="SFO", to="OGG", dep=((2026, 12, 11), (8, 23)),
                   arr=((2026, 12, 11), (11, 48)), duration=325)],
        ["Alaska"],
    )


def _ua_direct(price=505):
    return itin_array(
        price,
        [seg_array(frm="SFO", to="OGG", carrier="UA", number="1749", airline="United",
                   dep=((2026, 12, 11), (16, 30)), arr=((2026, 12, 11), (19, 55)), duration=325)],
        ["United"],
    )


RETURN_PAGE = page_html(best=[
    itin_array(253, [seg_array(frm="OGG", to="SFO", carrier="AS", number="593",
                               dep=((2026, 12, 18), (22, 19)), arr=((2026, 12, 19), (5, 30)),
                               duration=311)], ["Alaska"]),
    itin_array(253, [seg_array(frm="OGG", to="SFO", carrier="UA", number="1750",
                               airline="United",
                               dep=((2026, 12, 18), (23, 35)), arr=((2026, 12, 19), (6, 40)),
                               duration=305)], ["United"]),
    itin_array(262, [seg_array(frm="OGG", to="SFO", carrier="AS", number="942",
                               dep=((2026, 12, 18), (11, 54)), arr=((2026, 12, 18), (19, 5)),
                               duration=311)], ["Alaska"]),
])


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
    async def test_normalizes_direct_flight_with_designators(self):
        with _patch_fetch(return_value=page_html(best=[_as_direct()])):
            result = await _client().search_flights("SFO", "OGG", "2026-12-11")

        assert result.success is True
        assert result.provider == "fast_flights"
        assert result.total_results == 1
        flight = result.flights[0]
        assert flight.departure_airport == "SFO"
        assert flight.arrival_airport == "OGG"
        assert flight.price_amount == Decimal("1585")
        assert flight.price_display == "$1585"
        assert flight.carrier_code == "AS"
        assert flight.airline_name == "Alaska"
        assert flight.stops == 0
        assert flight.stops_text == "Direct"
        assert flight.duration_minutes == 325
        raw = flight.raw_data
        assert raw["provider"] == "fast_flights"
        assert raw["round_trip_total"] is False  # one-way search
        assert raw["is_best"] is True
        assert raw["carrier_codes"] == ["AS"]
        seg = raw["segments"][0]
        assert seg["carrier"] == "AS"
        assert seg["flightNumber"] == "943"
        assert seg["from"] == "SFO"
        assert seg["to"] == "OGG"
        assert seg["departureTime"] == "2026-12-11T08:23:00"

    @pytest.mark.asyncio
    async def test_merges_best_and_other_sections(self):
        with _patch_fetch(return_value=page_html(best=[_as_direct(1585)], other=[_ua_direct(505)])):
            result = await _client().search_flights("SFO", "OGG", "2026-12-11", sort="price")
        assert result.total_results == 2
        # price sort puts the "other"-section UA fare first
        assert result.flights[0].carrier_code == "UA"
        assert result.flights[0].raw_data["is_best"] is False
        assert result.flights[1].carrier_code == "AS"

    @pytest.mark.asyncio
    async def test_connecting_flight_durations_and_layovers(self):
        # Times are LOCAL (DEN->JFK arrival is EDT), so the naive endpoint
        # diff (08:00 -> 18:45 = 645) overstates the trip; the total must be
        # segment flight minutes + layover minutes instead.
        segs = [
            seg_array(frm="SFO", to="DEN", dep=((2026, 9, 15), (8, 0)),
                      arr=((2026, 9, 15), (11, 30)), duration=210, carrier="UA", number="508",
                      airline="United"),
            seg_array(frm="DEN", to="JFK", dep=((2026, 9, 15), (13, 0)),
                      arr=((2026, 9, 15), (18, 45)), duration=225, carrier="UA", number="1200",
                      airline="United"),
        ]
        with _patch_fetch(return_value=page_html(best=[itin_array(400, segs, ["United"])])):
            result = await _client().search_flights("SFO", "JFK", "2026-09-15")
        flight = result.flights[0]
        assert flight.stops == 1
        assert flight.stops_text == "1 stop"
        assert flight.duration_minutes == 525  # 210 + 225 + 90 layover
        assert len(flight.layovers) == 1
        assert flight.layovers[0].airport == "DEN"
        assert flight.layovers[0].duration_minutes == 90
        assert [s["flightNumber"] for s in flight.raw_data["segments"]] == ["508", "1200"]

    @pytest.mark.asyncio
    async def test_duration_falls_back_to_endpoint_diff_when_segment_minutes_missing(self):
        segs = [
            seg_array(frm="SFO", to="DEN", dep=((2026, 9, 15), (8, 0)),
                      arr=((2026, 9, 15), (11, 30)), duration=None),
            seg_array(frm="DEN", to="JFK", dep=((2026, 9, 15), (13, 0)),
                      arr=((2026, 9, 15), (18, 45)), duration=225),
        ]
        with _patch_fetch(return_value=page_html(best=[itin_array(400, segs)])):
            result = await _client().search_flights("SFO", "JFK", "2026-09-15")
        # Missing per-segment minutes -> naive endpoint diff (08:00 -> 18:45)
        assert result.flights[0].duration_minutes == 645

    @pytest.mark.asyncio
    async def test_airline_names_fall_back_to_page_metadata(self):
        itin = itin_array(300, [seg_array(carrier="HA", number="11", airline="Hawaiian")], names=[])
        with _patch_fetch(return_value=page_html(best=[itin], airlines=[("HA", "Hawaiian Airlines")])):
            result = await _client().search_flights("SFO", "OGG", "2026-12-11")
        assert result.flights[0].airline_name == "Hawaiian Airlines"

    @pytest.mark.asyncio
    async def test_unpriced_itineraries_dropped(self):
        with _patch_fetch(return_value=page_html(best=[itin_array(0, [seg_array()]),
                                                       itin_array(None, [seg_array()]),
                                                       _as_direct(250)])):
            result = await _client().search_flights("SFO", "OGG", "2026-12-11")
        assert result.total_results == 1
        assert result.flights[0].price_amount == Decimal("250")

    @pytest.mark.asyncio
    async def test_chat_round_trip_is_single_query(self):
        # Without include_return_options a round trip stays one Google call.
        with _patch_fetch(return_value=page_html(best=[_as_direct()])) as mock_fetch:
            result = await _client().search_flights(
                "SFO", "OGG", "2026-12-11", return_date="2026-12-18"
            )
        assert mock_fetch.call_count == 1
        assert result.is_round_trip is True
        flight = result.flights[0]
        assert flight.raw_data["round_trip_total"] is True
        assert "return_segments" not in flight.raw_data

    @pytest.mark.asyncio
    async def test_flights_not_found_is_empty_success(self):
        with _patch_fetch(return_value=error_page_html()):
            result = await _client().search_flights("SFO", "LAX", "2026-09-15")
        assert result.success is True
        assert result.flights == []
        assert result.total_results == 0

    @pytest.mark.asyncio
    async def test_invalid_passenger_count_degrades_to_failed_result(self):
        # The fast-flights protobuf layer asserts <= 9 passengers; a bad input
        # must come back as success=False, never an unhandled exception.
        with _patch_fetch(return_value=page_html(best=[_as_direct()])) as mock_fetch:
            result = await _client().search_flights("SFO", "LAX", "2026-09-15", adults=99)
        assert result.success is False
        assert result.error
        assert result.flights == []
        mock_fetch.assert_not_called()

    @pytest.mark.asyncio
    async def test_sort_and_pagination(self):
        page = page_html(best=[_as_direct(300), _as_direct(100), _as_direct(200)])
        with _patch_fetch(return_value=page):
            result = await _client().search_flights(
                "SFO", "OGG", "2026-12-11", sort="price", limit=2, offset=1
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
            return page_html(best=[_as_direct()])

        with _patch_fetch(side_effect=flaky):
            result = await _client().search_flights("SFO", "OGG", "2026-12-11")
        assert calls["n"] == 2
        assert result.total_results == 1

    @pytest.mark.asyncio
    async def test_blocked_page_without_payload_is_transient(self, monkeypatch):
        monkeypatch.setattr("app.clients.fast_flights.BASE_BACKOFF_SECONDS", 0.0)
        with _patch_fetch(return_value="<html>captcha</html>") as mock_fetch:
            with pytest.raises(FastFlightsTransientError):
                await _client().search_flights("SFO", "OGG", "2026-12-11")
        assert mock_fetch.call_count == 3  # initial + MAX_TRANSIENT_RETRIES

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
            _patch_fetch(return_value=page_html(best=[_as_direct()])),
        ):
            await _client().search_flights("SFO", "OGG", "2026-12-11")
        assert mock_budget.call_args[0][0] == "fast_flights_calls"

    @pytest.mark.asyncio
    async def test_proxy_forwarded_to_fetcher(self):
        client = FastFlightsClient(proxy="http://proxy.example:8080")
        with _patch_fetch(return_value=page_html(best=[_as_direct()])) as mock_fetch:
            await client.search_flights("SFO", "OGG", "2026-12-11")
        assert mock_fetch.call_args.kwargs["proxy"] == "http://proxy.example:8080"


class TestReturnOptions:
    @pytest.mark.asyncio
    async def test_tracking_round_trip_attaches_same_airline_returns(self):
        outbound_page = page_html(best=[_as_direct(1585)], other=[_ua_direct(1815)])

        def fetcher(query, proxy=None):
            legs = query.flight_data
            if legs[0].from_airport.airport == "OGG":  # reverse one-way query
                assert query.get_trip_type() == "one-way"
                assert legs[0].date == "2026-12-18"
                return RETURN_PAGE
            return outbound_page

        with _patch_fetch(side_effect=fetcher) as mock_fetch:
            result = await _client().search_flights_all(
                "SFO", "OGG", "2026-12-11", return_date="2026-12-18"
            )

        assert mock_fetch.call_count == 2
        assert result.success is True
        by_carrier = {f.carrier_code: f for f in result.flights}

        alaska = by_carrier["AS"].raw_data
        assert [s["flightNumber"] for s in alaska["return_segments"]] == ["593"]
        assert alaska["return_stops"] == 0
        assert alaska["return_duration_minutes"] == 311
        # Two Alaska return options matched, best-ranked first
        assert len(alaska["return_options"]) == 2
        assert alaska["round_trip_total"] is True

        united = by_carrier["UA"].raw_data
        assert [s["flightNumber"] for s in united["return_segments"]] == ["1750"]
        assert len(united["return_options"]) == 1

    @pytest.mark.asyncio
    async def test_no_same_airline_return_leaves_offer_untouched(self):
        outbound_page = page_html(
            best=[itin_array(900, [seg_array(carrier="HA", number="11", airline="Hawaiian")], ["Hawaiian"])]
        )

        def fetcher(query, proxy=None):
            if query.flight_data[0].from_airport.airport == "OGG":
                return RETURN_PAGE  # AS/UA only — no Hawaiian match
            return outbound_page

        with _patch_fetch(side_effect=fetcher):
            result = await _client().search_flights_all(
                "SFO", "OGG", "2026-12-11", return_date="2026-12-18"
            )
        raw = result.flights[0].raw_data
        assert "return_segments" not in raw
        assert raw["round_trip_total"] is True

    @pytest.mark.asyncio
    async def test_return_carriers_join_the_airline_filter_codes(self):
        # Mixed-carrier outbound (UA+AS): the AS-only and UA-only returns both
        # match (subset rule), and the filterable codes stay the union.
        segs = [
            seg_array(frm="SFO", to="KOA", carrier="UA", number="1721", airline="United"),
            seg_array(frm="KOA", to="OGG", carrier="AS", number="1149", airline="Alaska Airlines"),
        ]
        outbound_page = page_html(best=[itin_array(850, segs, ["United", "Alaska"])])

        def fetcher(query, proxy=None):
            if query.flight_data[0].from_airport.airport == "OGG":
                return RETURN_PAGE
            return outbound_page

        with _patch_fetch(side_effect=fetcher):
            result = await _client().search_flights_all(
                "SFO", "OGG", "2026-12-11", return_date="2026-12-18"
            )
        raw = result.flights[0].raw_data
        assert len(raw["return_options"]) == 3
        assert raw["carrier_codes"] == ["AS", "UA"]

    @pytest.mark.asyncio
    async def test_return_query_failure_keeps_outbound_offers(self, monkeypatch):
        monkeypatch.setattr("app.clients.fast_flights.BASE_BACKOFF_SECONDS", 0.0)
        outbound_page = page_html(best=[_as_direct(1585)])

        def fetcher(query, proxy=None):
            if query.flight_data[0].from_airport.airport == "OGG":
                raise RuntimeError("blocked")
            return outbound_page

        with _patch_fetch(side_effect=fetcher):
            result = await _client().search_flights_all(
                "SFO", "OGG", "2026-12-11", return_date="2026-12-18"
            )
        assert result.success is True
        assert result.total_results == 1
        assert "return_segments" not in result.flights[0].raw_data

    @pytest.mark.asyncio
    async def test_budget_breaker_on_return_query_propagates(self):
        from app.core.errors import GlobalBudgetExceeded

        outbound_page = page_html(best=[_as_direct(1585)])
        budget = AsyncMock(side_effect=[(True, 1), (False, 50_001)])
        client = _client()
        with (
            patch("app.clients.fast_flights.incr_and_check_global_budget", new=budget),
            _patch_fetch(return_value=outbound_page),
        ):
            with pytest.raises(GlobalBudgetExceeded):
                await client.search_flights_all(
                    "SFO", "OGG", "2026-12-11", return_date="2026-12-18"
                )


class TestHelpers:
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
