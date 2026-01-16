"""Pydantic schemas for request/response validation."""

from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.location import LocationResult
from app.schemas.trip import (
    FlightPrefs,
    HotelPrefs,
    NotificationPrefs,
    PriceSnapshotResponse,
    RefreshStartResponse,
    RefreshStatusResponse,
    TripCreate,
    TripDetail,
    TripDetailResponse,
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
    "LocationResult",
    "NotificationPrefs",
    "TripCreate",
    "TripResponse",
    "TripDetail",
    "TripDetailResponse",
    "RefreshStartResponse",
    "RefreshStatusResponse",
    "TripStatusUpdate",
    "PriceSnapshotResponse",
]
