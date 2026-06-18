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
- **MCP Orchestration:** Routes tool calls to Skiplagged MCP (flights + hotels) or internal trip management tools.

### 1.3 Worker (Temporal)
- **Role:** Executes long-running business logic reliably.
- **Workflows:**
  - `RefreshAllTripsWorkflow`: Orchestrates updating all enabled trips.
  - `PriceCheckWorkflow`: Fetches data for a single trip via Skiplagged MCP.
  - `RunOptimizerWorkflow` (Phase 4): Scans date ranges using Skiplagged flex calendar.
- **Logic - Airline Filtering:** Carrier codes are parsed from the Skiplagged `id` field using `parse_flight_segments()`. The `PriceCheckWorkflow` filters results in-memory against `trip.flight_prefs.airlines`.
- **Logic - Room Type Filtering:** After fetching hotel details via `get_hotel_details`, the worker matches room `title` fields against `trip.hotel_prefs.preferred_room_types` and `preferred_views`.

### 1.4 MCP Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      LLM (Groq/GPT OSS 120B)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   MCP Router      │
                    │   (FastAPI)       │
                    └─────────┬─────────┘
                 ┌────────────┴────────────┐
                 ▼                         ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│  Skiplagged MCP          │  │  Internal Trip Management      │
│  (mcp.skiplagged.com)    │  │  Tools                         │
│                          │  │                                │
│ • search_flights         │  │ • create_trip                  │
│ • search_hotels          │  │ • list_trips                   │
│                          │  │ • get_trip_details             │
│ HTTP/JSON-RPC            │  │ • set_notification             │
│ No auth required         │  │ • pause_trip / resume_trip     │
└──────────────────────────┘  │ • trigger_refresh              │
           │                  └────────────────────────────────┘
           ▼                               │
  Skiplagged API                    PostgreSQL
  (Free, public)                    (Internal)
```

## 2. Skiplagged MCP Integration

**Endpoint:** `https://mcp.skiplagged.com/mcp`
**Protocol:** JSON-RPC 2.0 over Streamable HTTP (no auth required)
**Client:** `apps/api/app/clients/skiplagged.py`

### Session Lifecycle

1. `initialize` handshake — POST with `protocolVersion: "2024-11-05"`, receive session ID in `mcp-session-id` response header
2. Subsequent `tools/call` requests — include session ID header
3. Session auto-resets on 400/401/403 responses

### Available Tools

| Tool | Parameters | Used By |
|------|-----------|---------|
| `sk_flights_search` | origin, destination, departure_date, return_date, adults, max_stops, sort, limit, offset | Chat `search_flights` tool, worker `fetch_flights_activity` |
| `sk_hotels_search` | city, checkin, checkout, adults, rooms, sort, limit, offset | Chat `search_hotels` tool, worker `fetch_hotels_activity` |
| `sk_hotel_details` | hotel_id, checkin, checkout, adults, rooms | Worker (room-level data for filtering) |
| `sk_flex_departure_calendar` | origin, destination, year, month | Phase 4 date optimizer |
| `sk_flex_return_calendar` | origin, destination, departure_date, year, month | Phase 4 date optimizer |

### Flight Number Parsing

Skiplagged encodes flight segments in the `id` field:

```
"SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"
```

Parser in `apps/api/app/clients/skiplagged_parser.py`:
- Split on `trip=` → get segment string
- Split on `,` → outbound leg, return leg
- Split each leg on `-` → individual segments (strip `~` hidden-city marker)
- Regex `^([A-Z]{2,3})(\d+)$` → carrier code + flight number

## 3. Architectural Patterns

- **Saga Pattern (Orchestration):** Managed via **Temporal**, ensuring that multi-step price fetches (flights + hotels via Skiplagged) either complete or fail gracefully with retries.
- **Single Provider:** All flight and hotel data comes from the single Skiplagged MCP endpoint. No provider abstraction layer needed.
- **Outbox Pattern:** Notification events are queued in the database during price runs and processed by a dedicated activity for at-least-once delivery.
- **Post-Fetch Filtering:** Airline preferences are applied by parsing carrier codes from the Skiplagged `id` field. Room type/view preferences are applied by matching against room `title` text after calling `get_hotel_details`.

## 4. Data Provider Strategy

All phases use Skiplagged MCP. No paid APIs required.

| Phase | Flights | Hotels | Optimizer | Monthly Cost |
|:------|:--------|:-------|:----------|:-------------|
| **MVP** | Skiplagged `search_flights_all` | Skiplagged `search_hotels_all` + `get_hotel_details` | N/A | $0 |
| **Phase 2** | Skiplagged `search_flights` (chat) | Skiplagged `search_hotels` (chat) | N/A | $0 |
| **Phase 3** | Skiplagged `search_flights_all` | Skiplagged `search_hotels_all` + `get_hotel_details` | N/A | $0 |
| **Phase 4** | Skiplagged `search_flights_all` | Skiplagged `search_hotels_all` + `get_hotel_details` | Skiplagged flex calendar | $0 |

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

Skiplagged does not support query-level room type or view filtering. We implement **post-fetch filtering** against room detail data:

```python
# Worker filter logic (apps/worker/worker/activities/price_check.py)
def _filter_hotels(hotels, prefs):
    filtered = []
    for hotel in hotels:
        # Collect all room titles and amenity names
        room_titles = [r.get("title", "").lower() for r in hotel.get("rooms", [])]
        amenities = [a.lower() for a in hotel.get("amenityNames", [])]
        all_text = room_titles + amenities

        # Match preferred room types against room title
        if prefs.get("preferred_room_types"):
            if not any(
                rt.lower() in text
                for rt in prefs["preferred_room_types"]
                for text in room_titles
            ):
                continue

        # Match preferred views against room title and amenities
        if prefs.get("preferred_views"):
            if not any(
                view.lower() in text
                for view in prefs["preferred_views"]
                for text in all_text
            ):
                continue

        filtered.append(hotel)
    return filtered
```

## 7. Workflows

### 7.1 Manual Refresh
1. User clicks "Refresh".
2. API calls `temporal_client.execute_workflow("PriceCheckWorkflow", trip_id)`.
3. Workflow:
   - Call Skiplagged `search_flights_all(max_pages=4)` for up to 300 flight results
   - Call Skiplagged `search_hotels_all(max_pages=4)` for hotel list
   - Call Skiplagged `get_hotel_details` for top 20 hotels (by price) to get room data
4. Apply post-fetch filters (airlines via ID parsing, room types/views via room title).
5. Save PriceSnapshot to database.
6. Check notification thresholds.
7. Push update to UI via SSE.

### 7.2 Error Handling
- **API Level:** Global exception handlers return standardized JSON errors (RFC 7807 Problem Details).
- **UI Level:** Toasts for transient errors. Empty states for data load failures.
- **Workflow Level:** Temporal automatically retries transient network errors. Non-retriable errors mark the trip as "Error" status.

## 8. Deployment Strategy
- **Local/Home Server:** Orchestrated via `docker-compose`.
- **Ingress:** Cloudflare Tunnel for secure public access to Google OAuth callbacks without port forwarding.
- **Skiplagged MCP:** Public hosted endpoint, no sidecar containers required.
