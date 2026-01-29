"""Amadeus Hotel Offers MCP Tool.

This tool wraps AmadeusClient.search_hotel_offers() for use in the MCP router.
Use for getting detailed pricing and availability for a specific hotel.
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
AMADEUS_HOTEL_OFFER_TOOL_PARAMETERS = {
    "type": "object",
    "properties": {
        "hotel_id": {
            "type": "string",
            "description": "Amadeus hotel ID (from search_hotels results)",
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
        "currency": {
            "type": "string",
            "description": "Currency code for pricing (default: USD)",
            "default": "USD",
        },
    },
    "required": ["hotel_id", "check_in_date", "check_out_date"],
}


class AmadeusHotelOfferTool(BaseTool):
    """Get specific hotel offers with pricing details.

    Use this tool to get detailed room availability and pricing for a specific hotel
    that was returned from the search_hotels tool.
    """

    name = "search_hotel_offers"
    description = (
        "Get detailed pricing and availability for a specific hotel. "
        "Use this after search_hotels to get room options and prices for a particular hotel."
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
        """Execute the hotel offer search.

        Args:
            args: Dictionary containing search parameters.
            user_id: UUID string of the authenticated user (for logging/rate limiting).
            db: Database session (not used for this tool but required by interface).

        Returns:
            ToolResult with hotel offer data or error message.
        """
        # Extract and validate required parameters
        hotel_id = args.get("hotel_id")
        check_in_date = args.get("check_in_date")
        check_out_date = args.get("check_out_date")

        if not hotel_id or not check_in_date or not check_out_date:
            return self.error("Missing required parameters: hotel_id, check_in_date, check_out_date")

        # Optional parameters with defaults
        adults = args.get("adults", 1)
        rooms = args.get("rooms", 1)
        currency = args.get("currency", "USD")

        logger.info(
            "Amadeus hotel offer search: hotel=%s, dates=%s to %s (user=%s)",
            hotel_id,
            check_in_date,
            check_out_date,
            user_id,
        )

        try:
            result = await self._client.search_hotel_offers(
                hotel_ids=[hotel_id],
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                adults=adults,
                rooms=rooms,
                currency=currency,
            )

            formatted_data = self._format_results(result, hotel_id)
            return self.success(formatted_data)

        except AmadeusClientError as e:
            logger.warning("Amadeus hotel offer search failed: %s", e)
            return self.error(f"Hotel offer search failed: {e}")
        except Exception as e:
            logger.exception("Unexpected error in Amadeus hotel offer search")
            return self.error(f"An unexpected error occurred: {e}")

    def _format_results(self, result: dict[str, Any], hotel_id: str) -> dict[str, Any]:
        """Format Amadeus API response for LLM consumption.

        Args:
            result: Raw response from AmadeusClient.search_hotel_offers().
            hotel_id: The requested hotel ID.

        Returns:
            Formatted dictionary with hotel offers.
        """
        data = result.get("data", [])

        if not data:
            return {
                "hotel_id": hotel_id,
                "hotel_name": None,
                "offers": [],
                "count": 0,
                "provider": "amadeus",
                "message": "No offers found for this hotel.",
            }

        # Get the first hotel entry (we only requested one hotel)
        hotel_data = data[0]
        hotel_info = hotel_data.get("hotel", {})
        offers = hotel_data.get("offers", [])

        formatted_offers = []
        for offer in offers:
            formatted_offer = self._format_offer(offer)
            if formatted_offer:
                formatted_offers.append(formatted_offer)

        return {
            "hotel_id": hotel_info.get("hotelId", hotel_id),
            "hotel_name": hotel_info.get("name"),
            "chain_code": hotel_info.get("chainCode"),
            "city_code": hotel_info.get("cityCode"),
            "offers": formatted_offers,
            "count": len(formatted_offers),
            "provider": "amadeus",
        }

    def _format_offer(self, offer: dict[str, Any]) -> dict[str, Any] | None:
        """Format a single hotel offer with detailed room information.

        Args:
            offer: Raw offer from Amadeus API.

        Returns:
            Formatted offer dict or None if invalid.
        """
        try:
            price_info = offer.get("price", {})
            room_info = offer.get("room", {})
            description = room_info.get("description", {})
            type_estimated = room_info.get("typeEstimated", {})
            policies = offer.get("policies", {})
            cancellation = policies.get("cancellation", {})
            cancellation_desc = cancellation.get("description", {})

            # Calculate nightly rate if possible
            total = price_info.get("total")
            variations = price_info.get("variations", {})
            average = variations.get("average", {})
            nightly_rate = average.get("total")

            return {
                "offer_id": offer.get("id"),
                "check_in": offer.get("checkInDate"),
                "check_out": offer.get("checkOutDate"),
                "price": {
                    "total": total,
                    "currency": price_info.get("currency", "USD"),
                    "base": price_info.get("base"),
                    "nightly_average": nightly_rate,
                },
                "room": {
                    "type": room_info.get("type"),
                    "category": type_estimated.get("category"),
                    "beds": type_estimated.get("beds"),
                    "bed_type": type_estimated.get("bedType"),
                    "description": description.get("text") if description else None,
                },
                "guests": {
                    "adults": offer.get("guests", {}).get("adults"),
                },
                "policies": {
                    "cancellation": {
                        "deadline": cancellation.get("deadline"),
                        "amount": cancellation.get("amount"),
                        "description": cancellation_desc.get("text") if cancellation_desc else None,
                    },
                    "payment_type": policies.get("paymentType"),
                    "guarantee": self._format_guarantee(policies.get("guarantee", {})),
                },
                "rate_family": offer.get("rateFamilyEstimated", {}).get("type"),
                "board_type": offer.get("boardType"),
            }
        except (KeyError, TypeError, AttributeError) as e:
            logger.warning("Failed to format hotel offer: %s", e)
            return None

    def _format_guarantee(self, guarantee: dict[str, Any]) -> dict[str, Any] | None:
        """Format guarantee/deposit information.

        Args:
            guarantee: Raw guarantee info from Amadeus API.

        Returns:
            Formatted guarantee dict or None if empty.
        """
        if not guarantee:
            return None

        accepted_payments = guarantee.get("acceptedPayments", {})
        return {
            "description": guarantee.get("description", {}).get("text"),
            "accepted_cards": accepted_payments.get("creditCards", []),
            "accepted_methods": accepted_payments.get("methods", []),
        }
