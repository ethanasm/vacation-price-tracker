import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.sql import func
from sqlmodel import Field, SQLModel

from app.core.constants import NotificationStatus, ThresholdType


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
    threshold_type: ThresholdType = Field(default=ThresholdType.TRIP_TOTAL, nullable=False)
    old_price: Decimal | None = Field(default=None, sa_column=Column(Numeric(10, 2)))
    new_price: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    threshold_value: Decimal | None = Field(default=None, sa_column=Column(Numeric(10, 2)))
    status: NotificationStatus = Field(default=NotificationStatus.PENDING, nullable=False)
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
