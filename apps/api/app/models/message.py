"""Message model for chat message persistence."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, ForeignKey, Text
from sqlalchemy.sql import func
from sqlmodel import DateTime, Field, SQLModel


class Message(SQLModel, table=True):
    """A single message in a conversation.

    Messages can have different roles:
    - "system": System prompt (usually first message)
    - "user": User input
    - "assistant": LLM response
    - "tool": Tool execution result

    For assistant messages with tool calls, the tool_calls field contains
    the list of tool invocations. For tool result messages, tool_call_id
    references which tool call this is a response to.
    """

    __tablename__ = "messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("conversations.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    role: str = Field(max_length=20)  # "system", "user", "assistant", "tool"
    content: str = Field(sa_column=Column(Text, nullable=False))

    # For assistant messages that invoke tools
    tool_calls: list[dict[str, Any]] | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )

    # For tool result messages - references the tool call this responds to
    tool_call_id: str | None = Field(default=None, max_length=255)

    # Tool name (used for tool result messages)
    name: str | None = Field(default=None, max_length=255)

    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
            index=True,
        )
    )
