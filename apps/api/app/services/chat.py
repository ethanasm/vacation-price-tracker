"""Chat service for processing messages with LLM and tool execution.

This module provides:
- process_chat_with_tools: Main async generator for chat processing
- Tool call loop with multi-turn support
- Message persistence integration
- Streaming SSE chunk generation
- Query validation for travel-related requests
- Tool retry limits to prevent infinite loops
"""

from __future__ import annotations

import json
import logging
import uuid
from collections import Counter
from typing import TYPE_CHECKING, Any

from app.clients.groq import (
    GroqClient,
    GroqClientError,
    GroqRateLimitError,
    GroqToolCallError,
    Tool,
    ToolCall,
    groq_client,
)
from app.clients.groq import (
    Message as GroqMessage,
)
from app.core.prompts import build_system_prompt
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import ChatChunk, ChatChunkType
from app.schemas.mcp import get_all_tools
from app.services.conversation import (
    ConversationService,
    conversation_service,
    enforce_conversation_limit,
    generate_title,
    get_first_exchange,
    should_generate_title,
    update_conversation_title,
)
from app.services.mcp_router import MCPRouter, ToolResult, get_mcp_router
from app.services.query_validator import validate_query

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.conversation import Conversation
    from app.models.trip import Trip

logger = logging.getLogger(__name__)

# Maximum number of tool call rounds to prevent infinite loops
MAX_TOOL_ROUNDS = 10

# Maximum number of times a single tool can be called per conversation turn
MAX_TOOL_RETRIES = 3


class ChatServiceError(Exception):
    """Base error for chat service failures."""


class ToolLoopExceededError(ChatServiceError):
    """Raised when tool call loop exceeds maximum rounds."""


class ToolRetryExceededError(ChatServiceError):
    """Raised when a specific tool exceeds retry limit."""


class ToolRetryTracker:
    """Tracks tool call attempts to prevent infinite retries.

    Each tool can only be called MAX_TOOL_RETRIES times per conversation turn.
    This prevents the LLM from getting stuck in a loop calling the same tool.
    """

    def __init__(self, max_retries: int = MAX_TOOL_RETRIES) -> None:
        """Initialize the tracker.

        Args:
            max_retries: Maximum times a tool can be called per turn.
        """
        self._counts: Counter[str] = Counter()
        self._max_retries = max_retries

    def record_call(self, tool_name: str) -> None:
        """Record a tool call attempt.

        Args:
            tool_name: Name of the tool being called.
        """
        self._counts[tool_name] += 1

    def is_exceeded(self, tool_name: str) -> bool:
        """Check if tool has exceeded retry limit.

        Args:
            tool_name: Name of the tool to check.

        Returns:
            True if tool has been called more than max_retries times.
        """
        return self._counts[tool_name] >= self._max_retries

    def get_count(self, tool_name: str) -> int:
        """Get current call count for a tool.

        Args:
            tool_name: Name of the tool.

        Returns:
            Number of times the tool has been called.
        """
        return self._counts[tool_name]

    def get_exceeded_tools(self) -> list[str]:
        """Get list of tools that have exceeded their retry limit.

        Returns:
            List of tool names that hit the limit.
        """
        return [name for name, count in self._counts.items() if count >= self._max_retries]

    def reset(self) -> None:
        """Reset all counters."""
        self._counts.clear()


def _get_rate_limit_error_message(error: GroqRateLimitError) -> str:
    """Get user-friendly error message for rate limit errors."""
    if error.is_daily_limit:
        return (
            "You've reached the daily AI usage limit. Please try again tomorrow, "
            "or consider upgrading to a higher tier at console.groq.com."
        )
    return "The AI service is currently busy. Please wait a moment and try again."


def _get_error_chunk(error: GroqClientError) -> ChatChunk:
    """Convert a Groq error to an appropriate error chunk."""
    if isinstance(error, GroqRateLimitError):
        return ChatChunk.error_chunk(_get_rate_limit_error_message(error))
    if isinstance(error, GroqToolCallError):
        return ChatChunk.error_chunk(str(error))
    return ChatChunk.error_chunk(f"LLM service error: {error}")


def _log_groq_error(error: GroqClientError) -> None:
    """Log Groq error with appropriate level."""
    if isinstance(error, GroqRateLimitError):
        logger.warning("Rate limit exceeded: %s (daily_limit=%s)", error, error.is_daily_limit)
    elif isinstance(error, GroqToolCallError):
        logger.warning("Tool call generation failed: %s", error)
    else:
        logger.exception("Groq client error during chat processing")


def _convert_tools_to_groq_format() -> list[Tool]:
    """Convert MCP tool definitions to Groq Tool format."""
    mcp_tools = get_all_tools()
    return [
        Tool(
            type="function",
            function=tool["function"],
        )
        for tool in mcp_tools
    ]


def _convert_db_messages_to_groq(messages: list[Message]) -> list[GroqMessage]:
    """Convert database Message models to Groq API format."""
    return [
        GroqMessage(
            role=msg.role,
            content=msg.content,
            tool_calls=msg.tool_calls,
            tool_call_id=msg.tool_call_id,
            name=msg.name,
        )
        for msg in messages
    ]


def _tool_calls_to_dict(tool_calls: list[ToolCall]) -> list[dict[str, Any]]:
    """Convert ToolCall objects to dict format for storage."""
    return [
        {
            "id": tc.id,
            "type": tc.type,
            "function": {
                "name": tc.function.name,
                "arguments": tc.function.arguments,
            },
        }
        for tc in tool_calls
    ]


async def _stream_llm_response(
    client: GroqClient,
    messages: list[GroqMessage],
    tools: list[dict[str, Any]],
) -> AsyncGenerator[tuple[ChatChunk | None, str, list[ToolCall]], None]:
    """Stream LLM response and yield chunks with accumulated state.

    Yields tuples of (chunk_to_yield, full_content, accumulated_tool_calls).
    """
    full_content = ""
    accumulated_tool_calls: list[ToolCall] = []

    async for chunk in client.chat(messages=messages, tools=tools, stream=True):
        if chunk.rate_limit_status:
            status = chunk.rate_limit_status
            yield (
                ChatChunk.rate_limited_chunk(
                    attempt=status.attempt,
                    max_attempts=status.max_attempts,
                    retry_after=status.retry_after,
                ),
                full_content,
                accumulated_tool_calls,
            )
            continue

        if chunk.content:
            full_content += chunk.content
            yield ChatChunk.text(chunk.content), full_content, accumulated_tool_calls

        if chunk.tool_calls:
            accumulated_tool_calls.extend(chunk.tool_calls)

    yield None, full_content, accumulated_tool_calls


def _is_elicitation_result(result: ToolResult) -> bool:
    """Check if a tool result indicates elicitation is needed.

    A tool signals elicitation is needed by returning a successful result
    with data containing needs_elicitation: True.

    Args:
        result: The tool execution result to check.

    Returns:
        True if the tool is requesting elicitation, False otherwise.
    """
    return (
        result.success
        and result.data is not None
        and result.data.get("needs_elicitation", False) is True
    )


async def _execute_tool_call(
    tool_call: ToolCall,
    router: MCPRouter,
    user_id: str,
    db: AsyncSession,
) -> AsyncGenerator[tuple[ChatChunk, ToolResult | None], None]:
    """Execute a single tool call and yield chunks with final result.

    If the tool returns a result indicating elicitation is needed
    (i.e., result.data contains needs_elicitation: True), an elicitation
    chunk is yielded instead of a tool_result chunk. This signals the
    frontend to open a form UI to collect the missing data.
    """
    tool_name = tool_call.function.name
    arguments_json = tool_call.function.arguments

    yield ChatChunk.tool_calling(
        tool_call_id=tool_call.id,
        name=tool_name,
        arguments=arguments_json,
    ), None

    result = await router.execute_from_json(tool_name, arguments_json, user_id, db)

    # Check if tool is requesting elicitation for missing fields
    if _is_elicitation_result(result):
        logger.info(
            "Tool %s requesting elicitation, missing_fields=%s",
            tool_name,
            result.data.get("missing_fields", []),
        )
        yield ChatChunk.elicitation_request(
            tool_call_id=tool_call.id,
            tool_name=tool_name,
            component=result.data.get("component", "unknown"),
            prefilled=result.data.get("prefilled", {}),
            missing_fields=result.data.get("missing_fields", []),
        ), result
    else:
        logger.info("Tool %s executed, success=%s, yielding tool_result chunk", tool_name, result.success)
        yield ChatChunk.tool_executed(
            tool_call_id=tool_call.id,
            name=tool_name,
            result=result.data if result.success else {"error": result.error},
            success=result.success,
        ), result


def _create_tool_result_message(tool_call: ToolCall, result: ToolResult) -> GroqMessage:
    """Create a tool result message for the conversation."""
    result_content = json.dumps(result.data) if result.success else json.dumps({"error": result.error})
    return GroqMessage(
        role="tool",
        content=result_content,
        tool_call_id=tool_call.id,
        name=tool_call.function.name,
    )


def _create_assistant_message(content: str, tool_calls: list[ToolCall]) -> GroqMessage:
    """Create an assistant message with tool calls for the conversation."""
    return GroqMessage(
        role="assistant",
        content=content or "",
        tool_calls=_tool_calls_to_dict(tool_calls),
    )


def _log_tool_call_start(user_id: str, tool_count: int) -> None:
    """Log the start of tool call processing."""
    user_display = user_id[:8] + "..." if len(user_id) > 8 else user_id
    logger.info("Processing %d tool calls for user %s", tool_count, user_display)


async def _process_tool_calls(
    tool_calls: list[ToolCall],
    router: MCPRouter,
    user_id: str,
    db: AsyncSession,
    messages: list[GroqMessage],
    retry_tracker: ToolRetryTracker | None = None,
) -> AsyncGenerator[ChatChunk | tuple[ChatChunk, bool], None]:
    """Execute tool calls and yield chunks, appending results to messages.

    Args:
        tool_calls: List of tool calls to execute.
        router: MCP router for tool execution.
        user_id: User ID for authorization.
        db: Database session.
        messages: Message list to append results to.
        retry_tracker: Optional tracker for tool retry limits.

    Yields:
        ChatChunk objects, or (ChatChunk, stop_flag) tuples when processing should stop.
        stop_flag is True when retry limit is hit or elicitation is requested.
    """
    for tool_call in tool_calls:
        tool_name = tool_call.function.name

        # Check if tool has exceeded retry limit
        if retry_tracker is not None:
            if retry_tracker.is_exceeded(tool_name):
                logger.warning(
                    "Tool %s exceeded retry limit (%d calls), skipping",
                    tool_name,
                    retry_tracker.get_count(tool_name),
                )
                # Yield error chunk indicating tool was skipped
                yield ChatChunk.error_chunk(
                    f"Tool '{tool_name}' has been called too many times ({MAX_TOOL_RETRIES}). "
                    "Please try a different approach or rephrase your request."
                ), True
                continue

            retry_tracker.record_call(tool_name)

        result = None
        elicitation_requested = False
        async for chunk, tool_result in _execute_tool_call(tool_call, router, user_id, db):
            # Check if this is an elicitation chunk
            if chunk.type == ChatChunkType.ELICITATION:
                elicitation_requested = True
                # Yield the elicitation chunk with stop flag
                yield chunk, True
            else:
                yield chunk
            if tool_result is not None:
                result = tool_result

        # If elicitation was requested, stop processing further tool calls
        # The frontend will collect user input and submit to continue
        if elicitation_requested:
            logger.info("Elicitation requested, stopping tool call processing")
            return

        if result is not None:
            messages.append(_create_tool_result_message(tool_call, result))


async def _run_single_tool_round(
    client: GroqClient,
    messages: list[GroqMessage],
    tools: list[Tool],
    router: MCPRouter,
    user_id: str,
    db: AsyncSession,
    retry_tracker: ToolRetryTracker | None = None,
) -> AsyncGenerator[tuple[ChatChunk | None, bool], None]:
    """Run a single round of LLM + tool execution.

    Args:
        client: Groq client for LLM calls.
        messages: Conversation messages.
        tools: Available tools.
        router: MCP router for tool execution.
        user_id: User ID for authorization.
        db: Database session.
        retry_tracker: Optional tracker for tool retry limits.

    Yields:
        (chunk, should_continue) tuples. should_continue is False when no more rounds needed.
    """
    full_content = ""
    accumulated_tool_calls: list[ToolCall] = []

    async for chunk, content, tool_calls in _stream_llm_response(client, messages, tools):
        full_content = content
        accumulated_tool_calls = tool_calls
        if chunk:
            yield chunk, True

    if not accumulated_tool_calls:
        logger.debug("No tool calls, conversation complete")
        yield None, False
        return

    _log_tool_call_start(user_id, len(accumulated_tool_calls))
    messages.append(_create_assistant_message(full_content, accumulated_tool_calls))

    any_exceeded = False
    async for result in _process_tool_calls(
        accumulated_tool_calls, router, user_id, db, messages, retry_tracker
    ):
        # Handle both plain chunks and (chunk, exceeded) tuples
        if isinstance(result, tuple):
            chunk, exceeded = result
            if exceeded:
                any_exceeded = True
            yield chunk, True
        else:
            yield result, True

    # If any tools exceeded their retry limit, signal to stop processing
    if any_exceeded:
        yield None, False


async def process_chat_with_tools(
    messages: list[GroqMessage],
    user_id: str,
    db: AsyncSession,
    *,
    client: GroqClient | None = None,
    router: MCPRouter | None = None,
) -> AsyncGenerator[ChatChunk, None]:
    """Process chat messages with tool execution support.

    This is the main chat processing function that:
    1. Sends messages to the Groq LLM with available tools
    2. Streams content chunks as they arrive
    3. Executes any tool calls made by the LLM
    4. Continues the conversation with tool results
    5. Repeats until the LLM responds without tool calls
    6. Tracks tool retry counts to prevent infinite loops on specific tools

    Args:
        messages: List of conversation messages in Groq format.
        user_id: UUID of the authenticated user for tool authorization.
        db: Database session for tool execution.
        client: Optional Groq client (uses singleton if not provided).
        router: Optional MCP router (uses singleton if not provided).

    Yields:
        ChatChunk objects for each piece of the response.

    Raises:
        ChatServiceError: If an unrecoverable error occurs.
        ToolLoopExceededError: If tool calls exceed MAX_TOOL_ROUNDS.
    """
    client = client or groq_client
    router = router or get_mcp_router()
    tools = _convert_tools_to_groq_format()

    # Create retry tracker for this conversation turn
    retry_tracker = ToolRetryTracker(max_retries=MAX_TOOL_RETRIES)

    for round_count in range(1, MAX_TOOL_ROUNDS + 1):
        logger.debug("Tool round %d/%d", round_count, MAX_TOOL_ROUNDS)

        try:
            should_continue = True
            async for chunk, continue_flag in _run_single_tool_round(
                client, messages, tools, router, user_id, db, retry_tracker
            ):
                should_continue = continue_flag
                if chunk:
                    yield chunk

            if not should_continue:
                # Log if any tools hit their retry limit
                exceeded = retry_tracker.get_exceeded_tools()
                if exceeded:
                    logger.warning("Tools that hit retry limit: %s", exceeded)
                return

        except GroqClientError as e:
            _log_groq_error(e)
            yield _get_error_chunk(e)
            return

    logger.warning("Tool loop exceeded %d rounds, terminating", MAX_TOOL_ROUNDS)
    yield ChatChunk.error_chunk(
        f"Tool execution exceeded maximum rounds ({MAX_TOOL_ROUNDS}). Please try a simpler request."
    )


class ChatService:
    """High-level chat service combining conversation management and LLM processing.

    This service provides the complete chat workflow:
    1. Load or create conversation
    2. Build message history with context window
    3. Process with LLM and tools
    4. Persist messages to database

    Example:
        service = ChatService()
        async for chunk in service.send_message(
            user=current_user,
            message="Track prices for Hawaii",
            thread_id=None,
            db=session,
        ):
            yield f"data: {chunk.model_dump_json()}\n\n"
    """

    def __init__(
        self,
        conversation_svc: ConversationService | None = None,
        groq_client_instance: GroqClient | None = None,
        mcp_router: MCPRouter | None = None,
    ) -> None:
        """Initialize the chat service.

        Args:
            conversation_svc: Optional conversation service (uses singleton if not provided).
            groq_client_instance: Optional Groq client (uses singleton if not provided).
            mcp_router: Optional MCP router (uses singleton if not provided).
        """
        self._conversation_svc = conversation_svc or conversation_service
        self._groq_client = groq_client_instance or groq_client
        self._mcp_router = mcp_router or get_mcp_router()

    async def send_message(
        self,
        user: User,
        message: str,
        db: AsyncSession,
        thread_id: uuid.UUID | None = None,
        trips: list[Trip] | None = None,
        trip_prices: dict[str, float] | None = None,
    ) -> AsyncGenerator[ChatChunk, None]:
        """Send a message and stream the response.

        Args:
            user: The authenticated user.
            message: User's message content.
            db: Database session.
            thread_id: Optional existing conversation ID.
            trips: Optional list of user's trips for context.
            trip_prices: Optional dict of trip_id -> current price.

        Yields:
            ChatChunk objects for each piece of the response.
        """
        # 0. Validate query is within travel scope
        validation = validate_query(message)
        if not validation.is_valid:
            logger.warning(
                "Query rejected - not travel-related: %s (reason: %s)",
                message[:50],
                validation.reason,
            )
            yield ChatChunk.text(
                "I'm a travel assistant focused on helping you track vacation prices. "
                "I can help you create trips, monitor flight and hotel prices, set price alerts, "
                "and manage your travel plans. Is there something travel-related I can help you with?"
            )
            yield ChatChunk.done_chunk(thread_id=thread_id)
            return

        # 1. Enforce conversation limit before creating new conversations
        if thread_id is None:
            await enforce_conversation_limit(user.id, db)

        # 2. Get or create conversation
        conversation = await self._conversation_svc.get_or_create_conversation(thread_id, user.id, db)
        logger.info(
            "Chat: user=%s conversation=%s thread_id=%s",
            str(user.id)[:8],
            str(conversation.id)[:8],
            thread_id,
        )

        # 3. Save user message
        await self._conversation_svc.add_message(
            conversation_id=conversation.id,
            role="user",
            content=message,
            db=db,
        )

        # 4. Build system prompt with user context
        system_prompt = build_system_prompt(user, trips, trip_prices)

        # 5. Get message history that fits in context window
        history_messages = await self._conversation_svc.get_messages_for_context(
            conversation.id, db, system_prompt=system_prompt
        )

        # 6. Convert to Groq format with system prompt first
        groq_messages: list[GroqMessage] = [GroqMessage(role="system", content=system_prompt)]
        groq_messages.extend(self._conversation_svc.messages_to_groq_format(history_messages))

        # 7. Process chat with tools and stream response
        full_response = ""
        tool_calls_made: list[dict[str, Any]] = []
        tool_results_to_save: list[dict[str, Any]] = []
        first_chunk = True

        try:
            async for chunk in process_chat_with_tools(
                messages=groq_messages,
                user_id=str(user.id),
                db=db,
                client=self._groq_client,
                router=self._mcp_router,
            ):
                # Include thread_id in first chunk
                if first_chunk:
                    chunk.thread_id = conversation.id
                    first_chunk = False

                # Accumulate content for persistence
                if chunk.content:
                    full_response += chunk.content

                # Track tool calls for persistence (must match Groq API format)
                if chunk.tool_call:
                    tool_calls_made.append(
                        {
                            "id": chunk.tool_call.id,
                            "type": "function",
                            "function": {
                                "name": chunk.tool_call.name,
                                "arguments": chunk.tool_call.arguments,
                            },
                        }
                    )

                # Track tool results for persistence
                if chunk.tool_result:
                    tool_results_to_save.append(
                        {
                            "tool_call_id": chunk.tool_result.tool_call_id,
                            "name": chunk.tool_result.name,
                            "result": chunk.tool_result.result,
                            "success": chunk.tool_result.success,
                        }
                    )

                yield chunk

            # 8. Save assistant response and tool results
            await self._save_messages(
                conversation.id, db, full_response, tool_calls_made, tool_results_to_save
            )

            # 9. Generate title if needed (first exchange completed)
            await self._maybe_generate_title(conversation.id, db)

            # 10. Prune old messages if needed
            await self._conversation_svc.prune_old_messages(conversation.id, db)

            # 11. Commit the transaction
            await db.commit()

            # 12. Send done chunk with thread_id
            yield ChatChunk.done_chunk(thread_id=conversation.id)

        except Exception as e:
            logger.exception("Error during chat processing")
            await db.rollback()
            yield ChatChunk.error_chunk(f"Chat processing error: {e}")
            yield ChatChunk.done_chunk(thread_id=conversation.id)

    async def _save_messages(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
        full_response: str,
        tool_calls_made: list[dict[str, Any]],
        tool_results_to_save: list[dict[str, Any]],
    ) -> None:
        """Save assistant response and tool result messages to database.

        Args:
            conversation_id: UUID of the conversation.
            db: Database session.
            full_response: Accumulated text response from assistant.
            tool_calls_made: List of tool calls made during this turn.
            tool_results_to_save: List of tool results to persist.
        """
        # Save assistant response (with tool calls if any)
        if full_response or tool_calls_made:
            await self._conversation_svc.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_response,
                db=db,
                tool_calls=tool_calls_made if tool_calls_made else None,
            )

        # Save tool result messages
        for tr in tool_results_to_save:
            await self._conversation_svc.add_message(
                conversation_id=conversation_id,
                role="tool",
                content=json.dumps(tr["result"]),
                db=db,
                tool_call_id=tr["tool_call_id"],
                name=tr["name"],
            )

    async def _maybe_generate_title(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        """Generate and save conversation title if conditions are met.

        Title is generated when:
        - Conversation has no title
        - Conversation has at least 1 user + 1 assistant message

        Args:
            conversation_id: UUID of the conversation.
            db: Database session.
        """
        try:
            if not await should_generate_title(conversation_id, db):
                return

            user_message, assistant_response = await get_first_exchange(
                conversation_id, db
            )

            if not user_message or not assistant_response:
                logger.debug(
                    "Skipping title generation: missing user or assistant message"
                )
                return

            title = await generate_title(user_message, assistant_response)
            await update_conversation_title(conversation_id, title, db)
            logger.info(
                "Generated title for conversation %s: %s",
                str(conversation_id)[:8],
                title[:50],
            )
        except Exception as e:
            # Don't fail the chat if title generation fails
            logger.warning(
                "Failed to generate title for conversation %s: %s",
                conversation_id,
                e,
            )

    async def get_conversation_history(
        self,
        user: User,
        thread_id: uuid.UUID,
        db: AsyncSession,
        limit: int | None = None,
    ) -> tuple[Conversation | None, list[Message]]:
        """Get conversation and message history.

        Args:
            user: The authenticated user.
            thread_id: Conversation ID to retrieve.
            db: Database session.
            limit: Optional maximum number of messages.

        Returns:
            Tuple of (conversation, messages) or (None, []) if not found.
        """
        conversation = await self._conversation_svc.get_conversation(thread_id, user.id, db)
        if not conversation:
            return None, []

        messages = await self._conversation_svc.get_messages(conversation.id, db, limit=limit)
        return conversation, messages

    async def continue_after_elicitation(
        self,
        user: User,
        conversation_id: uuid.UUID,
        db: AsyncSession,
        trips: list[Trip] | None = None,
        trip_prices: dict[str, float] | None = None,
    ) -> AsyncGenerator[ChatChunk, None]:
        """Continue a conversation after elicitation tool result is saved.

        This method is called after an elicitation form is submitted and the tool
        result has been saved to the conversation history. It continues the LLM
        conversation loop to generate a follow-up response and any additional
        tool calls (e.g., trigger_refresh after create_trip).

        Args:
            user: The authenticated user.
            conversation_id: UUID of the existing conversation.
            db: Database session.
            trips: Optional list of user's trips for context.
            trip_prices: Optional dict of trip_id -> current price.

        Yields:
            ChatChunk objects for each piece of the response.
        """
        logger.info(
            "Continuing conversation after elicitation: user=%s conversation=%s",
            str(user.id)[:8],
            str(conversation_id)[:8],
        )

        # 1. Build system prompt with user context
        system_prompt = build_system_prompt(user, trips, trip_prices)

        # 2. Get message history that fits in context window
        history_messages = await self._conversation_svc.get_messages_for_context(
            conversation_id, db, system_prompt=system_prompt
        )

        # 3. Convert to Groq format with system prompt first
        groq_messages: list[GroqMessage] = [GroqMessage(role="system", content=system_prompt)]
        groq_messages.extend(self._conversation_svc.messages_to_groq_format(history_messages))

        # 4. Process chat with tools and stream response
        full_response = ""
        tool_calls_made: list[dict[str, Any]] = []
        tool_results_to_save: list[dict[str, Any]] = []
        first_chunk = True

        try:
            async for chunk in process_chat_with_tools(
                messages=groq_messages,
                user_id=str(user.id),
                db=db,
                client=self._groq_client,
                router=self._mcp_router,
            ):
                # Include thread_id in first chunk
                if first_chunk:
                    chunk.thread_id = conversation_id
                    first_chunk = False

                # Accumulate content for persistence
                if chunk.content:
                    full_response += chunk.content

                # Track tool calls for persistence
                if chunk.tool_call:
                    tool_calls_made.append(
                        {
                            "id": chunk.tool_call.id,
                            "type": "function",
                            "function": {
                                "name": chunk.tool_call.name,
                                "arguments": chunk.tool_call.arguments,
                            },
                        }
                    )

                # Track tool results for persistence
                if chunk.tool_result:
                    tool_results_to_save.append(
                        {
                            "tool_call_id": chunk.tool_result.tool_call_id,
                            "name": chunk.tool_result.name,
                            "result": chunk.tool_result.result,
                            "success": chunk.tool_result.success,
                        }
                    )

                yield chunk

            # 5. Save assistant response and tool results
            await self._save_messages(
                conversation_id, db, full_response, tool_calls_made, tool_results_to_save
            )

            # 6. Prune old messages if needed
            await self._conversation_svc.prune_old_messages(conversation_id, db)

            # 7. Commit the transaction
            await db.commit()

            # 8. Send done chunk with thread_id
            yield ChatChunk.done_chunk(thread_id=conversation_id)

        except Exception as e:
            logger.exception("Error during elicitation continuation")
            await db.rollback()
            yield ChatChunk.error_chunk(f"Chat processing error: {e}")
            yield ChatChunk.done_chunk(thread_id=conversation_id)


# Singleton instance for shared use
chat_service = ChatService()
