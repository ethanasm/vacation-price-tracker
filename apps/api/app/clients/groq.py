"""Groq API client for LLM chat functionality."""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import tiktoken
from groq import APIError, AsyncGroq, RateLimitError

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

    def __init__(
        self,
        message: str,
        retry_after: float | None = None,
        attempts_made: int = 0,
        is_daily_limit: bool = False,
    ) -> None:
        super().__init__(message)
        self.retry_after = retry_after
        self.attempts_made = attempts_made
        self.is_daily_limit = is_daily_limit


class GroqRequestError(GroqClientError):
    """Raised when a Groq API request fails."""


class GroqToolCallError(GroqClientError):
    """Raised when the LLM fails to generate a valid tool call.

    This happens when the model produces malformed JSON for function arguments.
    Retrying may help, but if it persists, simplifying the request might be needed.
    """


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
class RateLimitStatus:
    """Status update during rate limit retry."""

    attempt: int  # Current attempt (1-indexed)
    max_attempts: int  # Total allowed attempts
    retry_after: float  # Seconds until next retry


@dataclass
class ChatChunk:
    """A streaming chat response chunk."""

    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None
    usage: dict[str, int] | None = None
    rate_limit_status: RateLimitStatus | None = None  # Set when rate limited


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

    def _is_daily_token_limit(self, error: RateLimitError) -> bool:
        """Check if the rate limit is a daily token limit (TPD) vs per-minute (TPM).

        Daily limits require waiting until the quota resets (up to 24 hours),
        so retrying immediately is pointless.
        """
        try:
            # Check the error message for "tokens per day" or "TPD"
            if hasattr(error, "body") and error.body:
                error_body = error.body
                if isinstance(error_body, dict):
                    message = error_body.get("error", {}).get("message", "")
                    if "tokens per day" in message.lower() or "(tpd)" in message.lower():
                        return True
        except (AttributeError, TypeError):
            pass
        return False

    def _handle_rate_limit_sync(
        self, error: RateLimitError, attempt: int
    ) -> tuple[float | None, float, bool]:
        """Handle rate limit error, returning (retry_after if exceeded, delay, is_daily).

        Returns:
            Tuple of (retry_after if max retries exceeded else None, calculated delay, is_daily_limit)
        """
        retry_after = self._extract_retry_after(error)
        is_daily = self._is_daily_token_limit(error)
        delay = self._calculate_delay(attempt, retry_after)

        # For daily limits, don't bother retrying - the wait could be hours
        if is_daily:
            logger.warning(
                "Groq daily token limit reached. Retry after: %s seconds. Not retrying.",
                retry_after,
            )
            return retry_after, delay, True

        if attempt >= self._max_retries:
            return retry_after, delay, False
        logger.warning(
            "Rate limited by Groq API. Attempt %d/%d. Retrying in %.2f seconds.",
            attempt + 1,
            self._max_retries + 1,
            delay,
        )
        return None, delay, False

    @staticmethod
    def _is_tool_call_error(error: APIError) -> bool:
        """Check if the API error is a tool call generation failure."""
        error_msg = str(error)
        return "Failed to call a function" in error_msg or "failed_generation" in error_msg

    async def _handle_tool_call_error(self, error: APIError, attempt: int) -> int:
        """Handle tool call generation error.

        Returns:
            New attempt number if should retry, -1 if retries exhausted.
        """
        if attempt < 1:
            logger.warning(
                "Tool call generation failed, retrying. Attempt %d/2. Error: %s",
                attempt + 1,
                str(error)[:100],
            )
            await asyncio.sleep(0.5)  # Brief pause before retry
            return attempt + 1
        return -1  # Signal that retries are exhausted

    def _raise_rate_limit_error(
        self, error: RateLimitError, retry_after: float | None, delay: float, is_daily: bool, attempt: int
    ) -> None:
        """Raise appropriate rate limit error based on context."""
        if is_daily:
            raise GroqRateLimitError(
                "Daily token limit reached. Please try again later.",
                retry_after=retry_after,
                attempts_made=attempt + 1,
                is_daily_limit=True,
            ) from error
        raise GroqRateLimitError(
            f"Rate limited after {self._max_retries + 1} attempts",
            retry_after=retry_after,
            attempts_made=self._max_retries + 1,
        ) from error

    async def _handle_rate_limit_in_chat(
        self,
        error: RateLimitError,
        attempt: int,
        max_attempts: int,
    ) -> tuple[int, ChatChunk | None]:
        """Handle rate limit error during chat. Returns (next_attempt, optional_chunk)."""
        retry_after, delay, is_daily = self._handle_rate_limit_sync(error, attempt)
        if is_daily or retry_after is not None:
            self._raise_rate_limit_error(error, retry_after, delay, is_daily, attempt)
        # Return chunk to yield and updated attempt
        chunk = ChatChunk(
            rate_limit_status=RateLimitStatus(
                attempt=attempt + 1,
                max_attempts=max_attempts,
                retry_after=delay,
            )
        )
        return delay, chunk

    async def _handle_api_error_in_chat(self, error: APIError, attempt: int) -> int:
        """Handle API error during chat. Returns next attempt or raises."""
        if self._is_tool_call_error(error):
            new_attempt = await self._handle_tool_call_error(error, attempt)
            if new_attempt >= 0:
                return new_attempt
            raise GroqToolCallError(
                "The AI failed to generate a valid response. Please try rephrasing your request."
            ) from error
        logger.exception("Groq API error: %s", error)
        raise GroqRequestError(f"Groq API error: {error}") from error

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
            Also yields ChatChunk with rate_limit_status when rate limited.

        Raises:
            GroqAuthError: If API key is not configured.
            GroqRateLimitError: If rate limited after all retries.
            GroqRequestError: If the request fails.
        """
        client = self._get_client()
        kwargs = self._build_chat_kwargs(messages, tools, stream, temperature, max_tokens)
        attempt = 0
        max_attempts = self._max_retries + 1

        while attempt <= self._max_retries:
            try:
                async for chunk in self._execute_chat(client, kwargs, stream):
                    yield chunk
                return
            except RateLimitError as e:
                delay, chunk = await self._handle_rate_limit_in_chat(e, attempt, max_attempts)
                if chunk:
                    yield chunk
                await asyncio.sleep(delay)
                attempt += 1
            except APIError as e:
                attempt = await self._handle_api_error_in_chat(e, attempt)
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
