"""Tests for the extended Google Flights page parser."""

from __future__ import annotations

import pytest
from app.clients.fast_flights_parser import parse_flights_page
from fast_flights import FlightsNotFound

from tests.clients.ff_fixtures import error_page_html, itin_array, page_html, seg_array


def test_parses_both_sections_best_first():
    best = [itin_array(524, [seg_array(carrier="AA", number="2211", airline="American")], ["American"])]
    other = [itin_array(505, [seg_array(carrier="UA", number="1749", airline="United")], ["United"])]
    page = parse_flights_page(page_html(best=best, other=other))

    assert len(page.itineraries) == 2
    assert page.itineraries[0].is_best is True
    assert page.itineraries[0].price == 524
    assert page.itineraries[0].segments[0].designator == "AA2211"
    assert page.itineraries[1].is_best is False
    assert page.itineraries[1].price == 505
    assert page.itineraries[1].segments[0].designator == "UA1749"


def test_segment_fields_and_local_datetimes():
    seg = seg_array(
        frm="SFO", to="OGG",
        dep=((2026, 12, 11), (8, 23)), arr=((2026, 12, 11), (11, 48)),
        duration=325, carrier="AS", number="943", airline="Alaska Airlines",
        plane="Airbus A321neo",
    )
    page = parse_flights_page(page_html(best=[itin_array(1585, [seg], ["Alaska"])]))
    parsed = page.itineraries[0].segments[0]
    assert parsed.from_code == "SFO"
    assert parsed.to_code == "OGG"
    assert parsed.departure.isoformat() == "2026-12-11T08:23:00"
    assert parsed.arrival.isoformat() == "2026-12-11T11:48:00"
    assert parsed.duration_minutes == 325
    assert parsed.carrier == "AS"
    assert parsed.flight_number == "943"
    assert parsed.designator == "AS943"
    assert parsed.airline_name == "Alaska Airlines"
    assert parsed.plane_type == "Airbus A321neo"


def test_hour_only_time_arrays():
    # Google omits trailing zero components: 2:00 PM arrives as [14].
    seg = seg_array(dep=((2026, 12, 11), (14,)), arr=((2026, 12, 11), (19, 5)))
    page = parse_flights_page(page_html(best=[itin_array(505, [seg])]))
    assert page.itineraries[0].segments[0].departure.isoformat() == "2026-12-11T14:00:00"


def test_airline_metadata_map():
    page = parse_flights_page(page_html(best=[itin_array(100, [seg_array()])],
                                        airlines=[("AS", "Alaska Airlines"), ("HA", "Hawaiian")]))
    assert page.airline_code_to_name == {"AS": "Alaska Airlines", "HA": "Hawaiian"}


def test_short_or_malformed_segments_are_skipped():
    best = [
        itin_array(200, [["junk"], seg_array()]),  # first entry not a segment array
        itin_array(300, [[None] * 5]),             # too short -> itinerary dropped
        itin_array(None, [seg_array()]),           # unpriced kept (price None; client filters)
    ]
    page = parse_flights_page(page_html(best=best))
    assert len(page.itineraries) == 2
    assert len(page.itineraries[0].segments) == 1
    assert page.itineraries[1].price is None


def test_missing_identity_degrades_to_none():
    seg = seg_array()
    seg[22] = None
    page = parse_flights_page(page_html(best=[itin_array(100, [seg])]))
    parsed = page.itineraries[0].segments[0]
    assert parsed.carrier is None
    assert parsed.flight_number is None
    assert parsed.designator is None


def test_empty_page_yields_no_itineraries():
    page = parse_flights_page(page_html())
    assert page.itineraries == []


def test_error_page_raises_flights_not_found():
    with pytest.raises(FlightsNotFound):
        parse_flights_page(error_page_html())


def test_missing_script_raises_value_error():
    with pytest.raises(ValueError, match="payload script"):
        parse_flights_page("<html><body>blocked</body></html>")
