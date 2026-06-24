import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Numeric
from sqlmodel import Field, SQLModel

from app.core.constants import ThresholdType


class NotificationRule(SQLModel, table=True):
    """Notification preferences for a trip."""

    __tablename__ = "notification_rules"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("trips.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        )
    )
    threshold_type: ThresholdType = Field(default=ThresholdType.TRIP_TOTAL, nullable=False)
    threshold_value: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    notify_without_threshold: bool = Field(default=False, nullable=False)
    email_enabled: bool = Field(default=True, nullable=False)
    sms_enabled: bool = Field(default=False, nullable=False)

    # Price-drop dedup: the price at which the most recent alert fired. A new
    # alert only enqueues when the price drops below this, and it is reset to
    # NULL once the price climbs back above the threshold (re-arming the alert).
    last_notified_price: Decimal | None = Field(default=None, sa_column=Column(Numeric(10, 2)))
    last_notified_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
