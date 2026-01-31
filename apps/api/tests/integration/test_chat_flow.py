"""Integration tests for full chat flow with tool calls.

Tests the complete tool call loop:
- user message -> assistant (with tool_call) -> tool_result -> assistant (final response)
"""

from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from app.clients.groq import (
    ChatChunk as GroqChatChunk,
)
from app.clients.groq import (
    GroqClient,
    ToolCall,
    ToolCallFunction,
)
from app.clients.groq import (
    Message as GroqMessage,
)
from app.models.user import User
from app.schemas.chat import ChatChunkType
from app.schemas.mcp import ToolResult
from app.services.chat import (
    ChatService,
    process_chat_with_tools,
)
from app.services.mcp_router import MCPRouter


@pytest.fixture
def mock_groq_client():
    """Create a mock Groq client."""
    return MagicMock(spec=GroqClient)


@pytest.fixture
def mock_mcp_router():
    """Create a mock MCP router."""
    router = MagicMock(spec=MCPRouter)
    router.execute_from_json = AsyncMock()
    return router


def make_tool_call(
    tool_id: str,
    name: str,
    arguments: dict[str, Any],
) -> ToolCall:
    """Helper to create a ToolCall object."""
    return ToolCall(
        id=tool_id,
        type="function",
        function=ToolCallFunction(
            name=name,
            arguments=json.dumps(arguments),
        ),
    )


async def mock_streaming_response(
    content: str | None = None,
    tool_calls: list[ToolCall] | None = None,
):
    """Helper to create async generator for mock streaming response."""
    if content:
        yield GroqChatChunk(content=content)

    if tool_calls:
        # Tool calls come at the end of stream
        yield GroqChatChunk(
            tool_calls=tool_calls,
            finish_reason="tool_calls",
        )
    else:
        yield GroqChatChunk(finish_reason="stop")


class TestProcessChatWithToolsSingleTurn:
    """Tests for single-turn chat (no tool calls)."""

    @pytest.mark.anyio
    async def test_simple_response_no_tools(self, mock_groq_client, mock_mcp_router):
        """Test simple response without tool calls."""

        async def stream_response(*args, **kwargs):
            yield GroqChatChunk(content="Hello! ")
            yield GroqChatChunk(content="How can I help?")
            yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_response

        messages = [GroqMessage(role="user", content="Hello")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user-id",
            db=None,
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Should have 2 content chunks
        assert len(chunks) == 2
        assert chunks[0].type == ChatChunkType.CONTENT
        assert chunks[0].content == "Hello! "
        assert chunks[1].type == ChatChunkType.CONTENT
        assert chunks[1].content == "How can I help?"

        # No tool calls should have been made
        mock_mcp_router.execute_from_json.assert_not_called()


class TestProcessChatWithToolsMultiTurn:
    """Tests for multi-turn chat with tool calls."""

    @pytest.mark.anyio
    async def test_single_tool_call_loop(self, mock_groq_client, mock_mcp_router):
        """Test complete tool call loop: user -> assistant (tool) -> result -> assistant."""
        call_count = 0

        async def stream_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                # First response: tool call
                yield GroqChatChunk(content="Let me list your trips.")
                yield GroqChatChunk(
                    tool_calls=[
                        make_tool_call("tc1", "list_trips", {}),
                    ],
                    finish_reason="tool_calls",
                )
            else:
                # Second response: final answer
                yield GroqChatChunk(content="You have 3 trips tracked.")
                yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_response
        mock_mcp_router.execute_from_json.return_value = ToolResult(
            success=True,
            data={"trips": [{"name": "Trip 1"}, {"name": "Trip 2"}, {"name": "Trip 3"}]},
        )

        messages = [GroqMessage(role="user", content="List my trips")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user-id",
            db=None,
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Should have: content, tool_call, tool_result, final content
        content_chunks = [c for c in chunks if c.type == ChatChunkType.CONTENT]
        tool_call_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_CALL]
        tool_result_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_RESULT]

        assert len(content_chunks) == 2
        assert len(tool_call_chunks) == 1
        assert len(tool_result_chunks) == 1

        # Verify tool call chunk
        assert tool_call_chunks[0].tool_call.name == "list_trips"
        assert tool_call_chunks[0].tool_call.id == "tc1"

        # Verify tool result chunk
        assert tool_result_chunks[0].tool_result.success is True
        assert "trips" in tool_result_chunks[0].tool_result.result

        # Verify tool was executed
        mock_mcp_router.execute_from_json.assert_called_once_with("list_trips", "{}", "test-user-id", None)

    @pytest.mark.anyio
    async def test_multiple_tool_calls_in_one_turn(self, mock_groq_client, mock_mcp_router):
        """Test multiple tool calls in a single assistant turn."""
        call_count = 0

        async def stream_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                yield GroqChatChunk(content="Getting trip details...")
                yield GroqChatChunk(
                    tool_calls=[
                        make_tool_call("tc1", "list_trips", {}),
                        make_tool_call("tc2", "get_trip_details", {"trip_id": "abc123"}),
                    ],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="Here are your trips and details.")
                yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_response

        def mock_execute(tool_name: str, args_json: str, user_id: str, db=None):
            if tool_name == "list_trips":
                return ToolResult(success=True, data={"trips": []})
            else:
                return ToolResult(success=True, data={"trip": {"name": "Test"}})

        mock_mcp_router.execute_from_json.side_effect = mock_execute

        messages = [GroqMessage(role="user", content="Show me everything")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user-id",
            db=None,
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Should have 2 tool_call chunks and 2 tool_result chunks
        tool_call_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_CALL]
        tool_result_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_RESULT]

        assert len(tool_call_chunks) == 2
        assert len(tool_result_chunks) == 2

        # Verify both tools were called
        assert mock_mcp_router.execute_from_json.call_count == 2

    @pytest.mark.anyio
    async def test_tool_call_failure_handling(self, mock_groq_client, mock_mcp_router):
        """Test handling of failed tool execution."""
        call_count = 0

        async def stream_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                yield GroqChatChunk(
                    tool_calls=[
                        make_tool_call("tc1", "create_trip", {"name": "Test"}),
                    ],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="Sorry, I couldn't create the trip.")
                yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_response
        mock_mcp_router.execute_from_json.return_value = ToolResult(
            success=False,
            error="Missing required field: origin_airport",
        )

        messages = [GroqMessage(role="user", content="Create trip")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user-id",
            db=None,
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Verify tool result shows failure
        tool_result_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_RESULT]
        assert len(tool_result_chunks) == 1
        assert tool_result_chunks[0].tool_result.success is False
        assert "error" in tool_result_chunks[0].tool_result.result


class TestProcessChatWithToolsLoopLimit:
    """Tests for tool loop limit protection."""

    @pytest.mark.anyio
    async def test_exceeds_max_tool_rounds(self, mock_groq_client, mock_mcp_router):
        """Test that exceeding tool limits produces error chunk.

        Note: With per-tool retry limits (3), calling the same tool repeatedly
        will hit the per-tool limit before the total loop limit (10).
        """

        async def infinite_tool_calls(*args, **kwargs):
            yield GroqChatChunk(content="Calling another tool...")
            yield GroqChatChunk(
                tool_calls=[make_tool_call("tc", "list_trips", {})],
                finish_reason="tool_calls",
            )

        mock_groq_client.chat = infinite_tool_calls
        mock_mcp_router.execute_from_json.return_value = ToolResult(success=True, data={"trips": []})

        messages = [GroqMessage(role="user", content="Loop forever")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user-id",
            db=None,
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Should end with an error chunk about too many calls
        error_chunks = [c for c in chunks if c.type == ChatChunkType.ERROR]
        assert len(error_chunks) >= 1
        # Error should mention either "too many times" (per-tool limit) or "maximum rounds"
        error_text = error_chunks[0].error.lower()
        assert "too many times" in error_text or "maximum rounds" in error_text


class TestChatServiceIntegration:
    """Integration tests for ChatService with full workflow."""

    @pytest_asyncio.fixture
    async def test_user(self, test_session):
        """Create a test user."""
        user = User(
            google_sub="integration_test_user",
            email="integration@example.com",
            name="Integration Test User",
        )
        test_session.add(user)
        await test_session.flush()
        await test_session.refresh(user)
        return user

    @pytest.mark.anyio
    async def test_full_send_message_flow(
        self,
        test_session,
        test_user,
        mock_groq_client,
        mock_mcp_router,
    ):
        """Test complete send_message workflow with persistence."""

        # Mock a simple response
        async def stream_response(*args, **kwargs):
            yield GroqChatChunk(content="I'll help you track that trip.")
            yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_response

        # Mock conversation service
        mock_conv_service = MagicMock()
        mock_conv = MagicMock()
        mock_conv.id = uuid.uuid4()
        mock_conv_service.get_or_create_conversation = AsyncMock(return_value=mock_conv)
        mock_conv_service.add_message = AsyncMock()
        mock_conv_service.get_messages_for_context = AsyncMock(return_value=[])
        mock_conv_service.messages_to_groq_format = MagicMock(return_value=[])
        mock_conv_service.prune_old_messages = AsyncMock()

        service = ChatService(
            conversation_svc=mock_conv_service,
            groq_client_instance=mock_groq_client,
            mcp_router=mock_mcp_router,
        )

        chunks = []
        async for chunk in service.send_message(
            user=test_user,
            message="Track Hawaii trip",
            db=test_session,
        ):
            chunks.append(chunk)

        # Should include content and done chunks
        content_chunks = [c for c in chunks if c.type == ChatChunkType.CONTENT]
        done_chunks = [c for c in chunks if c.type == ChatChunkType.DONE]

        assert len(content_chunks) >= 1
        assert len(done_chunks) == 1

        # First chunk should have thread_id
        assert chunks[0].thread_id == mock_conv.id

        # Conversation service should have been called
        mock_conv_service.get_or_create_conversation.assert_called_once()
        assert mock_conv_service.add_message.call_count >= 1

    @pytest.mark.anyio
    async def test_send_message_with_tool_call_persists_correctly(
        self,
        test_session,
        test_user,
        mock_groq_client,
        mock_mcp_router,
    ):
        """Test that tool calls are properly tracked and persisted."""
        call_count = 0

        async def stream_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                yield GroqChatChunk(
                    tool_calls=[make_tool_call("tc1", "list_trips", {})],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="You have no trips.")
                yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_response
        mock_mcp_router.execute_from_json.return_value = ToolResult(success=True, data={"trips": [], "count": 0})

        mock_conv_service = MagicMock()
        mock_conv = MagicMock()
        mock_conv.id = uuid.uuid4()
        mock_conv_service.get_or_create_conversation = AsyncMock(return_value=mock_conv)
        mock_conv_service.add_message = AsyncMock()
        mock_conv_service.get_messages_for_context = AsyncMock(return_value=[])
        mock_conv_service.messages_to_groq_format = MagicMock(return_value=[])
        mock_conv_service.prune_old_messages = AsyncMock()

        service = ChatService(
            conversation_svc=mock_conv_service,
            groq_client_instance=mock_groq_client,
            mcp_router=mock_mcp_router,
        )

        chunks = []
        async for chunk in service.send_message(
            user=test_user,
            message="List my trips",
            db=test_session,
        ):
            chunks.append(chunk)

        # Verify tool was called
        mock_mcp_router.execute_from_json.assert_called()

        # Verify chunks include tool_call and tool_result
        tool_call_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_CALL]
        tool_result_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_RESULT]
        assert len(tool_call_chunks) >= 1
        assert len(tool_result_chunks) >= 1


class TestChatErrorHandling:
    """Tests for error handling in chat flow."""

    @pytest.mark.anyio
    async def test_groq_client_error_yields_error_chunk(self, mock_groq_client, mock_mcp_router):
        """Test that Groq client errors produce error chunks."""
        from app.clients.groq import GroqClientError

        async def failing_chat(*args, **kwargs):
            raise GroqClientError("API request failed")
            yield  # Make it an async generator

        mock_groq_client.chat = failing_chat

        messages = [GroqMessage(role="user", content="Hello")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user-id",
            db=None,
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Should have error chunk
        error_chunks = [c for c in chunks if c.type == ChatChunkType.ERROR]
        assert len(error_chunks) == 1
        assert "LLM service error" in error_chunks[0].error
