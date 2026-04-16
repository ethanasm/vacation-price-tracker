# API Specification v1

## 1. Authentication
Exclusively handled via **Google OAuth 2.0**.
- `GET /v1/auth/google/start`: Redirects to Google consent screen.
- `GET /v1/auth/google/callback`: Issues JWT access and refresh tokens.
- `POST /v1/auth/refresh`: Exchanges refresh token for new access token.
- `POST /v1/auth/logout`: Clears cookies.

## 2. Core Schemas (Pydantic)
These models are used for request validation and to provide clear interfaces for AI coding assistants.

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date
from enum import Enum

class ThresholdType(str, Enum):
    TRIP_TOTAL = "trip_total"
    FLIGHT_TOTAL = "flight_total"
    HOTEL_TOTAL = "hotel_total"

class TrackingStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"

class NotificationPrefs(BaseModel):
    threshold_type: ThresholdType = ThresholdType.TRIP_TOTAL
    threshold_value: float
    notify_without_threshold: bool = False
    email_enabled: bool = True
    sms_enabled: bool = False

class FlightPrefs(BaseModel):
    airlines: List[str] = Field(default_factory=list, description="IATA codes (e.g., ['UA', 'NH'])")
    stops_mode: str = "nonstop"  # nonstop, 1-stop, any
    max_stops: Optional[int] = None
    cabin: str = "economy"

class HotelPrefs(BaseModel):
    rooms: int = 1
    adults_per_room: int = 2
    room_selection_mode: str = "cheapest"
    preferred_room_types: List[str] = Field(default_factory=list, description="e.g., ['King', 'Suite']")
    preferred_views: List[str] = Field(default_factory=list, description="e.g., ['Ocean', 'City']")

class TripCreate(BaseModel):
    name: str
    origin_airport: str
    destination_code: str
    is_round_trip: bool
    depart_date: date
    return_date: date
    adults: int = 1
    flight_prefs: Optional[FlightPrefs] = None
    hotel_prefs: Optional[HotelPrefs] = None
    notification_prefs: NotificationPrefs

class TripResponse(BaseModel):
    id: str
    name: str
    status: TrackingStatus
    current_flight_price: Optional[float]
    current_hotel_price: Optional[float]
    total_price: Optional[float]
    last_refreshed: Optional[str]
```

## 3. Endpoints

### Auth
- `GET /v1/auth/google/start`: Redirects to Google consent screen.
- `GET /v1/auth/google/callback`: Handles return, sets HTTP-only cookies.
- `POST /v1/auth/logout`: Clears cookies.
- `POST /v1/auth/refresh`: Exchanges refresh token for new access token.

### Trips
- `GET /v1/trips`: List user's trips and refresh status.
- `POST /v1/trips`: Create trip (Max 10 per user).
- `GET /v1/trips/{id}`: Detailed view with history and offers.
- `DELETE /v1/trips/{id}`: Delete trip and all related price snapshots.
- `PATCH /v1/trips/{id}/status`: Pause/Unpause tracking (`{ "status": "PAUSED" }`).
- `POST /v1/trips/refresh-all`: Triggers manual refresh workflow for all active trips.

### Reference Data
- `GET /v1/locations/search?q={query}`: Search for airports/cities.
  - Response: `[ { "code": "SFO", "name": "San Francisco Intl", "type": "AIRPORT" } ]`

### Chat
- `POST /v1/chat/messages`: Send a message to the AI agent.
  - Body: `{ "message": "Find me a flight to Hawaii", "thread_id": "..." }`
  - Response: Streaming JSON or SSE containing chunks from **Groq**.

### Optimization (Phase 4)
- `POST /v1/optimizer/jobs`: Start a flexible date search using SearchAPI.
- `GET /v1/optimizer/jobs/{id}`: Get candidate results.

## 4. Idempotency & Reliability
To prevent duplicate state changes in a distributed environment:

- **X-Idempotency-Key**: Required header for `POST /v1/trips`. Prevents duplicate trips if the UI retries a request. Stored in Redis with 24-hour TTL.
- **Refresh Locking**: The `refresh-all` endpoint checks `meta.refreshing` status. If a refresh is already in progress for a user, subsequent calls return the existing `refresh_group_id` rather than spawning a new Temporal workflow.
- **Database Constraints**: A unique composite index on `(user_id, trip_name)` prevents duplicate trip creation during intermittent network retries.

## 5. External MCP Tools (Pre-Built)

These tools are provided by existing open-source MCP servers and **do not require custom development**:

### Kiwi MCP Server (Flights)
| Tool | Description | Example |
|:-----|:------------|:--------|
| `search-flight` | Search flights between locations | `search-flight({flyFrom: "SFO", flyTo: "MCO", departureDate: "15/02/2026"})` |

### Amadeus MCP Server (Hotels)
| Tool | Description | Example |
|:-----|:------------|:--------|
| `amadeus_hotel_list` | Search hotels in a city | `amadeus_hotel_list({cityCode: "MCO", ratings: [4, 5]})` |
| `amadeus_hotel_search` | Get hotel offers with pricing | `amadeus_hotel_search({cityCode: "MCO", checkInDate: "2026-02-08", checkOutDate: "2026-02-15", adults: 2})` |
| `amadeus_hotel_offer` | Get specific offer details | `amadeus_hotel_offer({offerId: "XYZ123"})` |
| `amadeus_hotel_booking` | Book a hotel (optional) | See Amadeus MCP docs |

**Source**: [github.com/soren-olympus/amadeus-mcp](https://github.com/soren-olympus/amadeus-mcp)

## 6. Custom MCP Tools (We Build)

Since flights and hotels are handled by external MCP servers, our custom tools are limited to **trip management**:

| Tool Name | Parameters | AI Instruction |
|:----------|:-----------|:---------------|
| `create_trip` | `TripCreate` object | Use when user expresses intent to "track" or "watch" a route. Calls Kiwi + Amadeus MCP internally. |
| `list_trips` | None | Use to show the user what they are currently tracking. |
| `get_trip_details` | `trip_id` | Get full price history and current offers for a specific trip. |
| `set_notification` | `trip_id`, `threshold` | Update price alert settings for a specific trip. |
| `pause_trip` | `trip_id` | Pause tracking for a trip. |
| `trigger_refresh` | None | Force a check of current prices across all active trips. |

## 7. Phase 4: SearchAPI Integration (Flexible Date Optimizer)

For the date optimizer feature, we use **SearchAPI Google Hotels** to survey price ranges across multiple dates efficiently.

### Why SearchAPI for Phase 4?
- **Amadeus Limitation**: Free tier (2,000 calls/month) is insufficient for surveying 90+ date combinations.
- **SearchAPI Advantage**: $40/month for 10,000 searches; better for bulk date-range queries.
- **Room Data**: Returns property-level pricing with amenities, sufficient for date comparison.

### Optimizer Endpoint
```
POST /v1/optimizer/jobs
{
  "trip_id": "abc123",
  "date_range_start": "2026-02-01",
  "date_range_end": "2026-04-30",
  "trip_length_days": 7,
  "flexibility_days": 3
}
```

### Response
```json
{
  "job_id": "opt-xyz",
  "status": "running",
  "candidates": [
    {
      "depart_date": "2026-02-08",
      "return_date": "2026-02-15",
      "estimated_total": 1850.00,
      "savings_vs_original": 320.00
    }
  ]
}
```
