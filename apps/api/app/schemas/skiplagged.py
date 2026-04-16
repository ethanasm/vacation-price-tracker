"""Raw response models for Skiplagged MCP API.

These match the JSON structure returned by mcp.skiplagged.com/mcp.
They are normalized into FlightSearchResult/HotelSearchResult for downstream use.
"""

from __future__ import annotations

from pydantic import BaseModel


class SkiplaggedFlightSegment(BaseModel):
    """Parsed flight segment from Skiplagged ID field."""
    carrier_code: str
    flight_number: str


class SkiplaggedFlightEndpoint(BaseModel):
    airport: str
    dateTime: str  # ISO 8601 with timezone


class SkiplaggedPrice(BaseModel):
    amount: float
    currency: str


class SkiplaggedReturnFlight(BaseModel):
    airlines: str
    departure: SkiplaggedFlightEndpoint
    arrival: SkiplaggedFlightEndpoint
    duration: str
    layovers: int
    attributes: list[str] = []


class SkiplaggedFlight(BaseModel):
    id: str
    airlines: str
    departure: SkiplaggedFlightEndpoint
    arrival: SkiplaggedFlightEndpoint
    duration: str
    layovers: int
    price: SkiplaggedPrice
    deepLink: str
    attributes: list[str] = []
    returnFlight: SkiplaggedReturnFlight | None = None
    parsed_segments: list[SkiplaggedFlightSegment] = []


class SkiplaggedPagination(BaseModel):
    totalAvailable: int
    currentlyShowing: int
    offset: int
    limit: int
    hasMoreResults: bool


class SkiplaggedFlightsResponse(BaseModel):
    searchUrl: str | None = None
    flights: list[SkiplaggedFlight] = []
    pagination: SkiplaggedPagination | None = None


class SkiplaggedHotelRating(BaseModel):
    stars: int
    text: str


class SkiplaggedHotelPrice(BaseModel):
    amount: float
    currency: str
    text: str


class SkiplaggedHotel(BaseModel):
    id: str
    name: str
    imageUrl: str | None = None
    rating: SkiplaggedHotelRating | None = None
    price: SkiplaggedHotelPrice
    chain: str | None = None
    location: str | None = None
    amenities: list[str] = []
    deepLink: str


class SkiplaggedHotelsResponse(BaseModel):
    searchUrl: str | None = None
    results: list[SkiplaggedHotel] = []
    pagination: SkiplaggedPagination | None = None


class SkiplaggedRoom(BaseModel):
    id: str
    title: str
    occupancyLimit: int
    pricePerNightInDollars: float
    totalPriceInDollars: float
    taxesAndFeesInDollars: float
    currency: str
    refundable: bool
    freeCancellation: bool
    bedTypes: list[str] = []
    bookingLink: str
    source: str | None = None


class SkiplaggedHotelLocation(BaseModel):
    lat: float
    lng: float


class SkiplaggedHotelDetail(BaseModel):
    hotelId: str
    hotelName: str
    starRating: int | None = None
    reviewRating: float | None = None
    reviewCount: int | None = None
    totalPriceInDollars: float
    chainName: str | None = None
    amenityNames: list[str] = []
    address: str | None = None
    cityName: str | None = None
    countryName: str | None = None
    description: str | None = None
    checkinDate: str
    checkoutDate: str
    location: SkiplaggedHotelLocation | None = None
    rooms: list[SkiplaggedRoom] = []
