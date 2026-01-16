import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Column, ForeignKey, Numeric
from sqlalchemy.sql import func
from sqlmodel import DateTime, Field, SQLModel


class PriceSnapshot(SQLModel, table=True):
    """Historical price snapshot for a trip."""

    __tablename__ = "price_snapshots"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("trips.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    flight_price: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2)),
    )
    hotel_price: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2)),
    )
    total_price: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 2)),
    )
    # Use JSON type for SQLite/PostgreSQL compatibility
    raw_data: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, server_default="{}"),
    )

    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
            index=True,
        )
    )
