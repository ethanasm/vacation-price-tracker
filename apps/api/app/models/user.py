import uuid
from datetime import datetime

from sqlalchemy import Boolean, text
from sqlalchemy.sql import func
from sqlmodel import Column, DateTime, Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    google_sub: str = Field(unique=True, index=True, max_length=255)
    email_notifications_enabled: bool = Field(
        sa_column=Column(Boolean, server_default=text("true"), nullable=False),
        default=True,
    )

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
