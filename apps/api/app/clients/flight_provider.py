"""Flight provider abstraction for multiple flight data sources."""

from __future__ import annotations

import logging
from typing import Any, Protocol, runtime_checkable

from app.core.config import settings

logger = logging.getLogger(__name__)


class FlightProviderError(Exception):
    """Base error for flight provider failures."""


@runtime_checkable
class FlightProvider(Protocol):
    """Protocol defining the interface for flight data providers."""

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        travel_class: str = "ECONOMY",
        non_stop: bool = False,
        max_results: int = 10,
    ) -> dict[str, Any]:
        """
        Search for flight offers.

        Args:
            origin: IATA airport code (e.g., "SFO")
            destination: IATA airport code (e.g., "JFK")
            departure_date: ISO format date (e.g., "2026-02-01")
            return_date: ISO format date for round trip, None for one-way
            adults: Number of adult passengers (1-9)
            travel_class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST
            non_stop: If True, only return non-stop flights
            max_results: Maximum number of flight offers to return

        Returns:
            dict with "data" array of flight offers

        Raises:
            FlightProviderError: If the search fails
        """
        ...


def get_flight_provider() -> FlightProvider:
    """
    Get the configured flight provider based on settings.

    Returns:
        A FlightProvider implementation based on EXTERNAL_FLIGHT_PRICE_PROVIDER env var.

    Supported providers:
        - "amadeus" (default): Uses Amadeus Flight Offers Search API
        - "fast-flights": Uses Google Flights via fast-flights library
    """
    provider_name = settings.external_flight_price_provider.lower()

    if provider_name == "fast-flights":
        logger.info("Using Google Flights provider (fast-flights)")
        from app.clients.google_flights import google_flights_client

        return google_flights_client

    # Default to Amadeus
    logger.info("Using Amadeus flight provider")
    from app.clients.amadeus import amadeus_client

    return amadeus_client


def get_provider_name() -> str:
    """Get the name of the currently configured flight provider."""
    return settings.external_flight_price_provider.lower()
