"""MCP tool for searching hotels via Skiplagged."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.skiplagged import (
    SkiplaggedClient,
    SkiplaggedMCPError,
    skiplagged_client,
)
from app.schemas.hotel_search import HotelSearchResult
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool

logger = logging.getLogger(__name__)


class SearchHotelsSkiplaggedTool(BaseTool):
    """Search for hotels using the Skiplagged MCP server.

    Returns hotel name, star rating, review score, nightly price,
    amenities, and booking links.
    """

    name = "search_hotels"
    description = (
        "Search for hotels in a city. Returns hotel name, star rating, review score, "
        "nightly price, amenities, and booking links."
    )

    def __init__(self, client: SkiplaggedClient | None = None) -> None:
        self._client = client or skiplagged_client

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Execute hotel search via Skiplagged."""
        city = args.get("city")
        checkin = args.get("checkin")
        checkout = args.get("checkout")

        if not city or not checkin or not checkout:
            missing = [
                p
                for p in ("city", "checkin", "checkout")
                if not args.get(p)
            ]
            return self.error(f"Missing required parameters: {', '.join(missing)}")

        adults = args.get("adults", 2)
        rooms = args.get("rooms", 1)
        sort = args.get("sort", "value")
        limit = args.get("limit", 75)
        offset = args.get("offset", 0)

        try:
            result = await self._client.search_hotels(
                city=city,
                checkin=checkin,
                checkout=checkout,
                adults=adults,
                rooms=rooms,
                sort=sort,
                limit=limit,
                offset=offset,
            )

            if not result.success:
                return self.error(f"Hotel search failed: {result.error}")

            formatted = self._format_results(result)
            return self.success(formatted)
        except SkiplaggedMCPError as e:
            logger.warning("Skiplagged hotel search failed: %s", e)
            return self.error(f"Hotel search failed: {e}")
        except Exception as e:
            logger.exception("Unexpected error in Skiplagged hotel search")
            return self.error(f"An unexpected error occurred: {e}")

    @staticmethod
    def _format_results(result: HotelSearchResult) -> dict[str, Any]:
        """Format HotelSearchResult for LLM consumption."""
        hotels = []
        for h in result.hotels:
            hotels.append({
                "id": h.id,
                "name": h.name,
                "star_rating": h.star_rating,
                "review_rating": h.review_rating,
                "review_count": h.review_count,
                "price_per_night": str(h.price_per_night),
                "price_currency": h.price_currency,
                "chain": h.chain,
                "address": h.address,
                "amenities": h.amenities,
                "booking_link": h.booking_link,
            })

        return {
            "hotels": hotels,
            "count": len(hotels),
            "city": result.city,
            "checkin": result.checkin,
            "checkout": result.checkout,
            "provider": "skiplagged",
            "currency": result.currency,
        }
