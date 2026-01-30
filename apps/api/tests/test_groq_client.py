"""Tests for the Groq API client."""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.clients.groq import (
    ChatChunk,
    GroqAuthError,
    GroqClient,
    GroqRateLimitError,
    GroqRequestError,
    GroqToolCallError,
    Message,
    TokenCounter,
    Tool,
    ToolCall,
    ToolCallFunction,
)
from app.core import config as config_module
from groq import APIError, RateLimitError

# --- Message Tests ---


def test_message_to_dict_basic():
    """Test Message.to_dict() with basic fields."""
    msg = Message(role="user", content="Hello, world!")
    result = msg.to_dict()

    assert result["role"] == "user"
    assert result["content"] == "Hello, world!"
    assert "tool_calls" not in result
    assert "tool_call_id" not in result
    assert "name" not in result


def test_message_to_dict_with_tool_calls():
    """Test Message.to_dict() with tool calls."""
    msg = Message(
        role="assistant",
        content="",
        tool_calls=[
            {
                "id": "call_123",
                "type": "function",
                "function": {"name": "get_weather", "arguments": '{"city": "SF"}'},
            }
        ],
    )
    result = msg.to_dict()

    assert result["role"] == "assistant"
    assert result["tool_calls"] == msg.tool_calls


def test_message_to_dict_with_tool_response():
    """Test Message.to_dict() for tool response."""
    msg = Message(
        role="tool",
        content='{"temperature": 72}',
        tool_call_id="call_123",
        name="get_weather",
    )
    result = msg.to_dict()

    assert result["role"] == "tool"
    assert result["content"] == '{"temperature": 72}'
    assert result["tool_call_id"] == "call_123"
    assert result["name"] == "get_weather"


# --- Tool Tests ---


def test_tool_to_dict():
    """Test Tool.to_dict() conversion."""
    tool = Tool(
        type="function",
        function={
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    )
    result = tool.to_dict()

    assert result["type"] == "function"
    assert result["function"]["name"] == "get_weather"
    assert result["function"]["description"] == "Get current weather"


# --- TokenCounter Tests ---


def test_token_counter_count_tokens_empty():
    """Test TokenCounter with empty string."""
    assert TokenCounter.count_tokens("") == 0


def test_token_counter_count_tokens_basic():
    """Test TokenCounter with basic text."""
    # "Hello, world!" is approximately 4 tokens
    count = TokenCounter.count_tokens("Hello, world!")
    assert count > 0
    assert count < 10


def test_token_counter_count_tokens_longer():
    """Test TokenCounter with longer text."""
    text = "The quick brown fox jumps over the lazy dog. " * 10
    count = TokenCounter.count_tokens(text)
    assert count > 50


def test_token_counter_count_message_tokens():
    """Test TokenCounter.count_message_tokens()."""
    messages = [
        Message(role="system", content="You are a helpful assistant."),
        Message(role="user", content="What is 2+2?"),
        Message(role="assistant", content="2+2 equals 4."),
    ]
    count = TokenCounter.count_message_tokens(messages)

    # Should include message content + overhead
    assert count > 0
    # At least some tokens per message
    assert count >= len(messages) * 4


def test_token_counter_count_message_tokens_with_tool_calls():
    """Test TokenCounter.count_message_tokens() with tool calls."""
    messages = [
        Message(
            role="assistant",
            content="",
            tool_calls=[
                {
                    "function": {
                        "name": "create_trip",
                        "arguments": '{"name": "Hawaii Trip", "origin": "SFO"}',
                    }
                }
            ],
        )
    ]
    count = TokenCounter.count_message_tokens(messages)
    assert count > 0


def test_token_counter_count_tool_tokens():
    """Test TokenCounter.count_tool_tokens()."""
    tools = [
        Tool(
            function={
                "name": "get_weather",
                "description": "Get current weather for a city",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "city": {"type": "string", "description": "City name"},
                        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                    },
                    "required": ["city"],
                },
            }
        )
    ]
    count = TokenCounter.count_tool_tokens(tools)
    assert count > 0


# --- GroqClient Initialization Tests ---


def test_groq_client_init_defaults(monkeypatch):
    """Test GroqClient initialization with defaults."""
    monkeypatch.setattr(config_module.settings, "groq_api_key", "test-key")
    monkeypatch.setattr(config_module.settings, "groq_model", "llama-3.3-70b-versatile")

    client = GroqClient()

    assert client._api_key == "test-key"
    assert client._model == "llama-3.3-70b-versatile"
    assert client._max_retries == 3
    assert client._client is None


def test_groq_client_init_custom_params():
    """Test GroqClient initialization with custom params."""
    client = GroqClient(
        api_key="custom-key",
        model="custom-model",
        max_retries=5,
        base_delay=2.0,
        max_delay=120.0,
        jitter=0.2,
    )

    assert client._api_key == "custom-key"
    assert client._model == "custom-model"
    assert client._max_retries == 5
    assert client._base_delay == 2.0
    assert client._max_delay == 120.0
    assert client._jitter == 0.2


def test_groq_client_get_client_no_api_key(monkeypatch):
    """Test _get_client raises GroqAuthError when no API key."""
    monkeypatch.setattr(config_module.settings, "groq_api_key", "")

    client = GroqClient(api_key="")

    with pytest.raises(GroqAuthError) as exc_info:
        client._get_client()

    assert "API key is not configured" in str(exc_info.value)


def test_groq_client_get_client_creates_instance(monkeypatch):
    """Test _get_client creates AsyncGroq instance."""
    client = GroqClient(api_key="test-key")

    with patch("app.clients.groq.AsyncGroq") as mock_groq:
        mock_groq.return_value = MagicMock()
        result = client._get_client()

        mock_groq.assert_called_once_with(api_key="test-key")
        assert result is not None


def test_groq_client_get_client_reuses_instance(monkeypatch):
    """Test _get_client reuses existing instance."""
    client = GroqClient(api_key="test-key")
    mock_instance = MagicMock()
    client._client = mock_instance

    result = client._get_client()

    assert result is mock_instance


# --- Delay Calculation Tests ---


def test_calculate_delay_with_retry_after():
    """Test delay calculation respects retry_after header."""
    client = GroqClient(api_key="test-key", max_delay=60.0)

    delay = client._calculate_delay(attempt=0, retry_after=5.0)
    assert delay == 5.0


def test_calculate_delay_caps_retry_after():
    """Test delay calculation caps retry_after at max_delay."""
    client = GroqClient(api_key="test-key", max_delay=10.0)

    delay = client._calculate_delay(attempt=0, retry_after=100.0)
    assert delay == 10.0


def test_calculate_delay_exponential_backoff():
    """Test exponential backoff without retry_after."""
    client = GroqClient(api_key="test-key", base_delay=1.0, max_delay=60.0, jitter=0.0)

    # Attempt 0: 1.0 * 2^0 = 1.0
    delay0 = client._calculate_delay(attempt=0)
    assert delay0 == pytest.approx(1.0, abs=0.1)

    # Attempt 1: 1.0 * 2^1 = 2.0
    delay1 = client._calculate_delay(attempt=1)
    assert delay1 == pytest.approx(2.0, abs=0.1)

    # Attempt 2: 1.0 * 2^2 = 4.0
    delay2 = client._calculate_delay(attempt=2)
    assert delay2 == pytest.approx(4.0, abs=0.1)


def test_calculate_delay_caps_at_max():
    """Test delay calculation caps at max_delay."""
    client = GroqClient(api_key="test-key", base_delay=1.0, max_delay=5.0, jitter=0.0)

    # Attempt 10: 1.0 * 2^10 = 1024, but capped at 5.0
    delay = client._calculate_delay(attempt=10)
    assert delay == pytest.approx(5.0, abs=0.1)


def test_calculate_delay_with_jitter():
    """Test delay calculation includes jitter."""
    client = GroqClient(api_key="test-key", base_delay=10.0, max_delay=60.0, jitter=0.5)

    # With 50% jitter, delay should vary within range
    delays = [client._calculate_delay(attempt=0) for _ in range(20)]

    # Base delay is 10.0, with 50% jitter should be 5.0-15.0
    assert min(delays) >= 5.0 - 0.1
    assert max(delays) <= 15.0 + 0.1
    # Should have some variation
    assert max(delays) - min(delays) > 1.0


# --- Chat Method Tests ---


@dataclass
class MockChoice:
    """Mock chat completion choice."""

    delta: MagicMock | None = None
    message: MagicMock | None = None
    finish_reason: str | None = None


@dataclass
class MockChunk:
    """Mock streaming chunk."""

    choices: list[MockChoice]
    usage: MagicMock | None = None


@pytest.mark.asyncio
async def test_chat_streaming_basic():
    """Test chat method with streaming response."""
    client = GroqClient(api_key="test-key", model="test-model")

    # Create mock streaming response
    async def mock_stream():
        delta1 = MagicMock()
        delta1.content = "Hello"
        delta1.tool_calls = None

        delta2 = MagicMock()
        delta2.content = " world!"
        delta2.tool_calls = None

        yield MockChunk(choices=[MockChoice(delta=delta1, finish_reason=None)])
        yield MockChunk(choices=[MockChoice(delta=delta2, finish_reason="stop")])

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = AsyncMock(return_value=mock_stream())

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        chunks = []
        async for chunk in client.chat(messages, stream=True):
            chunks.append(chunk)

    assert len(chunks) == 2
    assert chunks[0].content == "Hello"
    assert chunks[1].content == " world!"
    assert chunks[1].finish_reason == "stop"


@pytest.mark.asyncio
async def test_chat_non_streaming():
    """Test chat method with non-streaming response."""
    client = GroqClient(api_key="test-key", model="test-model")

    # Create mock response
    mock_message = MagicMock()
    mock_message.content = "Hello! How can I help?"
    mock_message.tool_calls = None

    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 10
    mock_usage.completion_tokens = 5
    mock_usage.total_tokens = 15

    mock_response = MagicMock()
    mock_response.choices = [MockChoice(message=mock_message, finish_reason="stop")]
    mock_response.usage = mock_usage

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        chunks = []
        async for chunk in client.chat(messages, stream=False):
            chunks.append(chunk)

    assert len(chunks) == 1
    assert chunks[0].content == "Hello! How can I help?"
    assert chunks[0].finish_reason == "stop"
    assert chunks[0].usage["total_tokens"] == 15


@pytest.mark.asyncio
async def test_chat_with_tools():
    """Test chat method with tool calls."""
    client = GroqClient(api_key="test-key", model="test-model")

    # Create mock tool call response
    mock_tool_call = MagicMock()
    mock_tool_call.id = "call_123"
    mock_tool_call.type = "function"
    mock_tool_call.function = MagicMock()
    mock_tool_call.function.name = "get_weather"
    mock_tool_call.function.arguments = '{"city": "San Francisco"}'

    mock_message = MagicMock()
    mock_message.content = None
    mock_message.tool_calls = [mock_tool_call]

    mock_response = MagicMock()
    mock_response.choices = [MockChoice(message=mock_message, finish_reason="tool_calls")]
    mock_response.usage = None

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = AsyncMock(return_value=mock_response)

    tools = [
        Tool(
            function={
                "name": "get_weather",
                "description": "Get weather",
                "parameters": {"type": "object", "properties": {}},
            }
        )
    ]

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="What's the weather in SF?")]
        chunks = []
        async for chunk in client.chat(messages, tools=tools, stream=False):
            chunks.append(chunk)

    assert len(chunks) == 1
    assert chunks[0].tool_calls is not None
    assert len(chunks[0].tool_calls) == 1
    assert chunks[0].tool_calls[0].id == "call_123"
    assert chunks[0].tool_calls[0].function.name == "get_weather"


@pytest.mark.asyncio
async def test_chat_rate_limit_retry():
    """Test chat method retries on rate limit."""
    client = GroqClient(
        api_key="test-key",
        model="test-model",
        max_retries=2,
        base_delay=0.01,
    )

    call_count = 0

    async def mock_create(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise RateLimitError(
                message="Rate limit exceeded",
                response=MagicMock(headers={}),
                body=None,
            )

        # Return success on second attempt
        async def success_stream():
            delta = MagicMock()
            delta.content = "Success"
            delta.tool_calls = None
            yield MockChunk(choices=[MockChoice(delta=delta, finish_reason="stop")])

        return success_stream()

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = mock_create

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        chunks = []
        async for chunk in client.chat(messages, stream=True):
            chunks.append(chunk)

    assert call_count == 2
    # One rate limit status chunk, then the content chunk
    assert len(chunks) == 2
    assert chunks[0].rate_limit_status is not None
    assert chunks[0].rate_limit_status.attempt == 1
    assert chunks[1].content == "Success"


@pytest.mark.asyncio
async def test_chat_rate_limit_exhausted():
    """Test chat method raises after max retries."""
    client = GroqClient(
        api_key="test-key",
        model="test-model",
        max_retries=2,
        base_delay=0.01,
    )

    async def mock_create(**kwargs):
        raise RateLimitError(
            message="Rate limit exceeded",
            response=MagicMock(headers={"retry-after": "5"}),
            body=None,
        )

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = mock_create

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        with pytest.raises(GroqRateLimitError) as exc_info:
            async for _ in client.chat(messages, stream=True):
                pass

    assert "Rate limited after 3 attempts" in str(exc_info.value)


@pytest.mark.asyncio
async def test_chat_general_error():
    """Test chat method raises GroqRequestError on failure."""
    client = GroqClient(api_key="test-key", model="test-model")

    async def mock_create(**kwargs):
        raise ValueError("Unexpected error")

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = mock_create

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        with pytest.raises(GroqRequestError) as exc_info:
            async for _ in client.chat(messages, stream=True):
                pass

    assert "Groq request failed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_chat_streaming_with_tool_calls():
    """Test streaming chat accumulates tool calls correctly."""
    client = GroqClient(api_key="test-key", model="test-model")

    async def mock_stream():
        # First chunk: tool call start
        delta1 = MagicMock()
        delta1.content = None
        tc_delta1 = MagicMock()
        tc_delta1.index = 0
        tc_delta1.id = "call_abc"
        tc_delta1.type = "function"
        tc_delta1.function = MagicMock()
        tc_delta1.function.name = "create_trip"
        tc_delta1.function.arguments = '{"name":'
        delta1.tool_calls = [tc_delta1]
        yield MockChunk(choices=[MockChoice(delta=delta1, finish_reason=None)])

        # Second chunk: more arguments
        delta2 = MagicMock()
        delta2.content = None
        tc_delta2 = MagicMock()
        tc_delta2.index = 0
        tc_delta2.id = None
        tc_delta2.type = None
        tc_delta2.function = MagicMock()
        tc_delta2.function.name = None
        tc_delta2.function.arguments = ' "Hawaii"}'
        delta2.tool_calls = [tc_delta2]
        yield MockChunk(choices=[MockChoice(delta=delta2, finish_reason=None)])

        # Final chunk: finish
        delta3 = MagicMock()
        delta3.content = None
        delta3.tool_calls = None
        yield MockChunk(choices=[MockChoice(delta=delta3, finish_reason="tool_calls")])

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = AsyncMock(return_value=mock_stream())

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Create a trip to Hawaii")]
        chunks = []
        async for chunk in client.chat(messages, stream=True):
            chunks.append(chunk)

    # Find the chunk with tool calls
    tool_call_chunk = next((c for c in chunks if c.tool_calls), None)
    assert tool_call_chunk is not None
    assert len(tool_call_chunk.tool_calls) == 1
    assert tool_call_chunk.tool_calls[0].id == "call_abc"
    assert tool_call_chunk.tool_calls[0].function.name == "create_trip"
    assert tool_call_chunk.tool_calls[0].function.arguments == '{"name": "Hawaii"}'


# --- Close Method Tests ---


@pytest.mark.asyncio
async def test_close_cleans_up_client():
    """Test close() properly cleans up resources."""
    client = GroqClient(api_key="test-key")
    mock_async_groq = MagicMock()
    mock_async_groq.close = AsyncMock()
    client._client = mock_async_groq

    await client.close()

    mock_async_groq.close.assert_called_once()
    assert client._client is None


@pytest.mark.asyncio
async def test_close_noop_when_no_client():
    """Test close() is safe when client not initialized."""
    client = GroqClient(api_key="test-key")
    assert client._client is None

    # Should not raise
    await client.close()


# --- Data Class Tests ---


def test_chat_chunk_defaults():
    """Test ChatChunk default values."""
    chunk = ChatChunk()
    assert chunk.content is None
    assert chunk.tool_calls is None
    assert chunk.finish_reason is None
    assert chunk.usage is None


def test_tool_call_structure():
    """Test ToolCall and ToolCallFunction structure."""
    func = ToolCallFunction(name="test_func", arguments='{"key": "value"}')
    tc = ToolCall(id="call_123", type="function", function=func)

    assert tc.id == "call_123"
    assert tc.type == "function"
    assert tc.function.name == "test_func"
    assert tc.function.arguments == '{"key": "value"}'


# --- Error Class Tests ---


def test_groq_rate_limit_error_with_retry_after():
    """Test GroqRateLimitError stores retry_after."""
    error = GroqRateLimitError("Rate limited", retry_after=30.0)
    assert str(error) == "Rate limited"
    assert error.retry_after == 30.0


def test_groq_rate_limit_error_without_retry_after():
    """Test GroqRateLimitError without retry_after."""
    error = GroqRateLimitError("Rate limited")
    assert error.retry_after is None
    assert error.is_daily_limit is False


def test_groq_rate_limit_error_daily_limit():
    """Test GroqRateLimitError with daily limit flag."""
    error = GroqRateLimitError("Daily limit reached", retry_after=3600.0, is_daily_limit=True)
    assert error.is_daily_limit is True
    assert error.retry_after == 3600.0


def test_is_daily_token_limit_detects_tpd():
    """Test _is_daily_token_limit detects TPD errors."""
    client = GroqClient(api_key="test-key")

    # Mock error with daily token limit message
    mock_error = MagicMock()
    mock_error.body = {
        "error": {
            "message": "Rate limit reached for model `llama-3.3-70b-versatile` on tokens per day (TPD): Limit 100000"
        }
    }
    assert client._is_daily_token_limit(mock_error) is True


def test_is_daily_token_limit_ignores_tpm():
    """Test _is_daily_token_limit ignores TPM (per minute) errors."""
    client = GroqClient(api_key="test-key")

    # Mock error with per-minute token limit
    mock_error = MagicMock()
    mock_error.body = {
        "error": {"message": "Rate limit reached on tokens per minute (TPM): Limit 18000"}
    }
    assert client._is_daily_token_limit(mock_error) is False


def test_is_daily_token_limit_handles_missing_body():
    """Test _is_daily_token_limit handles errors without body."""
    client = GroqClient(api_key="test-key")

    mock_error = MagicMock()
    mock_error.body = None
    assert client._is_daily_token_limit(mock_error) is False


@pytest.mark.asyncio
async def test_chat_daily_limit_no_retry():
    """Test chat method immediately raises for daily token limits without retrying."""
    client = GroqClient(api_key="test-key", model="test-model", max_retries=3)

    call_count = 0

    async def mock_create(**kwargs):
        nonlocal call_count
        call_count += 1
        error = RateLimitError(
            message="Rate limit exceeded",
            response=MagicMock(headers={"retry-after": "3600"}),
            body=None,
        )
        # Simulate daily limit by adding body attribute
        error.body = {
            "error": {
                "message": "Rate limit reached on tokens per day (TPD): Limit 100000, Used 99000"
            }
        }
        raise error

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = mock_create

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        with pytest.raises(GroqRateLimitError) as exc_info:
            async for _ in client.chat(messages, stream=True):
                pass

    # Should only have called once (no retries for daily limit)
    assert call_count == 1
    assert exc_info.value.is_daily_limit is True
    assert "Daily token limit" in str(exc_info.value)


@pytest.mark.asyncio
async def test_chat_tool_call_error_retries_once():
    """Test chat method retries once on tool call generation failure."""
    client = GroqClient(api_key="test-key", model="test-model", max_retries=3)

    call_count = 0

    async def mock_create(**kwargs):
        nonlocal call_count
        call_count += 1
        # Simulate API error for failed tool call generation
        raise APIError(
            message="Failed to call a function. Please adjust your prompt. See 'failed_generation' for more details.",
            request=MagicMock(),
            body=None,
        )

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = mock_create

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        with pytest.raises(GroqToolCallError) as exc_info:
            async for _ in client.chat(messages, stream=True):
                pass

    # Should have retried once (2 total attempts)
    assert call_count == 2
    assert "failed to generate a valid response" in str(exc_info.value)


@pytest.mark.asyncio
async def test_chat_tool_call_error_succeeds_on_retry():
    """Test chat method can succeed on retry after tool call failure."""
    client = GroqClient(api_key="test-key", model="test-model", max_retries=3)

    call_count = 0

    async def mock_create(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First call fails
            raise APIError(
                message="Failed to call a function.",
                request=MagicMock(),
                body=None,
            )
        # Second call succeeds

        async def mock_stream():
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta.content = "Success!"
            chunk.choices[0].delta.tool_calls = None
            chunk.choices[0].finish_reason = "stop"
            chunk.usage = None
            yield chunk

        return mock_stream()

    mock_async_groq = MagicMock()
    mock_async_groq.chat.completions.create = mock_create

    with patch.object(client, "_get_client", return_value=mock_async_groq):
        messages = [Message(role="user", content="Hello")]
        chunks = [c async for c in client.chat(messages, stream=True)]

    # Should have called twice (first failed, second succeeded)
    assert call_count == 2
    assert len(chunks) > 0
    assert chunks[0].content == "Success!"
