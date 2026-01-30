"""Integration tests for streaming response assembly.

Tests SSE (Server-Sent Events) chunk handling:
- Chunk assembly from multiple stream fragments
- Tool call chunks in streaming context
- Error chunk generation and handling
- Done chunk signaling stream completion
- Thread ID propagation in first and last chunks
"""

from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
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
from app.schemas.chat import (
    ChatChunk,
    ChatChunkType,
)
from app.schemas.mcp import ToolResult
from app.services.chat import ChatService, process_chat_with_tools
from app.services.mcp_router import MCPRouter


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


class TestChatChunkTypes:
    """Tests for different ChatChunk types."""

    def test_text_chunk_creation(self):
        """Test creating a text content chunk."""
        chunk = ChatChunk.text("Hello world")

        assert chunk.type == ChatChunkType.CONTENT
        assert chunk.content == "Hello world"
        assert chunk.tool_call is None
        assert chunk.error is None

    def test_tool_calling_chunk_creation(self):
        """Test creating a tool_call chunk."""
        chunk = ChatChunk.tool_calling(
            tool_call_id="tc123",
            name="list_trips",
            arguments='{"limit": 10}',
        )

        assert chunk.type == ChatChunkType.TOOL_CALL
        assert chunk.tool_call is not None
        assert chunk.tool_call.id == "tc123"
        assert chunk.tool_call.name == "list_trips"
        assert chunk.tool_call.arguments == '{"limit": 10}'

    def test_tool_executed_chunk_creation(self):
        """Test creating a tool_result chunk."""
        chunk = ChatChunk.tool_executed(
            tool_call_id="tc123",
            name="list_trips",
            result={"trips": [], "count": 0},
            success=True,
        )

        assert chunk.type == ChatChunkType.TOOL_RESULT
        assert chunk.tool_result is not None
        assert chunk.tool_result.tool_call_id == "tc123"
        assert chunk.tool_result.name == "list_trips"
        assert chunk.tool_result.success is True
        assert chunk.tool_result.result == {"trips": [], "count": 0}

    def test_error_chunk_creation(self):
        """Test creating an error chunk."""
        chunk = ChatChunk.error_chunk("Something went wrong")

        assert chunk.type == ChatChunkType.ERROR
        assert chunk.error == "Something went wrong"
        assert chunk.content is None

    def test_done_chunk_creation(self):
        """Test creating a done chunk."""
        thread_id = uuid.uuid4()
        chunk = ChatChunk.done_chunk(thread_id=thread_id)

        assert chunk.type == ChatChunkType.DONE
        assert chunk.thread_id == thread_id

    def test_done_chunk_without_thread_id(self):
        """Test done chunk can be created without thread_id."""
        chunk = ChatChunk.done_chunk()

        assert chunk.type == ChatChunkType.DONE
        assert chunk.thread_id is None


class TestStreamingChunkAssembly:
    """Tests for assembling content from multiple stream chunks."""

    @pytest.fixture
    def mock_groq_client(self):
        """Create a mock Groq client."""
        return MagicMock(spec=GroqClient)

    @pytest.fixture
    def mock_mcp_router(self):
        """Create a mock MCP router."""
        router = MagicMock(spec=MCPRouter)
        router.execute_from_json = AsyncMock()
        return router

    @pytest.mark.anyio
    async def test_content_chunks_assemble_correctly(self, mock_groq_client, mock_mcp_router):
        """Test that multiple content chunks can be assembled."""

        async def stream_fragments(*args, **kwargs):
            yield GroqChatChunk(content="Hello")
            yield GroqChatChunk(content=" ")
            yield GroqChatChunk(content="world")
            yield GroqChatChunk(content="!")
            yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_fragments

        messages = [GroqMessage(role="user", content="Hi")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user",
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Assemble content
        content_chunks = [c for c in chunks if c.type == ChatChunkType.CONTENT]
        full_content = "".join(c.content for c in content_chunks)

        assert full_content == "Hello world!"

    @pytest.mark.anyio
    async def test_streaming_preserves_chunk_order(self, mock_groq_client, mock_mcp_router):
        """Test that chunks are yielded in the correct order."""

        async def stream_numbered(*args, **kwargs):
            for i in range(5):
                yield GroqChatChunk(content=str(i))
            yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_numbered

        messages = [GroqMessage(role="user", content="Count")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user",
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Verify order
        content_chunks = [c for c in chunks if c.type == ChatChunkType.CONTENT]
        contents = [c.content for c in content_chunks]
        assert contents == ["0", "1", "2", "3", "4"]


class TestToolCallStreamingChunks:
    """Tests for tool call chunks in streaming context."""

    @pytest.fixture
    def mock_groq_client(self):
        return MagicMock(spec=GroqClient)

    @pytest.fixture
    def mock_mcp_router(self):
        router = MagicMock(spec=MCPRouter)
        router.execute_from_json = AsyncMock()
        return router

    @pytest.mark.anyio
    async def test_tool_call_chunk_emitted_before_result(self, mock_groq_client, mock_mcp_router):
        """Test that tool_call chunk is emitted before tool_result."""
        call_count = 0

        async def stream_with_tool(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                yield GroqChatChunk(
                    tool_calls=[make_tool_call("tc1", "list_trips", {})],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="Done")
                yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_with_tool
        mock_mcp_router.execute_from_json.return_value = ToolResult(success=True, data={"trips": []})

        messages = [GroqMessage(role="user", content="List trips")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user",
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Find indices
        tool_call_idx = next(i for i, c in enumerate(chunks) if c.type == ChatChunkType.TOOL_CALL)
        tool_result_idx = next(i for i, c in enumerate(chunks) if c.type == ChatChunkType.TOOL_RESULT)

        assert tool_call_idx < tool_result_idx

    @pytest.mark.anyio
    async def test_multiple_tool_calls_ordered_correctly(self, mock_groq_client, mock_mcp_router):
        """Test multiple tool calls maintain proper ordering."""
        call_count = 0

        async def stream_multi_tool(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                yield GroqChatChunk(
                    tool_calls=[
                        make_tool_call("tc1", "tool_a", {}),
                        make_tool_call("tc2", "tool_b", {}),
                    ],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="Done")
                yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_multi_tool
        mock_mcp_router.execute_from_json.return_value = ToolResult(success=True, data={})

        messages = [GroqMessage(role="user", content="Call tools")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user",
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        # Extract tool-related chunks
        tool_chunks = [c for c in chunks if c.type in (ChatChunkType.TOOL_CALL, ChatChunkType.TOOL_RESULT)]

        # Should be: call_a, result_a, call_b, result_b
        assert len(tool_chunks) == 4
        assert tool_chunks[0].type == ChatChunkType.TOOL_CALL
        assert tool_chunks[0].tool_call.name == "tool_a"
        assert tool_chunks[1].type == ChatChunkType.TOOL_RESULT
        assert tool_chunks[2].type == ChatChunkType.TOOL_CALL
        assert tool_chunks[2].tool_call.name == "tool_b"
        assert tool_chunks[3].type == ChatChunkType.TOOL_RESULT


class TestErrorChunkHandling:
    """Tests for error chunk generation and handling."""

    @pytest.fixture
    def mock_groq_client(self):
        return MagicMock(spec=GroqClient)

    @pytest.fixture
    def mock_mcp_router(self):
        router = MagicMock(spec=MCPRouter)
        router.execute_from_json = AsyncMock()
        return router

    @pytest.mark.anyio
    async def test_error_chunk_on_groq_failure(self, mock_groq_client, mock_mcp_router):
        """Test error chunk generated on Groq client failure."""
        from app.clients.groq import GroqClientError

        async def failing_stream(*args, **kwargs):
            raise GroqClientError("Rate limit exceeded")
            yield  # Make it a generator

        mock_groq_client.chat = failing_stream

        messages = [GroqMessage(role="user", content="Hi")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user",
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        error_chunks = [c for c in chunks if c.type == ChatChunkType.ERROR]
        assert len(error_chunks) == 1
        assert "LLM service error" in error_chunks[0].error

    @pytest.mark.anyio
    async def test_tool_failure_chunk(self, mock_groq_client, mock_mcp_router):
        """Test tool_result chunk reflects tool failure."""
        call_count = 0

        async def stream_tool(*args, **kwargs):
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                yield GroqChatChunk(
                    tool_calls=[make_tool_call("tc1", "create_trip", {})],
                    finish_reason="tool_calls",
                )
            else:
                yield GroqChatChunk(content="I couldn't do that")
                yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = stream_tool
        mock_mcp_router.execute_from_json.return_value = ToolResult(success=False, error="Missing required field")

        messages = [GroqMessage(role="user", content="Create trip")]
        chunks = []

        async for chunk in process_chat_with_tools(
            messages=messages,
            user_id="test-user",
            client=mock_groq_client,
            router=mock_mcp_router,
        ):
            chunks.append(chunk)

        tool_result_chunks = [c for c in chunks if c.type == ChatChunkType.TOOL_RESULT]
        assert len(tool_result_chunks) == 1
        assert tool_result_chunks[0].tool_result.success is False
        assert "error" in tool_result_chunks[0].tool_result.result


class TestChatServiceStreamingIntegration:
    """Tests for ChatService streaming with full integration."""

    @pytest.fixture
    def mock_conv_service(self):
        """Create a mock conversation service."""
        service = MagicMock()
        mock_conv = MagicMock()
        mock_conv.id = uuid.uuid4()
        service.get_or_create_conversation = AsyncMock(return_value=mock_conv)
        service.add_message = AsyncMock()
        service.get_messages_for_context = AsyncMock(return_value=[])
        service.messages_to_groq_format = MagicMock(return_value=[])
        service.prune_old_messages = AsyncMock()
        return service, mock_conv

    @pytest.fixture
    def mock_groq_client(self):
        return MagicMock(spec=GroqClient)

    @pytest.fixture
    def mock_mcp_router(self):
        router = MagicMock(spec=MCPRouter)
        router.execute_from_json = AsyncMock()
        return router

    @pytest.fixture
    def mock_user(self):
        """Create a mock user."""
        user = MagicMock()
        user.id = uuid.uuid4()
        user.name = "Test User"
        user.email = "test@example.com"
        return user

    @pytest.mark.anyio
    async def test_first_chunk_has_thread_id(
        self,
        test_session,
        mock_conv_service,
        mock_groq_client,
        mock_mcp_router,
        mock_user,
    ):
        """Test that first chunk includes thread_id."""
        conv_svc, mock_conv = mock_conv_service

        async def simple_stream(*args, **kwargs):
            yield GroqChatChunk(content="Hello")
            yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = simple_stream

        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=mock_groq_client,
            mcp_router=mock_mcp_router,
        )

        chunks = []
        async for chunk in service.send_message(
            user=mock_user,
            message="Hi",
            db=test_session,
        ):
            chunks.append(chunk)

        # First chunk should have thread_id
        assert chunks[0].thread_id == mock_conv.id

    @pytest.mark.anyio
    async def test_done_chunk_ends_stream(
        self,
        test_session,
        mock_conv_service,
        mock_groq_client,
        mock_mcp_router,
        mock_user,
    ):
        """Test that stream ends with done chunk."""
        conv_svc, mock_conv = mock_conv_service

        async def simple_stream(*args, **kwargs):
            yield GroqChatChunk(content="Response")
            yield GroqChatChunk(finish_reason="stop")

        mock_groq_client.chat = simple_stream

        service = ChatService(
            conversation_svc=conv_svc,
            groq_client_instance=mock_groq_client,
            mcp_router=mock_mcp_router,
        )

        chunks = []
        async for chunk in service.send_message(
            user=mock_user,
            message="Hi",
            db=test_session,
        ):
            chunks.append(chunk)

        # Last chunk should be done
        assert chunks[-1].type == ChatChunkType.DONE
        assert chunks[-1].thread_id == mock_conv.id


class TestChunkSerialization:
    """Tests for chunk JSON serialization for SSE transport."""

    def test_content_chunk_serialization(self):
        """Test content chunk can be serialized to JSON."""
        chunk = ChatChunk.text("Hello")
        json_str = chunk.model_dump_json()

        parsed = json.loads(json_str)
        assert parsed["type"] == "content"
        assert parsed["content"] == "Hello"

    def test_tool_call_chunk_serialization(self):
        """Test tool_call chunk serialization."""
        chunk = ChatChunk.tool_calling("tc1", "list_trips", '{"x": 1}')
        json_str = chunk.model_dump_json()

        parsed = json.loads(json_str)
        assert parsed["type"] == "tool_call"
        assert parsed["tool_call"]["id"] == "tc1"
        assert parsed["tool_call"]["name"] == "list_trips"

    def test_tool_result_chunk_serialization(self):
        """Test tool_result chunk serialization."""
        chunk = ChatChunk.tool_executed("tc1", "list_trips", {"data": "value"}, success=True)
        json_str = chunk.model_dump_json()

        parsed = json.loads(json_str)
        assert parsed["type"] == "tool_result"
        assert parsed["tool_result"]["success"] is True

    def test_error_chunk_serialization(self):
        """Test error chunk serialization."""
        chunk = ChatChunk.error_chunk("Something failed")
        json_str = chunk.model_dump_json()

        parsed = json.loads(json_str)
        assert parsed["type"] == "error"
        assert parsed["error"] == "Something failed"

    def test_done_chunk_with_uuid_serialization(self):
        """Test done chunk with UUID serialization."""
        thread_id = uuid.uuid4()
        chunk = ChatChunk.done_chunk(thread_id=thread_id)
        json_str = chunk.model_dump_json()

        parsed = json.loads(json_str)
        assert parsed["type"] == "done"
        assert parsed["thread_id"] == str(thread_id)


class TestSSEFormatting:
    """Tests for SSE format generation."""

    def test_sse_chunk_format(self):
        """Test generating proper SSE format."""
        chunk = ChatChunk.text("Hello")

        # SSE format: "data: {json}\n\n"
        sse_line = f"data: {chunk.model_dump_json()}\n\n"

        assert sse_line.startswith("data: ")
        assert sse_line.endswith("\n\n")

        # Parse the JSON portion
        json_part = sse_line[6:-2]  # Remove "data: " and "\n\n"
        parsed = json.loads(json_part)
        assert parsed["type"] == "content"

    def test_sse_done_marker(self):
        """Test SSE [DONE] marker format."""
        # Standard SSE done marker
        done_line = "data: [DONE]\n\n"
        assert done_line == "data: [DONE]\n\n"

    def test_multiple_sse_chunks(self):
        """Test assembling multiple SSE chunks."""
        chunks = [
            ChatChunk.text("Hello "),
            ChatChunk.text("world!"),
            ChatChunk.done_chunk(),
        ]

        sse_output = ""
        for chunk in chunks:
            sse_output += f"data: {chunk.model_dump_json()}\n\n"
        sse_output += "data: [DONE]\n\n"

        # Verify format
        lines = sse_output.split("\n\n")
        assert len(lines) == 5  # 3 chunks + [DONE] + trailing empty

        # Each line should be parseable (except [DONE])
        for line in lines[:-2]:  # Exclude [DONE] and empty
            json_part = line[6:]  # Remove "data: "
            json.loads(json_part)  # Should not raise
