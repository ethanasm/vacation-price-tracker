"""Chat API router for LLM-powered conversation with tool execution.

This module provides:
- POST /v1/chat/messages: Streaming SSE endpoint for chat messages
- POST /v1/chat/elicitation/{tool_call_id}: Submit elicitation form data
- GET /v1/chat/conversations: List user's conversations
- GET /v1/chat/conversations/{thread_id}: Get conversation history
- DELETE /v1/chat/conversations/{thread_id}: Delete a conversation
"""

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.deps import get_db
from app.models.trip import Trip
from app.routers.auth import UserResponse, get_current_user
from app.schemas.base import APIResponse
from app.schemas.chat import (
    ChatChunk,
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    ElicitationSubmissionRequest,
)
from app.services.chat import ChatService, chat_service
from app.services.conversation import ConversationService, conversation_service

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

router = APIRouter()
logger = logging.getLogger(__name__)


class ConversationNotFound(NotFoundError):
    """Raised when a conversation is not found."""

    def __init__(self) -> None:
        super().__init__(detail="Conversation not found")


async def _get_user_trips_for_context(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[list[Trip], dict[str, float]]:
    """Fetch user's trips and latest prices for system prompt context.

    Returns:
        Tuple of (trips list, price dict mapping trip_id to total price)
    """
    from sqlalchemy import func
    from sqlalchemy.orm import aliased

    from app.models.price_snapshot import PriceSnapshot

    # Get all user trips
    result = await db.execute(select(Trip).where(Trip.user_id == user_id))
    trips = list(result.scalars().all())

    if not trips:
        return [], {}

    # Get latest prices for each trip
    latest_snapshot_at = (
        select(
            PriceSnapshot.trip_id,
            func.max(PriceSnapshot.created_at).label("latest_created_at"),
        )
        .group_by(PriceSnapshot.trip_id)
        .subquery()
    )
    latest_snapshot = aliased(PriceSnapshot)

    trip_ids = [t.id for t in trips]
    price_stmt = (
        select(latest_snapshot.trip_id, latest_snapshot.total_price)
        .join(
            latest_snapshot_at,
            (latest_snapshot.trip_id == latest_snapshot_at.c.trip_id)
            & (latest_snapshot.created_at == latest_snapshot_at.c.latest_created_at),
        )
        .where(latest_snapshot.trip_id.in_(trip_ids))
    )
    price_result = await db.execute(price_stmt)
    prices = {str(row.trip_id): float(row.total_price) for row in price_result if row.total_price}

    return trips, prices


@router.post("/v1/chat/messages")
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
    svc: ChatService = Depends(lambda: chat_service),
) -> StreamingResponse:
    """Send a chat message and stream the response.

    This endpoint accepts a user message and returns a Server-Sent Events (SSE)
    stream with the assistant's response. The stream includes:

    - **content**: Text content from the LLM
    - **tool_call**: When the LLM invokes a tool
    - **tool_result**: Result from tool execution
    - **error**: If an error occurs
    - **done**: Stream completion marker

    Each chunk is a JSON object with a `type` field indicating the chunk type.

    Args:
        request: Chat message request body.
        db: Database session.
        current_user: Authenticated user.
        svc: Chat service instance.

    Returns:
        StreamingResponse with SSE content.
    """
    from app.models.user import User

    user_id = uuid.UUID(current_user.id)

    # Get user from database for system prompt context
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalars().first()

    if not user:
        # This shouldn't happen if auth is working correctly
        logger.error("User not found in database: %s", user_id)
        raise ConversationNotFound()

    # Get user's trips for context injection
    trips, trip_prices = await _get_user_trips_for_context(user_id, db)

    async def generate() -> AsyncGenerator[str, None]:
        """Generate SSE chunks from the chat service."""
        async for chunk in svc.send_message(
            user=user,
            message=request.message,
            db=db,
            thread_id=request.thread_id,
            trips=trips,
            trip_prices=trip_prices,
        ):
            yield f"data: {chunk.model_dump_json()}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get(
    "/v1/chat/conversations",
    response_model=APIResponse[list[ConversationResponse]],
)
async def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
    svc: ConversationService = Depends(lambda: conversation_service),
) -> APIResponse[list[ConversationResponse]]:
    """List the current user's conversations.

    Returns conversations sorted by most recently updated.

    Args:
        limit: Maximum number of conversations to return.
        offset: Number of conversations to skip.
        db: Database session.
        current_user: Authenticated user.
        svc: Conversation service instance.

    Returns:
        List of conversation metadata.
    """
    user_id = uuid.UUID(current_user.id)
    conversations = await svc.list_conversations(user_id, db, limit=limit, offset=offset)

    return APIResponse(
        data=[
            ConversationResponse(
                id=conv.id,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
            )
            for conv in conversations
        ]
    )


@router.get(
    "/v1/chat/conversations/{thread_id}",
    response_model=APIResponse[ChatResponse],
)
async def get_conversation(
    thread_id: uuid.UUID,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
    svc: ChatService = Depends(lambda: chat_service),
) -> APIResponse[ChatResponse]:
    """Get a conversation with its message history.

    Args:
        thread_id: Conversation UUID.
        limit: Maximum number of messages to return.
        db: Database session.
        current_user: Authenticated user.
        svc: Chat service instance.

    Returns:
        Conversation metadata and messages.

    Raises:
        ConversationNotFound: If conversation doesn't exist or doesn't belong to user.
    """
    from app.models.user import User

    user_id = uuid.UUID(current_user.id)
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalars().first()

    if not user:
        raise ConversationNotFound()

    conversation, messages = await svc.get_conversation_history(
        user=user,
        thread_id=thread_id,
        db=db,
        limit=limit,
    )

    if not conversation:
        raise ConversationNotFound()

    return APIResponse(
        data=ChatResponse(
            conversation=ConversationResponse(
                id=conversation.id,
                title=conversation.title,
                created_at=conversation.created_at,
                updated_at=conversation.updated_at,
            ),
            messages=[
                ChatMessageResponse(
                    id=msg.id,
                    role=msg.role,
                    content=msg.content,
                    tool_calls=msg.tool_calls,
                    tool_call_id=msg.tool_call_id,
                    name=msg.name,
                    created_at=msg.created_at,
                )
                for msg in messages
            ],
        )
    )


@router.delete("/v1/chat/conversations/{thread_id}", status_code=204)
async def delete_conversation(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
    svc: ConversationService = Depends(lambda: conversation_service),
) -> None:
    """Delete a conversation and all its messages.

    Args:
        thread_id: Conversation UUID to delete.
        db: Database session.
        current_user: Authenticated user.
        svc: Conversation service instance.

    Raises:
        ConversationNotFound: If conversation doesn't exist or doesn't belong to user.
    """
    user_id = uuid.UUID(current_user.id)
    deleted = await svc.delete_conversation(thread_id, user_id, db)

    if not deleted:
        raise ConversationNotFound()

    await db.commit()


class ElicitationNotFound(NotFoundError):
    """Raised when an elicitation tool_call_id is not found or invalid."""

    def __init__(self) -> None:
        super().__init__(detail="Elicitation not found or invalid")


class ToolNotRegistered(NotFoundError):
    """Raised when the specified tool is not registered."""

    def __init__(self, tool_name: str) -> None:
        super().__init__(detail=f"Tool not registered: {tool_name}")


@router.post("/v1/chat/elicitation/{tool_call_id}")
async def submit_elicitation(
    tool_call_id: str,
    request: ElicitationSubmissionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
    conv_svc: ConversationService = Depends(lambda: conversation_service),
) -> StreamingResponse:
    """Submit elicitation form data to complete a pending tool execution.

    When a tool requests elicitation (missing required fields), the frontend
    displays a form to collect the data. This endpoint receives the submitted
    form data and executes the tool with complete arguments.

    The response is an SSE stream containing:
    - **tool_result**: Result from the tool execution
    - **content**: Optional follow-up text from the LLM
    - **done**: Stream completion marker

    Args:
        tool_call_id: Unique identifier from the elicitation request.
        request: Elicitation submission containing thread_id, tool_name, and form data.
        db: Database session.
        current_user: Authenticated user.
        conv_svc: Conversation service instance.

    Returns:
        StreamingResponse with SSE content.

    Raises:
        ConversationNotFound: If the conversation doesn't exist or doesn't belong to user.
        ToolNotRegistered: If the specified tool is not registered.
    """
    from app.services.mcp_router import get_mcp_router

    user_id = uuid.UUID(current_user.id)

    # Verify conversation exists and belongs to user
    conversation = await conv_svc.get_conversation(
        request.thread_id, user_id, db
    )
    if not conversation:
        raise ConversationNotFound()

    # Get MCP router and verify tool exists
    router_instance = get_mcp_router()
    if not router_instance.is_registered(request.tool_name):
        raise ToolNotRegistered(request.tool_name)

    async def generate() -> AsyncGenerator[str, None]:
        """Execute the tool and stream results."""
        # Execute the tool with submitted data
        result = await router_instance.execute(
            tool_name=request.tool_name,
            arguments=request.data,
            user_id=str(user_id),
            db=db,
        )

        # Yield tool result chunk
        yield f"data: {ChatChunk.tool_executed(tool_call_id=tool_call_id, name=request.tool_name, result=result.data if result.success else {'error': result.error}, success=result.success).model_dump_json()}\n\n"

        # Save tool result to conversation history
        import json

        await conv_svc.add_message(
            conversation_id=conversation.id,
            role="tool",
            content=json.dumps(result.data) if result.success else json.dumps({"error": result.error}),
            db=db,
            tool_call_id=tool_call_id,
            name=request.tool_name,
        )

        await db.commit()

        # Yield done chunk with thread_id
        yield f"data: {ChatChunk.done_chunk(thread_id=request.thread_id).model_dump_json()}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
