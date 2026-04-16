# Project Implementation Plan

## Data Provider: Skiplagged MCP

All flight and hotel data is provided by the **Skiplagged MCP** at `https://mcp.skiplagged.com/mcp`. No API keys or paid plans required. The single `SkiplaggedClient` in `apps/api/app/clients/skiplagged.py` is used for both chat tools and worker activities.

### What We Have Built:
- ✅ Trip management tools (create, list, pause, delete, trigger refresh)
- ✅ Notification preference tools
- ✅ Refresh orchestration (Temporal workflows)
- ✅ Post-fetch filtering logic (airlines via ID parsing, room types/views via room title)
- ✅ Price snapshot storage and history
- ✅ `search_flights` chat tool (Skiplagged)
- ✅ `search_hotels` chat tool (Skiplagged — new in Phase 2)

---

## Phase 1: MVP Core (Manual Refresh)
**Goal:** A working dashboard running locally or on a home server.

### Infrastructure
- [x] Docker Compose with Postgres, Temporal, FastAPI
- [x] Skiplagged MCP client (HTTP/JSON-RPC, no auth)

### Authentication
- [x] Implement Google OAuth flow (Frontend + Backend)
- [x] JWT token management with HTTP-only cookies
- [x] No local password storage

### Data Layer
- [x] SQLModel/SQLAlchemy models for User, Trip, PriceSnapshot, NotificationRule
- [x] Alembic migrations
- [x] Pydantic schemas with validation

### API
- [x] CRUD endpoints for Trips
- [x] Idempotency key handling for POST requests
- [x] Error handling with RFC 7807 Problem Details

### Worker (Temporal)
- [x] `RefreshAllTripsWorkflow` - orchestrates all trip updates
- [x] `PriceCheckWorkflow` - fetches data for single trip
- [x] Activities:
  - `fetch_flights_activity` - calls Skiplagged `search_flights_all`
  - `fetch_hotels_activity` - calls Skiplagged `search_hotels_all` + `get_hotel_details` for top 20
  - `filter_results_activity` - applies airline/room preferences
  - `save_snapshot_activity` - persists to database

### UI
- [x] Dashboard table with trip list and current prices
- [x] Trip detail modal with price history chart
- [x] Manual refresh button
- [x] Error boundary components

---

## Phase 2: Chat & LLM Integration
**Goal:** Conversational control using Groq.

### LLM Setup
- [x] Groq API client configuration (Llama 3.3 70B)
- [x] System prompts for travel assistant persona
- [x] Tool-calling configuration for MCP integration

### Custom MCP Tools
- [x] `create_trip` - validates input, stores trip, triggers initial price check
- [x] `list_trips` - returns user's tracked trips with current prices
- [x] `get_trip_details` - full history and offer details
- [x] `set_notification` - update threshold preferences
- [x] `pause_trip` / `resume_trip` - toggle tracking status
- [x] `trigger_refresh` - manual price check
- [x] `search_flights` - conversational flight search via Skiplagged (airline names, flight numbers, prices, booking links)
- [x] `search_hotels` - conversational hotel search via Skiplagged (name, stars, reviews, nightly price, amenities)

### UI
- [x] Integrate `assistant-ui` chat component
- [x] Streaming response display
- [x] Tool call visualization

### Elicitation Logic
- [x] Prompt engineering for missing parameters
- [x] Airline preference collection
- [x] Room type/view preference collection

---

## Phase 3: Reliability & Hosting
**Goal:** Stable daily runner on a home server.

### Hosting
- [ ] Configure Cloudflare Tunnel for public access
- [ ] SSL/TLS setup via Cloudflare
- [ ] Document OAuth callback URL configuration

### Scheduler
- [ ] Enable Temporal Schedules for daily cron
- [ ] Per-user schedule configuration
- [ ] Rate limiting (caching + per-user token bucket for Skiplagged)

### Pause/Unpause
- [ ] UI toggle for individual trip tracking
- [ ] Skip paused trips in refresh workflow
- [ ] Resume tracking with immediate price check

### Notifications
- [ ] Email notifications via SMTP2GO (free tier)
- [ ] Threshold comparison logic
- [ ] Notification history tracking
- [ ] Unsubscribe handling

---

## Phase 4: Flexible Date Optimizer
**Goal:** "Find me cheaper dates" feature using Skiplagged flex calendar.

### Skiplagged Flexible Calendar Integration
- [ ] Use Skiplagged `sk_flex_departure_calendar` / `sk_flex_return_calendar` for date-range price grids
- [ ] No additional cost or API key needed (same Skiplagged MCP endpoint)

### Optimizer Workflow
- [ ] `RunOptimizerWorkflow` - Temporal workflow for date surveying
- [ ] Activities:
  - `generate_date_combinations` - create search grid (up to 90 combos)
  - `fetch_prices_batch` - parallel Skiplagged flex calendar calls with rate limiting
  - `rank_candidates` - sort by total price
  - `verify_top_candidates` - re-check top 5 with live `search_flights_all`

### UI
- [ ] "Find Cheaper Dates" button on trip detail
- [ ] Date range selector (up to 3 months)
- [ ] Progress indicator during survey
- [ ] Candidate results display with savings calculation
- [ ] "Lock In" button to update trip dates

---

## Testing Strategy

### Unit Tests (Pytest)
- [x] Pydantic model validation
- [x] Post-fetch filtering logic (Skiplagged carrier code parsing, room title matching)
- [x] Notification threshold comparison
- [x] Skiplagged client (HTTP mock, pagination, error handling)
- [x] Flight number parser (normal, hidden-city, multi-segment, round-trip)
- [x] Chat tool tests (search_flights, search_hotels)
- [ ] Date combination generator (Phase 4)

### Integration Tests
- [x] Temporal workflow tests with mocked activities
- [x] MCP tool integration tests
- [x] Database transaction tests

### E2E Tests (Playwright)
- [x] Chat flight search in light + dark mode
- [x] Chat hotel search in light + dark mode
- [x] Trip creation + price refresh in light + dark mode
- [x] Theme validation across all pages
- [ ] Google OAuth login flow (requires live server)
- [ ] Notification threshold setting

---

## Milestones

| Phase | Status | Key Deliverable |
|:------|:-------|:----------------|
| Phase 1 | Complete | Working dashboard with manual refresh |
| Phase 2 | Complete | Chat interface with Skiplagged flight + hotel search |
| Phase 3 | In Progress | Daily automated tracking + notifications |
| Phase 4 | Planned | Flexible date optimizer via Skiplagged calendar |

---

## Risk Mitigation

| Risk | Mitigation |
|:-----|:-----------|
| Skiplagged MCP availability | 24h Redis cache reduces live calls; graceful error handling in worker |
| Skiplagged undocumented rate limits | Per-user token bucket throttling + `max_pages=4` cap per fetch |
| Room type parsing failures | Fallback to showing all rooms if `title` matching finds no matches |
| Flight number parsing failures | Parser returns empty list on failure; carrier filtering skipped gracefully |
| Google OAuth callback issues | Document Cloudflare Tunnel setup thoroughly |
