import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from sqlmodel import Field, SQLModel


class DeviceToken(SQLModel, table=True):
    """An Expo push token registered by a user's mobile device.

    A user may have several (one per device). Unique on ``expo_push_token`` so
    re-registering the same device is an idempotent upsert. Rows cascade-delete
    with the user.
    """

    __tablename__ = "device_tokens"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
        )
    )
    expo_push_token: str = Field(
        sa_column=Column(String(255), unique=True, index=True, nullable=False)
    )
    platform: str = Field(sa_column=Column(String(16), nullable=False))

    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        )
    )
