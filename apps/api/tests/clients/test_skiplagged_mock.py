"""Tests for Skiplagged mock data module."""

from __future__ import annotations

from app.clients.skiplagged_mock import (
    mock_flight_search,
    mock_hotel_details,
    mock_hotel_search,
)


class TestMockFlightSearch:
    def test_returns_skiplagged_shape(self):
        response = mock_flight_search(
            origin="SFO",
            destination="CDG",
            departure_date="2026-06-15",
        )
        assert isinstance(response, dict)
        assert "flights" in response
        assert isinstance(response["flights"], list)
        assert len(response["flights"]) > 0

    def test_flights_have_required_fields(self):
        response = mock_flight_search(
            origin="SFO",
            destination="CDG",
            departure_date="2026-06-15",
        )
        flight = response["flights"][0]
        assert "id" in flight
        assert "airlines" in flight
        assert "departure" in flight
        assert "arrival" in flight
        assert "price" in flight
        assert "amount" in flight["price"]
        assert "currency" in flight["price"]

    def test_id_format_is_parseable(self):
        """Flight IDs should match Skiplagged 'trip=XX\\d+' format so parser works."""
        response = mock_flight_search(
            origin="SFO",
            destination="CDG",
            departure_date="2026-06-15",
        )
        flight = response["flights"][0]
        assert "trip=" in flight["id"]

    def test_round_trip_includes_return(self):
        response = mock_flight_search(
            origin="SFO",
            destination="CDG",
            departure_date="2026-06-15",
            return_date="2026-06-22",
        )
        # At least some flights should have returnFlight when round trip
        has_return = any("returnFlight" in f for f in response["flights"])
        assert has_return

    def test_respects_limit(self):
        response = mock_flight_search(
            origin="SFO",
            destination="CDG",
            departure_date="2026-06-15",
            limit=3,
        )
        assert len(response["flights"]) <= 3

    def test_pagination_metadata(self):
        response = mock_flight_search(
            origin="SFO",
            destination="CDG",
            departure_date="2026-06-15",
        )
        if "pagination" in response:
            pagination = response["pagination"]
            assert "totalAvailable" in pagination
            assert "hasMoreResults" in pagination


class TestMockHotelSearch:
    def test_returns_skiplagged_shape(self):
        response = mock_hotel_search(
            city="PAR",
            checkin="2026-06-15",
            checkout="2026-06-18",
        )
        assert isinstance(response, dict)
        assert "results" in response
        assert isinstance(response["results"], list)

    def test_hotels_have_required_fields(self):
        response = mock_hotel_search(
            city="PAR",
            checkin="2026-06-15",
            checkout="2026-06-18",
        )
        hotel = response["results"][0]
        assert "id" in hotel
        assert "name" in hotel
        assert "price" in hotel
        assert "amount" in hotel["price"]
        assert "rating" in hotel
        assert "amenities" in hotel

    def test_varied_star_ratings(self):
        response = mock_hotel_search(
            city="PAR",
            checkin="2026-06-15",
            checkout="2026-06-18",
        )
        stars = {h["rating"]["stars"] for h in response["results"] if h.get("rating")}
        assert len(stars) > 1  # should have variety


class TestMockHotelDetails:
    def test_returns_hotel_detail(self):
        detail = mock_hotel_details(
            hotel_id=1001,
            checkin="2026-06-15",
            checkout="2026-06-18",
        )
        assert isinstance(detail, dict)
        assert "hotelId" in detail
        assert "rooms" in detail
        assert len(detail["rooms"]) > 0

    def test_rooms_have_required_fields(self):
        detail = mock_hotel_details(
            hotel_id=1001,
            checkin="2026-06-15",
            checkout="2026-06-18",
        )
        room = detail["rooms"][0]
        assert "title" in room
        assert "pricePerNightInDollars" in room
        assert "totalPriceInDollars" in room
        assert "currency" in room
        assert "bookingLink" in room

    def test_varied_room_types(self):
        detail = mock_hotel_details(
            hotel_id=1001,
            checkin="2026-06-15",
            checkout="2026-06-18",
        )
        titles = {r["title"] for r in detail["rooms"]}
        assert len(titles) >= 2  # multiple room types

    def test_location_coordinates(self):
        detail = mock_hotel_details(
            hotel_id=1001,
            checkin="2026-06-15",
            checkout="2026-06-18",
        )
        if "location" in detail:
            location = detail["location"]
            assert "lat" in location
            assert "lng" in location
