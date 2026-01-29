"""MCP Router for dispatching tool calls to appropriate handlers.

This module provides:
- MCPRouter: Central dispatcher for MCP tool execution
- Tool call validation against JSON schemas
- User context injection for authorization
- Error handling and result formatting
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import Awaitable, Callable
from typing import Any, Protocol, runtime_checkable

from app.schemas.mcp import ToolResult, get_tool_schema

logger = logging.getLogger(__name__)


class ToolValidationError(Exception):
    """Raised when tool arguments fail validation."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ToolNotFoundError(Exception):
    """Raised when a requested tool is not registered."""

    def __init__(self, tool_name: str):
        super().__init__(f"Tool not found: {tool_name}")
        self.tool_name = tool_name


class ToolExecutionError(Exception):
    """Raised when tool execution fails."""

    def __init__(self, message: str, cause: Exception | None = None):
        super().__init__(message)
        self.cause = cause


@runtime_checkable
class ToolHandler(Protocol):
    """Protocol for MCP tool handlers.

    Tool handlers must implement an async execute method that takes
    arguments and user_id, returning a ToolResult.
    """

    async def execute(self, args: dict[str, Any], user_id: str) -> ToolResult:
        """Execute the tool with given arguments.

        Args:
            args: Tool arguments (pre-validated).
            user_id: UUID of the authenticated user.

        Returns:
            ToolResult indicating success/failure and data.
        """
        ...


# Type alias for simple function-based handlers
ToolFunction = Callable[[dict[str, Any], str], Awaitable[ToolResult]]


def _check_type_match(value: Any, expected_type: str) -> bool:
    """Check if a value matches the expected JSON schema type."""
    if expected_type == "string":
        return isinstance(value, str)
    if expected_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected_type == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected_type == "boolean":
        return isinstance(value, bool)
    if expected_type == "array":
        return isinstance(value, list)
    if expected_type == "object":
        return isinstance(value, dict)
    if expected_type == "null":
        return value is None
    return False


def _validate_string_format(value: str, fmt: str, path: str) -> list[str]:
    """Validate string format constraints."""
    errors: list[str] = []
    if fmt == "uuid":
        try:
            uuid.UUID(value)
        except ValueError:
            errors.append(f"{path}: must be a valid UUID")
    elif fmt == "date":
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            errors.append(f"{path}: must be a valid date (YYYY-MM-DD)")
    return errors


def _validate_string(value: str, schema: dict[str, Any], path: str) -> list[str]:
    """Validate string-specific constraints."""
    errors: list[str] = []
    if "minLength" in schema and len(value) < schema["minLength"]:
        errors.append(f"{path}: length must be >= {schema['minLength']}")
    if "maxLength" in schema and len(value) > schema["maxLength"]:
        errors.append(f"{path}: length must be <= {schema['maxLength']}")
    if "pattern" in schema and not re.match(schema["pattern"], value):
        errors.append(f"{path}: must match pattern {schema['pattern']}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: must be one of {schema['enum']}")
    if "format" in schema:
        errors.extend(_validate_string_format(value, schema["format"], path))
    return errors


def _validate_number(value: int | float, schema: dict[str, Any], path: str) -> list[str]:
    """Validate number/integer-specific constraints."""
    errors: list[str] = []
    if "minimum" in schema and value < schema["minimum"]:
        errors.append(f"{path}: must be >= {schema['minimum']}")
    if "maximum" in schema and value > schema["maximum"]:
        errors.append(f"{path}: must be <= {schema['maximum']}")
    return errors


def _validate_type(value: Any, schema: dict[str, Any], path: str) -> list[str]:
    """Validate a value against a JSON schema type.

    Args:
        value: The value to validate.
        schema: JSON schema for the expected type.
        path: Current path for error messages.

    Returns:
        List of validation error messages (empty if valid).
    """
    expected_type = schema.get("type")
    if expected_type is None:
        return []

    # Check type match
    if not _check_type_match(value, expected_type):
        return [f"{path}: expected {expected_type}, got {type(value).__name__}"]

    # Type-specific validations
    if expected_type == "string":
        return _validate_string(value, schema, path)
    if expected_type in ("integer", "number"):
        return _validate_number(value, schema, path)
    if expected_type == "array":
        errors: list[str] = []
        items_schema = schema.get("items", {})
        for i, item in enumerate(value):
            errors.extend(_validate_type(item, items_schema, f"{path}[{i}]"))
        return errors

    return []


def validate_tool_args(tool_name: str, args: dict[str, Any]) -> None:
    """Validate tool arguments against the tool's JSON schema.

    Args:
        tool_name: Name of the tool.
        args: Arguments to validate.

    Raises:
        ToolNotFoundError: If the tool is not registered.
        ToolValidationError: If arguments fail validation.
    """
    schema = get_tool_schema(tool_name)
    if schema is None:
        raise ToolNotFoundError(tool_name)

    errors: list[str] = []

    # Check required parameters
    required = schema.get("required", [])
    properties = schema.get("properties", {})

    for param_name in required:
        if param_name not in args:
            errors.append(f"Missing required parameter: {param_name}")

    # Validate provided parameters
    for param_name, param_value in args.items():
        if param_name not in properties:
            # Unknown parameters are ignored (not an error)
            continue

        param_schema = properties[param_name]
        errors.extend(_validate_type(param_value, param_schema, param_name))

    if errors:
        raise ToolValidationError(
            f"Invalid arguments for tool '{tool_name}'",
            details={"errors": errors},
        )


class MCPRouter:
    """Central router for dispatching MCP tool calls.

    The MCPRouter maintains a registry of tool handlers and provides:
    - Tool registration (class-based or function-based handlers)
    - Argument validation against JSON schemas
    - User context injection for authorization
    - Standardized error handling and result formatting

    Example:
        router = MCPRouter()
        router.register("list_trips", ListTripsTool())
        result = await router.execute("list_trips", {}, user_id="...")
    """

    def __init__(self) -> None:
        """Initialize the MCP router with an empty tool registry."""
        self._tools: dict[str, ToolHandler | ToolFunction] = {}

    def register(
        self,
        tool_name: str,
        handler: ToolHandler | ToolFunction,
    ) -> None:
        """Register a tool handler.

        Args:
            tool_name: Name of the tool (must match schema definition).
            handler: Tool handler (class instance or async function).
        """
        self._tools[tool_name] = handler
        logger.debug("Registered tool: %s", tool_name)

    def unregister(self, tool_name: str) -> bool:
        """Unregister a tool handler.

        Args:
            tool_name: Name of the tool to unregister.

        Returns:
            True if the tool was unregistered, False if not found.
        """
        if tool_name in self._tools:
            del self._tools[tool_name]
            logger.debug("Unregistered tool: %s", tool_name)
            return True
        return False

    def get_registered_tools(self) -> list[str]:
        """Get list of registered tool names.

        Returns:
            List of registered tool names.
        """
        return list(self._tools.keys())

    def is_registered(self, tool_name: str) -> bool:
        """Check if a tool is registered.

        Args:
            tool_name: Name of the tool.

        Returns:
            True if registered, False otherwise.
        """
        return tool_name in self._tools

    async def execute(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str,
        *,
        skip_validation: bool = False,
    ) -> ToolResult:
        """Execute a tool with the given arguments.

        This method:
        1. Validates the tool exists in the registry
        2. Validates arguments against the tool's JSON schema
        3. Executes the tool handler with user context
        4. Returns a standardized ToolResult

        Args:
            tool_name: Name of the tool to execute.
            arguments: Tool arguments (will be validated).
            user_id: UUID of the authenticated user.
            skip_validation: If True, skip argument validation (for testing).

        Returns:
            ToolResult with success status and data/error.
        """
        logger.info(
            "Executing tool: %s for user: %s",
            tool_name,
            user_id[:8] + "..." if len(user_id) > 8 else user_id,
        )

        # Check if tool is registered
        handler = self._tools.get(tool_name)
        if handler is None:
            logger.warning("Tool not found: %s", tool_name)
            return ToolResult(
                success=False,
                error=f"Tool not found: {tool_name}",
            )

        # Validate arguments
        if not skip_validation:
            try:
                validate_tool_args(tool_name, arguments)
            except ToolNotFoundError:
                # Tool exists in registry but not in schema - log warning
                logger.warning(
                    "Tool %s is registered but has no schema definition",
                    tool_name,
                )
            except ToolValidationError as e:
                logger.warning(
                    "Validation failed for tool %s: %s",
                    tool_name,
                    e.details,
                )
                return ToolResult(
                    success=False,
                    error=e.message,
                    data=e.details,
                )

        # Execute the handler
        try:
            if isinstance(handler, ToolHandler):
                result = await handler.execute(arguments, user_id)
            else:
                # Function-based handler
                result = await handler(arguments, user_id)

            logger.info(
                "Tool %s executed successfully: success=%s",
                tool_name,
                result.success,
            )
            return result

        except Exception as e:
            logger.exception("Tool %s execution failed", tool_name)
            return ToolResult(
                success=False,
                error=f"Tool execution failed: {e!s}",
            )

    async def execute_from_json(
        self,
        tool_name: str,
        arguments_json: str,
        user_id: str,
    ) -> ToolResult:
        """Execute a tool with JSON-encoded arguments.

        This is a convenience method for handling LLM tool calls where
        arguments are provided as a JSON string.

        Args:
            tool_name: Name of the tool to execute.
            arguments_json: JSON string of tool arguments.
            user_id: UUID of the authenticated user.

        Returns:
            ToolResult with success status and data/error.
        """
        try:
            arguments = json.loads(arguments_json)
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse tool arguments JSON: %s", e)
            return ToolResult(
                success=False,
                error=f"Invalid JSON in tool arguments: {e!s}",
            )

        if not isinstance(arguments, dict):
            return ToolResult(
                success=False,
                error="Tool arguments must be a JSON object",
            )

        return await self.execute(tool_name, arguments, user_id)


# Singleton router instance for the application
_router: MCPRouter | None = None


def get_mcp_router() -> MCPRouter:
    """Get the application-wide MCP router instance.

    Returns:
        The singleton MCPRouter instance.
    """
    global _router
    if _router is None:
        _router = MCPRouter()
    return _router


def reset_mcp_router() -> None:
    """Reset the singleton router instance (for testing)."""
    global _router
    _router = None
