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
    ELICITATION = "elicitation"  # Request user input via form
    ERROR = "error"  # Error occurred during processing
    RATE_LIMITED = "rate_limited"  # Rate limited, retrying
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


class RateLimitChunk(BaseModel):
    """Represents rate limit status during retries."""

    attempt: int  # Current attempt number (1-indexed)
    max_attempts: int  # Maximum number of attempts
    retry_after: float  # Seconds until next retry


class ElicitationChunk(BaseModel):
    """Request to open an external form for user input.

    When a tool requires additional information that wasn't provided in the
    conversation, this chunk signals the frontend to open a form UI component
    to collect the missing data.

    Attributes:
        tool_call_id: Unique identifier for this tool call, used to correlate
                      the submission back to the pending tool execution.
        tool_name: Name of the tool that requested elicitation (e.g., "create_trip").
        component: Frontend component to render (e.g., "create-trip-form").
        prefilled: Data already captured from the conversation that should be
                   pre-populated in the form.
        missing_fields: List of required field names that were not provided.
    """

    tool_call_id: str
    tool_name: str
    component: str
    prefilled: dict[str, Any]
    missing_fields: list[str] = Field(default_factory=list)


class ChatChunk(BaseModel):
    """Individual chunk in the SSE stream.

    Each chunk has a type and optional associated data depending
    on the chunk type:
    - content: text string
    - tool_call: ToolCallChunk
    - tool_result: ToolResultChunk
    - elicitation: ElicitationChunk requesting form input
    - error: error message string
    - rate_limited: RateLimitChunk with retry info
    - done: no additional data
    """

    type: ChatChunkType
    content: str | None = None
    tool_call: ToolCallChunk | None = None
    tool_result: ToolResultChunk | None = None
    elicitation: ElicitationChunk | None = None
    rate_limit: RateLimitChunk | None = None
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
    def rate_limited_chunk(
        cls, attempt: int, max_attempts: int, retry_after: float
    ) -> ChatChunk:
        """Create a rate limit chunk to inform the user about retry status."""
        return cls(
            type=ChatChunkType.RATE_LIMITED,
            rate_limit=RateLimitChunk(
                attempt=attempt,
                max_attempts=max_attempts,
                retry_after=retry_after,
            ),
        )

    @classmethod
    def done_chunk(cls, thread_id: uuid.UUID | None = None) -> ChatChunk:
        """Create a done chunk indicating stream completion."""
        return cls(type=ChatChunkType.DONE, thread_id=thread_id)

    @classmethod
    def elicitation_request(
        cls,
        tool_call_id: str,
        tool_name: str,
        component: str,
        prefilled: dict[str, Any],
        missing_fields: list[str] | None = None,
    ) -> ChatChunk:
        """Create an elicitation chunk to request form input from the user.

        Args:
            tool_call_id: Unique identifier for the pending tool call.
            tool_name: Name of the tool requesting elicitation.
            component: Frontend component identifier to render (e.g., "create-trip-form").
            prefilled: Data already captured to pre-populate in the form.
            missing_fields: Optional list of required field names that are missing.

        Returns:
            ChatChunk with type ELICITATION and populated elicitation data.
        """
        return cls(
            type=ChatChunkType.ELICITATION,
            elicitation=ElicitationChunk(
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                component=component,
                prefilled=prefilled,
                missing_fields=missing_fields or [],
            ),
        )


class ElicitationSubmissionRequest(BaseModel):
    """Request body for submitting elicitation form data.

    Used with POST /v1/chat/elicitation/{tool_call_id} to submit
    user-provided form data and complete a pending tool execution.

    Attributes:
        thread_id: The conversation thread ID where elicitation occurred.
        tool_name: Name of the tool being executed (for validation).
        data: The form data submitted by the user.
    """

    thread_id: uuid.UUID = Field(
        ...,
        description="Conversation thread ID where the elicitation was requested.",
    )
    tool_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the tool that requested elicitation.",
    )
    data: dict[str, Any] = Field(
        ...,
        description="Form data submitted by the user to complete the tool call.",
    )
