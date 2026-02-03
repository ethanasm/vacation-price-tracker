"""Tests for chat elicitation schema and endpoint.

Coverage targets:
- ElicitationChunk model validation
- ChatChunk.elicitation_request() factory method
- ElicitationSubmissionRequest validation
- POST /v1/chat/elicitation/{tool_call_id} endpoint
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.models.conversation import Conversation
from app.models.user import User
from app.routers.chat import (
    ElicitationNotFound,
    ToolNotRegistered,
    router,
)
from app.schemas.chat import (
    ChatChunk,
    ChatChunkType,
    ElicitationChunk,
    ElicitationSubmissionRequest,
)
from app.schemas.mcp import ToolResult
from fastapi import FastAPI
from fastapi.testclient import TestClient

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    user = MagicMock(spec=User)
    user.id = uuid.uuid4()
    user.email = "test@example.com"
    user.created_at = datetime.now()
    return user


@pytest.fixture
def mock_conversation():
    """Create a mock conversation."""
    conv = MagicMock(spec=Conversation)
    conv.id = uuid.uuid4()
    conv.user_id = uuid.uuid4()
    conv.title = "Test Conversation"
    conv.created_at = datetime.now()
    conv.updated_at = datetime.now()
    return conv


def make_mock_db_session():
    """Create a mock database session."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


# =============================================================================
# ElicitationChunk Model Tests
# =============================================================================


class TestElicitationChunkModel:
    """Tests for the ElicitationChunk model."""

    def test_creates_with_all_fields(self):
        """Test creating ElicitationChunk with all fields."""
        chunk = ElicitationChunk(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={"destination_code": "SEA"},
            missing_fields=["name", "origin_airport", "depart_date"],
        )

        assert chunk.tool_call_id == "call_123"
        assert chunk.tool_name == "create_trip"
        assert chunk.component == "create-trip-form"
        assert chunk.prefilled == {"destination_code": "SEA"}
        assert chunk.missing_fields == ["name", "origin_airport", "depart_date"]

    def test_missing_fields_defaults_to_empty_list(self):
        """Test missing_fields defaults to empty list when not provided."""
        chunk = ElicitationChunk(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={},
        )

        assert chunk.missing_fields == []

    def test_prefilled_can_have_various_types(self):
        """Test prefilled dict can contain various value types."""
        chunk = ElicitationChunk(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={
                "name": "Seattle Trip",
                "adults": 2,
                "airlines": ["AA", "UA"],
                "is_active": True,
            },
        )

        assert chunk.prefilled["name"] == "Seattle Trip"
        assert chunk.prefilled["adults"] == 2
        assert chunk.prefilled["airlines"] == ["AA", "UA"]
        assert chunk.prefilled["is_active"] is True

    def test_serializes_to_dict(self):
        """Test ElicitationChunk serializes correctly."""
        chunk = ElicitationChunk(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={"destination_code": "SEA"},
            missing_fields=["name"],
        )

        data = chunk.model_dump()
        assert data["tool_call_id"] == "call_123"
        assert data["tool_name"] == "create_trip"
        assert data["component"] == "create-trip-form"
        assert data["prefilled"] == {"destination_code": "SEA"}
        assert data["missing_fields"] == ["name"]


# =============================================================================
# ChatChunk.elicitation_request() Factory Tests
# =============================================================================


class TestChatChunkElicitationRequest:
    """Tests for the ChatChunk.elicitation_request() factory method."""

    def test_creates_elicitation_chunk(self):
        """Test factory creates correct chunk type."""
        chunk = ChatChunk.elicitation_request(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={"destination_code": "SEA"},
        )

        assert chunk.type == ChatChunkType.ELICITATION
        assert chunk.elicitation is not None
        assert chunk.elicitation.tool_call_id == "call_123"
        assert chunk.elicitation.tool_name == "create_trip"
        assert chunk.elicitation.component == "create-trip-form"
        assert chunk.elicitation.prefilled == {"destination_code": "SEA"}

    def test_includes_missing_fields(self):
        """Test factory includes missing_fields when provided."""
        chunk = ChatChunk.elicitation_request(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={},
            missing_fields=["name", "origin_airport"],
        )

        assert chunk.elicitation.missing_fields == ["name", "origin_airport"]

    def test_missing_fields_defaults_to_empty(self):
        """Test missing_fields defaults to empty list when None."""
        chunk = ChatChunk.elicitation_request(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={},
            missing_fields=None,
        )

        assert chunk.elicitation.missing_fields == []

    def test_other_fields_are_none(self):
        """Test that other chunk fields are None for elicitation type."""
        chunk = ChatChunk.elicitation_request(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={},
        )

        assert chunk.content is None
        assert chunk.tool_call is None
        assert chunk.tool_result is None
        assert chunk.rate_limit is None
        assert chunk.error is None
        assert chunk.thread_id is None

    def test_serializes_to_json(self):
        """Test elicitation chunk serializes to JSON correctly."""
        chunk = ChatChunk.elicitation_request(
            tool_call_id="call_123",
            tool_name="create_trip",
            component="create-trip-form",
            prefilled={"destination_code": "SEA"},
            missing_fields=["name"],
        )

        json_str = chunk.model_dump_json()
        data = json.loads(json_str)

        assert data["type"] == "elicitation"
        assert data["elicitation"]["tool_call_id"] == "call_123"
        assert data["elicitation"]["tool_name"] == "create_trip"
        assert data["elicitation"]["component"] == "create-trip-form"
        assert data["elicitation"]["prefilled"] == {"destination_code": "SEA"}
        assert data["elicitation"]["missing_fields"] == ["name"]


# =============================================================================
# ElicitationSubmissionRequest Schema Tests
# =============================================================================


class TestElicitationSubmissionRequestSchema:
    """Tests for ElicitationSubmissionRequest validation."""

    def test_valid_request(self):
        """Test creating valid submission request."""
        thread_id = uuid.uuid4()
        request = ElicitationSubmissionRequest(
            thread_id=thread_id,
            tool_name="create_trip",
            data={
                "name": "Seattle Adventure",
                "origin_airport": "SFO",
                "destination_code": "SEA",
                "depart_date": "2024-06-15",
                "return_date": "2024-06-20",
            },
        )

        assert request.thread_id == thread_id
        assert request.tool_name == "create_trip"
        assert request.data["name"] == "Seattle Adventure"

    def test_empty_tool_name_rejected(self):
        """Test empty tool_name is rejected."""
        with pytest.raises(ValueError):
            ElicitationSubmissionRequest(
                thread_id=uuid.uuid4(),
                tool_name="",
                data={},
            )

    def test_tool_name_max_length(self):
        """Test tool_name over 100 chars is rejected."""
        with pytest.raises(ValueError):
            ElicitationSubmissionRequest(
                thread_id=uuid.uuid4(),
                tool_name="x" * 101,
                data={},
            )

    def test_data_can_be_empty(self):
        """Test data dict can be empty."""
        request = ElicitationSubmissionRequest(
            thread_id=uuid.uuid4(),
            tool_name="list_trips",
            data={},
        )

        assert request.data == {}

    def test_data_with_nested_objects(self):
        """Test data can contain nested objects."""
        request = ElicitationSubmissionRequest(
            thread_id=uuid.uuid4(),
            tool_name="create_trip",
            data={
                "name": "Trip",
                "preferences": {
                    "airlines": ["AA", "UA"],
                    "cabin": "economy",
                },
            },
        )

        assert request.data["preferences"]["airlines"] == ["AA", "UA"]


# =============================================================================
# Exception Tests
# =============================================================================


class TestElicitationExceptions:
    """Tests for elicitation-related exceptions."""

    def test_elicitation_not_found_has_correct_detail(self):
        """Test ElicitationNotFound has correct error detail."""
        exc = ElicitationNotFound()
        assert exc.detail == "Elicitation not found or invalid"

    def test_tool_not_registered_has_correct_detail(self):
        """Test ToolNotRegistered has correct error detail."""
        exc = ToolNotRegistered("unknown_tool")
        assert exc.detail == "Tool not registered: unknown_tool"


# =============================================================================
# Endpoint Integration Tests
# =============================================================================


@pytest.fixture
def elicitation_app(mock_user):
    """Create a FastAPI app with chat router for elicitation testing."""
    from app.core.errors import AppError, problem_details_response
    from app.routers.auth import get_current_user
    from fastapi import Request

    app = FastAPI()
    app.include_router(router)

    # Register exception handler for AppError
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return problem_details_response(exc, request)

    # Override authentication
    async def override_get_current_user():
        from app.routers.auth import UserResponse

        return UserResponse(id=str(mock_user.id), email=mock_user.email)

    app.dependency_overrides[get_current_user] = override_get_current_user

    return app


class TestSubmitElicitationEndpoint:
    """Tests for POST /v1/chat/elicitation/{tool_call_id}."""

    def test_submit_elicitation_returns_sse(self, elicitation_app, mock_user, mock_conversation):
        """Test that submit_elicitation returns SSE content type."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        # Mock conversation service
        with patch.object(
            conversation_service,
            "get_conversation",
            new_callable=AsyncMock,
            return_value=mock_conversation,
        ):
            with patch.object(
                conversation_service,
                "add_message",
                new_callable=AsyncMock,
            ):
                # Mock MCP router
                mock_router = MagicMock()
                mock_router.is_registered.return_value = True
                mock_router.execute = AsyncMock(
                    return_value=ToolResult(
                        success=True,
                        data={"trip_id": str(uuid.uuid4()), "message": "Trip created"},
                    )
                )

                with patch(
                    "app.services.mcp_router.get_mcp_router",
                    return_value=mock_router,
                ):
                    client = TestClient(elicitation_app)
                    response = client.post(
                        "/v1/chat/elicitation/call_123",
                        json={
                            "thread_id": str(mock_conversation.id),
                            "tool_name": "create_trip",
                            "data": {
                                "name": "Seattle Trip",
                                "origin_airport": "SFO",
                                "destination_code": "SEA",
                                "depart_date": "2024-06-15",
                                "return_date": "2024-06-20",
                            },
                        },
                    )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

    def test_submit_elicitation_streams_chunks(self, elicitation_app, mock_user, mock_conversation):
        """Test that submit_elicitation streams tool_result and done chunks."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        trip_id = str(uuid.uuid4())

        with patch.object(
            conversation_service,
            "get_conversation",
            new_callable=AsyncMock,
            return_value=mock_conversation,
        ):
            with patch.object(
                conversation_service,
                "add_message",
                new_callable=AsyncMock,
            ):
                mock_router = MagicMock()
                mock_router.is_registered.return_value = True
                mock_router.execute = AsyncMock(
                    return_value=ToolResult(
                        success=True,
                        data={"trip_id": trip_id, "message": "Trip created"},
                    )
                )

                with patch(
                    "app.services.mcp_router.get_mcp_router",
                    return_value=mock_router,
                ):
                    client = TestClient(elicitation_app)
                    response = client.post(
                        "/v1/chat/elicitation/call_456",
                        json={
                            "thread_id": str(mock_conversation.id),
                            "tool_name": "create_trip",
                            "data": {"name": "Test"},
                        },
                    )

        # Parse SSE events
        lines = response.text.strip().split("\n\n")
        assert len(lines) == 2  # tool_result + done

        # Verify tool_result chunk
        tool_result_data = json.loads(lines[0][6:])  # Remove "data: " prefix
        assert tool_result_data["type"] == "tool_result"
        assert tool_result_data["tool_result"]["tool_call_id"] == "call_456"
        assert tool_result_data["tool_result"]["name"] == "create_trip"
        assert tool_result_data["tool_result"]["success"] is True
        assert tool_result_data["tool_result"]["result"]["trip_id"] == trip_id

        # Verify done chunk
        done_data = json.loads(lines[1][6:])
        assert done_data["type"] == "done"
        assert done_data["thread_id"] == str(mock_conversation.id)

    def test_submit_elicitation_conversation_not_found(self, elicitation_app, mock_user):
        """Test returns 404 when conversation not found."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "get_conversation",
            new_callable=AsyncMock,
            return_value=None,
        ):
            client = TestClient(elicitation_app)
            response = client.post(
                "/v1/chat/elicitation/call_123",
                json={
                    "thread_id": str(uuid.uuid4()),
                    "tool_name": "create_trip",
                    "data": {},
                },
            )

        assert response.status_code == 404

    def test_submit_elicitation_tool_not_registered(self, elicitation_app, mock_user, mock_conversation):
        """Test returns 404 when tool is not registered."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "get_conversation",
            new_callable=AsyncMock,
            return_value=mock_conversation,
        ):
            mock_router = MagicMock()
            mock_router.is_registered.return_value = False

            with patch(
                "app.services.mcp_router.get_mcp_router",
                return_value=mock_router,
            ):
                client = TestClient(elicitation_app)
                response = client.post(
                    "/v1/chat/elicitation/call_123",
                    json={
                        "thread_id": str(mock_conversation.id),
                        "tool_name": "nonexistent_tool",
                        "data": {},
                    },
                )

        assert response.status_code == 404

    def test_submit_elicitation_handles_tool_failure(self, elicitation_app, mock_user, mock_conversation):
        """Test handles tool execution failure gracefully."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "get_conversation",
            new_callable=AsyncMock,
            return_value=mock_conversation,
        ):
            with patch.object(
                conversation_service,
                "add_message",
                new_callable=AsyncMock,
            ):
                mock_router = MagicMock()
                mock_router.is_registered.return_value = True
                mock_router.execute = AsyncMock(
                    return_value=ToolResult(
                        success=False,
                        error="Invalid trip name",
                    )
                )

                with patch(
                    "app.services.mcp_router.get_mcp_router",
                    return_value=mock_router,
                ):
                    client = TestClient(elicitation_app)
                    response = client.post(
                        "/v1/chat/elicitation/call_789",
                        json={
                            "thread_id": str(mock_conversation.id),
                            "tool_name": "create_trip",
                            "data": {"name": ""},
                        },
                    )

        assert response.status_code == 200

        # Parse SSE to verify error is included
        lines = response.text.strip().split("\n\n")
        tool_result_data = json.loads(lines[0][6:])
        assert tool_result_data["tool_result"]["success"] is False
        assert tool_result_data["tool_result"]["result"]["error"] == "Invalid trip name"

    def test_submit_elicitation_saves_to_conversation(self, elicitation_app, mock_user, mock_conversation):
        """Test that tool result is saved to conversation history."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        add_message_mock = AsyncMock()

        with patch.object(
            conversation_service,
            "get_conversation",
            new_callable=AsyncMock,
            return_value=mock_conversation,
        ):
            with patch.object(
                conversation_service,
                "add_message",
                add_message_mock,
            ):
                mock_router = MagicMock()
                mock_router.is_registered.return_value = True
                mock_router.execute = AsyncMock(
                    return_value=ToolResult(
                        success=True,
                        data={"trip_id": "123"},
                    )
                )

                with patch(
                    "app.services.mcp_router.get_mcp_router",
                    return_value=mock_router,
                ):
                    client = TestClient(elicitation_app)
                    client.post(
                        "/v1/chat/elicitation/call_abc",
                        json={
                            "thread_id": str(mock_conversation.id),
                            "tool_name": "create_trip",
                            "data": {"name": "Test"},
                        },
                    )

        # Verify add_message was called
        add_message_mock.assert_called_once()
        call_kwargs = add_message_mock.call_args[1]
        assert call_kwargs["conversation_id"] == mock_conversation.id
        assert call_kwargs["role"] == "tool"
        assert call_kwargs["tool_call_id"] == "call_abc"
        assert call_kwargs["name"] == "create_trip"

    def test_submit_elicitation_validation_error(self, elicitation_app, mock_user):
        """Test validation error for invalid request body."""
        from app.db.deps import get_db

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        client = TestClient(elicitation_app)
        response = client.post(
            "/v1/chat/elicitation/call_123",
            json={
                "thread_id": "not-a-uuid",  # Invalid UUID
                "tool_name": "create_trip",
                "data": {},
            },
        )

        assert response.status_code == 422

    def test_submit_elicitation_has_correct_headers(self, elicitation_app, mock_user, mock_conversation):
        """Test response has correct SSE headers."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        elicitation_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "get_conversation",
            new_callable=AsyncMock,
            return_value=mock_conversation,
        ):
            with patch.object(
                conversation_service,
                "add_message",
                new_callable=AsyncMock,
            ):
                mock_router = MagicMock()
                mock_router.is_registered.return_value = True
                mock_router.execute = AsyncMock(
                    return_value=ToolResult(success=True, data={})
                )

                with patch(
                    "app.services.mcp_router.get_mcp_router",
                    return_value=mock_router,
                ):
                    client = TestClient(elicitation_app)
                    response = client.post(
                        "/v1/chat/elicitation/call_123",
                        json={
                            "thread_id": str(mock_conversation.id),
                            "tool_name": "list_trips",
                            "data": {},
                        },
                    )

        assert response.headers["cache-control"] == "no-cache"
        assert response.headers["x-accel-buffering"] == "no"
