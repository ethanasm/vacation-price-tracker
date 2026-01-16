import uuid
from datetime import date, datetime

from sqlalchemy import UniqueConstraint
from sqlalchemy.sql import func
from sqlmodel import Column, DateTime, Field, SQLModel

from app.core.constants import TripStatus


class Trip(SQLModel, table=True):
    """Trip model for tracking vacation price searches."""

    __tablename__ = "trips"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)
    name: str = Field(max_length=100, nullable=False)
    origin_airport: str = Field(max_length=3, nullable=False)  # IATA code
    destination_code: str = Field(max_length=3, nullable=False)  # IATA code
    is_round_trip: bool = Field(default=True, nullable=False)
    depart_date: date = Field(nullable=False)
    return_date: date = Field(nullable=False)
    adults: int = Field(default=1, ge=1, le=9, nullable=False)
    status: TripStatus = Field(default=TripStatus.ACTIVE, nullable=False)

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

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_trip_user_name"),)
