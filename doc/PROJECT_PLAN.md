# Project Implementation Plan

## Scope Reduction: External MCP Servers

**Key Insight:** The Amadeus MCP server ([github.com/soren-olympus/amadeus-mcp](https://github.com/soren-olympus/amadeus-mcp)) already exposes hotel search, offer details, and booking tools. Combined with the Kiwi MCP server for flights, we do **not** need to build custom flight/hotel search tools.

### What We DON'T Need to Build:
- ❌ `kiwi_search_flights` tool (use Kiwi MCP)
- ❌ `amadeus_search_hotels` tool (use Amadeus MCP)
- ❌ `search_airports` tool (can use Amadeus location search)

### What We DO Need to Build:
- ✅ Trip management tools (create, list, pause, delete)
- ✅ Notification preference tools
- ✅ Refresh orchestration
- ✅ Post-fetch filtering logic (airlines, room types, views)
- ✅ Price snapshot storage and history

---

## Phase 1: MVP Core (Manual Refresh)
**Goal:** A working dashboard running locally or on a home server.

### Infrastructure
- [ ] Docker Compose with Postgres, Temporal, FastAPI
- [ ] Configure Amadeus MCP server as a sidecar container
- [ ] Set up Kiwi MCP connection (via Claude.ai or self-hosted)

### Authentication
- [ ] Implement Google OAuth flow (Frontend + Backend)
- [ ] JWT token management with HTTP-only cookies
- [ ] No local password storage

### Data Layer
- [ ] SQLModel/SQLAlchemy models for User, Trip, PriceSnapshot, NotificationRule
- [ ] Alembic migrations
- [ ] Pydantic schemas with validation

### API
- [ ] CRUD endpoints for Trips
- [ ] Idempotency key handling for POST requests
- [ ] Error handling with RFC 7807 Problem Details

### Worker (Temporal)
- [ ] `RefreshAllTripsWorkflow` - orchestrates all trip updates
- [ ] `PriceCheckWorkflow` - fetches data for single trip
- [ ] Activities:
  - `fetch_flights_activity` - calls Kiwi MCP
  - `fetch_hotels_activity` - calls Amadeus MCP
  - `filter_results_activity` - applies airline/room preferences
  - `save_snapshot_activity` - persists to database

### UI
- [ ] Dashboard table with trip list and current prices
- [ ] Trip detail modal with price history chart
- [ ] Manual refresh button
- [ ] Error boundary components

---

## Phase 2: Chat & LLM Integration
**Goal:** Conversational control using Groq.

### LLM Setup
- [ ] Groq API client configuration (Llama 3.3 70B)
- [ ] System prompts for travel assistant persona
- [ ] Tool-calling configuration for MCP integration

### Custom MCP Tools (Trip Management Only)
- [ ] `create_trip` - validates input, stores trip, triggers initial price check
- [ ] `list_trips` - returns user's tracked trips with current prices
- [ ] `get_trip_details` - full history and offer details
- [ ] `set_notification` - update threshold preferences
- [ ] `pause_trip` / `resume_trip` - toggle tracking status
- [ ] `trigger_refresh` - manual price check

### UI
- [ ] Integrate `assistant-ui` chat component
- [ ] Streaming response display
- [ ] Tool call visualization (optional)

### Elicitation Logic
- [ ] Prompt engineering for missing parameters
- [ ] Airline preference collection
- [ ] Room type/view preference collection

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
- [ ] Rate limiting to stay within API free tiers

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
**Goal:** "Find me cheaper dates" feature using SearchAPI.

### SearchAPI Integration
- [ ] SearchAPI Google Hotels client
- [ ] Rate limiting (20% of plan credits per hour)
- [ ] Response parsing for property-level pricing

### Why SearchAPI Instead of Amadeus for Optimizer?
| Aspect | Amadeus | SearchAPI |
|:-------|:--------|:----------|
| Free Tier | ~2,000 calls/month | 100 calls (test) |
| Paid Tier | €0.001-0.025/call | $40/month for 10,000 |
| Best For | Individual trip lookups | Bulk date surveying |
| Date Range Survey (90 combos) | Would consume 4.5 months of free tier | ~1% of monthly quota |

### Optimizer Workflow
- [ ] `RunOptimizerWorkflow` - Temporal workflow for date surveying
- [ ] Activities:
  - `generate_date_combinations` - create search grid
  - `fetch_prices_batch` - parallel SearchAPI calls with rate limiting
  - `rank_candidates` - sort by total price
  - `verify_top_candidates` - re-check top 5 with live Amadeus data

### UI
- [ ] "Find Cheaper Dates" button on trip detail
- [ ] Date range selector (up to 3 months)
- [ ] Progress indicator during survey
- [ ] Candidate results display with savings calculation
- [ ] "Lock In" button to update trip dates

---

## Testing Strategy

### Unit Tests (Pytest)
- [ ] Pydantic model validation
- [ ] Post-fetch filtering logic
- [ ] Notification threshold comparison
- [ ] Date combination generator

### Integration Tests
- [ ] Temporal workflow tests with mocked activities
- [ ] MCP tool integration tests
- [ ] Database transaction tests

### E2E Tests (Playwright)
- [ ] Google OAuth login flow
- [ ] Create trip via chat
- [ ] Manual refresh and price display
- [ ] Notification threshold setting

### Contract Tests
- [ ] Validate Pydantic schemas match frontend TypeScript types
- [ ] MCP tool response schema validation

---

## Milestones

| Phase | Duration | Key Deliverable |
|:------|:---------|:----------------|
| Phase 1 | 4-6 weeks | Working dashboard with manual refresh |
| Phase 2 | 2-3 weeks | Chat interface with trip management |
| Phase 3 | 2 weeks | Daily automated tracking + notifications |
| Phase 4 | 3-4 weeks | Flexible date optimizer |

**Total Estimated Time:** 11-15 weeks for full feature set

---

## Risk Mitigation

| Risk | Mitigation |
|:-----|:-----------|
| Amadeus free tier exceeded | Implement aggressive caching (24h TTL for same route/date) |
| Kiwi MCP rate limits | Queue requests with exponential backoff |
| SearchAPI hourly limit (20%) | Spread optimizer queries across multiple hours |
| Room type parsing failures | Fallback to showing all rooms if filtering fails |
| Google OAuth callback issues | Document Cloudflare Tunnel setup thoroughly |
