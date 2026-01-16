import uuid

from sqlalchemy import JSON, Column, ForeignKey
from sqlmodel import Field, SQLModel

from app.core.constants import CabinClass, RoomSelectionMode, StopsMode


class TripFlightPrefs(SQLModel, table=True):
    """Flight preferences for a trip."""

    __tablename__ = "trip_flight_prefs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("trips.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        )
    )
    # Store as JSON for SQLite/PostgreSQL compatibility (arrays stored as JSON)
    airlines: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
    )
    stops_mode: StopsMode = Field(default=StopsMode.ANY, nullable=False)
    max_stops: int | None = Field(default=None, ge=0, le=3)
    cabin: CabinClass = Field(default=CabinClass.ECONOMY, nullable=False)


class TripHotelPrefs(SQLModel, table=True):
    """Hotel preferences for a trip."""

    __tablename__ = "trip_hotel_prefs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trip_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("trips.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        )
    )
    rooms: int = Field(default=1, ge=1, le=9, nullable=False)
    adults_per_room: int = Field(default=2, ge=1, le=4, nullable=False)
    room_selection_mode: RoomSelectionMode = Field(default=RoomSelectionMode.CHEAPEST, nullable=False)
    # Store as JSON for SQLite/PostgreSQL compatibility (arrays stored as JSON)
    preferred_room_types: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
    )
    preferred_views: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, server_default="[]"),
    )
