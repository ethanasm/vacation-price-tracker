"""Groq API client for LLM chat functionality."""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import tiktoken
from groq import AsyncGroq, RateLimitError

from app.core.config import settings

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

logger = logging.getLogger(__name__)

# Default retry configuration
DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 1.0
DEFAULT_MAX_DELAY = 60.0
DEFAULT_JITTER = 0.1

# Token counting model mapping (Llama uses cl100k_base encoding)
TOKEN_ENCODING = "cl100k_base"


class GroqClientError(Exception):
    """Base error for Groq client failures."""


class GroqAuthError(GroqClientError):
    """Raised when authentication with Groq fails."""


class GroqRateLimitError(GroqClientError):
    """Raised when rate limited by Groq API."""

    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class GroqRequestError(GroqClientError):
    """Raised when a Groq API request fails."""


@dataclass
class Message:
    """A chat message."""

    role: str  # "system", "user", "assistant", "tool"
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to Groq API message format."""
        msg: dict[str, Any] = {"role": self.role, "content": self.content}
        if self.tool_calls:
            msg["tool_calls"] = self.tool_calls
        if self.tool_call_id:
            msg["tool_call_id"] = self.tool_call_id
        if self.name:
            msg["name"] = self.name
        return msg


@dataclass
class ToolCall:
    """A tool call from the LLM."""

    id: str
    type: str
    function: ToolCallFunction


@dataclass
class ToolCallFunction:
    """Function details for a tool call."""

    name: str
    arguments: str


@dataclass
class ChatChunk:
    """A streaming chat response chunk."""

    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    usage: dict[str, int] | None = None


@dataclass
class ChatResponse:
    """A complete chat response."""

    content: str
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    usage: dict[str, int] | None = None


@dataclass
class Tool:
    """An LLM tool definition."""

    type: str = "function"
    function: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to Groq API tool format."""
        return {"type": self.type, "function": self.function}


class TokenCounter:
    """Utility for counting tokens in text."""

    _encoding: tiktoken.Encoding | None = None

    @classmethod
    def _get_encoding(cls) -> tiktoken.Encoding:
        """Get or create the token encoding (lazy initialization)."""
        if cls._encoding is None:
            cls._encoding = tiktoken.get_encoding(TOKEN_ENCODING)
        return cls._encoding

    @classmethod
    def count_tokens(cls, text: str) -> int:
        """Count tokens in a text string."""
        if not text:
            return 0
        encoding = cls._get_encoding()
        return len(encoding.encode(text))

    @classmethod
    def count_message_tokens(cls, messages: list[Message]) -> int:
        """
        Count tokens in a list of messages.

        This includes overhead for message formatting (role, separators, etc.).
        Based on OpenAI's token counting guidelines, adapted for Llama models.
        """
        total = 0
        for msg in messages:
            # Base overhead per message (role + separators)
            total += 4
            total += cls.count_tokens(msg.content)
            if msg.name:
                total += cls.count_tokens(msg.name) + 1
            if msg.tool_calls:
                for tool_call in msg.tool_calls:
                    func = tool_call.get("function", {})
                    total += cls.count_tokens(func.get("name", ""))
                    total += cls.count_tokens(func.get("arguments", ""))
        # Add priming tokens
        total += 3
        return total

    @classmethod
    def count_tool_tokens(cls, tools: list[Tool]) -> int:
        """
        Count tokens in tool definitions.

        Tool schemas contribute to the context window.
        """
        import json

        total = 0
        for tool in tools:
            # Serialize tool definition and count tokens
            tool_json = json.dumps(tool.to_dict())
            total += cls.count_tokens(tool_json)
        return total


class GroqClient:
    """Async client for Groq API with streaming and retry support."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
        base_delay: float = DEFAULT_BASE_DELAY,
        max_delay: float = DEFAULT_MAX_DELAY,
        jitter: float = DEFAULT_JITTER,
    ) -> None:
        """
        Initialize the Groq client.

        Args:
            api_key: Groq API key. Defaults to settings.groq_api_key.
            model: Model to use. Defaults to settings.groq_model.
            max_retries: Maximum number of retry attempts for rate limits.
            base_delay: Base delay in seconds for exponential backoff.
            max_delay: Maximum delay in seconds between retries.
            jitter: Jitter factor (0-1) to add randomness to delays.
        """
        self._api_key = api_key or settings.groq_api_key
        self._model = model or settings.groq_model
        self._max_retries = max_retries
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._jitter = jitter
        self._client: AsyncGroq | None = None

    def _get_client(self) -> AsyncGroq:
        """Get or create the Groq client."""
        if self._client is None:
            if not self._api_key:
                raise GroqAuthError("Groq API key is not configured")
            self._client = AsyncGroq(api_key=self._api_key)
        return self._client

    def _calculate_delay(self, attempt: int, retry_after: float | None = None) -> float:
        """
        Calculate delay for exponential backoff with jitter.

        Args:
            attempt: Current attempt number (0-indexed).
            retry_after: Optional server-suggested retry delay.

        Returns:
            Delay in seconds before next retry.
        """
        if retry_after is not None:
            return min(retry_after, self._max_delay)

        # Exponential backoff: base_delay * 2^attempt
        delay = self._base_delay * (2**attempt)
        delay = min(delay, self._max_delay)

        # Add jitter to prevent thundering herd
        jitter_range = delay * self._jitter
        delay += random.uniform(-jitter_range, jitter_range)

        return max(0, delay)

    def _build_chat_kwargs(
        self,
        messages: list[Message],
        tools: list[Tool] | None,
        stream: bool,
        temperature: float,
        max_tokens: int | None,
    ) -> dict[str, Any]:
        """Build kwargs dict for the Groq chat completion API."""
        api_messages = [msg.to_dict() for msg in messages]
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": api_messages,
            "temperature": temperature,
            "stream": stream,
        }
        if tools:
            kwargs["tools"] = [tool.to_dict() for tool in tools]
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        return kwargs

    def _extract_retry_after(self, error: RateLimitError) -> float | None:
        """Extract retry-after value from rate limit error response."""
        if not hasattr(error, "response") or error.response is None:
            return None
        retry_header = error.response.headers.get("retry-after")
        if not retry_header:
            return None
        try:
            return float(retry_header)
        except ValueError:
            return None

    async def _handle_rate_limit(
        self, error: RateLimitError, attempt: int
    ) -> float | None:
        """Handle rate limit error, returning retry_after if max retries exceeded."""
        retry_after = self._extract_retry_after(error)
        if attempt >= self._max_retries:
            return retry_after
        delay = self._calculate_delay(attempt, retry_after)
        logger.warning(
            "Rate limited by Groq API. Attempt %d/%d. Retrying in %.2f seconds.",
            attempt + 1,
            self._max_retries + 1,
            delay,
        )
        await asyncio.sleep(delay)
        return None

    async def chat(
        self,
        messages: list[Message],
        tools: list[Tool] | None = None,
        stream: bool = True,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[ChatChunk, None]:
        """
        Send a chat request with streaming response.

        Args:
            messages: List of chat messages.
            tools: Optional list of tool definitions.
            stream: Whether to stream the response.
            temperature: Sampling temperature (0-2).
            max_tokens: Maximum tokens to generate.

        Yields:
            ChatChunk objects with content and/or tool calls.

        Raises:
            GroqAuthError: If API key is not configured.
            GroqRateLimitError: If rate limited after all retries.
            GroqRequestError: If the request fails.
        """
        client = self._get_client()
        kwargs = self._build_chat_kwargs(messages, tools, stream, temperature, max_tokens)
        attempt = 0

        while attempt <= self._max_retries:
            try:
                async for chunk in self._execute_chat(client, kwargs, stream):
                    yield chunk
                return
            except RateLimitError as e:
                retry_after = await self._handle_rate_limit(e, attempt)
                if retry_after is not None:
                    raise GroqRateLimitError(
                        f"Rate limited after {self._max_retries + 1} attempts",
                        retry_after=retry_after,
                    ) from e
                attempt += 1
            except GroqClientError:
                raise
            except Exception as e:
                logger.exception("Groq API request failed")
                raise GroqRequestError(f"Groq request failed: {e}") from e

    async def _execute_chat(
        self, client: AsyncGroq, kwargs: dict[str, Any], stream: bool
    ) -> AsyncGenerator[ChatChunk, None]:
        """Execute the chat request (streaming or non-streaming)."""
        if stream:
            async for chunk in self._stream_chat(client, kwargs):
                yield chunk
        else:
            response = await self._non_stream_chat(client, kwargs)
            yield response

    def _accumulate_tool_call_delta(
        self, accumulated: dict[int, dict[str, Any]], tool_call_delta: Any
    ) -> None:
        """Accumulate a streaming tool call delta into the accumulated dict."""
        idx = tool_call_delta.index
        if idx not in accumulated:
            accumulated[idx] = {
                "id": "",
                "type": "function",
                "function": {"name": "", "arguments": ""},
            }
        tc = accumulated[idx]
        if tool_call_delta.id:
            tc["id"] = tool_call_delta.id
        if tool_call_delta.type:
            tc["type"] = tool_call_delta.type
        if tool_call_delta.function:
            if tool_call_delta.function.name:
                tc["function"]["name"] = tool_call_delta.function.name
            if tool_call_delta.function.arguments:
                tc["function"]["arguments"] += tool_call_delta.function.arguments

    def _convert_accumulated_tool_calls(
        self, accumulated: dict[int, dict[str, Any]]
    ) -> list[ToolCall]:
        """Convert accumulated tool call dicts to ToolCall objects."""
        return [
            ToolCall(
                id=tc["id"],
                type=tc["type"],
                function=ToolCallFunction(
                    name=tc["function"]["name"],
                    arguments=tc["function"]["arguments"],
                ),
            )
            for tc in accumulated.values()
        ]

    @staticmethod
    def _extract_usage(chunk: Any) -> dict[str, int] | None:
        """Extract usage information from a chunk."""
        if not hasattr(chunk, "usage") or not chunk.usage:
            return None
        return {
            "prompt_tokens": chunk.usage.prompt_tokens,
            "completion_tokens": chunk.usage.completion_tokens,
            "total_tokens": chunk.usage.total_tokens,
        }

    async def _stream_chat(
        self, client: AsyncGroq, kwargs: dict[str, Any]
    ) -> AsyncGenerator[ChatChunk, None]:
        """Handle streaming chat response."""
        response = await client.chat.completions.create(**kwargs)
        accumulated_tool_calls: dict[int, dict[str, Any]] = {}

        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            finish_reason = chunk.choices[0].finish_reason if chunk.choices else None
            chat_chunk = ChatChunk(finish_reason=finish_reason)

            if delta:
                if delta.content:
                    chat_chunk.content = delta.content
                if delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        self._accumulate_tool_call_delta(accumulated_tool_calls, tc_delta)

            chat_chunk.usage = self._extract_usage(chunk)

            if finish_reason == "tool_calls" and accumulated_tool_calls:
                chat_chunk.tool_calls = self._convert_accumulated_tool_calls(accumulated_tool_calls)

            yield chat_chunk

    async def _non_stream_chat(
        self, client: AsyncGroq, kwargs: dict[str, Any]
    ) -> ChatChunk:
        """Handle non-streaming chat response."""
        kwargs["stream"] = False
        response = await client.chat.completions.create(**kwargs)

        choice = response.choices[0] if response.choices else None
        if not choice:
            return ChatChunk()

        tool_calls = None
        if choice.message.tool_calls:
            tool_calls = [
                ToolCall(
                    id=tc.id,
                    type=tc.type,
                    function=ToolCallFunction(
                        name=tc.function.name,
                        arguments=tc.function.arguments,
                    ),
                )
                for tc in choice.message.tool_calls
            ]

        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }

        return ChatChunk(
            content=choice.message.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason,
            usage=usage,
        )

    async def close(self) -> None:
        """Close the client and release resources."""
        if self._client is not None:
            await self._client.close()
            self._client = None


# Singleton instance for shared use
groq_client = GroqClient()
