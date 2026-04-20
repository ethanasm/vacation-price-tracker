"""Tests for Pydantic schema validation rules added for track flags and hotel city."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.trip import HotelPrefs, NotificationPrefs, TripCreate


def _base_payload(**overrides):
    today = date.today()
    base = {
        "name": "Test Trip",
        "origin_airport": "SFO",
        "destination_code": "HNL",
        "depart_date": today + timedelta(days=30),
        "return_date": today + timedelta(days=37),
        "notification_prefs": NotificationPrefs(threshold_value=Decimal("2000.00")),
        "track_flights": True,
        "track_hotels": True,
    }
    base.update(overrides)
    return base


def test_track_flights_only_requires_no_hotel_prefs():
    trip = TripCreate(**_base_payload(track_hotels=False))
    assert trip.track_flights is True
    assert trip.track_hotels is False
    assert trip.hotel_prefs is None


def test_track_hotels_only_with_city():
    payload = _base_payload(
        track_flights=False,
        hotel_prefs=HotelPrefs(city="Downtown Orlando"),
    )
    trip = TripCreate(**payload)
    assert trip.track_flights is False
    assert trip.track_hotels is True
    assert trip.hotel_prefs.city == "Downtown Orlando"


def test_neither_flag_rejected():
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(track_flights=False, track_hotels=False))
    assert "at least one of track_flights or track_hotels" in str(exc.value).lower()


def test_track_hotels_requires_hotel_prefs_with_city():
    # hotel_prefs omitted
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(track_flights=False, hotel_prefs=None))
    assert "hotel_prefs" in str(exc.value).lower()

    # hotel_prefs present but city blank
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(hotel_prefs=HotelPrefs(city="")))
    assert "city" in str(exc.value).lower()

    # hotel_prefs present but city None
    with pytest.raises(ValidationError) as exc:
        TripCreate(**_base_payload(hotel_prefs=HotelPrefs(city=None)))
    assert "city" in str(exc.value).lower()


def test_hotel_prefs_allows_city_up_to_200_chars():
    prefs = HotelPrefs(city="A" * 200)
    assert len(prefs.city) == 200
    with pytest.raises(ValidationError):
        HotelPrefs(city="A" * 201)


def test_defaults_both_flags_true():
    payload = _base_payload()
    payload.pop("track_flights")
    payload.pop("track_hotels")
    trip = TripCreate(**payload)
    assert trip.track_flights is True
    assert trip.track_hotels is True
