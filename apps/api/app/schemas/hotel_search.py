"""Normalized hotel search result types.

Provider-agnostic models consumed by chat tools and worker activities.
Mirrors the pattern in flight_search.py.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class HotelRoom(BaseModel):
    title: str
    occupancy_limit: int
    price_per_night: Decimal
    price_total: Decimal
    taxes_and_fees: Decimal
    currency: str
    refundable: bool
    free_cancellation: bool
    bed_types: list[str] = []
    booking_link: str | None = None


class HotelSearchHotel(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    star_rating: int | None = None
    review_rating: float | None = None
    review_count: int | None = None
    price_per_night: Decimal
    price_total: Decimal | None = None
    price_currency: str
    chain: str | None = None
    address: str | None = None
    amenities: list[str] = []
    booking_link: str | None = None
    rooms: list[HotelRoom] = []
    provider: str = "skiplagged"
    raw_data: dict[str, Any] | None = None


class HotelSearchResult(BaseModel):
    hotels: list[HotelSearchHotel]
    city: str
    checkin: str
    checkout: str
    provider: str = "skiplagged"
    total_results: int = 0
    currency: str = "USD"
    success: bool = True
    error: str | None = None
