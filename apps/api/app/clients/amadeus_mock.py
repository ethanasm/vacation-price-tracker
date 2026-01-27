"""Mock data for API responses during development."""

from __future__ import annotations

import logging
import random
from typing import Any

logger = logging.getLogger(__name__)


# Sample flight data for flight search
MOCK_FLIGHTS: list[dict[str, Any]] = [
    {
        "id": "FL001",
        "carrier": "UA",
        "airline_name": "United Airlines",
        "price": {"total": "342.00", "currency": "USD"},
        "departure_time": "08:15",
        "arrival_time": "11:45",
        "duration": 210,
        "stops": 0,
    },
    {
        "id": "FL002",
        "carrier": "AA",
        "airline_name": "American Airlines",
        "price": {"total": "389.00", "currency": "USD"},
        "departure_time": "10:30",
        "arrival_time": "14:15",
        "duration": 225,
        "stops": 0,
    },
    {
        "id": "FL003",
        "carrier": "DL",
        "airline_name": "Delta Air Lines",
        "price": {"total": "298.00", "currency": "USD"},
        "departure_time": "06:00",
        "arrival_time": "10:45",
        "duration": 285,
        "stops": 1,
    },
    {
        "id": "FL004",
        "carrier": "SW",
        "airline_name": "Southwest Airlines",
        "price": {"total": "256.00", "currency": "USD"},
        "departure_time": "14:20",
        "arrival_time": "17:50",
        "duration": 210,
        "stops": 0,
    },
    {
        "id": "FL005",
        "carrier": "AS",
        "airline_name": "Alaska Airlines",
        "price": {"total": "312.00", "currency": "USD"},
        "departure_time": "12:00",
        "arrival_time": "16:30",
        "duration": 270,
        "stops": 1,
    },
    {
        "id": "FL006",
        "carrier": "B6",
        "airline_name": "JetBlue Airways",
        "price": {"total": "275.00", "currency": "USD"},
        "departure_time": "16:45",
        "arrival_time": "20:15",
        "duration": 210,
        "stops": 0,
    },
]


def mock_flight_search(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: str | None = None,
    adults: int = 1,
    travel_class: str = "ECONOMY",
    non_stop: bool = False,
    max_results: int = 10,
) -> dict[str, Any]:
    """Return mock flight search results in Amadeus format."""
    flights = []
    source_flights = MOCK_FLIGHTS[:max_results]

    # Filter to non-stop only if requested
    if non_stop:
        source_flights = [f for f in source_flights if f["stops"] == 0]

    for i, flight in enumerate(source_flights):
        base_price = float(flight["price"]["total"])
        # Add some random variation (+/- 15%)
        variation = base_price * random.uniform(-0.15, 0.15)
        adjusted_price = round(base_price + variation, 2)
        # Multiply by adults
        total_price = round(adjusted_price * adults, 2)

        # Build Amadeus-compatible response format
        itineraries = [
            {
                "duration": f"PT{flight['duration']}M",
                "segments": [
                    {
                        "departure": {
                            "iataCode": origin.upper(),
                            "at": f"{departure_date}T{flight['departure_time']}:00",
                        },
                        "arrival": {
                            "iataCode": destination.upper(),
                            "at": f"{departure_date}T{flight['arrival_time']}:00",
                        },
                        "carrierCode": flight["carrier"],
                        "number": str(100 + i),
                        "operating": {"carrierCode": flight["carrier"]},
                        "numberOfStops": flight["stops"],
                    }
                ],
            }
        ]

        # Add return flight if round trip
        if return_date:
            itineraries.append(
                {
                    "duration": f"PT{flight['duration']}M",
                    "segments": [
                        {
                            "departure": {
                                "iataCode": destination.upper(),
                                "at": f"{return_date}T{flight['departure_time']}:00",
                            },
                            "arrival": {
                                "iataCode": origin.upper(),
                                "at": f"{return_date}T{flight['arrival_time']}:00",
                            },
                            "carrierCode": flight["carrier"],
                            "number": str(200 + i),
                            "operating": {"carrierCode": flight["carrier"]},
                            "numberOfStops": flight["stops"],
                        }
                    ],
                }
            )

        flights.append(
            {
                "id": str(i + 1),
                "source": "MOCK",
                "instantTicketingRequired": False,
                "validatingAirlineCodes": [flight["carrier"]],
                "price": {
                    "currency": "USD",
                    "total": str(total_price),
                    "grandTotal": str(total_price),
                    "base": str(round(total_price * 0.85, 2)),
                },
                "itineraries": itineraries,
                "travelerPricings": [
                    {
                        "travelerId": "1",
                        "fareOption": "STANDARD",
                        "travelerType": "ADULT",
                        "price": {"currency": "USD", "total": str(total_price)},
                        "fareDetailsBySegment": [
                            {"cabin": travel_class, "class": travel_class[0]}
                        ],
                    }
                ],
            }
        )

    logger.info(
        "Mock Amadeus Flights: Returning %d flights for %s -> %s (%s, %d adults)",
        len(flights),
        origin,
        destination,
        departure_date,
        adults,
    )

    return {
        "data": flights,
        "meta": {
            "count": len(flights),
            "provider": "amadeus_mock",
        },
    }

# Sample hotel data for hotel search
MOCK_HOTELS: list[dict[str, Any]] = [
    {
        "hotel_id": "MOCK001",
        "name": "Grand Plaza Hotel",
        "description": "Deluxe King Room with Ocean View - Spacious room featuring modern amenities",
        "price": {"total": "289.00", "currency": "USD"},
        "rating": 4,
        "address": "123 Beachfront Drive",
    },
    {
        "hotel_id": "MOCK002",
        "name": "Seaside Resort & Spa",
        "description": "Premium Suite with City View - Luxury suite with separate living area",
        "price": {"total": "425.00", "currency": "USD"},
        "rating": 5,
        "address": "456 Ocean Boulevard",
    },
    {
        "hotel_id": "MOCK003",
        "name": "Downtown Business Hotel",
        "description": "Standard Queen Room - Comfortable room ideal for business travelers",
        "price": {"total": "159.00", "currency": "USD"},
        "rating": 3,
        "address": "789 Main Street",
    },
    {
        "hotel_id": "MOCK004",
        "name": "Boutique Garden Inn",
        "description": "Garden View Double Room - Charming room overlooking the courtyard garden",
        "price": {"total": "199.00", "currency": "USD"},
        "rating": 4,
        "address": "321 Garden Lane",
    },
    {
        "hotel_id": "MOCK005",
        "name": "Luxury Waterfront Hotel",
        "description": "Executive King Suite with Ocean View - Top floor suite with panoramic views",
        "price": {"total": "599.00", "currency": "USD"},
        "rating": 5,
        "address": "555 Harbor Way",
    },
    {
        "hotel_id": "MOCK006",
        "name": "Budget Comfort Inn",
        "description": "Economy Double Room - Clean and affordable accommodation",
        "price": {"total": "89.00", "currency": "USD"},
        "rating": 2,
        "address": "999 Highway Road",
    },
    {
        "hotel_id": "MOCK007",
        "name": "Historic City Center Hotel",
        "description": "Classic King Room with City View - Elegant room in heritage building",
        "price": {"total": "245.00", "currency": "USD"},
        "rating": 4,
        "address": "100 Old Town Square",
    },
    {
        "hotel_id": "MOCK008",
        "name": "Modern Airport Hotel",
        "description": "Superior Twin Room - Convenient location with soundproof windows",
        "price": {"total": "175.00", "currency": "USD"},
        "rating": 3,
        "address": "1 Airport Terminal Road",
    },
]


def mock_hotel_search(
    city_code: str,
    check_in_date: str,
    check_out_date: str,
    adults: int = 2,
    rooms: int = 1,
) -> dict[str, Any]:
    """Return mock hotel search results."""
    # Randomize prices slightly for each search to simulate real data
    hotels = []
    for hotel in MOCK_HOTELS:
        hotel_copy = hotel.copy()
        base_price = float(hotel["price"]["total"])
        # Add some random variation (+/- 15%)
        variation = base_price * random.uniform(-0.15, 0.15)
        adjusted_price = round(base_price + variation, 2)
        # Multiply by rooms
        total_price = round(adjusted_price * rooms, 2)
        hotel_copy["price"] = {"total": str(total_price), "currency": "USD"}
        hotels.append(hotel_copy)

    logger.info(
        "Mock Amadeus: Returning %d hotels for %s (%s to %s, %d adults, %d rooms)",
        len(hotels),
        city_code,
        check_in_date,
        check_out_date,
        adults,
        rooms,
    )

    return {
        "data": hotels,
        "meta": {
            "count": len(hotels),
            "provider": "amadeus_mock",
        },
    }
