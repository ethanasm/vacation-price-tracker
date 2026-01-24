"""Pydantic schemas for request/response validation."""

from app.schemas.base import APIResponse, PaginationMeta
from app.schemas.trip import (
    FlightOffer,
    FlightPrefs,
    HotelOffer,
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
    "FlightOffer",
    "FlightPrefs",
    "HotelOffer",
    "HotelPrefs",
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
