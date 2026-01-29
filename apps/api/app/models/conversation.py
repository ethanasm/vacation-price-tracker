"""Conversation model for chat history persistence."""

import uuid
from datetime import datetime

from sqlalchemy import Column, ForeignKey
from sqlalchemy.sql import func
from sqlmodel import DateTime, Field, SQLModel


class Conversation(SQLModel, table=True):
    """A chat conversation session for a user."""

    __tablename__ = "conversations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    title: str | None = Field(default=None, max_length=255)

    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        )
    )
