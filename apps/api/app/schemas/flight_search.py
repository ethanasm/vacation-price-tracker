"""Normalized flight search schemas for external MCP providers."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class FlightLayover(BaseModel):
    """Layover information between flight segments."""

    airport: str = Field(description="Layover airport IATA code")
    city: str | None = Field(default=None, description="Layover city name")
    arrival_time: datetime | None = Field(default=None, description="Arrival time at layover")
    departure_time: datetime | None = Field(default=None, description="Departure time from layover")
    duration_minutes: int | None = Field(default=None, description="Layover duration in minutes")


class FlightSearchFlight(BaseModel):
    """A single flight in search results (normalized across providers)."""

    # Core routing info
    departure_airport: str = Field(description="Departure airport IATA code")
    arrival_airport: str = Field(description="Arrival airport IATA code")
    departure_time: datetime | None = Field(default=None, description="Departure datetime (local)")
    arrival_time: datetime | None = Field(default=None, description="Arrival datetime (local)")

    # Airline info (may be None for Kiwi)
    airline_name: str | None = Field(default=None, description="Airline name (e.g., 'Ryanair')")
    carrier_code: str | None = Field(default=None, description="Airline IATA code (e.g., 'FR')")

    # Duration and stops
    duration_minutes: int | None = Field(default=None, description="Total flight duration in minutes")
    stops: int = Field(default=0, description="Number of stops (0 = direct)")
    stops_text: str | None = Field(default=None, description="Human-readable stops (e.g., 'Direct', '1 stop')")

    # Layover details (available from Kiwi)
    layovers: list[FlightLayover] = Field(default_factory=list, description="Detailed layover information")

    # Pricing
    price_amount: Decimal = Field(description="Price amount")
    price_currency: str = Field(default="USD", description="Price currency code")
    price_display: str | None = Field(default=None, description="Formatted price for display (e.g., '35.85 $')")

    # Booking
    booking_link: str | None = Field(default=None, description="Deep link for booking")

    # Provider metadata
    provider: str = Field(description="Data source provider (e.g., 'lastminute', 'kiwi')")
    raw_data: dict | None = Field(default=None, description="Original response data for debugging")


class FlightSearchResult(BaseModel):
    """Normalized flight search result from external MCP providers."""

    # Flight results
    flights: list[FlightSearchFlight] = Field(default_factory=list, description="List of flight offers")

    # Search metadata
    origin: str = Field(description="Search origin IATA code")
    destination: str = Field(description="Search destination IATA code")
    departure_date: str = Field(description="Search departure date (YYYY-MM-DD)")
    return_date: str | None = Field(default=None, description="Search return date for round trips")
    is_round_trip: bool = Field(default=False, description="Whether this is a round trip search")

    # Provider info
    provider: str = Field(description="Data source provider")
    total_results: int = Field(default=0, description="Total number of results found")
    currency: str = Field(default="USD", description="Currency used for prices")

    # Error handling
    error: str | None = Field(default=None, description="Error message if search failed")
    success: bool = Field(default=True, description="Whether the search completed successfully")

    model_config = {"from_attributes": True}
