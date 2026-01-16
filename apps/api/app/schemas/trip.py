"""Trip-related Pydantic schemas for request/response validation."""

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.constants import (
    CabinClass,
    RoomSelectionMode,
    StopsMode,
    ThresholdType,
    TripStatus,
)


class FlightPrefs(BaseModel):
    """Flight preferences for a trip."""

    airlines: list[str] = Field(
        default_factory=list,
        description="Preferred airline IATA codes (e.g., ['UA', 'NH'])",
    )
    stops_mode: StopsMode = Field(
        default=StopsMode.ANY,
        description="Flight stops preference",
    )
    max_stops: Annotated[int | None, Field(ge=0, le=3)] = Field(
        default=None,
        description="Maximum number of stops (only used when stops_mode is 'any')",
    )
    cabin: CabinClass = Field(
        default=CabinClass.ECONOMY,
        description="Preferred cabin class",
    )

    @field_validator("airlines")
    @classmethod
    def validate_airline_codes(cls, v: list[str]) -> list[str]:
        """Ensure airline codes are valid 2-letter IATA codes."""
        import re

        for code in v:
            if not re.match(r"^[A-Z0-9]{2}$", code):
                raise ValueError(f"Invalid airline code: {code}. Must be 2 characters.")
        return v


class HotelPrefs(BaseModel):
    """Hotel preferences for a trip."""

    rooms: Annotated[int, Field(ge=1, le=9)] = Field(
        default=1,
        description="Number of rooms needed",
    )
    adults_per_room: Annotated[int, Field(ge=1, le=4)] = Field(
        default=2,
        description="Number of adults per room",
    )
    room_selection_mode: RoomSelectionMode = Field(
        default=RoomSelectionMode.CHEAPEST,
        description="How to select rooms: cheapest or preferred",
    )
    preferred_room_types: list[str] = Field(
        default_factory=list,
        description="Preferred room types (e.g., ['King', 'Suite'])",
    )
    preferred_views: list[str] = Field(
        default_factory=list,
        description="Preferred views (e.g., ['Ocean', 'City'])",
    )


class NotificationPrefs(BaseModel):
    """Notification preferences for a trip."""

    threshold_type: ThresholdType = Field(
        default=ThresholdType.TRIP_TOTAL,
        description="What price to compare against threshold",
    )
    threshold_value: Decimal = Field(
        description="Price threshold for notifications",
        ge=0,
        decimal_places=2,
    )
    notify_without_threshold: bool = Field(
        default=False,
        description="Send notification on every refresh regardless of threshold",
    )
    email_enabled: bool = Field(
        default=True,
        description="Enable email notifications",
    )
    sms_enabled: bool = Field(
        default=False,
        description="Enable SMS notifications",
    )


class TripCreate(BaseModel):
    """Schema for creating a new trip."""

    name: Annotated[str, Field(min_length=1, max_length=100)] = Field(
        description="Trip name (must be unique per user)",
    )
    origin_airport: str = Field(
        pattern=r"^[A-Z]{3}$",
        description="Origin airport IATA code (e.g., 'SFO')",
    )
    destination_code: str = Field(
        pattern=r"^[A-Z]{3}$",
        description="Destination airport IATA code (e.g., 'MCO')",
    )
    is_round_trip: bool = Field(
        default=True,
        description="Whether this is a round trip",
    )
    depart_date: date = Field(
        description="Departure date",
    )
    return_date: date = Field(
        description="Return date",
    )
    adults: Annotated[int, Field(ge=1, le=9)] = Field(
        default=1,
        description="Number of adult travelers",
    )
    flight_prefs: FlightPrefs | None = Field(
        default=None,
        description="Flight preferences (optional)",
    )
    hotel_prefs: HotelPrefs | None = Field(
        default=None,
        description="Hotel preferences (optional)",
    )
    notification_prefs: NotificationPrefs = Field(
        description="Notification settings (required)",
    )

    @field_validator("depart_date", "return_date")
    @classmethod
    def validate_date_within_range(cls, v: date) -> date:
        """Ensure dates are not more than 359 days out (Amadeus limit)."""
        max_date = date.today() + timedelta(days=359)
        if v > max_date:
            raise ValueError(f"Date cannot be more than 359 days out. Maximum: {max_date}")
        if v < date.today():
            raise ValueError("Date cannot be in the past")
        return v

    @model_validator(mode="after")
    def validate_return_after_depart(self) -> "TripCreate":
        """Ensure return date is after departure date."""
        if self.return_date <= self.depart_date:
            raise ValueError("return_date must be after depart_date")
        return self


class TripResponse(BaseModel):
    """Schema for trip list response."""

    id: uuid.UUID
    name: str
    origin_airport: str
    destination_code: str
    depart_date: date
    return_date: date
    status: TripStatus
    current_flight_price: Decimal | None = None
    current_hotel_price: Decimal | None = None
    total_price: Decimal | None = None
    last_refreshed: datetime | None = None

    model_config = {"from_attributes": True}


class TripDetail(TripResponse):
    """Schema for detailed trip response with all preferences."""

    is_round_trip: bool
    adults: int
    flight_prefs: FlightPrefs | None = None
    hotel_prefs: HotelPrefs | None = None
    notification_prefs: NotificationPrefs | None = None
    created_at: datetime
    updated_at: datetime


class PriceSnapshotResponse(BaseModel):
    """Schema for price snapshot in trip history."""

    id: uuid.UUID
    flight_price: Decimal | None = None
    hotel_price: Decimal | None = None
    total_price: Decimal | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TripDetailResponse(BaseModel):
    """Schema for trip detail response with price history."""

    trip: TripDetail
    price_history: list[PriceSnapshotResponse]


class RefreshStartResponse(BaseModel):
    """Schema for refresh start response."""

    refresh_group_id: str


class RefreshStatusResponse(BaseModel):
    """Schema for refresh status response."""

    refresh_group_id: str
    status: str
    total: int
    completed: int
    failed: int
    in_progress: int


class TripStatusUpdate(BaseModel):
    """Schema for updating trip status (pause/resume)."""

    status: Literal[TripStatus.ACTIVE, TripStatus.PAUSED] = Field(
        description="New status: 'active' or 'paused'",
    )
