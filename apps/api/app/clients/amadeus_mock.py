"""Mock data for Amadeus API responses during development."""

from __future__ import annotations

import logging
import random
from typing import Any

logger = logging.getLogger(__name__)

# Sample airports/cities for location search
MOCK_LOCATIONS: list[dict[str, str]] = [
    {"code": "JFK", "name": "John F Kennedy International", "type": "AIRPORT"},
    {"code": "LAX", "name": "Los Angeles International", "type": "AIRPORT"},
    {"code": "ORD", "name": "O'Hare International", "type": "AIRPORT"},
    {"code": "MIA", "name": "Miami International", "type": "AIRPORT"},
    {"code": "SFO", "name": "San Francisco International", "type": "AIRPORT"},
    {"code": "SEA", "name": "Seattle-Tacoma International", "type": "AIRPORT"},
    {"code": "DEN", "name": "Denver International", "type": "AIRPORT"},
    {"code": "ATL", "name": "Hartsfield-Jackson Atlanta International", "type": "AIRPORT"},
    {"code": "BOS", "name": "Boston Logan International", "type": "AIRPORT"},
    {"code": "DFW", "name": "Dallas/Fort Worth International", "type": "AIRPORT"},
    {"code": "LHR", "name": "London Heathrow", "type": "AIRPORT"},
    {"code": "CDG", "name": "Paris Charles de Gaulle", "type": "AIRPORT"},
    {"code": "NRT", "name": "Tokyo Narita International", "type": "AIRPORT"},
    {"code": "HNL", "name": "Honolulu International", "type": "AIRPORT"},
    {"code": "CUN", "name": "Cancun International", "type": "AIRPORT"},
    {"code": "NYC", "name": "New York", "type": "CITY"},
    {"code": "LON", "name": "London", "type": "CITY"},
    {"code": "PAR", "name": "Paris", "type": "CITY"},
    {"code": "TYO", "name": "Tokyo", "type": "CITY"},
    {"code": "MXP", "name": "Milan Malpensa", "type": "AIRPORT"},
]

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


def mock_search_locations(query: str, limit: int = 10) -> list[dict[str, str]]:
    """Return mock location results matching the query."""
    query_lower = query.lower()
    matches = [
        loc
        for loc in MOCK_LOCATIONS
        if query_lower in loc["code"].lower() or query_lower in loc["name"].lower()
    ]
    logger.info("Mock Amadeus: Returning %d locations for query '%s'", len(matches[:limit]), query)
    return matches[:limit]


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
