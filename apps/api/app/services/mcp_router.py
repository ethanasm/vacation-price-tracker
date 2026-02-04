"""MCP Router for dispatching tool calls to appropriate handlers.

This module provides:
- MCPRouter: Central dispatcher for MCP tool execution
- Tool call validation against JSON schemas
- User context injection for authorization
- Input sanitization for LLM-generated arguments
- Audit logging for all tool calls
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
from app.services.audit_log import audit_logger
from app.services.input_sanitizer import input_sanitizer

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
    arguments, user_id, and db session, returning a ToolResult.
    """

    async def execute(
        self, args: dict[str, Any], user_id: str, db: Any
    ) -> ToolResult:
        """Execute the tool with given arguments.

        Args:
            args: Tool arguments (pre-validated).
            user_id: UUID of the authenticated user.
            db: Database session for queries.

        Returns:
            ToolResult indicating success/failure and data.
        """
        ...


# Type alias for simple function-based handlers
ToolFunction = Callable[[dict[str, Any], str, Any], Awaitable[ToolResult]]


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

    def _sanitize_arguments(
        self,
        arguments: dict[str, Any],
        user_id: str,
        tool_name: str,
    ) -> dict[str, Any]:
        """Sanitize LLM-generated arguments and log if modified."""
        sanitization_result = input_sanitizer.sanitize(arguments)
        if sanitization_result.was_modified:
            audit_logger.log_input_sanitized(
                user_id=user_id,
                tool_name=tool_name,
                sanitized_fields=sanitization_result.sanitized_fields,
                original_patterns=sanitization_result.detected_patterns,
            )
        return sanitization_result.sanitized_data

    def _validate_arguments(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str,
    ) -> ToolResult | None:
        """Validate arguments. Returns ToolResult on failure, None on success."""
        try:
            validate_tool_args(tool_name, arguments)
            return None
        except ToolNotFoundError:
            logger.warning("Tool %s is registered but has no schema definition", tool_name)
            return None
        except ToolValidationError as e:
            logger.warning("Validation failed for tool %s: %s", tool_name, e.details)
            audit_logger.log_tool_failure(
                user_id=user_id,
                tool_name=tool_name,
                arguments=arguments,
                error=e.message,
            )
            return ToolResult(success=False, error=e.message, data=e.details)

    async def _execute_handler(
        self,
        handler: ToolHandler | Any,
        arguments: dict[str, Any],
        user_id: str,
        db: Any,
    ) -> ToolResult:
        """Execute the tool handler and return result."""
        if isinstance(handler, ToolHandler):
            return await handler.execute(arguments, user_id, db)
        return await handler(arguments, user_id, db)

    def _log_result(
        self,
        tool_name: str,
        result: ToolResult,
        user_id: str,
        arguments: dict[str, Any],
    ) -> None:
        """Log tool execution result."""
        if result.success:
            audit_logger.log_tool_success(
                user_id=user_id,
                tool_name=tool_name,
                arguments=arguments,
                result=result.data or {},
            )
        else:
            audit_logger.log_tool_failure(
                user_id=user_id,
                tool_name=tool_name,
                arguments=arguments,
                error=result.error or "Unknown error",
            )

    async def execute(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str,
        db: Any = None,
        *,
        skip_validation: bool = False,
        skip_sanitization: bool = False,
    ) -> ToolResult:
        """Execute a tool with the given arguments.

        Args:
            tool_name: Name of the tool to execute.
            arguments: Tool arguments (will be validated and sanitized).
            user_id: UUID of the authenticated user.
            db: Database session for tool execution.
            skip_validation: If True, skip argument validation (for testing).
            skip_sanitization: If True, skip input sanitization (for testing).

        Returns:
            ToolResult with success status and data/error.
        """
        user_display = user_id[:8] + "..." if len(user_id) > 8 else user_id
        logger.info("Executing tool: %s for user: %s", tool_name, user_display)

        handler = self._tools.get(tool_name)
        if handler is None:
            logger.warning("Tool not found: %s", tool_name)
            audit_logger.log_tool_failure(
                user_id=user_id, tool_name=tool_name, arguments=arguments, error="Tool not found"
            )
            return ToolResult(success=False, error=f"Tool not found: {tool_name}")

        sanitized_arguments = arguments
        if not skip_sanitization:
            sanitized_arguments = self._sanitize_arguments(arguments, user_id, tool_name)

        audit_logger.log_tool_call(user_id=user_id, tool_name=tool_name, arguments=sanitized_arguments)

        if not skip_validation:
            validation_error = self._validate_arguments(tool_name, sanitized_arguments, user_id)
            if validation_error:
                return validation_error

        try:
            result = await self._execute_handler(handler, sanitized_arguments, user_id, db)
            logger.info("Tool %s executed successfully: success=%s", tool_name, result.success)
            self._log_result(tool_name, result, user_id, sanitized_arguments)
            return result
        except Exception as e:
            logger.exception("Tool %s execution failed", tool_name)
            audit_logger.log_tool_failure(
                user_id=user_id, tool_name=tool_name, arguments=sanitized_arguments, error=str(e)
            )
            return ToolResult(success=False, error=f"Tool execution failed: {e!s}")

    async def execute_from_json(
        self,
        tool_name: str,
        arguments_json: str,
        user_id: str,
        db: Any = None,
    ) -> ToolResult:
        """Execute a tool with JSON-encoded arguments.

        This is a convenience method for handling LLM tool calls where
        arguments are provided as a JSON string.

        Args:
            tool_name: Name of the tool to execute.
            arguments_json: JSON string of tool arguments.
            user_id: UUID of the authenticated user.
            db: Database session for tool execution.

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

        # Handle null/None arguments (common for tools with no required params)
        if arguments is None:
            arguments = {}

        if not isinstance(arguments, dict):
            return ToolResult(
                success=False,
                error="Tool arguments must be a JSON object",
            )

        return await self.execute(tool_name, arguments, user_id, db)


# Singleton router instance for the application
_router: MCPRouter | None = None


def _register_tools(router: MCPRouter) -> None:
    """Register all available MCP tools with the router."""
    from app.tools import (
        CreateTripTool,
        DeleteTripTool,
        GetTripDetailsTool,
        ListTripsTool,
        PauseTripTool,
        RefreshAllTripPricesTool,
        RefreshTripPricesTool,
        ResumeTripTool,
        SetNotificationTool,
    )

    # Register tool instances
    router.register("create_trip", CreateTripTool())
    router.register("delete_trip", DeleteTripTool())
    router.register("list_trips", ListTripsTool())
    router.register("get_trip_details", GetTripDetailsTool())
    router.register("set_notification", SetNotificationTool())
    router.register("pause_trip", PauseTripTool())
    router.register("resume_trip", ResumeTripTool())
    router.register("refresh_all_trip_prices", RefreshAllTripPricesTool())
    router.register("refresh_trip_prices", RefreshTripPricesTool())

    logger.info("Registered %d MCP tools", len(router.get_registered_tools()))


def get_mcp_router() -> MCPRouter:
    """Get the application-wide MCP router instance.

    Returns:
        The singleton MCPRouter instance.
    """
    global _router
    if _router is None:
        _router = MCPRouter()
        _register_tools(_router)
    return _router


def reset_mcp_router() -> None:
    """Reset the singleton router instance (for testing)."""
    global _router
    _router = None
