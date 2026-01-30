"""Chat API schemas for request/response models and SSE chunks.

This module defines:
- ChatRequest: Input model for the POST /v1/chat/messages endpoint
- ChatResponse: Response wrapper for chat operations
- ChatChunk: Individual SSE chunk types (content, tool_call, tool_result, error, done)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ChatChunkType(str, Enum):
    """Types of SSE chunks in the chat stream."""

    CONTENT = "content"  # Text content from the LLM
    TOOL_CALL = "tool_call"  # LLM is calling a tool
    TOOL_RESULT = "tool_result"  # Result from tool execution
    ERROR = "error"  # Error occurred during processing
    DONE = "done"  # Stream complete


class ChatRequest(BaseModel):
    """Request body for sending a chat message.

    Attributes:
        message: The user's message content.
        thread_id: Optional conversation thread ID. If not provided,
                  a new conversation will be created.
    """

    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="The user's message content",
    )
    thread_id: uuid.UUID | None = Field(
        default=None,
        description="Conversation thread ID. If not provided, creates a new conversation.",
    )


class ChatMessageResponse(BaseModel):
    """Response model for a single chat message in history."""

    id: uuid.UUID
    role: str
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    name: str | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    """Response model for conversation metadata."""

    id: uuid.UUID
    title: str | None = None
    created_at: datetime
    updated_at: datetime


class ChatResponse(BaseModel):
    """Response model for non-streaming chat operations.

    Used for conversation listing and retrieval, not for the
    main streaming chat endpoint.
    """

    conversation: ConversationResponse
    messages: list[ChatMessageResponse] = Field(default_factory=list)


class ToolCallChunk(BaseModel):
    """Represents a tool call being made by the LLM."""

    id: str
    name: str
    arguments: str  # JSON string of arguments


class ToolResultChunk(BaseModel):
    """Represents the result of a tool execution."""

    tool_call_id: str
    name: str
    result: dict[str, Any]
    success: bool


class ChatChunk(BaseModel):
    """Individual chunk in the SSE stream.

    Each chunk has a type and optional associated data depending
    on the chunk type:
    - content: text string
    - tool_call: ToolCallChunk
    - tool_result: ToolResultChunk
    - error: error message string
    - done: no additional data
    """

    type: ChatChunkType
    content: str | None = None
    tool_call: ToolCallChunk | None = None
    tool_result: ToolResultChunk | None = None
    error: str | None = None
    thread_id: uuid.UUID | None = None  # Included on first and last chunk

    @classmethod
    def text(cls, content: str) -> ChatChunk:
        """Create a content chunk with text."""
        return cls(type=ChatChunkType.CONTENT, content=content)

    @classmethod
    def tool_calling(cls, tool_call_id: str, name: str, arguments: str) -> ChatChunk:
        """Create a tool_call chunk."""
        return cls(
            type=ChatChunkType.TOOL_CALL,
            tool_call=ToolCallChunk(id=tool_call_id, name=name, arguments=arguments),
        )

    @classmethod
    def tool_executed(
        cls,
        tool_call_id: str,
        name: str,
        result: dict[str, Any],
        success: bool,
    ) -> ChatChunk:
        """Create a tool_result chunk."""
        return cls(
            type=ChatChunkType.TOOL_RESULT,
            tool_result=ToolResultChunk(
                tool_call_id=tool_call_id,
                name=name,
                result=result,
                success=success,
            ),
        )

    @classmethod
    def error_chunk(cls, error_message: str) -> ChatChunk:
        """Create an error chunk."""
        return cls(type=ChatChunkType.ERROR, error=error_message)

    @classmethod
    def done_chunk(cls, thread_id: uuid.UUID | None = None) -> ChatChunk:
        """Create a done chunk indicating stream completion."""
        return cls(type=ChatChunkType.DONE, thread_id=thread_id)
