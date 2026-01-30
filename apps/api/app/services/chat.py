"""Chat service for processing messages with LLM and tool execution.

This module provides:
- process_chat_with_tools: Main async generator for chat processing
- Tool call loop with multi-turn support
- Message persistence integration
- Streaming SSE chunk generation
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import TYPE_CHECKING, Any

from app.clients.groq import (
    GroqClient,
    GroqClientError,
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
from app.schemas.chat import ChatChunk
from app.schemas.mcp import get_all_tools
from app.services.conversation import ConversationService, conversation_service
from app.services.mcp_router import MCPRouter, get_mcp_router

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models.conversation import Conversation
    from app.models.trip import Trip

logger = logging.getLogger(__name__)

# Maximum number of tool call rounds to prevent infinite loops
MAX_TOOL_ROUNDS = 10


class ChatServiceError(Exception):
    """Base error for chat service failures."""


class ToolLoopExceededError(ChatServiceError):
    """Raised when tool call loop exceeds maximum rounds."""


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


async def process_chat_with_tools(
    messages: list[GroqMessage],
    user_id: str,
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

    Args:
        messages: List of conversation messages in Groq format.
        user_id: UUID of the authenticated user for tool authorization.
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

    round_count = 0

    while round_count < MAX_TOOL_ROUNDS:
        round_count += 1
        logger.debug("Tool round %d/%d", round_count, MAX_TOOL_ROUNDS)

        try:
            # Accumulate response from streaming
            full_content = ""
            accumulated_tool_calls: list[ToolCall] = []

            async for chunk in client.chat(messages=messages, tools=tools, stream=True):
                # Stream content as it arrives
                if chunk.content:
                    full_content += chunk.content
                    yield ChatChunk.text(chunk.content)

                # Collect tool calls (they come at the end of the stream)
                if chunk.tool_calls:
                    accumulated_tool_calls.extend(chunk.tool_calls)

            # If no tool calls, we're done
            if not accumulated_tool_calls:
                logger.debug("No tool calls, conversation complete")
                return

            # Process tool calls
            logger.info(
                "Processing %d tool calls for user %s",
                len(accumulated_tool_calls),
                user_id[:8] + "..." if len(user_id) > 8 else user_id,
            )

            # Add assistant message with tool calls to conversation
            messages.append(
                GroqMessage(
                    role="assistant",
                    content=full_content or "",
                    tool_calls=_tool_calls_to_dict(accumulated_tool_calls),
                )
            )

            # Execute each tool call and add results to messages
            for tool_call in accumulated_tool_calls:
                tool_name = tool_call.function.name
                arguments_json = tool_call.function.arguments

                # Notify about tool call
                yield ChatChunk.tool_calling(
                    tool_call_id=tool_call.id,
                    name=tool_name,
                    arguments=arguments_json,
                )

                # Execute the tool
                result = await router.execute_from_json(
                    tool_name,
                    arguments_json,
                    user_id,
                )

                # Notify about result
                yield ChatChunk.tool_executed(
                    tool_call_id=tool_call.id,
                    name=tool_name,
                    result=result.data if result.success else {"error": result.error},
                    success=result.success,
                )

                # Add tool result to messages for the next round
                result_content = json.dumps(result.data) if result.success else json.dumps({"error": result.error})
                messages.append(
                    GroqMessage(
                        role="tool",
                        content=result_content,
                        tool_call_id=tool_call.id,
                        name=tool_name,
                    )
                )

            # Continue loop to get LLM response after tool execution

        except GroqClientError as e:
            logger.exception("Groq client error during chat processing")
            yield ChatChunk.error_chunk(f"LLM service error: {e}")
            return

    # If we get here, we exceeded max rounds
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
        # 1. Get or create conversation
        conversation = await self._conversation_svc.get_or_create_conversation(thread_id, user.id, db)
        logger.info(
            "Chat: user=%s conversation=%s thread_id=%s",
            str(user.id)[:8],
            str(conversation.id)[:8],
            thread_id,
        )

        # 2. Save user message
        await self._conversation_svc.add_message(
            conversation_id=conversation.id,
            role="user",
            content=message,
            db=db,
        )

        # 3. Build system prompt with user context
        system_prompt = build_system_prompt(user, trips, trip_prices)

        # 4. Get message history that fits in context window
        history_messages = await self._conversation_svc.get_messages_for_context(
            conversation.id, db, system_prompt=system_prompt
        )

        # 5. Convert to Groq format with system prompt first
        groq_messages: list[GroqMessage] = [GroqMessage(role="system", content=system_prompt)]
        groq_messages.extend(self._conversation_svc.messages_to_groq_format(history_messages))

        # 6. Process chat with tools and stream response
        full_response = ""
        tool_calls_made: list[dict[str, Any]] = []
        first_chunk = True

        try:
            async for chunk in process_chat_with_tools(
                messages=groq_messages,
                user_id=str(user.id),
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

                # Track tool calls for persistence
                if chunk.tool_call:
                    tool_calls_made.append(
                        {
                            "id": chunk.tool_call.id,
                            "name": chunk.tool_call.name,
                            "arguments": chunk.tool_call.arguments,
                        }
                    )

                yield chunk

            # 7. Save assistant response
            if full_response or tool_calls_made:
                await self._conversation_svc.add_message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=full_response,
                    db=db,
                    tool_calls=tool_calls_made if tool_calls_made else None,
                )

            # 8. Prune old messages if needed
            await self._conversation_svc.prune_old_messages(conversation.id, db)

            # 9. Commit the transaction
            await db.commit()

            # 10. Send done chunk with thread_id
            yield ChatChunk.done_chunk(thread_id=conversation.id)

        except Exception as e:
            logger.exception("Error during chat processing")
            await db.rollback()
            yield ChatChunk.error_chunk(f"Chat processing error: {e}")
            yield ChatChunk.done_chunk(thread_id=conversation.id)

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


# Singleton instance for shared use
chat_service = ChatService()
