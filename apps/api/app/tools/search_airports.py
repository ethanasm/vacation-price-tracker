"""MCP tool for searching airports by name, city, or IATA code."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.amadeus import AmadeusClient, AmadeusClientError, amadeus_client
from app.schemas.mcp import ToolResult
from app.tools.base import BaseTool

logger = logging.getLogger(__name__)


class SearchAirportsTool(BaseTool):
    """Search for airports using the Amadeus Location Search API."""

    name = "search_airports"
    description = (
        "Search for airports by city name, airport name, or IATA code. "
        "Use this to help users find the correct airport codes."
    )

    def __init__(self, client: AmadeusClient | None = None) -> None:
        self._client = client or amadeus_client

    async def execute(
        self,
        args: dict[str, Any],
        user_id: str,
        db: AsyncSession,
    ) -> ToolResult:
        """Execute airport search."""
        query = args.get("query")
        if not query:
            return self.error("Missing required parameter: query")

        try:
            result = await self._client.search_airports(keyword=query)
            formatted = self._format_results(result)
            return self.success(formatted)
        except AmadeusClientError as e:
            logger.warning("Airport search failed for query '%s': %s", query, e)
            return self.error(f"Airport search failed: {e}")
        except Exception as e:
            logger.exception("Unexpected error in airport search")
            return self.error(f"An unexpected error occurred: {e}")

    @staticmethod
    def _format_results(result: dict[str, Any]) -> dict[str, Any]:
        """Format Amadeus location response for LLM consumption."""
        locations = result.get("data", [])
        formatted = []
        for loc in locations:
            address = loc.get("address", {})
            formatted.append({
                "iata_code": loc.get("iataCode"),
                "name": loc.get("name"),
                "city": address.get("cityName"),
                "country": address.get("countryName"),
                "type": loc.get("subType"),
            })
        return {
            "airports": formatted,
            "count": len(formatted),
            "provider": "amadeus",
        }
