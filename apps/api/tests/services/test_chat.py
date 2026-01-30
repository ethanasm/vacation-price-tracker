"""Comprehensive tests for the chat service.

Coverage targets:
- process_chat_with_tools: streaming, tool execution, error handling
- ChatService: message flow, conversation management, persistence
- Edge cases: tool loops, LLM errors, database failures
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.clients.groq import (
    ChatChunk as GroqChatChunk,
)
from app.clients.groq import (
    GroqClient,
    GroqRateLimitError,
    Tool,
    ToolCall,
    ToolCallFunction,
)
from app.clients.groq import (
    Message as GroqMessage,
)
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import ChatChunk, ChatChunkType
from app.schemas.mcp import ToolResult
from app.services.chat import (
    MAX_TOOL_ROUNDS,
    ChatService,
    _convert_db_messages_to_groq,
    _convert_tools_to_groq_format,
    _tool_calls_to_dict,
    process_chat_with_tools,
)
from app.services.conversation import ConversationService
from app.services.mcp_router import MCPRouter

# =============================================================================
# Helper Functions
# =============================================================================


def make_user(user_id: uuid.UUID | None = None, email: str = "test@example.com") -> User:
    """Create a mock User for testing."""
    user = MagicMock(spec=User)
    user.id = user_id or uuid.uuid4()
    user.email = email
    user.created_at = datetime.now()
    return user


def make_conversation(
    conv_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
) -> Conversation:
    """Create a mock Conversation for testing."""
    conv = MagicMock(spec=Conversation)
    conv.id = conv_id or uuid.uuid4()
    conv.user_id = user_id or uuid.uuid4()
    conv.title = None
    conv.created_at = datetime.now()
    conv.updated_at = datetime.now()
    return conv


def make_message(
    role: str = "user",
    content: str = "Hello",
    tool_calls: list[dict[str, Any]] | None = None,
    tool_call_id: str | None = None,
    name: str | None = None,
) -> Message:
    """Create a mock Message for testing."""
    msg = MagicMock(spec=Message)
    msg.id = uuid.uuid4()
    msg.conversation_id = uuid.uuid4()
    msg.role = role
    msg.content = content
    msg.tool_calls = tool_calls
    msg.tool_call_id = tool_call_id
    msg.name = name
    msg.created_at = datetime.now()
    return msg


async def collect_chunks(gen) -> list[ChatChunk]:
    """Collect all chunks from an async generator."""
    chunks = []
    async for chunk in gen:
        chunks.append(chunk)
    return chunks


# =============================================================================
# Helper Function Tests
# =============================================================================


class TestConvertToolsToGroqFormat:
    """Tests for _convert_tools_to_groq_format."""

    def test_returns_list_of_tools(self):
        """Test that the function returns a list of Tool objects."""
        tools = _convert_tools_to_groq_format()

        assert isinstance(tools, list)
        assert len(tools) > 0
        assert all(isinstance(t, Tool) for t in tools)

    def test_tools_have_correct_structure(self):
        """Test that converted tools have the correct structure."""
        tools = _convert_tools_to_groq_format()

        for tool in tools:
            assert tool.type == "function"
            assert "name" in tool.function
            assert "description" in tool.function
            assert "parameters" in tool.function


class TestConvertDbMessagesToGroq:
    """Tests for _convert_db_messages_to_groq."""

    def test_empty_list(self):
        """Test converting empty list."""
        result = _convert_db_messages_to_groq([])
        assert result == []

    def test_single_user_message(self):
        """Test converting a single user message."""
        msg = make_message(role="user", content="Hello")
        result = _convert_db_messages_to_groq([msg])

        assert len(result) == 1
        assert result[0].role == "user"
        assert result[0].content == "Hello"

    def test_message_with_tool_calls(self):
        """Test converting message with tool calls."""
        tool_calls = [{"id": "call_1", "type": "function", "function": {"name": "test", "arguments": "{}"}}]
        msg = make_message(role="assistant", content="", tool_calls=tool_calls)
        result = _convert_db_messages_to_groq([msg])

        assert len(result) == 1
        assert result[0].tool_calls == tool_calls

    def test_tool_result_message(self):
        """Test converting tool result message."""
        msg = make_message(
            role="tool",
            content='{"result": "data"}',
            tool_call_id="call_1",
            name="list_trips",
        )
        result = _convert_db_messages_to_groq([msg])

        assert len(result) == 1
        assert result[0].role == "tool"
        assert result[0].tool_call_id == "call_1"
        assert result[0].name == "list_trips"

    def test_multiple_messages(self):
        """Test converting multiple messages preserves order."""
        messages = [
            make_message(role="user", content="First"),
            make_message(role="assistant", content="Second"),
            make_message(role="user", content="Third"),
        ]
        result = _convert_db_messages_to_groq(messages)

        assert len(result) == 3
        assert result[0].content == "First"
        assert result[1].content == "Second"
        assert result[2].content == "Third"


class TestToolCallsToDict:
    """Tests for _tool_calls_to_dict."""

    def test_empty_list(self):
        """Test converting empty list."""
        result = _tool_calls_to_dict([])
        assert result == []

    def test_single_tool_call(self):
        """Test converting a single tool call."""
        tc = ToolCall(
            id="call_abc",
            type="function",
            function=ToolCallFunction(name="list_trips", arguments="{}"),
        )
        result = _tool_calls_to_dict([tc])

        assert len(result) == 1
        assert result[0]["id"] == "call_abc"
        assert result[0]["type"] == "function"
        assert result[0]["function"]["name"] == "list_trips"
        assert result[0]["function"]["arguments"] == "{}"

    def test_multiple_tool_calls(self):
        """Test converting multiple tool calls."""
        calls = [
            ToolCall(
                id="call_1",
                type="function",
                function=ToolCallFunction(name="list_trips", arguments="{}"),
            ),
            ToolCall(
                id="call_2",
                type="function",
                function=ToolCallFunction(
                    name="get_trip_details",
                    arguments='{"trip_id": "123"}',
                ),
            ),
        ]
        result = _tool_calls_to_dict(calls)

        assert len(result) == 2
        assert result[0]["function"]["name"] == "list_trips"
        assert result[1]["function"]["name"] == "get_trip_details"


# =============================================================================
# process_chat_with_tools Tests
# =============================================================================


class TestProcessChatWithTools:
    """Tests for the process_chat_with_tools async generator."""

    @pytest.mark.asyncio
    async def test_simple_text_response(self):
        """Test processing a message that returns only text."""
        mock_client = MagicMock(spec=GroqClient)
        mock_router = MagicMock(spec=MCPRouter)

        # Mock streaming response with text only
        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(content="Hello ")
            yield GroqChatChunk(content="there!")
            yield GroqChatChunk(finish_reason="stop")

        mock_client.chat = mock_chat

        messages = [GroqMessage(role="user", content="Hi")]
        chunks = await collect_chunks(
            process_chat_with_tools(
                messages=messages,
                user_id="user-123",
                db=None,
                client=mock_client,
                router=mock_router,
            )
        )

        # Should have 2 content chunks
        content_chunks = [c for c in chunks if c.type == ChatChunkType.CONTENT]
        assert len(content_chunks) == 2
        assert content_chunks[0].content == "Hello "
        assert content_chunks[1].content == "there!"

    @pytest.mark.asyncio
    async def test_response_with_tool_call(self):
        """Test processing a response with tool call and result."""
        mock_client = MagicMock(spec=GroqClient)
        mock_router = MagicMock(spec=MCPRouter)

        call_count = [0]

        async def mock_chat(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # First call: LLM makes a tool call
                yield GroqChatChunk(content="Let me check that.")
                yield GroqChatChunk(
                    tool_calls=[
                        ToolCall(
                            id="call_123",
                            type="function",
                            function=ToolCallFunction(name="list_trips", arguments="{}"),
                        )
                    ],
                    finish_reason="tool_calls",
                )
            else:
                # Second call: LLM responds after tool result
                yield GroqChatChunk(content="You have 2 trips.")
                yield GroqChatChunk(finish_reason="stop")

        mock_client.chat = mock_chat

        # Mock router to return a successful tool result
        mock_router.execute_from_json = AsyncMock(
            return_value=ToolResult(
                success=True,
                data={"trips": [{"name": "Hawaii"}, {"name": "Paris"}], "count": 2},
            )
        )

        messages = [GroqMessage(role="user", content="List my trips")]
        chunks = await collect_chunks(
            process_chat_with_tools(
                messages=messages,
                user_id="user-123",
                db=None,
                client=mock_client,
                router=mock_router,
            )
        )

        # Should have content, tool_call, tool_result, and more content
        types = [c.type for c in chunks]
        assert ChatChunkType.CONTENT in types
        assert ChatChunkType.TOOL_CALL in types
        assert ChatChunkType.TOOL_RESULT in types

        # Verify tool call chunk
        tool_call_chunk = next(c for c in chunks if c.type == ChatChunkType.TOOL_CALL)
        assert tool_call_chunk.tool_call.name == "list_trips"
        assert tool_call_chunk.tool_call.id == "call_123"

        # Verify tool result chunk
        tool_result_chunk = next(c for c in chunks if c.type == ChatChunkType.TOOL_RESULT)
        assert tool_result_chunk.tool_result.success is True
        assert tool_result_chunk.tool_result.name == "list_trips"

    @pytest.mark.asyncio
    async def test_tool_call_with_failure(self):
        """Test handling tool execution failure."""
        mock_client = MagicMock(spec=GroqClient)
        mock_router = MagicMock(spec=MCPRouter)

        call_count = [0]

        async def mock_chat(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                yield GroqChatChunk(
                    tool_calls=[
                        ToolCall(
                            id="call_fail",
                            type="function",
                            function=ToolCallFunction(
                                name="get_trip_details",
                                arguments='{"trip_id": "invalid"}',
                            ),
                        )
                    ],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="I couldn't find that trip.")
                yield GroqChatChunk(finish_reason="stop")

        mock_client.chat = mock_chat

        # Mock router to return a failure
        mock_router.execute_from_json = AsyncMock(return_value=ToolResult(success=False, error="Trip not found"))

        messages = [GroqMessage(role="user", content="Show trip details")]
        chunks = await collect_chunks(
            process_chat_with_tools(
                messages=messages,
                user_id="user-123",
                db=None,
                client=mock_client,
                router=mock_router,
            )
        )

        # Verify tool result shows failure
        tool_result_chunk = next(c for c in chunks if c.type == ChatChunkType.TOOL_RESULT)
        assert tool_result_chunk.tool_result.success is False
        assert "error" in tool_result_chunk.tool_result.result

    @pytest.mark.asyncio
    async def test_groq_client_error(self):
        """Test handling GroqClientError."""
        mock_client = MagicMock(spec=GroqClient)
        mock_router = MagicMock(spec=MCPRouter)

        async def mock_chat(*args, **kwargs):
            # Need to be an async generator that raises during iteration
            if False:
                yield  # Make this an async generator
            raise GroqRateLimitError("Rate limited", retry_after=30)

        mock_client.chat = mock_chat

        messages = [GroqMessage(role="user", content="Hi")]
        chunks = await collect_chunks(
            process_chat_with_tools(
                messages=messages,
                user_id="user-123",
                db=None,
                client=mock_client,
                router=mock_router,
            )
        )

        # Should have error chunk with user-friendly rate limit message
        error_chunks = [c for c in chunks if c.type == ChatChunkType.ERROR]
        assert len(error_chunks) == 1
        assert "AI service is currently busy" in error_chunks[0].error

    @pytest.mark.asyncio
    async def test_tool_loop_limit(self):
        """Test that tool loop is limited to prevent infinite loops."""
        mock_client = MagicMock(spec=GroqClient)
        mock_router = MagicMock(spec=MCPRouter)

        # Always return a tool call to trigger the loop limit
        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(
                tool_calls=[
                    ToolCall(
                        id=f"call_{uuid.uuid4()}",
                        type="function",
                        function=ToolCallFunction(name="list_trips", arguments="{}"),
                    )
                ],
                finish_reason="tool_calls",
            )

        mock_client.chat = mock_chat
        mock_router.execute_from_json = AsyncMock(return_value=ToolResult(success=True, data={"trips": []}))

        messages = [GroqMessage(role="user", content="Loop forever")]
        chunks = await collect_chunks(
            process_chat_with_tools(
                messages=messages,
                user_id="user-123",
                db=None,
                client=mock_client,
                router=mock_router,
            )
        )

        # Should end with an error about exceeding max rounds
        error_chunks = [c for c in chunks if c.type == ChatChunkType.ERROR]
        assert len(error_chunks) == 1
        assert "maximum rounds" in error_chunks[0].error.lower()

        # Router should have been called MAX_TOOL_ROUNDS times
        assert mock_router.execute_from_json.call_count == MAX_TOOL_ROUNDS

    @pytest.mark.asyncio
    async def test_multiple_tool_calls_in_one_turn(self):
        """Test handling multiple tool calls in a single LLM response."""
        mock_client = MagicMock(spec=GroqClient)
        mock_router = MagicMock(spec=MCPRouter)

        call_count = [0]

        async def mock_chat(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                yield GroqChatChunk(
                    tool_calls=[
                        ToolCall(
                            id="call_1",
                            type="function",
                            function=ToolCallFunction(name="list_trips", arguments="{}"),
                        ),
                        ToolCall(
                            id="call_2",
                            type="function",
                            function=ToolCallFunction(name="trigger_refresh", arguments="{}"),
                        ),
                    ],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="Done with both tasks.")
                yield GroqChatChunk(finish_reason="stop")

        mock_client.chat = mock_chat
        mock_router.execute_from_json = AsyncMock(return_value=ToolResult(success=True, data={"result": "ok"}))

        messages = [GroqMessage(role="user", content="Do two things")]
        chunks = await collect_chunks(
            process_chat_with_tools(
                messages=messages,
                user_id="user-123",
                db=None,
                client=mock_client,
                router=mock_router,
            )
        )

        # Should have 2 tool call chunks and 2 tool result chunks
        tool_call_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_CALL]
        tool_result_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_RESULT]

        assert len(tool_call_chunks) == 2
        assert len(tool_result_chunks) == 2
        assert mock_router.execute_from_json.call_count == 2

    @pytest.mark.asyncio
    async def test_empty_content_handling(self):
        """Test handling responses with no content (only tool calls)."""
        mock_client = MagicMock(spec=GroqClient)
        mock_router = MagicMock(spec=MCPRouter)

        call_count = [0]

        async def mock_chat(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # No content, just tool call
                yield GroqChatChunk(
                    tool_calls=[
                        ToolCall(
                            id="call_1",
                            type="function",
                            function=ToolCallFunction(name="list_trips", arguments="{}"),
                        )
                    ],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="Here are your trips.")
                yield GroqChatChunk(finish_reason="stop")

        mock_client.chat = mock_chat
        mock_router.execute_from_json = AsyncMock(return_value=ToolResult(success=True, data={"trips": []}))

        messages = [GroqMessage(role="user", content="List trips")]
        chunks = await collect_chunks(
            process_chat_with_tools(
                messages=messages,
                user_id="user-123",
                db=None,
                client=mock_client,
                router=mock_router,
            )
        )

        # Should complete without error
        content_chunks = [c for c in chunks if c.type == ChatChunkType.CONTENT]
        assert len(content_chunks) >= 1


# =============================================================================
# ChatService Tests
# =============================================================================


class TestChatService:
    """Tests for the ChatService class."""

    def test_initialization_with_defaults(self):
        """Test ChatService initializes with default dependencies."""
        service = ChatService()

        assert service._conversation_svc is not None
        assert service._groq_client is not None
        assert service._mcp_router is not None

    def test_initialization_with_custom_deps(self):
        """Test ChatService accepts custom dependencies."""
        conv_svc = MagicMock(spec=ConversationService)
        groq = MagicMock(spec=GroqClient)
        router = MagicMock(spec=MCPRouter)

        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=groq,
            mcp_router=router,
        )

        assert service._conversation_svc is conv_svc
        assert service._groq_client is groq
        assert service._mcp_router is router

    @pytest.mark.asyncio
    async def test_send_message_creates_conversation(self):
        """Test that send_message creates a new conversation when needed."""
        # Set up mocks
        conv_svc = MagicMock(spec=ConversationService)
        groq = MagicMock(spec=GroqClient)
        router = MagicMock(spec=MCPRouter)
        db = AsyncMock()

        conversation = make_conversation()
        conv_svc.get_or_create_conversation = AsyncMock(return_value=conversation)
        conv_svc.add_message = AsyncMock(return_value=make_message())
        conv_svc.get_messages_for_context = AsyncMock(return_value=[])
        conv_svc.messages_to_groq_format = MagicMock(return_value=[])
        conv_svc.prune_old_messages = AsyncMock(return_value=0)

        # Mock simple LLM response
        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(content="Hello!")
            yield GroqChatChunk(finish_reason="stop")

        groq.chat = mock_chat

        user = make_user()
        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=groq,
            mcp_router=router,
        )

        await collect_chunks(
            service.send_message(
                user=user,
                message="Hi",
                db=db,
                thread_id=None,
            )
        )

        # Verify conversation was created
        conv_svc.get_or_create_conversation.assert_called_once()
        assert conv_svc.get_or_create_conversation.call_args[0][0] is None  # thread_id

        # Verify user message was saved
        assert conv_svc.add_message.call_count >= 1
        first_add_call = conv_svc.add_message.call_args_list[0]
        assert first_add_call[1]["role"] == "user"
        assert first_add_call[1]["content"] == "Hi"

    @pytest.mark.asyncio
    async def test_send_message_uses_existing_conversation(self):
        """Test that send_message uses existing thread_id."""
        conv_svc = MagicMock(spec=ConversationService)
        groq = MagicMock(spec=GroqClient)
        router = MagicMock(spec=MCPRouter)
        db = AsyncMock()

        existing_conv_id = uuid.uuid4()
        conversation = make_conversation(conv_id=existing_conv_id)
        conv_svc.get_or_create_conversation = AsyncMock(return_value=conversation)
        conv_svc.add_message = AsyncMock(return_value=make_message())
        conv_svc.get_messages_for_context = AsyncMock(return_value=[])
        conv_svc.messages_to_groq_format = MagicMock(return_value=[])
        conv_svc.prune_old_messages = AsyncMock(return_value=0)

        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(content="Response")
            yield GroqChatChunk(finish_reason="stop")

        groq.chat = mock_chat

        user = make_user()
        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=groq,
            mcp_router=router,
        )

        await collect_chunks(
            service.send_message(
                user=user,
                message="Continue",
                db=db,
                thread_id=existing_conv_id,
            )
        )

        # Verify existing thread_id was passed
        conv_svc.get_or_create_conversation.assert_called_once()
        assert conv_svc.get_or_create_conversation.call_args[0][0] == existing_conv_id

    @pytest.mark.asyncio
    async def test_send_message_includes_thread_id_in_chunks(self):
        """Test that thread_id is included in first and last chunks."""
        conv_svc = MagicMock(spec=ConversationService)
        groq = MagicMock(spec=GroqClient)
        router = MagicMock(spec=MCPRouter)
        db = AsyncMock()

        conv_id = uuid.uuid4()
        conversation = make_conversation(conv_id=conv_id)
        conv_svc.get_or_create_conversation = AsyncMock(return_value=conversation)
        conv_svc.add_message = AsyncMock(return_value=make_message())
        conv_svc.get_messages_for_context = AsyncMock(return_value=[])
        conv_svc.messages_to_groq_format = MagicMock(return_value=[])
        conv_svc.prune_old_messages = AsyncMock(return_value=0)

        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(content="Hello")
            yield GroqChatChunk(finish_reason="stop")

        groq.chat = mock_chat

        user = make_user()
        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=groq,
            mcp_router=router,
        )

        chunks = await collect_chunks(service.send_message(user=user, message="Hi", db=db))

        # First content chunk should have thread_id
        first_chunk = chunks[0]
        assert first_chunk.thread_id == conv_id

        # Last chunk (done) should have thread_id
        done_chunks = [c for c in chunks if c.type == ChatChunkType.DONE]
        assert len(done_chunks) == 1
        assert done_chunks[0].thread_id == conv_id

    @pytest.mark.asyncio
    async def test_send_message_saves_assistant_response(self):
        """Test that assistant response is saved to database."""
        conv_svc = MagicMock(spec=ConversationService)
        groq = MagicMock(spec=GroqClient)
        router = MagicMock(spec=MCPRouter)
        db = AsyncMock()

        conversation = make_conversation()
        conv_svc.get_or_create_conversation = AsyncMock(return_value=conversation)
        conv_svc.add_message = AsyncMock(return_value=make_message())
        conv_svc.get_messages_for_context = AsyncMock(return_value=[])
        conv_svc.messages_to_groq_format = MagicMock(return_value=[])
        conv_svc.prune_old_messages = AsyncMock(return_value=0)

        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(content="Hello ")
            yield GroqChatChunk(content="world!")
            yield GroqChatChunk(finish_reason="stop")

        groq.chat = mock_chat

        user = make_user()
        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=groq,
            mcp_router=router,
        )

        await collect_chunks(service.send_message(user=user, message="Hi", db=db))

        # Should have saved user message and assistant message
        assert conv_svc.add_message.call_count == 2

        # Second call should be assistant message with full content
        assistant_call = conv_svc.add_message.call_args_list[1]
        assert assistant_call[1]["role"] == "assistant"
        assert assistant_call[1]["content"] == "Hello world!"

    @pytest.mark.asyncio
    async def test_send_message_commits_on_success(self):
        """Test that database is committed on successful completion."""
        conv_svc = MagicMock(spec=ConversationService)
        groq = MagicMock(spec=GroqClient)
        router = MagicMock(spec=MCPRouter)
        db = AsyncMock()

        conversation = make_conversation()
        conv_svc.get_or_create_conversation = AsyncMock(return_value=conversation)
        conv_svc.add_message = AsyncMock(return_value=make_message())
        conv_svc.get_messages_for_context = AsyncMock(return_value=[])
        conv_svc.messages_to_groq_format = MagicMock(return_value=[])
        conv_svc.prune_old_messages = AsyncMock(return_value=0)

        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(content="Done")
            yield GroqChatChunk(finish_reason="stop")

        groq.chat = mock_chat

        user = make_user()
        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=groq,
            mcp_router=router,
        )

        await collect_chunks(service.send_message(user=user, message="Hi", db=db))

        # Verify commit was called
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_message_rollback_on_error(self):
        """Test that database is rolled back on error."""
        conv_svc = MagicMock(spec=ConversationService)
        groq = MagicMock(spec=GroqClient)
        router = MagicMock(spec=MCPRouter)
        db = AsyncMock()

        conversation = make_conversation()
        conv_svc.get_or_create_conversation = AsyncMock(return_value=conversation)
        conv_svc.add_message = AsyncMock(return_value=make_message())
        conv_svc.get_messages_for_context = AsyncMock(return_value=[])
        conv_svc.messages_to_groq_format = MagicMock(return_value=[])
        # Simulate error during pruning
        conv_svc.prune_old_messages = AsyncMock(side_effect=Exception("DB error"))

        async def mock_chat(*args, **kwargs):
            yield GroqChatChunk(content="Response")
            yield GroqChatChunk(finish_reason="stop")

        groq.chat = mock_chat

        user = make_user()
        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=groq,
            mcp_router=router,
        )

        chunks = await collect_chunks(service.send_message(user=user, message="Hi", db=db))

        # Should have error chunk
        error_chunks = [c for c in chunks if c.type == ChatChunkType.ERROR]
        assert len(error_chunks) == 1

        # Verify rollback was called
        db.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_conversation_history_found(self):
        """Test get_conversation_history returns conversation and messages."""
        conv_svc = MagicMock(spec=ConversationService)
        db = AsyncMock()

        conversation = make_conversation()
        messages = [
            make_message(role="user", content="Hello"),
            make_message(role="assistant", content="Hi there!"),
        ]

        conv_svc.get_conversation = AsyncMock(return_value=conversation)
        conv_svc.get_messages = AsyncMock(return_value=messages)

        user = make_user()
        service = ChatService(conversation_svc=conv_svc)

        result_conv, result_msgs = await service.get_conversation_history(
            user=user,
            thread_id=conversation.id,
            db=db,
        )

        assert result_conv is conversation
        assert result_msgs == messages
        conv_svc.get_conversation.assert_called_once_with(conversation.id, user.id, db)

    @pytest.mark.asyncio
    async def test_get_conversation_history_not_found(self):
        """Test get_conversation_history returns None when not found."""
        conv_svc = MagicMock(spec=ConversationService)
        db = AsyncMock()

        conv_svc.get_conversation = AsyncMock(return_value=None)

        user = make_user()
        service = ChatService(conversation_svc=conv_svc)

        result_conv, result_msgs = await service.get_conversation_history(
            user=user,
            thread_id=uuid.uuid4(),
            db=db,
        )

        assert result_conv is None
        assert result_msgs == []

    @pytest.mark.asyncio
    async def test_get_conversation_history_with_limit(self):
        """Test get_conversation_history respects limit parameter."""
        conv_svc = MagicMock(spec=ConversationService)
        db = AsyncMock()

        conversation = make_conversation()
        conv_svc.get_conversation = AsyncMock(return_value=conversation)
        conv_svc.get_messages = AsyncMock(return_value=[])

        user = make_user()
        service = ChatService(conversation_svc=conv_svc)

        await service.get_conversation_history(
            user=user,
            thread_id=conversation.id,
            db=db,
            limit=50,
        )

        conv_svc.get_messages.assert_called_once_with(conversation.id, db, limit=50)


# =============================================================================
# ChatChunk Factory Methods Tests
# =============================================================================


class TestChatChunkFactoryMethods:
    """Tests for ChatChunk factory class methods."""

    def test_text_chunk(self):
        """Test ChatChunk.text() factory method."""
        chunk = ChatChunk.text("Hello world")

        assert chunk.type == ChatChunkType.CONTENT
        assert chunk.content == "Hello world"
        assert chunk.tool_call is None
        assert chunk.tool_result is None

    def test_tool_calling_chunk(self):
        """Test ChatChunk.tool_calling() factory method."""
        chunk = ChatChunk.tool_calling(
            tool_call_id="call_123",
            name="list_trips",
            arguments='{"filter": "active"}',
        )

        assert chunk.type == ChatChunkType.TOOL_CALL
        assert chunk.tool_call is not None
        assert chunk.tool_call.id == "call_123"
        assert chunk.tool_call.name == "list_trips"
        assert chunk.tool_call.arguments == '{"filter": "active"}'

    def test_tool_executed_success_chunk(self):
        """Test ChatChunk.tool_executed() for success."""
        chunk = ChatChunk.tool_executed(
            tool_call_id="call_123",
            name="list_trips",
            result={"trips": [], "count": 0},
            success=True,
        )

        assert chunk.type == ChatChunkType.TOOL_RESULT
        assert chunk.tool_result is not None
        assert chunk.tool_result.tool_call_id == "call_123"
        assert chunk.tool_result.name == "list_trips"
        assert chunk.tool_result.success is True
        assert chunk.tool_result.result == {"trips": [], "count": 0}

    def test_tool_executed_failure_chunk(self):
        """Test ChatChunk.tool_executed() for failure."""
        chunk = ChatChunk.tool_executed(
            tool_call_id="call_456",
            name="get_trip_details",
            result={"error": "Trip not found"},
            success=False,
        )

        assert chunk.type == ChatChunkType.TOOL_RESULT
        assert chunk.tool_result.success is False
        assert "error" in chunk.tool_result.result

    def test_error_chunk(self):
        """Test ChatChunk.error_chunk() factory method."""
        chunk = ChatChunk.error_chunk("Something went wrong")

        assert chunk.type == ChatChunkType.ERROR
        assert chunk.error == "Something went wrong"

    def test_done_chunk_without_thread_id(self):
        """Test ChatChunk.done_chunk() without thread_id."""
        chunk = ChatChunk.done_chunk()

        assert chunk.type == ChatChunkType.DONE
        assert chunk.thread_id is None

    def test_done_chunk_with_thread_id(self):
        """Test ChatChunk.done_chunk() with thread_id."""
        thread_id = uuid.uuid4()
        chunk = ChatChunk.done_chunk(thread_id=thread_id)

        assert chunk.type == ChatChunkType.DONE
        assert chunk.thread_id == thread_id


# =============================================================================
# Singleton Instance Tests
# =============================================================================


class TestSingletonChatService:
    """Tests for the singleton chat_service instance."""

    def test_chat_service_singleton_exists(self):
        """Test that chat_service singleton is importable."""
        from app.services.chat import chat_service

        assert chat_service is not None
        assert isinstance(chat_service, ChatService)
