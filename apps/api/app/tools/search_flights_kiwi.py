"""MCP tool for searching flights via Kiwi.com."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.kiwi_mcp import (
    KiwiMCPClient,
    KiwiMCPError,
    kiwi_mcp_client,
)
from app.schemas.flight_search import FlightSearchResult
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool

logger = logging.getLogger(__name__)


class SearchFlightsKiwiTool(BaseTool):
    """Search for flights using the Kiwi.com MCP server.

    Optimized for cheapest prices and creative routing with detailed
    layover information. Does NOT provide airline names or carrier codes.
    """

    name = "search_flights_kiwi"
    description = (
        "Search for flights using Kiwi.com. Optimized for cheapest prices "
        "and creative routing with detailed layover information."
    )

    def __init__(self, client: KiwiMCPClient | None = None) -> None:
        self._client = client or kiwi_mcp_client

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Execute flight search via Kiwi.com."""
        fly_from = args.get("fly_from")
        fly_to = args.get("fly_to")
        departure_date = args.get("departure_date")

        if not fly_from or not fly_to or not departure_date:
            missing = [
                p
                for p in ("fly_from", "fly_to", "departure_date")
                if not args.get(p)
            ]
            return self.error(f"Missing required parameters: {', '.join(missing)}")

        return_date = args.get("return_date")
        adults = args.get("adults", 1)
        currency = args.get("currency", "EUR")

        try:
            result = await self._client.search_flight(
                fly_from=fly_from,
                fly_to=fly_to,
                departure_date=departure_date,
                return_date=return_date,
                adults=adults,
                currency=currency,
            )

            if not result.success:
                return self.error(f"Flight search failed: {result.error}")

            formatted = self._format_results(result)
            return self.success(formatted)
        except KiwiMCPError as e:
            logger.warning("Kiwi.com flight search failed: %s", e)
            return self.error(f"Flight search failed: {e}")
        except Exception as e:
            logger.exception("Unexpected error in Kiwi flight search")
            return self.error(f"An unexpected error occurred: {e}")

    @staticmethod
    def _format_results(result: FlightSearchResult) -> dict[str, Any]:
        """Format FlightSearchResult for LLM consumption."""
        flights = []
        for f in result.flights:
            layovers = []
            for lay in f.layovers:
                layovers.append({
                    "airport": lay.airport,
                    "city": lay.city,
                    "duration_minutes": lay.duration_minutes,
                })

            flights.append({
                "departure_airport": f.departure_airport,
                "arrival_airport": f.arrival_airport,
                "departure_time": f.departure_time.isoformat() if f.departure_time else None,
                "arrival_time": f.arrival_time.isoformat() if f.arrival_time else None,
                "duration_minutes": f.duration_minutes,
                "stops": f.stops,
                "stops_text": f.stops_text,
                "layovers": layovers,
                "price": str(f.price_amount),
                "price_display": f.price_display,
                "currency": f.price_currency,
                "booking_link": f.booking_link,
            })

        return {
            "flights": flights,
            "count": len(flights),
            "origin": result.origin,
            "destination": result.destination,
            "departure_date": result.departure_date,
            "return_date": result.return_date,
            "is_round_trip": result.is_round_trip,
            "provider": "kiwi",
            "currency": result.currency,
        }
