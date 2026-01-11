# Design Overview

## 1. System Architecture

The application is a monorepo composed of containerized services orchestrated via Docker Compose.

### 1.1 Frontend (Web)
- **Framework:** Next.js 14 (App Router).
- **UI:** 2-column layout (Table + Chat).
- **Error Views:** Dedicated error boundaries for API failures.
- **Auth:** **Google OAuth 2.0 Only**. No local password storage. Tokens (JWT) stored in HTTP-Only cookies.

### 1.2 API Service (FastAPI)
- Exposes REST endpoints for the Frontend.
- Handles Google OAuth callbacks.
- **LLM Integration:** Connects to **Groq** for chat responses.
- **MCP Orchestration:** Routes tool calls to appropriate MCP servers (Kiwi, Amadeus, or internal).

### 1.3 Worker (Temporal)
- **Role:** Executes long-running business logic reliably.
- **Workflows:**
  - `RefreshAllTripsWorkflow`: Orchestrates updating all enabled trips.
  - `PriceCheckWorkflow`: Fetches data for a single trip via MCP servers.
  - `RunOptimizerWorkflow` (Phase 4): Scans date ranges using SearchAPI.
- **Logic - Airline Filtering:** Since Kiwi MCP returns *all* airlines, the `PriceCheckWorkflow` filters results in-memory against `trip.flight_prefs.airlines`.
- **Logic - Room Type Filtering:** Since no hotel API supports query-level room filtering, the worker parses `room.description` text for keywords.

### 1.4 MCP Architecture (Hybrid)

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM (Groq/Llama 3.3)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   MCP Router      │
                    │   (FastAPI)       │
                    └─────────┬─────────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Kiwi MCP      │ │  Amadeus MCP    │ │  Custom MCP     │
│   (External)    │ │  (External)     │ │  (Internal)     │
│                 │ │                 │ │                 │
│ • search-flight │ │ • hotel_list    │ │ • create_trip   │
│                 │ │ • hotel_search  │ │ • list_trips    │
│                 │ │ • hotel_offer   │ │ • set_notif     │
│                 │ │ • hotel_booking │ │ • trigger_refresh│
└─────────────────┘ └─────────────────┘ └─────────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   Kiwi API          Amadeus API         PostgreSQL
   (Free)            (Free Tier)         (Internal)
```

## 2. External MCP Servers (Pre-Built)

### 2.1 Kiwi MCP Server (Flights)
- **Source:** Available via Claude.ai connectors or self-hosted
- **Cost:** Free, no API key required
- **Tool:** `search-flight`
- **Capabilities:**
  - Search one-way and round-trip flights
  - Filter by cabin class, stops
  - Returns all airlines (requires post-fetch filtering)

### 2.2 Amadeus MCP Server (Hotels)
- **Source:** [github.com/soren-olympus/amadeus-mcp](https://github.com/soren-olympus/amadeus-mcp)
- **Cost:** Free tier ~2,000 calls/month, then €0.001-0.025/call
- **Tools:**
  | Tool | Amadeus API Endpoint | Purpose |
  |:-----|:---------------------|:--------|
  | `amadeus_hotel_list` | `/v1/reference-data/locations/hotels` | List hotels in a location |
  | `amadeus_hotel_search` | `/v2/shopping/hotel-offers` | Find availability and pricing |
  | `amadeus_hotel_offer` | `/v2/shopping/hotel-offers/{offerId}` | Get specific offer details |
  | `amadeus_hotel_booking` | `/v1/booking/hotel-bookings` | Book hotel rooms |

- **Setup:**
  ```json
  {
    "mcpServers": {
      "amadeus-hotel": {
        "command": "node",
        "args": ["/path/to/amadeus-mcp/dist/index.js"],
        "env": {
          "AMADEUS_API_KEY": "your_api_key",
          "AMADEUS_API_SECRET": "your_api_secret"
        }
      }
    }
  }
  ```

- **Limitations:**
  - No room type filtering at query level (post-fetch required)
  - No hotel images in V3 API
  - Max check-in date is 359 days out
  - Post-paid booking model only

## 3. Architectural Patterns

This project demonstrates several advanced distributed system patterns:

- **Saga Pattern (Orchestration):** Managed via **Temporal**, ensuring that multi-step price fetches (Kiwi + Amadeus) either complete or fail gracefully with retries.
- **Strategy Pattern:** Used in the backend to handle different hotel providers (Amadeus for MVP, SearchAPI for Phase 4 optimizer) through a unified `HotelProvider` interface.
- **Outbox Pattern:** Notification events are queued in the database during price runs and processed by a dedicated activity to ensure "at-least-once" delivery.
- **Post-Fetch Filtering:** Both airline preferences and room type/view preferences are applied after fetching raw data from APIs that don't support these filters natively.

## 4. Data Provider Strategy

| Phase | Flights | Hotels | Optimizer | Monthly Cost |
|:------|:--------|:-------|:----------|:-------------|
| **MVP** | Kiwi MCP | Amadeus MCP | N/A | $0 |
| **Phase 2** | Kiwi MCP | Amadeus MCP | N/A | $0 |
| **Phase 3** | Kiwi MCP | Amadeus MCP | N/A | $0 |
| **Phase 4** | Kiwi MCP | Amadeus MCP + SearchAPI | SearchAPI | ~$40 |

### Why SearchAPI for Phase 4?
The Flexible Date Optimizer needs to survey prices across 90+ date combinations (3-month window). Amadeus's free tier (2,000 calls/month) is insufficient for this bulk querying.

**SearchAPI Google Hotels:**
- $40/month for 10,000 searches (Developer plan)
- $4 per 1,000 searches
- Property-level pricing with amenities
- No commission model
- Rate limit: 20% of plan credits per hour

## 5. Data Model (Simplified ERD)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│    User      │       │    Trip      │       │  TripFlightPrefs │
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ id (PK)      │──┐    │ id (PK)      │──────▶│ trip_id (FK)     │
│ email        │  │    │ user_id (FK) │◀──┐   │ airlines[]       │
│ google_sub   │  └───▶│ name         │   │   │ stops_mode       │
│ created_at   │       │ origin       │   │   │ cabin            │
└──────────────┘       │ destination  │   │   └──────────────────┘
                       │ depart_date  │   │
                       │ return_date  │   │   ┌──────────────────┐
                       │ status       │   │   │  TripHotelPrefs  │
                       │ is_paused    │   │   ├──────────────────┤
                       └──────────────┘   └──▶│ trip_id (FK)     │
                              │               │ rooms            │
                              │               │ adults           │
                              ▼               │ room_types[]     │
                       ┌──────────────┐       │ views[]          │
                       │PriceSnapshot │       └──────────────────┘
                       ├──────────────┤
                       │ id (PK)      │       ┌──────────────────┐
                       │ trip_id (FK) │       │ NotificationRule │
                       │ flight_price │       ├──────────────────┤
                       │ hotel_price  │       │ trip_id (FK)     │
                       │ timestamp    │       │ threshold_type   │
                       │ raw_data     │       │ threshold_value  │
                       └──────────────┘       │ email_enabled    │
                                              └──────────────────┘
```

## 6. Room Type & View Filtering Logic

Since no hotel API supports query-level room type or view filtering, we implement **post-fetch filtering**:

```python
# Pseudocode for room filtering
def filter_rooms(rooms: List[Room], prefs: HotelPrefs) -> List[Room]:
    filtered = []
    for room in rooms:
        description = room.description.lower()
        
        # Check room type (King, Suite, Double, etc.)
        if prefs.preferred_room_types:
            type_match = any(
                rt.lower() in description or rt.lower() in room.type_estimated.category.lower()
                for rt in prefs.preferred_room_types
            )
            if not type_match:
                continue
        
        # Check view (Ocean, City, Garden, etc.)
        if prefs.preferred_views:
            view_keywords = {
                "ocean": ["ocean", "sea", "water", "beach"],
                "city": ["city", "skyline", "urban"],
                "garden": ["garden", "courtyard", "pool"]
            }
            view_match = any(
                any(kw in description for kw in view_keywords.get(view.lower(), [view.lower()]))
                for view in prefs.preferred_views
            )
            if not view_match:
                continue
        
        filtered.append(room)
    
    return filtered
```

## 7. Workflows

### 7.1 Manual Refresh
1. User clicks "Refresh".
2. API calls `temporal_client.execute_workflow("RefreshAllTrips")`.
3. Workflow iterates active trips.
4. For each trip:
   - Call Kiwi MCP `search-flight` (parallel)
   - Call Amadeus MCP `amadeus_hotel_search` (parallel)
5. Apply post-fetch filters (airlines, room types, views).
6. Save PriceSnapshot to database.
7. Check notification thresholds.
8. Push update to UI via SSE.

### 7.2 Error Handling
- **API Level:** Global exception handlers return standardized JSON errors (RFC 7807 Problem Details).
- **UI Level:** Toasts for transient errors. Empty states for data load failures.
- **Workflow Level:** Temporal automatically retries transient network errors. Non-retriable errors mark the trip as "Error" status.

## 8. Deployment Strategy
- **Local/Home Server:** Orchestrated via `docker-compose`.
- **Ingress:** Cloudflare Tunnel for secure public access to Google OAuth callbacks without port forwarding.
- **MCP Servers:** Run as sidecars in Docker Compose or connect to hosted versions.
