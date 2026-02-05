"""MCP Tools for trip management.

This module exports all available MCP tools for trip operations.
"""

from app.tools.base import BaseTool
from app.tools.create_trip import CreateTripTool
from app.tools.delete_trip import DeleteTripTool
from app.tools.get_trip_details import GetTripDetailsTool
from app.tools.list_trips import ListTripsTool
from app.tools.pause_resume import PauseTripTool, ResumeTripTool
from app.tools.search_airports import SearchAirportsTool
from app.tools.search_flights_kiwi import SearchFlightsKiwiTool
from app.tools.set_notification import SetNotificationTool
from app.tools.trigger_refresh import RefreshAllTripPricesTool, RefreshTripPricesTool

__all__ = [
    "BaseTool",
    "CreateTripTool",
    "DeleteTripTool",
    "GetTripDetailsTool",
    "ListTripsTool",
    "PauseTripTool",
    "RefreshAllTripPricesTool",
    "RefreshTripPricesTool",
    "ResumeTripTool",
    "SearchAirportsTool",
    "SearchFlightsKiwiTool",
    "SetNotificationTool",
]

# Tool registry for easy access
TRIP_TOOLS = {
    "create_trip": CreateTripTool,
    "delete_trip": DeleteTripTool,
    "list_trips": ListTripsTool,
    "get_trip_details": GetTripDetailsTool,
    "set_notification": SetNotificationTool,
    "pause_trip": PauseTripTool,
    "resume_trip": ResumeTripTool,
    "refresh_all_trip_prices": RefreshAllTripPricesTool,
    "refresh_trip_prices": RefreshTripPricesTool,
    "search_airports": SearchAirportsTool,
    "search_flights_kiwi": SearchFlightsKiwiTool,
}


def get_trip_tool(name: str) -> type[BaseTool] | None:
    """Get a trip tool class by name.

    Args:
        name: The tool name.

    Returns:
        The tool class, or None if not found.
    """
    return TRIP_TOOLS.get(name)


def get_all_trip_tools() -> dict[str, type[BaseTool]]:
    """Get all available trip tools.

    Returns:
        Dictionary mapping tool names to tool classes.
    """
    return TRIP_TOOLS.copy()
