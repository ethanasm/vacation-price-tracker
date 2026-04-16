"""Mock data for Skiplagged API responses during development.

Returns Skiplagged-shaped responses with realistic variation.
Used when MOCK_SKIPLAGGED_API=true in environment.
"""

from __future__ import annotations

import logging
import random
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Mock flight data
# ---------------------------------------------------------------------------

_MOCK_FLIGHTS: list[dict[str, Any]] = [
    {
        "airlines": "Air France",
        "carrier": "AF",
        "flight_num": "81",
        "departure_time": "20:10",
        "arrival_time": "15:50+1",
        "duration": "10h 40m",
        "layovers": 0,
        "base_price": 1200.0,
    },
    {
        "airlines": "United Airlines",
        "carrier": "UA",
        "flight_num": "200",
        "departure_time": "09:15",
        "arrival_time": "22:00",
        "duration": "11h 45m",
        "layovers": 0,
        "base_price": 980.0,
    },
    {
        "airlines": "Delta Air Lines",
        "carrier": "DL",
        "flight_num": "410",
        "departure_time": "07:30",
        "arrival_time": "08:15+1",
        "duration": "14h 45m",
        "layovers": 1,
        "base_price": 750.0,
    },
    {
        "airlines": "Ryanair",
        "carrier": "FR",
        "flight_num": "1234",
        "departure_time": "06:00",
        "arrival_time": "09:50",
        "duration": "2h 50m",
        "layovers": 0,
        "base_price": 200.0,
    },
    {
        "airlines": "Lufthansa",
        "carrier": "LH",
        "flight_num": "453",
        "departure_time": "11:30",
        "arrival_time": "06:20+1",
        "duration": "12h 50m",
        "layovers": 1,
        "base_price": 890.0,
    },
    {
        "airlines": "British Airways",
        "carrier": "BA",
        "flight_num": "174",
        "departure_time": "14:45",
        "arrival_time": "09:10+1",
        "duration": "11h 25m",
        "layovers": 0,
        "base_price": 1100.0,
    },
    {
        "airlines": "Air Canada",
        "carrier": "AC",
        "flight_num": "744",
        "departure_time": "17:00",
        "arrival_time": "11:30+1",
        "duration": "13h 30m",
        "layovers": 1,
        "base_price": 850.0,
    },
    {
        "airlines": "Swiss International",
        "carrier": "LX",
        "flight_num": "38",
        "departure_time": "10:20",
        "arrival_time": "08:05+1",
        "duration": "12h 45m",
        "layovers": 1,
        "base_price": 950.0,
    },
    {
        "airlines": "KLM Royal Dutch Airlines",
        "carrier": "KL",
        "flight_num": "605",
        "departure_time": "13:10",
        "arrival_time": "09:55+1",
        "duration": "11h 45m",
        "layovers": 1,
        "base_price": 820.0,
    },
    {
        "airlines": "Iberia",
        "carrier": "IB",
        "flight_num": "6253",
        "departure_time": "08:00",
        "arrival_time": "05:45+1",
        "duration": "14h 45m",
        "layovers": 2,
        "base_price": 650.0,
    },
]


def mock_flight_search(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None = None,
    adults: int = 1,
    max_stops: str | None = None,
    sort: str = "value",
    limit: int = 75,
    offset: int = 0,
) -> dict[str, Any]:
    """Return mock flight search results in Skiplagged format.

    Args:
        origin: Origin airport IATA code.
        destination: Destination airport IATA code.
        departure_date: Departure date (YYYY-MM-DD).
        return_date: Return date for round trips (YYYY-MM-DD).
        adults: Number of adult passengers.
        max_stops: Stop filter ("none", "one", "many").
        sort: Sort order ("price", "duration", "value").
        limit: Max results to return.
        offset: Pagination offset.

    Returns:
        Skiplagged-shaped flight search response dict.
    """
    source = _MOCK_FLIGHTS[:]

    # Apply stop filter
    if max_stops == "none":
        source = [f for f in source if f["layovers"] == 0]
    elif max_stops == "one":
        source = [f for f in source if f["layovers"] <= 1]

    # Apply sort
    if sort == "price":
        source = sorted(source, key=lambda f: f["base_price"])
    elif sort == "duration":
        pass  # Mock data already loosely ordered

    # Apply pagination
    page_source = source[offset: offset + limit]

    flights = []
    for i, flight in enumerate(page_source):
        flight_index = offset + i
        base_price = flight["base_price"]
        # Add ±15% random variation
        variation = base_price * random.uniform(-0.15, 0.15)
        price = round(base_price + variation, 2)
        # Multiply by adults
        total_price = round(price * adults, 2)

        flight_id = (
            f"{origin.upper()}-{destination.upper()}-{departure_date}"
            f"-trip={flight['carrier']}{flight['flight_num']}"
        )

        flight_entry: dict[str, Any] = {
            "type": "FlightCard",
            "id": flight_id,
            "airlines": flight["airlines"],
            "departure": {
                "airport": origin.upper(),
                "dateTime": f"{departure_date}T{flight['departure_time']}:00-07:00",
            },
            "arrival": {
                "airport": destination.upper(),
                "dateTime": f"{departure_date}T{flight['arrival_time']}:00+02:00",
            },
            "duration": flight["duration"],
            "layovers": flight["layovers"],
            "price": {"amount": total_price, "currency": "USD"},
            "deepLink": f"https://skiplagged.com/flights/{origin.lower()}/{destination.lower()}/{departure_date}#{flight_index}",
            "attributes": ["nonstop" if flight["layovers"] == 0 else "connecting"],
        }

        if return_date:
            return_flight = {
                "airlines": flight["airlines"],
                "departure": {
                    "airport": destination.upper(),
                    "dateTime": f"{return_date}T{flight['departure_time']}:00+02:00",
                },
                "arrival": {
                    "airport": origin.upper(),
                    "dateTime": f"{return_date}T{flight['arrival_time']}:00-07:00",
                },
                "duration": flight["duration"],
                "layovers": flight["layovers"],
                "attributes": ["nonstop" if flight["layovers"] == 0 else "connecting"],
            }
            flight_entry["returnFlight"] = return_flight

        flights.append(flight_entry)

    total_available = len(source)
    has_more = (offset + limit) < total_available

    logger.info(
        "Mock Skiplagged Flights: Returning %d flights for %s -> %s (%s, %d adults)",
        len(flights),
        origin,
        destination,
        departure_date,
        adults,
    )

    return {
        "searchUrl": f"https://skiplagged.com/flights/{origin.lower()}/{destination.lower()}/{departure_date}",
        "flights": flights,
        "pagination": {
            "totalAvailable": total_available,
            "currentlyShowing": len(flights),
            "offset": offset,
            "limit": limit,
            "hasMoreResults": has_more,
        },
    }


# ---------------------------------------------------------------------------
# Mock hotel data
# ---------------------------------------------------------------------------

_MOCK_HOTELS: list[dict[str, Any]] = [
    {
        "id": "hotel_1001",
        "name": "Grand Palais Hotel",
        "star_rating": 5,
        "chain": "Marriott",
        "location": "12 Rue de Rivoli, Paris",
        "amenities": ["Free WiFi", "Pool", "Spa", "Restaurant", "Gym", "Bar"],
        "base_price": 380.0,
    },
    {
        "id": "hotel_1002",
        "name": "Eiffel Tower View Inn",
        "star_rating": 4,
        "chain": "Hilton",
        "location": "7 Avenue de Suffren, Paris",
        "amenities": ["Free WiFi", "Restaurant", "Bar", "Room Service"],
        "base_price": 220.0,
    },
    {
        "id": "hotel_1003",
        "name": "Montmartre Boutique Hotel",
        "star_rating": 4,
        "chain": None,
        "location": "24 Rue Lepic, Montmartre, Paris",
        "amenities": ["Free WiFi", "Breakfast Included", "Concierge"],
        "base_price": 185.0,
    },
    {
        "id": "hotel_1004",
        "name": "Le Marais Budget Hotel",
        "star_rating": 3,
        "chain": None,
        "location": "45 Rue de Bretagne, Le Marais, Paris",
        "amenities": ["Free WiFi", "24hr Reception"],
        "base_price": 110.0,
    },
    {
        "id": "hotel_1005",
        "name": "Champs-Elysees Luxury Suites",
        "star_rating": 5,
        "chain": "Four Seasons",
        "location": "31 Avenue des Champs-Elysees, Paris",
        "amenities": ["Free WiFi", "Pool", "Spa", "Fine Dining", "Butler Service", "Valet"],
        "base_price": 650.0,
    },
    {
        "id": "hotel_1006",
        "name": "Republique Modern Hotel",
        "star_rating": 3,
        "chain": "Ibis",
        "location": "8 Place de la Republique, Paris",
        "amenities": ["Free WiFi", "Restaurant", "Business Center"],
        "base_price": 95.0,
    },
    {
        "id": "hotel_1007",
        "name": "Saint-Germain Charme Hotel",
        "star_rating": 4,
        "chain": None,
        "location": "3 Rue Jacob, Saint-Germain-des-Pres, Paris",
        "amenities": ["Free WiFi", "Breakfast Included", "Bike Rental", "Concierge"],
        "base_price": 200.0,
    },
    {
        "id": "hotel_1008",
        "name": "Paris Opera Budget Rooms",
        "star_rating": 2,
        "chain": None,
        "location": "58 Rue du Faubourg-Montmartre, Paris",
        "amenities": ["Free WiFi"],
        "base_price": 65.0,
    },
]


def mock_hotel_search(
    city: str,
    checkin: str,
    checkout: str,
    adults: int = 2,
    rooms: int = 1,
    sort: str = "value",
    limit: int = 75,
    offset: int = 0,
) -> dict[str, Any]:
    """Return mock hotel search results in Skiplagged format.

    Args:
        city: City name or IATA code.
        checkin: Check-in date (YYYY-MM-DD).
        checkout: Check-out date (YYYY-MM-DD).
        adults: Number of adult guests.
        rooms: Number of rooms.
        sort: Sort order ("price", "ranking", "value").
        limit: Max results to return.
        offset: Pagination offset.

    Returns:
        Skiplagged-shaped hotel search response dict.
    """
    source = _MOCK_HOTELS[:]

    # Apply sort
    if sort == "price":
        source = sorted(source, key=lambda h: h["base_price"])

    # Apply pagination
    page_source = source[offset: offset + limit]

    hotels = []
    for hotel in page_source:
        base_price = hotel["base_price"]
        # Add ±15% random variation
        variation = base_price * random.uniform(-0.15, 0.15)
        price = round(base_price + variation, 2)
        # Multiply by rooms
        total_price = round(price * rooms, 2)

        hotel_entry: dict[str, Any] = {
            "type": "HotelCard",
            "id": hotel["id"],
            "name": hotel["name"],
            "imageUrl": f"https://images.skiplagged.com/hotels/{hotel['id']}.jpg",
            "rating": {
                "stars": hotel["star_rating"],
                "text": f"{hotel['star_rating']} stars",
            },
            "price": {
                "amount": total_price,
                "currency": "USD",
                "text": f"${total_price}/night",
            },
            "chain": hotel["chain"],
            "location": hotel["location"],
            "amenities": hotel["amenities"],
            "deepLink": f"https://skiplagged.com/hotels/{city.lower()}/{hotel['id']}/{checkin}/{checkout}",
        }
        hotels.append(hotel_entry)

    total_available = len(source)
    has_more = (offset + limit) < total_available

    logger.info(
        "Mock Skiplagged Hotels: Returning %d hotels for %s (%s to %s, %d adults, %d rooms)",
        len(hotels),
        city,
        checkin,
        checkout,
        adults,
        rooms,
    )

    return {
        "searchUrl": f"https://skiplagged.com/hotels/{city.lower()}/{checkin}/{checkout}",
        "results": hotels,
        "pagination": {
            "totalAvailable": total_available,
            "currentlyShowing": len(hotels),
            "offset": offset,
            "limit": limit,
            "hasMoreResults": has_more,
        },
    }


# ---------------------------------------------------------------------------
# Mock hotel detail data
# ---------------------------------------------------------------------------

_MOCK_ROOM_TYPES: list[dict[str, Any]] = [
    {
        "title": "Standard King Room",
        "occupancyLimit": 2,
        "bedTypes": ["King"],
        "refundable": False,
        "freeCancellation": False,
        "price_multiplier": 1.0,
    },
    {
        "title": "Deluxe Queen Room",
        "occupancyLimit": 2,
        "bedTypes": ["Queen"],
        "refundable": True,
        "freeCancellation": True,
        "price_multiplier": 1.2,
    },
    {
        "title": "Junior Suite",
        "occupancyLimit": 3,
        "bedTypes": ["King", "Sofa Bed"],
        "refundable": True,
        "freeCancellation": True,
        "price_multiplier": 1.8,
    },
    {
        "title": "Executive Suite with City View",
        "occupancyLimit": 4,
        "bedTypes": ["King", "Twin"],
        "refundable": True,
        "freeCancellation": True,
        "price_multiplier": 2.5,
    },
    {
        "title": "Standard Twin Room",
        "occupancyLimit": 2,
        "bedTypes": ["Twin", "Twin"],
        "refundable": False,
        "freeCancellation": False,
        "price_multiplier": 0.95,
    },
]


def mock_hotel_details(
    hotel_id: int,
    checkin: str,
    checkout: str,
    adults: int = 2,
    rooms: int = 1,
) -> dict[str, Any]:
    """Return mock hotel detail response in Skiplagged format.

    Includes 3-5 room types with varied pricing and cancellation policies.

    Args:
        hotel_id: Hotel ID (integer).
        checkin: Check-in date (YYYY-MM-DD).
        checkout: Check-out date (YYYY-MM-DD).
        adults: Number of adults.
        rooms: Number of rooms.

    Returns:
        Skiplagged-shaped hotel detail response dict.
    """
    # Pick a mock hotel or use defaults for unknown IDs
    hotel_lookup = {int(h["id"].replace("hotel_", "")): h for h in _MOCK_HOTELS}
    hotel = hotel_lookup.get(hotel_id, _MOCK_HOTELS[0])

    base_price = hotel["base_price"]
    # Add ±10% variation
    variation = base_price * random.uniform(-0.10, 0.10)
    nightly_price = round(base_price + variation, 2)

    # Calculate nights
    from datetime import date

    try:
        checkin_dt = date.fromisoformat(checkin)
        checkout_dt = date.fromisoformat(checkout)
        nights = max(1, (checkout_dt - checkin_dt).days)
    except ValueError:
        nights = 1

    total_price = round(nightly_price * nights * rooms, 2)

    # Build 3-5 rooms
    room_count = random.randint(3, 5)
    room_types = _MOCK_ROOM_TYPES[:room_count]
    mock_rooms = []
    for i, room_type in enumerate(room_types):
        room_nightly = round(nightly_price * room_type["price_multiplier"], 2)
        room_total = round(room_nightly * nights, 2)
        room_taxes = round(room_total * 0.12, 2)
        mock_rooms.append({
            "id": f"room_{hotel_id}_{i}",
            "title": room_type["title"],
            "occupancyLimit": room_type["occupancyLimit"],
            "pricePerNightInDollars": room_nightly,
            "totalPriceInDollars": room_total,
            "taxesAndFeesInDollars": room_taxes,
            "currency": "USD",
            "refundable": room_type["refundable"],
            "freeCancellation": room_type["freeCancellation"],
            "bedTypes": room_type["bedTypes"],
            "bookingLink": f"https://skiplagged.com/hotels/book/{hotel_id}/room_{i}/{checkin}/{checkout}",
            "source": "skiplagged",
        })

    logger.info(
        "Mock Skiplagged Hotel Details: hotel_id=%d, %d nights, %d rooms",
        hotel_id,
        nights,
        len(mock_rooms),
    )

    return {
        "hotelId": str(hotel_id),
        "hotelName": hotel["name"],
        "starRating": hotel["star_rating"],
        "reviewRating": round(random.uniform(3.5, 5.0), 1),
        "reviewCount": random.randint(50, 2000),
        "totalPriceInDollars": total_price,
        "chainName": hotel["chain"],
        "amenityNames": hotel["amenities"],
        "address": hotel["location"],
        "cityName": "Paris",
        "countryName": "France",
        "description": (
            f"Welcome to {hotel['name']}, a premier {hotel['star_rating']}-star property "
            f"located in the heart of the city. Enjoy world-class amenities and service."
        ),
        "checkinDate": checkin,
        "checkoutDate": checkout,
        "location": {
            "lat": round(48.8566 + random.uniform(-0.02, 0.02), 6),
            "lng": round(2.3522 + random.uniform(-0.02, 0.02), 6),
        },
        "rooms": mock_rooms,
    }
