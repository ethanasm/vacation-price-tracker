"""Comprehensive tests for the chat router.

Coverage targets:
- POST /v1/chat/messages: SSE streaming, authentication, validation
- GET /v1/chat/conversations: List conversations
- GET /v1/chat/conversations/{thread_id}: Get conversation history
- DELETE /v1/chat/conversations/{thread_id}: Delete conversation
- Error handling and edge cases
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.trip import Trip
from app.models.user import User
from app.routers.chat import (
    ConversationNotFound,
    _get_user_trips_for_context,
    router,
)
from app.schemas.chat import (
    ChatChunk,
    ChatRequest,
    ConversationResponse,
)
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


@pytest.fixture
def mock_message():
    """Create a mock message."""
    msg = MagicMock(spec=Message)
    msg.id = uuid.uuid4()
    msg.conversation_id = uuid.uuid4()
    msg.role = "user"
    msg.content = "Hello"
    msg.tool_calls = None
    msg.tool_call_id = None
    msg.name = None
    msg.created_at = datetime.now()
    return msg


def make_mock_db_session():
    """Create a mock database session."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


# =============================================================================
# _get_user_trips_for_context Tests
# =============================================================================


class TestGetUserTripsForContext:
    """Tests for the _get_user_trips_for_context helper function."""

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_trips(self):
        """Test returns empty lists when user has no trips."""
        db = make_mock_db_session()

        # Mock empty trip result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute.return_value = mock_result

        trips, prices = await _get_user_trips_for_context(uuid.uuid4(), db)

        assert trips == []
        assert prices == {}

    @pytest.mark.asyncio
    async def test_returns_trips_with_prices(self):
        """Test returns trips and their latest prices."""
        db = make_mock_db_session()
        user_id = uuid.uuid4()

        # Create mock trips
        trip1 = MagicMock(spec=Trip)
        trip1.id = uuid.uuid4()
        trip1.name = "Hawaii"

        trip2 = MagicMock(spec=Trip)
        trip2.id = uuid.uuid4()
        trip2.name = "Paris"

        # Mock trip query result
        trip_result = MagicMock()
        trip_result.scalars.return_value.all.return_value = [trip1, trip2]

        # Mock price query result
        price_row1 = MagicMock()
        price_row1.trip_id = trip1.id
        price_row1.total_price = 1500.00

        price_row2 = MagicMock()
        price_row2.trip_id = trip2.id
        price_row2.total_price = 2000.00

        price_result = MagicMock()
        price_result.__iter__ = lambda self: iter([price_row1, price_row2])

        # Configure execute to return different results
        db.execute = AsyncMock(side_effect=[trip_result, price_result])

        trips, prices = await _get_user_trips_for_context(user_id, db)

        assert len(trips) == 2
        assert trip1 in trips
        assert trip2 in trips
        assert str(trip1.id) in prices
        assert prices[str(trip1.id)] == 1500.00

    @pytest.mark.asyncio
    async def test_handles_trips_without_prices(self):
        """Test handles trips that don't have price snapshots."""
        db = make_mock_db_session()
        user_id = uuid.uuid4()

        # Create mock trip
        trip = MagicMock(spec=Trip)
        trip.id = uuid.uuid4()
        trip.name = "New Trip"

        # Mock trip query result
        trip_result = MagicMock()
        trip_result.scalars.return_value.all.return_value = [trip]

        # Mock empty price result
        price_result = MagicMock()
        price_result.__iter__ = lambda self: iter([])

        db.execute = AsyncMock(side_effect=[trip_result, price_result])

        trips, prices = await _get_user_trips_for_context(user_id, db)

        assert len(trips) == 1
        assert prices == {}

    @pytest.mark.asyncio
    async def test_handles_null_total_price(self):
        """Test filters out trips with null total_price."""
        db = make_mock_db_session()
        user_id = uuid.uuid4()

        trip = MagicMock(spec=Trip)
        trip.id = uuid.uuid4()

        trip_result = MagicMock()
        trip_result.scalars.return_value.all.return_value = [trip]

        # Price row with None total
        price_row = MagicMock()
        price_row.trip_id = trip.id
        price_row.total_price = None

        price_result = MagicMock()
        price_result.__iter__ = lambda self: iter([price_row])

        db.execute = AsyncMock(side_effect=[trip_result, price_result])

        trips, prices = await _get_user_trips_for_context(user_id, db)

        assert len(trips) == 1
        assert prices == {}  # Null price should be filtered out


# =============================================================================
# ConversationNotFound Exception Tests
# =============================================================================


class TestConversationNotFound:
    """Tests for the ConversationNotFound exception."""

    def test_has_correct_detail(self):
        """Test exception has correct error detail."""
        exc = ConversationNotFound()
        assert exc.detail == "Conversation not found"


# =============================================================================
# ChatRequest Schema Tests
# =============================================================================


class TestChatRequestSchema:
    """Tests for ChatRequest validation."""

    def test_valid_message_only(self):
        """Test valid request with message only."""
        request = ChatRequest(message="Hello")

        assert request.message == "Hello"
        assert request.thread_id is None

    def test_valid_with_thread_id(self):
        """Test valid request with thread_id."""
        thread_id = uuid.uuid4()
        request = ChatRequest(message="Hello", thread_id=thread_id)

        assert request.message == "Hello"
        assert request.thread_id == thread_id

    def test_empty_message_rejected(self):
        """Test empty message is rejected."""
        with pytest.raises(ValueError):
            ChatRequest(message="")

    def test_message_too_long_rejected(self):
        """Test message over 10000 chars is rejected."""
        with pytest.raises(ValueError):
            ChatRequest(message="x" * 10001)

    def test_max_length_message_accepted(self):
        """Test message at max length is accepted."""
        request = ChatRequest(message="x" * 10000)
        assert len(request.message) == 10000


# =============================================================================
# Integration Tests with FastAPI TestClient
# =============================================================================


@pytest.fixture
def chat_app(mock_user):
    """Create a FastAPI app with chat router for testing."""
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


class TestListConversationsEndpoint:
    """Tests for GET /v1/chat/conversations."""

    def test_list_empty_conversations(self, chat_app, mock_user):
        """Test listing conversations when user has none."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        # Mock dependencies
        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        # Mock conversation service
        with patch.object(
            conversation_service,
            "list_conversations",
            new_callable=AsyncMock,
            return_value=[],
        ):
            client = TestClient(chat_app)
            response = client.get("/v1/chat/conversations")

        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []

    def test_list_conversations_with_results(self, chat_app, mock_user, mock_conversation):
        """Test listing conversations returns results."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "list_conversations",
            new_callable=AsyncMock,
            return_value=[mock_conversation],
        ):
            client = TestClient(chat_app)
            response = client.get("/v1/chat/conversations")

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["id"] == str(mock_conversation.id)
        assert data["data"][0]["title"] == mock_conversation.title

    def test_list_conversations_with_pagination(self, chat_app, mock_user):
        """Test listing conversations with pagination parameters."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "list_conversations",
            new_callable=AsyncMock,
            return_value=[],
        ) as mock_list:
            client = TestClient(chat_app)
            response = client.get("/v1/chat/conversations?limit=5&offset=10")

        assert response.status_code == 200
        mock_list.assert_called_once()
        call_kwargs = mock_list.call_args
        assert call_kwargs[1]["limit"] == 5
        assert call_kwargs[1]["offset"] == 10


class TestGetConversationEndpoint:
    """Tests for GET /v1/chat/conversations/{thread_id}."""

    def test_get_existing_conversation(self, chat_app, mock_user, mock_conversation, mock_message):
        """Test getting an existing conversation with messages."""
        from app.db.deps import get_db
        from app.services.chat import chat_service

        mock_db = make_mock_db_session()

        # Mock user query
        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        with patch.object(
            chat_service,
            "get_conversation_history",
            new_callable=AsyncMock,
            return_value=(mock_conversation, [mock_message]),
        ):
            client = TestClient(chat_app)
            response = client.get(f"/v1/chat/conversations/{mock_conversation.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["conversation"]["id"] == str(mock_conversation.id)
        assert len(data["data"]["messages"]) == 1

    def test_get_nonexistent_conversation(self, chat_app, mock_user):
        """Test getting a non-existent conversation returns 404."""
        from app.db.deps import get_db
        from app.services.chat import chat_service

        mock_db = make_mock_db_session()

        # Mock user query
        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        with patch.object(
            chat_service,
            "get_conversation_history",
            new_callable=AsyncMock,
            return_value=(None, []),
        ):
            client = TestClient(chat_app)
            response = client.get(f"/v1/chat/conversations/{uuid.uuid4()}")

        assert response.status_code == 404

    def test_get_conversation_user_not_found(self, chat_app, mock_user):
        """Test returns 404 when user not in database."""
        from app.db.deps import get_db

        mock_db = make_mock_db_session()

        # Mock user query returning None
        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        client = TestClient(chat_app)
        response = client.get(f"/v1/chat/conversations/{uuid.uuid4()}")

        assert response.status_code == 404


class TestDeleteConversationEndpoint:
    """Tests for DELETE /v1/chat/conversations/{thread_id}."""

    def test_delete_existing_conversation(self, chat_app, mock_user):
        """Test deleting an existing conversation."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "delete_conversation",
            new_callable=AsyncMock,
            return_value=True,
        ):
            client = TestClient(chat_app)
            response = client.delete(f"/v1/chat/conversations/{uuid.uuid4()}")

        assert response.status_code == 204
        mock_db.commit.assert_called_once()

    def test_delete_nonexistent_conversation(self, chat_app, mock_user):
        """Test deleting a non-existent conversation returns 404."""
        from app.db.deps import get_db
        from app.services.conversation import conversation_service

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        with patch.object(
            conversation_service,
            "delete_conversation",
            new_callable=AsyncMock,
            return_value=False,
        ):
            client = TestClient(chat_app)
            response = client.delete(f"/v1/chat/conversations/{uuid.uuid4()}")

        assert response.status_code == 404


class TestSendMessageEndpoint:
    """Tests for POST /v1/chat/messages."""

    def test_send_message_returns_sse(self, chat_app, mock_user):
        """Test that send_message returns SSE content type."""
        from app.db.deps import get_db
        from app.services.chat import chat_service

        mock_db = make_mock_db_session()

        # Mock user query
        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        # Mock chat service to yield some chunks
        async def mock_send_message(*args, **kwargs):
            yield ChatChunk.text("Hello")
            yield ChatChunk.done_chunk(thread_id=uuid.uuid4())

        with patch.object(chat_service, "send_message", mock_send_message):
            # Also mock _get_user_trips_for_context
            with patch(
                "app.routers.chat._get_user_trips_for_context",
                new_callable=AsyncMock,
                return_value=([], {}),
            ):
                client = TestClient(chat_app)
                response = client.post(
                    "/v1/chat/messages",
                    json={"message": "Hello"},
                )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

    def test_send_message_streams_chunks(self, chat_app, mock_user):
        """Test that send_message streams SSE chunks."""
        from app.db.deps import get_db
        from app.services.chat import chat_service

        mock_db = make_mock_db_session()

        # Mock user query
        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        conv_id = uuid.uuid4()

        async def mock_send_message(*args, **kwargs):
            yield ChatChunk.text("Hello ")
            yield ChatChunk.text("world!")
            yield ChatChunk.done_chunk(thread_id=conv_id)

        with patch.object(chat_service, "send_message", mock_send_message):
            with patch(
                "app.routers.chat._get_user_trips_for_context",
                new_callable=AsyncMock,
                return_value=([], {}),
            ):
                client = TestClient(chat_app)
                response = client.post(
                    "/v1/chat/messages",
                    json={"message": "Hello"},
                )

        # Parse SSE events
        lines = response.text.strip().split("\n\n")
        assert len(lines) == 3  # 2 content + 1 done

        for line in lines:
            assert line.startswith("data: ")
            data = json.loads(line[6:])
            assert "type" in data

    def test_send_message_with_thread_id(self, chat_app, mock_user):
        """Test sending message with existing thread_id."""
        from app.db.deps import get_db
        from app.services.chat import chat_service

        mock_db = make_mock_db_session()

        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        thread_id = uuid.uuid4()
        captured_kwargs = {}

        async def mock_send_message(*args, **kwargs):
            captured_kwargs.update(kwargs)
            yield ChatChunk.done_chunk(thread_id=thread_id)

        with patch.object(chat_service, "send_message", mock_send_message):
            with patch(
                "app.routers.chat._get_user_trips_for_context",
                new_callable=AsyncMock,
                return_value=([], {}),
            ):
                client = TestClient(chat_app)
                response = client.post(
                    "/v1/chat/messages",
                    json={"message": "Continue", "thread_id": str(thread_id)},
                )

        assert response.status_code == 200
        assert captured_kwargs.get("thread_id") == thread_id

    def test_send_message_user_not_found(self, chat_app, mock_user):
        """Test returns 404 when user not in database."""
        from app.db.deps import get_db

        mock_db = make_mock_db_session()

        # Mock user query returning None
        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        client = TestClient(chat_app)
        response = client.post(
            "/v1/chat/messages",
            json={"message": "Hello"},
        )

        assert response.status_code == 404

    def test_send_message_validation_error(self, chat_app, mock_user):
        """Test validation error for invalid request."""
        from app.db.deps import get_db

        mock_db = make_mock_db_session()

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        client = TestClient(chat_app)
        response = client.post(
            "/v1/chat/messages",
            json={"message": ""},  # Empty message
        )

        assert response.status_code == 422

    def test_send_message_headers(self, chat_app, mock_user):
        """Test response has correct SSE headers."""
        from app.db.deps import get_db
        from app.services.chat import chat_service

        mock_db = make_mock_db_session()

        user_result = MagicMock()
        user_result.scalars.return_value.first.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=user_result)

        async def override_db():
            yield mock_db

        chat_app.dependency_overrides[get_db] = override_db

        async def mock_send_message(*args, **kwargs):
            yield ChatChunk.done_chunk()

        with patch.object(chat_service, "send_message", mock_send_message):
            with patch(
                "app.routers.chat._get_user_trips_for_context",
                new_callable=AsyncMock,
                return_value=([], {}),
            ):
                client = TestClient(chat_app)
                response = client.post(
                    "/v1/chat/messages",
                    json={"message": "Hello"},
                )

        assert response.headers["cache-control"] == "no-cache"
        assert response.headers["x-accel-buffering"] == "no"


# =============================================================================
# ConversationResponse Schema Tests
# =============================================================================


class TestConversationResponseSchema:
    """Tests for ConversationResponse schema."""

    def test_serializes_correctly(self):
        """Test ConversationResponse serializes all fields."""
        conv_id = uuid.uuid4()
        now = datetime.now()

        response = ConversationResponse(
            id=conv_id,
            title="My Conversation",
            created_at=now,
            updated_at=now,
        )

        data = response.model_dump()
        assert data["id"] == conv_id
        assert data["title"] == "My Conversation"
        assert data["created_at"] == now
        assert data["updated_at"] == now

    def test_title_can_be_none(self):
        """Test ConversationResponse allows null title."""
        now = datetime.now()
        response = ConversationResponse(
            id=uuid.uuid4(),
            title=None,
            created_at=now,
            updated_at=now,
        )

        assert response.title is None
