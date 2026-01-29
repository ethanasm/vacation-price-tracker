"""Schemas for conversation and message API responses."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    """Response schema for a single message."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    """Response schema for a conversation (without messages)."""

    id: uuid.UUID
    user_id: uuid.UUID
    title: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationWithMessagesResponse(BaseModel):
    """Response schema for a conversation with its messages."""

    id: uuid.UUID
    user_id: uuid.UUID
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ConversationListResponse(BaseModel):
    """Response schema for listing conversations."""

    conversations: list[ConversationResponse]
    total: int


class CreateMessageRequest(BaseModel):
    """Request schema for creating a new message (user input)."""

    content: str = Field(..., min_length=1, max_length=32000)
    conversation_id: uuid.UUID | None = None


class ChatResponse(BaseModel):
    """Response schema for a chat message exchange.

    Contains the assistant's response and optionally the conversation ID
    if a new conversation was created.
    """

    conversation_id: uuid.UUID
    message: MessageResponse
    # For streaming, this would be replaced with SSE events
