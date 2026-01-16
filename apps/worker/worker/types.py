from typing import Any, TypedDict


class FlightPrefsData(TypedDict):
    airlines: list[str]
    stops_mode: str
    max_stops: int | None
    cabin: str


class HotelPrefsData(TypedDict):
    rooms: int
    adults_per_room: int
    room_selection_mode: str
    preferred_room_types: list[str]
    preferred_views: list[str]


class TripDetails(TypedDict):
    trip_id: str
    origin_airport: str
    destination_code: str
    is_round_trip: bool
    depart_date: str
    return_date: str
    adults: int
    flight_prefs: FlightPrefsData
    hotel_prefs: HotelPrefsData


class FetchResult(TypedDict):
    offers: list[dict[str, Any]]
    raw: dict[str, Any]
    error: str | None


class FilterInput(TypedDict):
    flight_result: FetchResult
    hotel_result: FetchResult
    flight_prefs: FlightPrefsData
    hotel_prefs: HotelPrefsData


class FilterOutput(TypedDict):
    flights: list[dict[str, Any]]
    hotels: list[dict[str, Any]]
    raw_data: dict[str, Any]


class SaveSnapshotInput(TypedDict):
    trip_id: str
    flights: list[dict[str, Any]]
    hotels: list[dict[str, Any]]
    raw_data: dict[str, Any]


class PriceCheckResult(TypedDict):
    success: bool
    snapshot_id: str | None
    flight_error: str | None
    hotel_error: str | None
