"""Pydantic schemas for request/response validation."""

from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.trip import (
    FlightPrefs,
    HotelPrefs,
    NotificationPrefs,
    PriceSnapshotResponse,
    TripCreate,
    TripDetail,
    TripResponse,
    TripStatusUpdate,
)

__all__ = [
    # Base schemas
    "APIResponse",
    "PaginationMeta",
    # Trip schemas
    "FlightPrefs",
    "HotelPrefs",
    "NotificationPrefs",
    "TripCreate",
    "TripResponse",
    "TripDetail",
    "TripStatusUpdate",
    "PriceSnapshotResponse",
]
