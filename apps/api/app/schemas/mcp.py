"""MCP (Model Context Protocol) schemas for tool definitions and results.

This module defines:
- ToolResult: Standard result format returned by MCP tools
- ToolCall: Tool invocation request from the LLM
- Tool schema definitions for OpenAI-compatible function calling
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ToolResult:
    """Result returned from MCP tool execution.

    Attributes:
        success: Whether the tool execution succeeded.
        data: The result data if successful, or None on failure.
        error: Error message if the tool execution failed.
    """

    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result: dict[str, Any] = {"success": self.success}
        if self.data is not None:
            result["data"] = self.data
        if self.error is not None:
            result["error"] = self.error
        return result


@dataclass
class ToolCallFunction:
    """Function details within a tool call."""

    name: str
    arguments: str  # JSON string of arguments


@dataclass
class ToolCall:
    """Tool invocation request from the LLM.

    Attributes:
        id: Unique identifier for this tool call.
        type: Always "function" for function calls.
        function: The function name and arguments.
    """

    id: str
    type: str
    function: ToolCallFunction


# =============================================================================
# OpenAI-compatible Tool Schema Definitions
# =============================================================================

# Type definitions for tool parameters
TOOL_PARAM_STRING = {"type": "string"}
TOOL_PARAM_INTEGER = {"type": "integer"}
TOOL_PARAM_NUMBER = {"type": "number"}
TOOL_PARAM_BOOLEAN = {"type": "boolean"}


def _make_tool(
    name: str,
    description: str,
    parameters: dict[str, Any],
    required: list[str] | None = None,
) -> dict[str, Any]:
    """Helper to create an OpenAI-compatible tool definition.

    Args:
        name: The function name.
        description: Human-readable description.
        parameters: Dict of parameter_name -> schema.
        required: List of required parameter names.

    Returns:
        OpenAI-compatible tool definition dict.
    """
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": parameters,
                "required": required or [],
            },
        },
    }


# -----------------------------------------------------------------------------
# Trip Management Tools
# -----------------------------------------------------------------------------

CREATE_TRIP_TOOL = _make_tool(
    name="create_trip",
    description=(
        "Create a new vacation price tracking trip. "
        "Sets up monitoring for flights and hotels. "
        "IMPORTANT: Only pass fields the user EXPLICITLY provided. "
        "Do NOT invent, guess, or fill in missing values (dates, names, etc.). "
        "If the user says 'create a trip to Seattle', call with only destination_code='SEA'. "
        "The tool will return an elicitation request to collect missing fields via a form. "
        "Fields: name, origin_airport, destination_code, depart_date (YYYY-MM-DD), "
        "return_date (YYYY-MM-DD), adults (default 1)."
    ),
    parameters={
        "name": {
            "type": "string",
            "description": "Trip name if user provided one, e.g. 'Seattle Trip'",
        },
        "origin_airport": {
            "type": "string",
            "description": "Origin IATA code if user provided one, e.g. 'SFO'",
        },
        "destination_code": {
            "type": "string",
            "description": "Destination IATA code if user provided one, e.g. 'SEA'",
        },
        "depart_date": {
            "type": "string",
            "description": "Departure date YYYY-MM-DD if user provided one",
        },
        "return_date": {
            "type": "string",
            "description": "Return date YYYY-MM-DD if user provided one",
        },
        "adults": {
            "type": "integer",
            "description": "Number of adults if user specified",
        },
    },
    required=[],
)


LIST_TRIPS_TOOL = _make_tool(
    name="list_trips",
    description=(
        "List all vacation trips being tracked for the current user. "
        "Returns trip names, routes, dates, status, and current prices."
    ),
    parameters={},
    required=[],
)


GET_TRIP_DETAILS_TOOL = _make_tool(
    name="get_trip_details",
    description=(
        "Get detailed information about a specific trip including flight preferences, "
        "hotel preferences, notification settings, and price history."
    ),
    parameters={
        "trip_id": {
            "type": "string",
            "description": "UUID of the trip to retrieve",
            "format": "uuid",
        },
    },
    required=["trip_id"],
)


SET_NOTIFICATION_TOOL = _make_tool(
    name="set_notification",
    description=(
        "Set or update the price alert threshold for a trip. "
        "You will be notified when the price drops below this threshold."
    ),
    parameters={
        "trip_id": {
            "type": "string",
            "description": "UUID of the trip",
            "format": "uuid",
        },
        "threshold_value": {
            "type": "number",
            "description": "Price threshold value in dollars",
            "minimum": 0,
        },
        "threshold_type": {
            "type": "string",
            "description": "What price to compare (trip_total, flight_total, or hotel_total)",
            "enum": ["trip_total", "flight_total", "hotel_total"],
            "default": "trip_total",
        },
    },
    required=["trip_id", "threshold_value"],
)


PAUSE_TRIP_TOOL = _make_tool(
    name="pause_trip",
    description=("Pause price tracking for a trip. The trip will not be refreshed until resumed."),
    parameters={
        "trip_id": {
            "type": "string",
            "description": "UUID of the trip to pause",
            "format": "uuid",
        },
    },
    required=["trip_id"],
)


RESUME_TRIP_TOOL = _make_tool(
    name="resume_trip",
    description=("Resume price tracking for a paused trip. This will also trigger an immediate price refresh."),
    parameters={
        "trip_id": {
            "type": "string",
            "description": "UUID of the trip to resume",
            "format": "uuid",
        },
    },
    required=["trip_id"],
)


TRIGGER_REFRESH_TOOL = _make_tool(
    name="trigger_refresh",
    description=(
        "Trigger an immediate price refresh for all active trips. This will fetch the latest flight and hotel prices."
    ),
    parameters={},
    required=[],
)


TRIGGER_REFRESH_TRIP_TOOL = _make_tool(
    name="trigger_refresh_trip",
    description=(
        "Trigger an immediate price refresh for a specific trip. "
        "Use this when the user wants to update prices for just one trip. "
        "The trip must be active (not paused)."
    ),
    parameters={
        "trip_id": {
            "type": "string",
            "description": "UUID of the trip to refresh",
            "format": "uuid",
        },
    },
    required=["trip_id"],
)


DELETE_TRIP_TOOL = _make_tool(
    name="delete_trip",
    description=(
        "Permanently delete a vacation price tracking trip and all its associated data. "
        "This action cannot be undone. All price history, notification settings, and preferences will be deleted."
    ),
    parameters={
        "trip_id": {
            "type": "string",
            "description": "UUID of the trip to delete",
            "format": "uuid",
        },
    },
    required=["trip_id"],
)


# -----------------------------------------------------------------------------
# Search Tools
# -----------------------------------------------------------------------------

SEARCH_AIRPORTS_TOOL = _make_tool(
    name="search_airports",
    description=(
        "Search for airports by city name, airport name, or IATA code. "
        "Use this to help users find the correct airport codes."
    ),
    parameters={
        "query": {
            "type": "string",
            "description": "Search query (city name, airport name, or IATA code)",
            "minLength": 2,
        },
    },
    required=["query"],
)


# =============================================================================
# Complete Tool Registry
# =============================================================================

# All available MCP tools in OpenAI function-calling format
MCP_TOOLS: list[dict[str, Any]] = [
    CREATE_TRIP_TOOL,
    LIST_TRIPS_TOOL,
    GET_TRIP_DETAILS_TOOL,
    SET_NOTIFICATION_TOOL,
    PAUSE_TRIP_TOOL,
    RESUME_TRIP_TOOL,
    TRIGGER_REFRESH_TOOL,
    TRIGGER_REFRESH_TRIP_TOOL,
    DELETE_TRIP_TOOL,
    SEARCH_AIRPORTS_TOOL,
]

# Tool name to schema mapping for validation
TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    tool["function"]["name"]: tool["function"]["parameters"] for tool in MCP_TOOLS
}


def get_tool_schema(tool_name: str) -> dict[str, Any] | None:
    """Get the parameter schema for a tool by name.

    Args:
        tool_name: The tool function name.

    Returns:
        The tool's parameter schema, or None if not found.
    """
    return TOOL_SCHEMAS.get(tool_name)


def get_all_tools() -> list[dict[str, Any]]:
    """Get all available MCP tools in OpenAI format.

    Returns:
        List of tool definitions.
    """
    return MCP_TOOLS.copy()
