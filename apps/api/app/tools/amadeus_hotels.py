"""Amadeus Hotel Search MCP Tool.

This tool wraps AmadeusClient.search_hotels_by_city() for use in the MCP router.
Use for finding hotels in a destination city.
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
AMADEUS_HOTEL_TOOL_PARAMETERS = {
    "type": "object",
    "properties": {
        "city_code": {
            "type": "string",
            "description": "City IATA code (e.g., 'PAR' for Paris, 'NYC' for New York)",
            "pattern": "^[A-Za-z]{3}$",
        },
        "check_in_date": {
            "type": "string",
            "description": "Check-in date in YYYY-MM-DD format",
            "format": "date",
        },
        "check_out_date": {
            "type": "string",
            "description": "Check-out date in YYYY-MM-DD format",
            "format": "date",
        },
        "adults": {
            "type": "integer",
            "description": "Number of adult guests per room (1-9, default: 1)",
            "minimum": 1,
            "maximum": 9,
            "default": 1,
        },
        "rooms": {
            "type": "integer",
            "description": "Number of rooms needed (1-9, default: 1)",
            "minimum": 1,
            "maximum": 9,
            "default": 1,
        },
        "radius": {
            "type": "integer",
            "description": "Search radius from city center (default: 20)",
            "minimum": 1,
            "maximum": 100,
            "default": 20,
        },
        "radius_unit": {
            "type": "string",
            "description": "Unit for search radius",
            "enum": ["KM", "MILE"],
            "default": "KM",
        },
        "max_hotels": {
            "type": "integer",
            "description": "Maximum number of hotels to return (default: 20)",
            "minimum": 1,
            "maximum": 50,
            "default": 20,
        },
    },
    "required": ["city_code", "check_in_date", "check_out_date"],
}


class AmadeusHotelTool(BaseTool):
    """Search hotels in a city via Amadeus API.

    This tool finds hotels in a destination city and returns pricing information.
    It combines the Amadeus Hotel List API and Hotel Search API into a single call.
    """

    name = "search_hotels"
    description = (
        "Search for hotels in a destination city with availability and pricing. "
        "Returns hotel names, ratings, room types, and prices for the specified dates."
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
        """Execute the hotel search.

        Args:
            args: Dictionary containing search parameters.
            user_id: UUID string of the authenticated user (for logging/rate limiting).
            db: Database session (not used for this tool but required by interface).

        Returns:
            ToolResult with hotel offers data or error message.
        """
        # Extract and validate required parameters
        city_code = args.get("city_code")
        check_in_date = args.get("check_in_date")
        check_out_date = args.get("check_out_date")

        if not city_code or not check_in_date or not check_out_date:
            return self.error("Missing required parameters: city_code, check_in_date, check_out_date")

        # Optional parameters with defaults
        adults = args.get("adults", 1)
        rooms = args.get("rooms", 1)
        max_hotels = args.get("max_hotels", 20)

        logger.info(
            "Amadeus hotel search: city=%s, dates=%s to %s (user=%s)",
            city_code,
            check_in_date,
            check_out_date,
            user_id,
        )

        try:
            # Use the combined search_hotels method
            result = await self._client.search_hotels(
                city_code=city_code,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                adults=adults,
                rooms=rooms,
                max_hotels=max_hotels,
            )

            formatted_data = self._format_results(result)
            return self.success(formatted_data)

        except AmadeusClientError as e:
            logger.warning("Amadeus hotel search failed: %s", e)
            return self.error(f"Hotel search failed: {e}")
        except Exception as e:
            logger.exception("Unexpected error in Amadeus hotel search")
            return self.error(f"An unexpected error occurred: {e}")

    def _format_results(self, result: dict[str, Any]) -> dict[str, Any]:
        """Format Amadeus API response for LLM consumption.

        Args:
            result: Raw response from AmadeusClient.search_hotels().

        Returns:
            Formatted dictionary with hotel offers.
        """
        data = result.get("data", [])
        meta = result.get("meta", {})

        formatted_hotels = []
        for hotel_data in data:
            formatted_hotel = self._format_single_hotel(hotel_data)
            if formatted_hotel:
                formatted_hotels.append(formatted_hotel)

        return {
            "hotels": formatted_hotels,
            "count": len(formatted_hotels),
            "provider": meta.get("provider", "amadeus"),
            "currency": "USD",
        }

    def _format_single_hotel(self, hotel_data: dict[str, Any]) -> dict[str, Any] | None:
        """Format a single hotel with its offers.

        Args:
            hotel_data: Raw hotel data from Amadeus API.

        Returns:
            Formatted hotel dict or None if invalid.
        """
        try:
            hotel_info = hotel_data.get("hotel", {})
            offers = hotel_data.get("offers", [])

            formatted_offers = []
            for offer in offers:
                formatted_offer = self._format_offer(offer)
                if formatted_offer:
                    formatted_offers.append(formatted_offer)

            return {
                "hotel_id": hotel_info.get("hotelId"),
                "name": hotel_info.get("name"),
                "chain_code": hotel_info.get("chainCode"),
                "city_code": hotel_info.get("cityCode"),
                "latitude": hotel_info.get("latitude"),
                "longitude": hotel_info.get("longitude"),
                "offers": formatted_offers,
                "cheapest_price": self._get_cheapest_price(formatted_offers),
            }
        except (KeyError, TypeError, AttributeError) as e:
            logger.warning("Failed to format hotel data: %s", e)
            return None

    def _format_offer(self, offer: dict[str, Any]) -> dict[str, Any] | None:
        """Format a single hotel offer.

        Args:
            offer: Raw offer from Amadeus API.

        Returns:
            Formatted offer dict or None if invalid.
        """
        try:
            price_info = offer.get("price", {})
            room_info = offer.get("room", {})
            description = room_info.get("description", {})

            return {
                "offer_id": offer.get("id"),
                "check_in": offer.get("checkInDate"),
                "check_out": offer.get("checkOutDate"),
                "price": {
                    "total": price_info.get("total"),
                    "currency": price_info.get("currency", "USD"),
                    "base": price_info.get("base"),
                },
                "room": {
                    "type": room_info.get("type"),
                    "type_estimated": room_info.get("typeEstimated", {}),
                    "description": description.get("text") if description else None,
                },
                "guests": offer.get("guests", {}).get("adults"),
                "policies": {
                    "cancellation": offer.get("policies", {})
                    .get("cancellation", {})
                    .get("description", {})
                    .get("text"),
                    "payment_type": offer.get("policies", {}).get("paymentType"),
                },
            }
        except (KeyError, TypeError, AttributeError) as e:
            logger.warning("Failed to format hotel offer: %s", e)
            return None

    def _get_cheapest_price(self, offers: list[dict[str, Any]]) -> str | None:
        """Get the cheapest price from a list of offers.

        Args:
            offers: List of formatted offers.

        Returns:
            Cheapest price string or None if no offers.
        """
        if not offers:
            return None

        prices = []
        for offer in offers:
            price_info = offer.get("price", {})
            total = price_info.get("total")
            if total:
                try:
                    prices.append(float(total))
                except (ValueError, TypeError):
                    continue

        return str(min(prices)) if prices else None
