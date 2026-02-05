"""Comprehensive tests for MCP Router and tool schemas.

Coverage targets:
- MCPRouter: registration, execution, validation, error handling
- Tool schemas: all tool definitions, validation logic
- Edge cases: malformed input, missing parameters, type mismatches
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import pytest
from app.schemas.mcp import (
    CREATE_TRIP_TOOL,
    GET_TRIP_DETAILS_TOOL,
    LIST_TRIPS_TOOL,
    MCP_TOOLS,
    PAUSE_TRIP_TOOL,
    REFRESH_ALL_TRIP_PRICES_TOOL,
    RESUME_TRIP_TOOL,
    SEARCH_AIRPORTS_TOOL,
    SEARCH_FLIGHTS_KIWI_TOOL,
    SET_NOTIFICATION_TOOL,
    TOOL_SCHEMAS,
    ToolCall,
    ToolCallFunction,
    ToolResult,
    get_all_tools,
    get_tool_schema,
)
from app.services.mcp_router import (
    MCPRouter,
    ToolExecutionError,
    ToolNotFoundError,
    ToolValidationError,
    _validate_type,
    get_mcp_router,
    reset_mcp_router,
    validate_tool_args,
)

# =============================================================================
# ToolResult Tests
# =============================================================================


class TestToolResult:
    """Tests for ToolResult dataclass."""

    def test_success_result_with_data(self):
        """Test creating a successful result with data."""
        result = ToolResult(success=True, data={"trips": [], "count": 0})

        assert result.success is True
        assert result.data == {"trips": [], "count": 0}
        assert result.error is None

    def test_error_result(self):
        """Test creating an error result."""
        result = ToolResult(success=False, error="Trip not found")

        assert result.success is False
        assert result.data is None
        assert result.error == "Trip not found"

    def test_to_dict_success(self):
        """Test to_dict() for successful result."""
        result = ToolResult(success=True, data={"id": "123"})
        d = result.to_dict()

        assert d["success"] is True
        assert d["data"] == {"id": "123"}
        assert "error" not in d

    def test_to_dict_error(self):
        """Test to_dict() for error result."""
        result = ToolResult(success=False, error="Validation failed")
        d = result.to_dict()

        assert d["success"] is False
        assert d["error"] == "Validation failed"
        assert "data" not in d

    def test_to_dict_with_both_data_and_error(self):
        """Test to_dict() when both data and error are set."""
        result = ToolResult(
            success=False,
            data={"details": "extra info"},
            error="Partial failure",
        )
        d = result.to_dict()

        assert d["success"] is False
        assert d["data"] == {"details": "extra info"}
        assert d["error"] == "Partial failure"


# =============================================================================
# ToolCall Tests
# =============================================================================


class TestToolCall:
    """Tests for ToolCall dataclass."""

    def test_tool_call_creation(self):
        """Test creating a ToolCall."""
        func = ToolCallFunction(
            name="list_trips",
            arguments="{}",
        )
        call = ToolCall(
            id="call_abc123",
            type="function",
            function=func,
        )

        assert call.id == "call_abc123"
        assert call.type == "function"
        assert call.function.name == "list_trips"
        assert call.function.arguments == "{}"

    def test_tool_call_with_arguments(self):
        """Test ToolCall with JSON arguments."""
        args = json.dumps({"trip_id": "550e8400-e29b-41d4-a716-446655440000"})
        func = ToolCallFunction(name="get_trip_details", arguments=args)
        call = ToolCall(id="call_xyz", type="function", function=func)

        parsed = json.loads(call.function.arguments)
        assert parsed["trip_id"] == "550e8400-e29b-41d4-a716-446655440000"


# =============================================================================
# Tool Schema Tests
# =============================================================================


class TestToolSchemas:
    """Tests for tool schema definitions."""

    def test_mcp_tools_is_list(self):
        """Test MCP_TOOLS is a list of tool definitions."""
        assert isinstance(MCP_TOOLS, list)
        assert len(MCP_TOOLS) == 11  # 11 tools defined

    def test_all_tools_have_required_structure(self):
        """Test all tools have the required OpenAI function structure."""
        for tool in MCP_TOOLS:
            assert tool["type"] == "function"
            assert "function" in tool
            assert "name" in tool["function"]
            assert "description" in tool["function"]
            assert "parameters" in tool["function"]
            assert tool["function"]["parameters"]["type"] == "object"

    def test_tool_schemas_dict(self):
        """Test TOOL_SCHEMAS maps tool names to parameter schemas."""
        assert "create_trip" in TOOL_SCHEMAS
        assert "list_trips" in TOOL_SCHEMAS
        assert "get_trip_details" in TOOL_SCHEMAS

        for _name, schema in TOOL_SCHEMAS.items():
            assert schema["type"] == "object"
            assert "properties" in schema

    def test_get_tool_schema_existing(self):
        """Test get_tool_schema returns schema for existing tool."""
        schema = get_tool_schema("create_trip")

        assert schema is not None
        assert schema["type"] == "object"
        assert "name" in schema["properties"]
        assert "origin_airport" in schema["properties"]

    def test_get_tool_schema_nonexistent(self):
        """Test get_tool_schema returns None for unknown tool."""
        schema = get_tool_schema("nonexistent_tool")
        assert schema is None

    def test_get_all_tools_returns_copy(self):
        """Test get_all_tools returns a copy of the tools list."""
        tools1 = get_all_tools()
        tools2 = get_all_tools()

        assert tools1 is not tools2
        assert tools1 == tools2

    def test_create_trip_tool_schema(self):
        """Test create_trip tool schema details."""
        schema = CREATE_TRIP_TOOL["function"]

        assert schema["name"] == "create_trip"
        assert "vacation price tracking" in schema["description"].lower()

        params = schema["parameters"]
        # No required params - elicitation handles missing fields
        assert params["required"] == []
        # But all properties should still be defined
        assert "name" in params["properties"]
        assert "origin_airport" in params["properties"]
        assert "destination_code" in params["properties"]
        assert "depart_date" in params["properties"]
        assert "return_date" in params["properties"]
        assert "adults" in params["properties"]

        # Description should mention elicitation behavior
        assert "only pass fields" in schema["description"].lower()

    def test_list_trips_tool_schema(self):
        """Test list_trips tool schema."""
        schema = LIST_TRIPS_TOOL["function"]

        assert schema["name"] == "list_trips"
        assert len(schema["parameters"]["required"]) == 0
        assert len(schema["parameters"]["properties"]) == 0

    def test_get_trip_details_tool_schema(self):
        """Test get_trip_details tool schema."""
        schema = GET_TRIP_DETAILS_TOOL["function"]

        assert schema["name"] == "get_trip_details"
        assert "trip_id" in schema["parameters"]["required"]
        assert schema["parameters"]["properties"]["trip_id"]["format"] == "uuid"

    def test_set_notification_tool_schema(self):
        """Test set_notification tool schema."""
        schema = SET_NOTIFICATION_TOOL["function"]

        assert schema["name"] == "set_notification"
        assert "trip_id" in schema["parameters"]["required"]
        assert "threshold_value" in schema["parameters"]["required"]
        assert schema["parameters"]["properties"]["threshold_type"]["enum"] == [
            "trip_total",
            "flight_total",
            "hotel_total",
        ]

    def test_pause_trip_tool_schema(self):
        """Test pause_trip tool schema."""
        schema = PAUSE_TRIP_TOOL["function"]

        assert schema["name"] == "pause_trip"
        assert schema["parameters"]["required"] == ["trip_id"]

    def test_resume_trip_tool_schema(self):
        """Test resume_trip tool schema."""
        schema = RESUME_TRIP_TOOL["function"]

        assert schema["name"] == "resume_trip"
        assert schema["parameters"]["required"] == ["trip_id"]

    def test_refresh_all_trip_prices_tool_schema(self):
        """Test refresh_all_trip_prices tool schema."""
        schema = REFRESH_ALL_TRIP_PRICES_TOOL["function"]

        assert schema["name"] == "refresh_all_trip_prices"
        assert len(schema["parameters"]["required"]) == 0

    def test_search_airports_tool_schema(self):
        """Test search_airports tool schema."""
        schema = SEARCH_AIRPORTS_TOOL["function"]

        assert schema["name"] == "search_airports"
        assert "query" in schema["parameters"]["required"]
        assert schema["parameters"]["properties"]["query"]["minLength"] == 2

    def test_search_flights_kiwi_tool_schema(self):
        """Test search_flights_kiwi tool schema."""
        schema = SEARCH_FLIGHTS_KIWI_TOOL["function"]

        assert schema["name"] == "search_flights_kiwi"
        assert set(schema["parameters"]["required"]) == {
            "fly_from",
            "fly_to",
            "departure_date",
        }
        assert "fly_from" in schema["parameters"]["properties"]
        assert "fly_to" in schema["parameters"]["properties"]
        assert "departure_date" in schema["parameters"]["properties"]
        assert "return_date" in schema["parameters"]["properties"]
        assert "adults" in schema["parameters"]["properties"]
        assert "currency" in schema["parameters"]["properties"]
        assert schema["parameters"]["properties"]["departure_date"]["format"] == "date"


# =============================================================================
# Validation Function Tests
# =============================================================================


class TestValidateType:
    """Tests for the _validate_type helper function."""

    def test_validate_string_valid(self):
        """Test valid string validation."""
        errors = _validate_type("hello", {"type": "string"}, "field")
        assert errors == []

    def test_validate_string_invalid_type(self):
        """Test string validation with wrong type."""
        errors = _validate_type(123, {"type": "string"}, "field")
        assert len(errors) == 1
        assert "expected string" in errors[0]

    def test_validate_string_min_length(self):
        """Test string minLength validation."""
        schema = {"type": "string", "minLength": 3}
        errors = _validate_type("ab", schema, "field")
        assert len(errors) == 1
        assert "length must be >= 3" in errors[0]

    def test_validate_string_max_length(self):
        """Test string maxLength validation."""
        schema = {"type": "string", "maxLength": 5}
        errors = _validate_type("toolong", schema, "field")
        assert len(errors) == 1
        assert "length must be <= 5" in errors[0]

    def test_validate_string_pattern(self):
        """Test string pattern validation."""
        schema = {"type": "string", "pattern": "^[A-Z]{3}$"}
        errors = _validate_type("ABC", schema, "field")
        assert errors == []

        errors = _validate_type("abc", schema, "field")
        assert len(errors) == 1
        assert "must match pattern" in errors[0]

    def test_validate_string_enum(self):
        """Test string enum validation."""
        schema = {"type": "string", "enum": ["a", "b", "c"]}
        errors = _validate_type("a", schema, "field")
        assert errors == []

        errors = _validate_type("d", schema, "field")
        assert len(errors) == 1
        assert "must be one of" in errors[0]

    def test_validate_string_format_uuid(self):
        """Test string format uuid validation."""
        schema = {"type": "string", "format": "uuid"}
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        errors = _validate_type(valid_uuid, schema, "field")
        assert errors == []

        errors = _validate_type("not-a-uuid", schema, "field")
        assert len(errors) == 1
        assert "must be a valid UUID" in errors[0]

    def test_validate_string_format_date(self):
        """Test string format date validation."""
        schema = {"type": "string", "format": "date"}
        errors = _validate_type("2026-03-15", schema, "field")
        assert errors == []

        errors = _validate_type("15-03-2026", schema, "field")
        assert len(errors) == 1
        assert "must be a valid date" in errors[0]

    def test_validate_integer_valid(self):
        """Test valid integer validation."""
        errors = _validate_type(42, {"type": "integer"}, "field")
        assert errors == []

    def test_validate_integer_rejects_bool(self):
        """Test integer validation rejects booleans."""
        # In Python, bool is subclass of int, but we should reject it
        errors = _validate_type(True, {"type": "integer"}, "field")
        assert len(errors) == 1

    def test_validate_integer_minimum(self):
        """Test integer minimum validation."""
        schema = {"type": "integer", "minimum": 1}
        errors = _validate_type(0, schema, "field")
        assert len(errors) == 1
        assert "must be >= 1" in errors[0]

    def test_validate_integer_maximum(self):
        """Test integer maximum validation."""
        schema = {"type": "integer", "maximum": 9}
        errors = _validate_type(10, schema, "field")
        assert len(errors) == 1
        assert "must be <= 9" in errors[0]

    def test_validate_number_valid(self):
        """Test valid number validation."""
        errors = _validate_type(3.14, {"type": "number"}, "field")
        assert errors == []

        errors = _validate_type(42, {"type": "number"}, "field")
        assert errors == []

    def test_validate_number_rejects_bool(self):
        """Test number validation rejects booleans."""
        errors = _validate_type(False, {"type": "number"}, "field")
        assert len(errors) == 1

    def test_validate_boolean_valid(self):
        """Test valid boolean validation."""
        errors = _validate_type(True, {"type": "boolean"}, "field")
        assert errors == []

        errors = _validate_type(False, {"type": "boolean"}, "field")
        assert errors == []

    def test_validate_boolean_invalid(self):
        """Test boolean validation with wrong type."""
        errors = _validate_type(1, {"type": "boolean"}, "field")
        assert len(errors) == 1
        assert "expected boolean" in errors[0]

    def test_validate_array_valid(self):
        """Test valid array validation."""
        errors = _validate_type(["a", "b"], {"type": "array"}, "field")
        assert errors == []

    def test_validate_array_items(self):
        """Test array items validation."""
        schema = {"type": "array", "items": {"type": "string"}}
        errors = _validate_type(["a", "b"], schema, "field")
        assert errors == []

        errors = _validate_type(["a", 1], schema, "field")
        assert len(errors) == 1
        assert "field[1]" in errors[0]

    def test_validate_object_valid(self):
        """Test valid object validation."""
        errors = _validate_type({"key": "value"}, {"type": "object"}, "field")
        assert errors == []

    def test_validate_null_valid(self):
        """Test null type validation."""
        errors = _validate_type(None, {"type": "null"}, "field")
        assert errors == []

    def test_validate_no_type_in_schema(self):
        """Test validation with no type in schema (passes)."""
        errors = _validate_type("anything", {}, "field")
        assert errors == []


class TestValidateToolArgs:
    """Tests for validate_tool_args function."""

    def test_validate_list_trips_no_args(self):
        """Test list_trips requires no arguments."""
        validate_tool_args("list_trips", {})  # Should not raise

    def test_validate_create_trip_partial_args(self):
        """Test create_trip accepts partial args (elicitation handles missing)."""
        # No longer raises - elicitation handles missing fields at tool level
        validate_tool_args("create_trip", {"name": "Test Trip"})  # Should not raise
        validate_tool_args("create_trip", {"destination_code": "SEA"})  # Should not raise
        validate_tool_args("create_trip", {})  # Should not raise

    def test_validate_create_trip_valid(self):
        """Test create_trip with all required fields."""
        args = {
            "name": "Hawaii Trip",
            "origin_airport": "SFO",
            "destination_code": "HNL",
            "depart_date": "2026-03-15",
            "return_date": "2026-03-22",
        }
        validate_tool_args("create_trip", args)  # Should not raise

    def test_validate_create_trip_lowercase_airport_code(self):
        """Test create_trip accepts lowercase airport codes (simplified schema)."""
        args = {
            "name": "Hawaii Trip",
            "origin_airport": "sf",  # Lowercase accepted in simplified schema
            "destination_code": "HNL",
            "depart_date": "2026-03-15",
            "return_date": "2026-03-22",
        }
        validate_tool_args("create_trip", args)  # Should not raise (no pattern validation)

    def test_validate_get_trip_details_valid_uuid(self):
        """Test get_trip_details with valid UUID."""
        args = {"trip_id": "550e8400-e29b-41d4-a716-446655440000"}
        validate_tool_args("get_trip_details", args)  # Should not raise

    def test_validate_get_trip_details_invalid_uuid(self):
        """Test get_trip_details with invalid UUID."""
        args = {"trip_id": "not-a-uuid"}
        with pytest.raises(ToolValidationError) as exc_info:
            validate_tool_args("get_trip_details", args)

        assert "must be a valid UUID" in str(exc_info.value.details)

    def test_validate_set_notification_valid(self):
        """Test set_notification with valid args."""
        args = {
            "trip_id": "550e8400-e29b-41d4-a716-446655440000",
            "threshold_value": 500.00,
            "threshold_type": "trip_total",
        }
        validate_tool_args("set_notification", args)  # Should not raise

    def test_validate_set_notification_invalid_type(self):
        """Test set_notification with invalid threshold_type."""
        args = {
            "trip_id": "550e8400-e29b-41d4-a716-446655440000",
            "threshold_value": 500.00,
            "threshold_type": "invalid_type",
        }
        with pytest.raises(ToolValidationError) as exc_info:
            validate_tool_args("set_notification", args)

        assert "must be one of" in str(exc_info.value.details)

    def test_validate_unknown_tool(self):
        """Test validation with unknown tool name."""
        with pytest.raises(ToolNotFoundError) as exc_info:
            validate_tool_args("unknown_tool", {})

        assert exc_info.value.tool_name == "unknown_tool"

    def test_validate_ignores_unknown_parameters(self):
        """Test validation ignores parameters not in schema."""
        args = {
            "trip_id": "550e8400-e29b-41d4-a716-446655440000",
            "unknown_param": "ignored",
        }
        validate_tool_args("get_trip_details", args)  # Should not raise

    def test_validate_search_airports_min_length(self):
        """Test search_airports query minLength validation."""
        with pytest.raises(ToolValidationError) as exc_info:
            validate_tool_args("search_airports", {"query": "a"})

        assert "length must be >= 2" in str(exc_info.value.details)

    def test_validate_create_trip_adults_any_value(self):
        """Test create_trip accepts any adults value (simplified schema)."""
        args = {
            "name": "Trip",
            "origin_airport": "SFO",
            "destination_code": "LAX",
            "depart_date": "2026-03-15",
            "return_date": "2026-03-22",
            "adults": 15,  # Simplified schema doesn't validate range
        }
        validate_tool_args("create_trip", args)  # Should not raise (no range validation)


# =============================================================================
# MCPRouter Tests
# =============================================================================


class MockToolHandler:
    """Mock tool handler for testing."""

    def __init__(self, result: ToolResult | None = None):
        self.result = result or ToolResult(success=True, data={"mock": "data"})
        self.call_count = 0
        self.last_args: dict[str, Any] = {}
        self.last_user_id: str = ""

    async def execute(self, args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
        """Execute the mock tool."""
        self.call_count += 1
        self.last_args = args
        self.last_user_id = user_id
        return self.result


class TestMCPRouter:
    """Tests for MCPRouter class."""

    def test_router_initialization(self):
        """Test router initializes with empty registry."""
        router = MCPRouter()
        assert router.get_registered_tools() == []

    def test_register_class_handler(self):
        """Test registering a class-based handler."""
        router = MCPRouter()
        handler = MockToolHandler()

        router.register("test_tool", handler)

        assert router.is_registered("test_tool")
        assert "test_tool" in router.get_registered_tools()

    def test_register_function_handler(self):
        """Test registering a function-based handler."""
        router = MCPRouter()

        async def handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(success=True, data={"function": "handler"})

        router.register("func_tool", handler)

        assert router.is_registered("func_tool")

    def test_unregister_existing(self):
        """Test unregistering an existing tool."""
        router = MCPRouter()
        router.register("test", MockToolHandler())

        result = router.unregister("test")

        assert result is True
        assert not router.is_registered("test")

    def test_unregister_nonexistent(self):
        """Test unregistering a non-existent tool."""
        router = MCPRouter()

        result = router.unregister("nonexistent")

        assert result is False

    def test_is_registered_true(self):
        """Test is_registered returns True for registered tool."""
        router = MCPRouter()
        router.register("test", MockToolHandler())

        assert router.is_registered("test") is True

    def test_is_registered_false(self):
        """Test is_registered returns False for unregistered tool."""
        router = MCPRouter()

        assert router.is_registered("test") is False

    @pytest.mark.asyncio
    async def test_execute_class_handler(self):
        """Test executing a class-based handler."""
        router = MCPRouter()
        handler = MockToolHandler(ToolResult(success=True, data={"id": "123"}))
        router.register("list_trips", handler)

        result = await router.execute("list_trips", {}, "user-123")

        assert result.success is True
        assert result.data == {"id": "123"}
        assert handler.call_count == 1
        assert handler.last_user_id == "user-123"

    @pytest.mark.asyncio
    async def test_execute_function_handler(self):
        """Test executing a function-based handler."""
        router = MCPRouter()

        async def handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(success=True, data={"user": user_id, "args": args})

        router.register("list_trips", handler)

        result = await router.execute("list_trips", {"key": "value"}, "user-456")

        assert result.success is True
        assert result.data["user"] == "user-456"
        assert result.data["args"] == {"key": "value"}

    @pytest.mark.asyncio
    async def test_execute_unregistered_tool(self):
        """Test executing an unregistered tool."""
        router = MCPRouter()

        result = await router.execute("unknown_tool", {}, "user-123")

        assert result.success is False
        assert "Tool not found" in result.error

    @pytest.mark.asyncio
    async def test_execute_with_validation_failure(self):
        """Test execute with validation failure."""
        router = MCPRouter()
        router.register("get_trip_details", MockToolHandler())

        result = await router.execute(
            "get_trip_details",
            {"trip_id": "not-a-uuid"},
            "user-123",
        )

        assert result.success is False
        assert "Invalid arguments" in result.error

    @pytest.mark.asyncio
    async def test_execute_skip_validation(self):
        """Test execute with skip_validation flag."""
        router = MCPRouter()
        handler = MockToolHandler()
        router.register("get_trip_details", handler)

        result = await router.execute(
            "get_trip_details",
            {"trip_id": "not-a-uuid"},
            "user-123",
            skip_validation=True,
        )

        assert result.success is True
        assert handler.call_count == 1

    @pytest.mark.asyncio
    async def test_execute_handler_exception(self):
        """Test execute handles handler exceptions."""
        router = MCPRouter()

        async def failing_handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            raise ValueError("Something went wrong")

        router.register("list_trips", failing_handler)

        result = await router.execute("list_trips", {}, "user-123")

        assert result.success is False
        assert "Tool execution failed" in result.error
        assert "Something went wrong" in result.error

    @pytest.mark.asyncio
    async def test_execute_tool_without_schema(self):
        """Test execute tool registered but without schema definition."""
        router = MCPRouter()
        handler = MockToolHandler()
        router.register("custom_tool", handler)  # Not in TOOL_SCHEMAS

        result = await router.execute("custom_tool", {"arg": "value"}, "user-123")

        # Should still execute despite no schema
        assert result.success is True
        assert handler.call_count == 1

    @pytest.mark.asyncio
    async def test_execute_passes_arguments_to_handler(self):
        """Test execute passes arguments correctly to handler."""
        router = MCPRouter()
        handler = MockToolHandler()
        router.register("list_trips", handler)

        args = {"filter": "active", "limit": 10}
        await router.execute("list_trips", args, "user-123")

        assert handler.last_args == args

    @pytest.mark.asyncio
    async def test_execute_from_json_valid(self):
        """Test execute_from_json with valid JSON."""
        router = MCPRouter()
        handler = MockToolHandler()
        router.register("list_trips", handler)

        result = await router.execute_from_json(
            "list_trips",
            '{"filter": "active"}',
            "user-123",
        )

        assert result.success is True
        assert handler.last_args == {"filter": "active"}

    @pytest.mark.asyncio
    async def test_execute_from_json_invalid_json(self):
        """Test execute_from_json with invalid JSON."""
        router = MCPRouter()
        router.register("list_trips", MockToolHandler())

        result = await router.execute_from_json(
            "list_trips",
            "not valid json",
            "user-123",
        )

        assert result.success is False
        assert "Invalid JSON" in result.error

    @pytest.mark.asyncio
    async def test_execute_from_json_non_object(self):
        """Test execute_from_json with non-object JSON."""
        router = MCPRouter()
        router.register("list_trips", MockToolHandler())

        result = await router.execute_from_json(
            "list_trips",
            '["array", "not", "object"]',
            "user-123",
        )

        assert result.success is False
        assert "must be a JSON object" in result.error


# =============================================================================
# Singleton Router Tests
# =============================================================================


class TestSingletonRouter:
    """Tests for singleton router instance."""

    def setup_method(self):
        """Reset singleton before each test."""
        reset_mcp_router()

    def teardown_method(self):
        """Reset singleton after each test."""
        reset_mcp_router()

    def test_get_mcp_router_creates_instance(self):
        """Test get_mcp_router creates a new instance."""
        router = get_mcp_router()
        assert router is not None
        assert isinstance(router, MCPRouter)

    def test_get_mcp_router_returns_same_instance(self):
        """Test get_mcp_router returns the same instance."""
        router1 = get_mcp_router()
        router2 = get_mcp_router()
        assert router1 is router2

    def test_reset_mcp_router(self):
        """Test reset_mcp_router clears the singleton."""
        router1 = get_mcp_router()
        router1.register("test", MockToolHandler())

        reset_mcp_router()
        router2 = get_mcp_router()

        assert router1 is not router2
        assert not router2.is_registered("test")


# =============================================================================
# Exception Tests
# =============================================================================


class TestExceptions:
    """Tests for custom exception classes."""

    def test_tool_validation_error(self):
        """Test ToolValidationError creation."""
        error = ToolValidationError(
            "Invalid arguments",
            details={"errors": ["field1: required"]},
        )

        assert str(error) == "Invalid arguments"
        assert error.message == "Invalid arguments"
        assert error.details == {"errors": ["field1: required"]}

    def test_tool_validation_error_no_details(self):
        """Test ToolValidationError without details."""
        error = ToolValidationError("Error message")

        assert error.message == "Error message"
        assert error.details == {}

    def test_tool_not_found_error(self):
        """Test ToolNotFoundError creation."""
        error = ToolNotFoundError("missing_tool")

        assert "Tool not found: missing_tool" in str(error)
        assert error.tool_name == "missing_tool"

    def test_tool_execution_error(self):
        """Test ToolExecutionError creation."""
        cause = ValueError("original error")
        error = ToolExecutionError("Execution failed", cause=cause)

        assert str(error) == "Execution failed"
        assert error.cause is cause

    def test_tool_execution_error_no_cause(self):
        """Test ToolExecutionError without cause."""
        error = ToolExecutionError("Execution failed")

        assert error.cause is None


# =============================================================================
# Integration Tests
# =============================================================================


class TestMCPRouterIntegration:
    """Integration tests for MCPRouter with realistic tool handlers."""

    @pytest.mark.asyncio
    async def test_full_tool_call_flow(self):
        """Test complete tool call flow from registration to execution."""
        router = MCPRouter()

        # Simulate a list_trips tool handler
        async def list_trips_handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(
                success=True,
                data={
                    "trips": [
                        {
                            "id": "trip-1",
                            "name": "Hawaii",
                            "status": "active",
                        }
                    ],
                    "count": 1,
                },
            )

        router.register("list_trips", list_trips_handler)

        # Execute via JSON (simulating LLM tool call)
        result = await router.execute_from_json(
            "list_trips",
            "{}",
            str(uuid.uuid4()),
        )

        assert result.success is True
        assert len(result.data["trips"]) == 1
        assert result.data["trips"][0]["name"] == "Hawaii"

    @pytest.mark.asyncio
    async def test_create_trip_validation_flow(self):
        """Test create_trip validation and execution flow."""
        router = MCPRouter()

        async def create_trip_handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(
                success=True,
                data={
                    "trip_id": str(uuid.uuid4()),
                    "name": args["name"],
                    "message": f"Created trip '{args['name']}'",
                },
            )

        router.register("create_trip", create_trip_handler)

        # Valid creation
        valid_args = json.dumps(
            {
                "name": "Hawaii Spring 2026",
                "origin_airport": "SFO",
                "destination_code": "HNL",
                "depart_date": "2026-03-15",
                "return_date": "2026-03-22",
            }
        )

        result = await router.execute_from_json(
            "create_trip",
            valid_args,
            str(uuid.uuid4()),
        )

        assert result.success is True
        assert result.data["name"] == "Hawaii Spring 2026"

    @pytest.mark.asyncio
    async def test_multiple_tools_registered(self):
        """Test router with multiple tools registered."""
        router = MCPRouter()

        async def list_handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(success=True, data={"action": "list"})

        async def details_handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(success=True, data={"action": "details"})

        async def pause_handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(success=True, data={"action": "pause"})

        router.register("list_trips", list_handler)
        router.register("get_trip_details", details_handler)
        router.register("pause_trip", pause_handler)

        assert len(router.get_registered_tools()) == 3

        # Execute each
        result1 = await router.execute("list_trips", {}, "user-1")
        assert result1.data["action"] == "list"

        valid_uuid = str(uuid.uuid4())
        result2 = await router.execute("get_trip_details", {"trip_id": valid_uuid}, "user-1")
        assert result2.data["action"] == "details"

        result3 = await router.execute("pause_trip", {"trip_id": valid_uuid}, "user-1")
        assert result3.data["action"] == "pause"
