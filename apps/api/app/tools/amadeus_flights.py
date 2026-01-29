"""Amadeus Flight Search MCP Tool.

This tool wraps AmadeusClient.search_flights() for use in the MCP router.
Use when:
- User asks for flight numbers or specific airlines
- Need detailed segment/layover information
- User wants to filter by airline
- Need to track a specific flight for price monitoring
- lastminute.com MCP doesn't provide enough detail
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.amadeus import AmadeusClient, AmadeusClientError, amadeus_client
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool

logger = logging.getLogger(__name__)

# JSON Schema for tool parameters (OpenAI function calling format)
AMADEUS_FLIGHT_TOOL_PARAMETERS = {
    "type": "object",
    "properties": {
        "origin": {
            "type": "string",
            "description": "Origin airport IATA code (e.g., 'SFO')",
            "pattern": "^[A-Za-z]{3}$",
        },
        "destination": {
            "type": "string",
            "description": "Destination airport IATA code (e.g., 'MCO')",
            "pattern": "^[A-Za-z]{3}$",
        },
        "departure_date": {
            "type": "string",
            "description": "Departure date in YYYY-MM-DD format",
            "format": "date",
        },
        "return_date": {
            "type": "string",
            "description": "Return date in YYYY-MM-DD format for round trip (optional)",
            "format": "date",
        },
        "adults": {
            "type": "integer",
            "description": "Number of adult passengers (1-9, default: 1)",
            "minimum": 1,
            "maximum": 9,
            "default": 1,
        },
        "travel_class": {
            "type": "string",
            "description": "Cabin class",
            "enum": ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
            "default": "ECONOMY",
        },
        "non_stop": {
            "type": "boolean",
            "description": "If true, only return non-stop flights (default: false)",
            "default": False,
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of results to return (1-250, default: 10)",
            "minimum": 1,
            "maximum": 250,
            "default": 10,
        },
    },
    "required": ["origin", "destination", "departure_date"],
}


class AmadeusFlightTool(BaseTool):
    """Search flights via Amadeus API.

    Use when:
    - User asks for flight numbers or specific airlines
    - Need detailed segment/layover information
    - User wants to filter by airline
    - Need to track a specific flight for price monitoring
    - lastminute.com MCP doesn't provide enough detail

    Returns detailed itineraries with flight numbers, airline codes,
    all segments, layover times, and real-time pricing.
    """

    name = "search_flights_amadeus"
    description = (
        "Search for flights using Amadeus. Returns detailed itineraries with "
        "flight numbers, airline codes, all segments, layover times, and real-time pricing. "
        "Use this when you need specific flight details like flight numbers or airline filtering."
    )

    def __init__(self, client: AmadeusClient | None = None) -> None:
        """Initialize the tool with an optional custom client.

        Args:
            client: Optional AmadeusClient instance (uses singleton if not provided).
        """
        self._client = client or amadeus_client

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Execute the flight search.

        Args:
            args: Dictionary containing search parameters.
            user_id: UUID string of the authenticated user (for logging/rate limiting).
            db: Database session (not used for this tool but required by interface).

        Returns:
            ToolResult with flight offers data or error message.
        """
        # Extract and validate parameters
        origin = args.get("origin")
        destination = args.get("destination")
        departure_date = args.get("departure_date")

        if not origin or not destination or not departure_date:
            return self.error("Missing required parameters: origin, destination, departure_date")

        # Optional parameters with defaults
        return_date = args.get("return_date")
        adults = args.get("adults", 1)
        travel_class = args.get("travel_class", "ECONOMY")
        non_stop = args.get("non_stop", False)
        max_results = args.get("max_results", 10)

        logger.info(
            "Amadeus flight search: %s -> %s on %s (user=%s)",
            origin,
            destination,
            departure_date,
            user_id,
        )

        try:
            result = await self._client.search_flights(
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                return_date=return_date,
                adults=adults,
                travel_class=travel_class,
                non_stop=non_stop,
                max_results=max_results,
            )

            formatted_data = self._format_results(result)
            return self.success(formatted_data)

        except AmadeusClientError as e:
            logger.warning("Amadeus flight search failed: %s", e)
            return self.error(f"Flight search failed: {e}")
        except Exception as e:
            logger.exception("Unexpected error in Amadeus flight search")
            return self.error(f"An unexpected error occurred: {e}")

    def _format_results(self, result: dict[str, Any]) -> dict[str, Any]:
        """Format Amadeus API response for LLM consumption.

        Args:
            result: Raw response from AmadeusClient.search_flights().

        Returns:
            Formatted dictionary with flight offers.
        """
        data = result.get("data", [])
        meta = result.get("meta", {})

        formatted_offers = []
        for offer in data:
            formatted_offer = self._format_single_offer(offer)
            if formatted_offer:
                formatted_offers.append(formatted_offer)

        return {
            "flights": formatted_offers,
            "count": len(formatted_offers),
            "provider": "amadeus",
            "currency": "USD",
            "meta": meta,
        }

    def _format_single_offer(self, offer: dict[str, Any]) -> dict[str, Any] | None:
        """Format a single flight offer.

        Args:
            offer: Raw flight offer from Amadeus API.

        Returns:
            Formatted offer dict or None if invalid.
        """
        try:
            price_info = offer.get("price", {})
            itineraries = offer.get("itineraries", [])
            validating_airlines = offer.get("validatingAirlineCodes", [])

            formatted_itineraries = []
            for itinerary in itineraries:
                formatted_itinerary = self._format_itinerary(itinerary)
                if formatted_itinerary:
                    formatted_itineraries.append(formatted_itinerary)

            return {
                "id": offer.get("id"),
                "price": {
                    "total": price_info.get("grandTotal") or price_info.get("total"),
                    "currency": price_info.get("currency", "USD"),
                    "base": price_info.get("base"),
                },
                "validating_airlines": validating_airlines,
                "itineraries": formatted_itineraries,
                "seats_available": offer.get("numberOfBookableSeats"),
            }
        except (KeyError, TypeError, AttributeError) as e:
            logger.warning("Failed to format flight offer: %s", e)
            return None

    def _format_itinerary(self, itinerary: dict[str, Any]) -> dict[str, Any] | None:
        """Format a single itinerary with all segments.

        Args:
            itinerary: Raw itinerary from Amadeus API.

        Returns:
            Formatted itinerary dict or None if invalid.
        """
        try:
            segments = itinerary.get("segments", [])
            formatted_segments = []

            for segment in segments:
                departure = segment.get("departure", {})
                arrival = segment.get("arrival", {})

                formatted_segment = {
                    "flight_number": f"{segment.get('carrierCode')}{segment.get('number')}",
                    "carrier_code": segment.get("carrierCode"),
                    "carrier_name": segment.get("operating", {}).get("carrierCode"),
                    "departure": {
                        "airport": departure.get("iataCode"),
                        "terminal": departure.get("terminal"),
                        "time": departure.get("at"),
                    },
                    "arrival": {
                        "airport": arrival.get("iataCode"),
                        "terminal": arrival.get("terminal"),
                        "time": arrival.get("at"),
                    },
                    "duration": segment.get("duration"),
                    "aircraft": segment.get("aircraft", {}).get("code"),
                    "cabin": segment.get("cabin"),
                    "stops": segment.get("numberOfStops", 0),
                }
                formatted_segments.append(formatted_segment)

            return {
                "duration": itinerary.get("duration"),
                "segments": formatted_segments,
                "segment_count": len(formatted_segments),
            }
        except (KeyError, TypeError, AttributeError) as e:
            logger.warning("Failed to format itinerary: %s", e)
            return None
