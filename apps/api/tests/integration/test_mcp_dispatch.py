"""Integration tests for MCP router dispatching.

Tests the MCP router's ability to:
- Register and dispatch to tool handlers
- Validate tool arguments against schemas
- Inject user context for authorization
- Handle tool execution errors gracefully
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

import pytest
import pytest_asyncio
from app.models.trip import Trip
from app.models.user import User
from app.schemas.mcp import ToolResult
from app.services.mcp_router import (
    MCPRouter,
    ToolNotFoundError,
    ToolValidationError,
    get_mcp_router,
    reset_mcp_router,
    validate_tool_args,
)


class MockToolHandler:
    """Mock tool handler for testing."""

    def __init__(self, result: ToolResult | None = None, should_raise: bool = False):
        self.result = result or ToolResult(success=True, data={"status": "ok"})
        self.should_raise = should_raise
        self.last_call: tuple[dict[str, Any], str] | None = None

    async def execute(self, args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
        self.last_call = (args, user_id)
        if self.should_raise:
            raise RuntimeError("Handler failed")
        return self.result


@pytest.fixture
def router():
    """Create a fresh MCPRouter for each test."""
    return MCPRouter()


@pytest.fixture(autouse=True)
def reset_global_router():
    """Reset the global router before each test."""
    reset_mcp_router()
    yield
    reset_mcp_router()


class TestMCPRouterRegistration:
    """Tests for tool registration."""

    def test_register_tool_handler(self, router):
        """Test registering a tool handler."""
        handler = MockToolHandler()
        router.register("test_tool", handler)

        assert router.is_registered("test_tool")
        assert "test_tool" in router.get_registered_tools()

    def test_register_async_function(self, router):
        """Test registering an async function as handler."""

        async def my_handler(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            return ToolResult(success=True, data=args)

        router.register("func_tool", my_handler)
        assert router.is_registered("func_tool")

    def test_unregister_tool(self, router):
        """Test unregistering a tool."""
        handler = MockToolHandler()
        router.register("temp_tool", handler)
        assert router.is_registered("temp_tool")

        result = router.unregister("temp_tool")
        assert result is True
        assert not router.is_registered("temp_tool")

    def test_unregister_nonexistent_tool(self, router):
        """Test unregistering a non-existent tool returns False."""
        result = router.unregister("nonexistent")
        assert result is False

    def test_get_registered_tools(self, router):
        """Test getting list of registered tools."""
        handler = MockToolHandler()
        router.register("tool_a", handler)
        router.register("tool_b", handler)

        tools = router.get_registered_tools()
        assert "tool_a" in tools
        assert "tool_b" in tools


class TestMCPRouterExecution:
    """Tests for tool execution dispatching."""

    @pytest.mark.anyio
    async def test_execute_registered_tool(self, router):
        """Test executing a registered tool."""
        handler = MockToolHandler(result=ToolResult(success=True, data={"value": 42}))
        router.register("my_tool", handler)

        result = await router.execute(
            tool_name="my_tool",
            arguments={"key": "value"},
            user_id="user-123",
            skip_validation=True,
            skip_sanitization=True,
        )

        assert result.success is True
        assert result.data == {"value": 42}
        assert handler.last_call == ({"key": "value"}, "user-123")

    @pytest.mark.anyio
    async def test_execute_unregistered_tool(self, router):
        """Test executing an unregistered tool returns error."""
        result = await router.execute(
            tool_name="unknown_tool",
            arguments={},
            user_id="user-123",
        )

        assert result.success is False
        assert "not found" in result.error.lower()

    @pytest.mark.anyio
    async def test_execute_async_function_handler(self, router):
        """Test executing a function-based handler."""
        call_log = []

        async def my_func(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            call_log.append((args, user_id))
            return ToolResult(success=True, data={"from_func": True})

        router.register("func_tool", my_func)

        result = await router.execute(
            tool_name="func_tool",
            arguments={"x": 1},
            user_id="user-456",
            skip_validation=True,
            skip_sanitization=True,
        )

        assert result.success is True
        assert result.data == {"from_func": True}
        assert call_log == [({"x": 1}, "user-456")]

    @pytest.mark.anyio
    async def test_execute_handler_exception(self, router):
        """Test handling handler exceptions."""
        handler = MockToolHandler(should_raise=True)
        router.register("failing_tool", handler)

        result = await router.execute(
            tool_name="failing_tool",
            arguments={},
            user_id="user-123",
            skip_validation=True,
            skip_sanitization=True,
        )

        assert result.success is False
        assert "execution failed" in result.error.lower()


class TestMCPRouterValidation:
    """Tests for argument validation."""

    @pytest.mark.anyio
    async def test_validation_missing_required_field(self, router):
        """Test validation fails for missing required fields."""
        # create_trip requires name, origin_airport, etc.
        handler = MockToolHandler()
        router.register("create_trip", handler)

        result = await router.execute(
            tool_name="create_trip",
            arguments={"name": "Test Trip"},  # Missing required fields
            user_id="user-123",
            skip_sanitization=True,
        )

        assert result.success is False
        assert "invalid arguments" in result.error.lower()

    @pytest.mark.anyio
    async def test_validation_with_all_required_fields(self, router):
        """Test validation passes with all required fields."""
        handler = MockToolHandler()
        router.register("create_trip", handler)

        result = await router.execute(
            tool_name="create_trip",
            arguments={
                "name": "Hawaii Trip",
                "origin_airport": "SFO",
                "destination_code": "HNL",
                "depart_date": "2026-06-01",
                "return_date": "2026-06-08",
            },
            user_id="user-123",
            skip_sanitization=True,
        )

        assert result.success is True

    @pytest.mark.anyio
    async def test_validation_type_mismatch(self, router):
        """Test validation fails for type mismatches."""
        handler = MockToolHandler()
        router.register("set_notification", handler)

        result = await router.execute(
            tool_name="set_notification",
            arguments={
                "trip_id": "valid-uuid-123",
                "threshold_value": "not-a-number",  # Should be number
            },
            user_id="user-123",
            skip_sanitization=True,
        )

        assert result.success is False


class TestMCPRouterFromJSON:
    """Tests for execute_from_json method."""

    @pytest.mark.anyio
    async def test_execute_from_json_valid(self, router):
        """Test executing with JSON string arguments."""
        handler = MockToolHandler()
        router.register("list_trips", handler)

        result = await router.execute_from_json(
            tool_name="list_trips",
            arguments_json="{}",
            user_id="user-123",
        )

        assert result.success is True

    @pytest.mark.anyio
    async def test_execute_from_json_invalid_json(self, router):
        """Test handling invalid JSON."""
        handler = MockToolHandler()
        router.register("list_trips", handler)

        result = await router.execute_from_json(
            tool_name="list_trips",
            arguments_json="not valid json",
            user_id="user-123",
        )

        assert result.success is False
        assert "invalid json" in result.error.lower()

    @pytest.mark.anyio
    async def test_execute_from_json_non_object(self, router):
        """Test handling JSON that's not an object."""
        handler = MockToolHandler()
        router.register("list_trips", handler)

        result = await router.execute_from_json(
            tool_name="list_trips",
            arguments_json="[1, 2, 3]",  # Array, not object
            user_id="user-123",
        )

        assert result.success is False
        assert "must be a json object" in result.error.lower()


class TestMCPRouterUserContext:
    """Tests for user context injection."""

    @pytest.mark.anyio
    async def test_user_id_passed_to_handler(self, router):
        """Test that user_id is correctly passed to handler."""
        received_user_ids = []

        async def capture_user_id(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            received_user_ids.append(user_id)
            return ToolResult(success=True)

        router.register("capture_tool", capture_user_id)

        await router.execute("capture_tool", {}, "unique-user-id-xyz", skip_validation=True, skip_sanitization=True)

        assert received_user_ids == ["unique-user-id-xyz"]

    @pytest.mark.anyio
    async def test_different_users_different_contexts(self, router):
        """Test that different users get isolated contexts."""
        calls_by_user = {}

        async def track_user(args: dict[str, Any], user_id: str, db: Any = None) -> ToolResult:
            calls_by_user[user_id] = calls_by_user.get(user_id, 0) + 1
            return ToolResult(success=True)

        router.register("track_tool", track_user)

        await router.execute("track_tool", {}, "user-a", skip_validation=True, skip_sanitization=True)
        await router.execute("track_tool", {}, "user-b", skip_validation=True, skip_sanitization=True)
        await router.execute("track_tool", {}, "user-a", skip_validation=True, skip_sanitization=True)

        assert calls_by_user == {"user-a": 2, "user-b": 1}


class TestToolValidation:
    """Tests for standalone validate_tool_args function."""

    def test_validate_args_missing_required(self):
        """Test validation raises for missing required fields."""
        with pytest.raises(ToolValidationError) as exc_info:
            validate_tool_args("create_trip", {"name": "Test"})

        assert "invalid arguments" in str(exc_info.value).lower()
        assert "errors" in exc_info.value.details

    def test_validate_args_unknown_tool(self):
        """Test validation raises for unknown tools."""
        with pytest.raises(ToolNotFoundError):
            validate_tool_args("completely_unknown_tool", {})

    def test_validate_args_valid(self):
        """Test validation passes for valid arguments."""
        # Should not raise
        validate_tool_args(
            "create_trip",
            {
                "name": "Test Trip",
                "origin_airport": "SFO",
                "destination_code": "HNL",
                "depart_date": "2026-06-01",
                "return_date": "2026-06-08",
            },
        )


class TestGlobalRouter:
    """Tests for global router singleton."""

    def test_get_mcp_router_returns_singleton(self):
        """Test that get_mcp_router returns the same instance."""
        router1 = get_mcp_router()
        router2 = get_mcp_router()
        assert router1 is router2

    def test_reset_mcp_router(self):
        """Test that reset_mcp_router creates new instance."""
        router1 = get_mcp_router()
        router1.register("temp", MockToolHandler())

        reset_mcp_router()

        router2 = get_mcp_router()
        assert router2 is not router1
        assert not router2.is_registered("temp")


class TestMCPRouterWithRealTools:
    """Integration tests with actual tool registrations."""

    @pytest_asyncio.fixture
    async def db_with_user(self, test_session):
        """Create a user in the test database."""
        user = User(
            google_sub="mcp_dispatch_test_user",
            email="mcp_test@example.com",
            name="MCP Test User",
        )
        test_session.add(user)
        await test_session.flush()
        await test_session.refresh(user)
        return test_session, user

    @pytest.mark.anyio
    async def test_tool_with_db_access(self, db_with_user, router):
        """Test a tool that accesses the database."""
        db, user = db_with_user

        # Create a handler that queries the database
        async def db_handler(args: dict[str, Any], user_id: str, db_session: Any = None) -> ToolResult:
            from sqlalchemy import select

            # Query trips for the user (use passed db or fallback to closure)
            session = db_session or db
            result = await session.execute(select(Trip).where(Trip.user_id == uuid.UUID(user_id)))
            trips = list(result.scalars().all())
            return ToolResult(
                success=True,
                data={"trips": [{"name": t.name} for t in trips], "count": len(trips)},
            )

        router.register("list_trips", db_handler)

        # Create a trip for the user
        trip = Trip(
            user_id=user.id,
            name="MCP Test Trip",
            origin_airport="SFO",
            destination_code="LAX",
            depart_date=date(2026, 5, 1),
            return_date=date(2026, 5, 5),
            adults=2,
        )
        db.add(trip)
        await db.flush()

        # Execute the tool
        result = await router.execute(
            tool_name="list_trips",
            arguments={},
            user_id=str(user.id),
            db=db,  # Pass db session
            skip_validation=True,
            skip_sanitization=True,
        )

        assert result.success is True
        assert result.data["count"] == 1
        assert result.data["trips"][0]["name"] == "MCP Test Trip"

    @pytest.mark.anyio
    async def test_tool_respects_user_isolation(self, db_with_user, router):
        """Test that tools only see data for the requesting user."""
        db, user1 = db_with_user

        # Create another user
        user2 = User(
            google_sub="mcp_dispatch_test_user_2",
            email="mcp_test2@example.com",
            name="MCP Test User 2",
        )
        db.add(user2)
        await db.flush()
        await db.refresh(user2)

        # Create trips for both users
        trip1 = Trip(
            user_id=user1.id,
            name="User1 Trip",
            origin_airport="SFO",
            destination_code="LAX",
            depart_date=date(2026, 5, 1),
            return_date=date(2026, 5, 5),
        )
        trip2 = Trip(
            user_id=user2.id,
            name="User2 Trip",
            origin_airport="JFK",
            destination_code="MIA",
            depart_date=date(2026, 6, 1),
            return_date=date(2026, 6, 5),
        )
        db.add_all([trip1, trip2])
        await db.flush()

        # Handler that respects user_id
        async def db_handler(args: dict[str, Any], user_id: str, db_session: Any = None) -> ToolResult:
            from sqlalchemy import select

            session = db_session or db
            result = await session.execute(select(Trip).where(Trip.user_id == uuid.UUID(user_id)))
            trips = list(result.scalars().all())
            return ToolResult(
                success=True,
                data={"trips": [{"name": t.name} for t in trips]},
            )

        router.register("list_trips", db_handler)

        # User1 should only see their trip
        result1 = await router.execute("list_trips", {}, str(user1.id), db=db, skip_validation=True, skip_sanitization=True)
        assert len(result1.data["trips"]) == 1
        assert result1.data["trips"][0]["name"] == "User1 Trip"

        # User2 should only see their trip
        result2 = await router.execute("list_trips", {}, str(user2.id), db=db, skip_validation=True, skip_sanitization=True)
        assert len(result2.data["trips"]) == 1
        assert result2.data["trips"][0]["name"] == "User2 Trip"
