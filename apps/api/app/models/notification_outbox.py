import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.sql import func
from sqlmodel import Field, SQLModel

from app.core.constants import NotificationStatus, ThresholdType
from app.models.enum_column import varchar_enum


class NotificationOutbox(SQLModel, table=True):
    """At-least-once notification event awaiting delivery.

    A row is enqueued (transactionally, keyed on ``snapshot_id``) when a price
    check finds a trip has crossed its ``NotificationRule`` threshold. The daily
    digest job drains pending rows, sends one email per user, and marks them
    ``sent``. The unique constraint on ``snapshot_id`` makes enqueueing idempotent
    so the evaluation activity is safe to retry.
    """

    __tablename__ = "notification_outbox"
    __table_args__ = (Index("ix_notification_outbox_status_user", "status", "user_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    )
    trip_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    )
    snapshot_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("price_snapshots.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        )
    )
    # status / threshold_type are stored as VARCHAR(20) holding the StrEnum
    # *values* ("pending", "trip_total") — see migration 007_notification_outbox.
    # varchar_enum keeps that DDL while loading rows back as enum members
    # (the plain String(20) columns this replaced loaded as bare str and were
    # invisible to test_no_native_enum_model_columns).
    threshold_type: ThresholdType = Field(
        default=ThresholdType.TRIP_TOTAL,
        sa_column=varchar_enum(ThresholdType, server_default="trip_total"),
    )
    old_price: Decimal | None = Field(default=None, sa_column=Column(Numeric(10, 2)))
    new_price: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    threshold_value: Decimal | None = Field(default=None, sa_column=Column(Numeric(10, 2)))
    status: NotificationStatus = Field(
        default=NotificationStatus.PENDING,
        sa_column=varchar_enum(NotificationStatus, server_default="pending"),
    )
    attempts: int = Field(default=0, nullable=False)
    error: str | None = Field(default=None)

    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )
    )
    sent_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
