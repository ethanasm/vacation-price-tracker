# AI Assistant Instructions

This file provides guidance to AI coding assistants when working with code in this repository.

**Supported AI Assistants:**
- Claude Code (claude.ai/code) - via `CLAUDE.md`
- GitHub Copilot - via `.github/copilot-instructions.md` (symlink)
- JetBrains AI Assistant - via `.cursorrules` (symlink)
- Gemini Code Assist - via `.gemini-instructions.md` (symlink)

All symlinks point to this single source of truth.

## Project Overview

Vacation Price Tracker is a full-stack web application that tracks flight and hotel prices for specific vacations using AI-powered chat and distributed workflows. Users can monitor price fluctuations and receive notifications when costs drop below custom thresholds.

**Key Architecture:**
- **Frontend:** Next.js 14 (App Router), Tailwind, shadcn/ui, assistant-ui
- **Backend:** FastAPI (Python 3.12), SQLModel/PostgreSQL
- **Orchestration:** Temporal SDK for Python (distributed workflows)
- **Auth:** Google OAuth 2.0 only (no local passwords)
- **LLM:** Groq (Llama 3.3) with MCP tool integration

## Web File Naming

Use kebab-case for new files in the web app (`apps/web/`).

## Skiplagged MCP Integration

All flights and hotels are fetched via the **Skiplagged MCP** at `https://mcp.skiplagged.com/mcp`. No API key or authentication is required. The client speaks JSON-RPC 2.0 over Streamable HTTP (one initialize handshake, then `tools/call` requests with the session ID from the `mcp-session-id` response header).

Implementation: `apps/api/app/clients/skiplagged.py`

### Flight Search APIs

| Method | Use Case | Notes |
|--------|----------|-------|
| `search_flights()` | Single-page search (chat tools, quick queries) | Returns up to `limit` (default 75) results |
| `search_flights_all()` | Full result set (worker tracking) | Follows `pagination.hasMoreResults` up to `max_pages=4` (up to 300 results) |

### Hotel Search APIs

| Method | Use Case | Notes |
|--------|----------|-------|
| `search_hotels()` / `search_hotels_all()` | Find hotels in a city by check-in/out dates | Returns price per night, amenities, booking links |
| `get_hotel_details()` | Room-level data for a specific hotel | Returns room titles, bed types, cancellation policy, per-room pricing |

**Worker hotel flow:** `search_hotels_all(max_pages=4)` to get the full hotel list, then `get_hotel_details` for the top 20 cheapest hotels to populate room-level data needed for `preferred_room_types` filtering.

### Flight Number Parsing

Skiplagged encodes flight numbers in the `id` field rather than returning them as structured data:

```
id: "SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"
```

Parser (`apps/api/app/clients/skiplagged_parser.py`):
1. Split on `trip=` to get the segment string
2. Split on `,` to separate outbound and return legs
3. Split each leg on `-` to get individual segments
4. Strip `~` suffix (hidden-city marker)
5. Extract carrier code (letters) + flight number (digits) from each segment

Result: `outbound=[{"carrier_code": "AC", "flight_number": "744"}, ...]`, `return_segs=[...]`

### Custom MCP Server (Trip Management)
Our custom MCP server implements:

**Trip Management Tools:**
- `create_trip` - Create new price tracking trip
- `list_trips` - List user's tracked trips
- `get_trip_details` - Get price history and offers
- `set_notification` - Update alert thresholds
- `pause_trip` / `resume_trip` - Toggle tracking
- `trigger_refresh` - Force price check

**Skiplagged Search Tools (chat):**
- `search_flights` - Flight search via Skiplagged MCP (airline names, flight numbers, prices, booking links)
- `search_hotels` - Hotel search via Skiplagged MCP (name, stars, review score, nightly price, amenities, booking links)

### Flight Display Requirements

Each flight offer card must show ALL segments for the complete itinerary:

**Structure:**
- **Outbound**: All segments from origin to destination (including connections)
- **Return**: All segments from destination back to origin (for round trips)

**Per-segment display:**
- Flight number — parsed from the Skiplagged `id` field (e.g., "AC744")
- Route (e.g., "SFO → DEN")
- Departure and arrival times
- Duration

**Layovers:** Show time and airport between connecting segments (e.g., "1h 30m layover in DEN").

**Price:** Total for entire itinerary (all segments combined).

**Implementation:**
- Flight numbers extracted via `parse_flight_segments()` in `apps/api/app/clients/skiplagged_parser.py`
- Schema models: `FlightSegment`, `FlightItinerary` in `apps/api/app/schemas/trip.py`
- Frontend renders via `ItinerarySection` and `SegmentRow` components in `apps/web/src/app/trips/[tripId]/page.tsx`

## Data Provider Strategy

All phases use a single provider: **Skiplagged MCP** (`mcp.skiplagged.com/mcp`). No API keys or paid plans required.

| Phase | Flights (Chat) | Flights (Tracking) | Hotels | Optimizer | Monthly Cost |
|:------|:---------------|:-------------------|:-------|:----------|:-------------|
| MVP (Phase 1-3) | Skiplagged `search_flights` | Skiplagged `search_flights_all` | Skiplagged `search_hotels_all` + `get_hotel_details` | N/A | $0 |
| Phase 4 | Skiplagged `search_flights` | Skiplagged `search_flights_all` | Skiplagged `search_hotels_all` + `get_hotel_details` | Skiplagged flex calendar | $0 |

**Single provider simplicity:** Chat tools and price-tracking worker both call the same Skiplagged client. The worker uses `search_flights_all`/`search_hotels_all` (up to 300 results across 4 pages) for comprehensive tracking data. Chat tools use single-page `search_flights`/`search_hotels` for speed.

**No documented rate limits:** Skiplagged MCP is a public endpoint with no authentication and no published rate limit. Caching (24-hour TTL in Redis) remains in place as a courtesy and for performance.

## Post-Fetch Filtering Strategy

Both airline and room type/view preferences require **post-fetch filtering** because the underlying API does not support these filters natively:

1. **Airline Filtering:** Skiplagged returns flights from multiple airlines. The `PriceCheckWorkflow` (Temporal worker) filters results in-memory against `trip.flight_prefs.airlines` using carrier codes parsed from the Skiplagged `id` field via `parse_flight_segments()` in `apps/api/app/clients/skiplagged_parser.py`.

2. **Room Type/View Filtering:** Skiplagged does not support query-level room filtering. After fetching hotel details with `get_hotel_details`, the worker matches `preferred_room_types` and `preferred_views` against each room's `title` field and the hotel's `amenityNames` list.

Implementation is in the Temporal worker's `filter_results_activity` in `apps/worker/worker/activities/price_check.py`.

## Core Architectural Patterns

- **Saga Pattern:** Managed via Temporal. Multi-step price fetches (flights + hotels via Skiplagged) either complete or fail gracefully with automatic retries.
- **Single Provider:** All flight and hotel data comes from Skiplagged MCP. The `SkiplaggedClient` in `apps/api/app/clients/skiplagged.py` handles both chat tools and worker activities.
- **Outbox Pattern:** Notification events queued in database during price runs, processed by dedicated activity for at-least-once delivery.
- **Idempotency:** `X-Idempotency-Key` header required for `POST /v1/trips`. Stored in Redis with 24-hour TTL.

## Environment Configuration

Copy `.env.example` to `.env` and configure:

**Required (MVP):**
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `GROQ_API_KEY` - LLM chat functionality

**Optional:**
- `SKIPLAGGED_MCP_URL` - Defaults to `https://mcp.skiplagged.com/mcp` (no auth required)
- `MOCK_SKIPLAGGED_API` - Set to `true` to use mock data in development
- `SEARCHAPI_KEY` - Phase 4 flexible date optimizer only
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` - Email notifications

**Feature Flags:**
- `ENABLE_BETA_OPTIMIZER` - Set to `true` only after configuring SearchAPI
- `ENABLE_SMS_NOTIFICATIONS` - Default `false` in dev
- `MAX_TRIPS_PER_USER` - Default 10

## Directory Structure (Planned)

```
vacation-price-tracker/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # FastAPI backend
│   ├── worker/           # Temporal workflows
│   └── mcp-server/       # Custom MCP tools (trip management only)
├── infra/                # Docker Compose
└── .env.example          # Configuration template
```


## Local Development (Docker)

All services run in Docker during local development. **Do not ask the user if services are running** - check directly with Docker commands.

### Container Names
| Container | Service | Port |
|:----------|:--------|:-----|
| `web` | Next.js frontend | 3000 |
| `api` | FastAPI backend | 8000 |
| `db` | PostgreSQL | 5432 |
| `redis` | Redis cache | 6379 |
| `temporal` | Temporal server | 7233 |
| `temporal-ui` | Temporal dashboard | 8080 |

### Debugging Commands
```bash
# Check running containers
docker ps

# View logs for a service (e.g., api errors)
docker logs api --tail 50

# Follow logs in real-time
docker logs -f api

# Restart a service
docker restart api

# Execute commands in a container
docker exec db psql -U postgres -d vacation_tracker -c "SELECT 1"
```

### Common Issues
- **API connection errors**: Check `docker logs api` for stack traces
- **Database errors**: Verify schema with `docker exec db psql -U postgres -d vacation_tracker -c "\d tablename"`
- **Container not running**: Use `docker ps -a` to see stopped containers, then `docker start <name>`

## Data Model Key Points

- **User:** Identified by `google_sub` (no local passwords)
- **Trip:** References `TripFlightPrefs` and `TripHotelPrefs` separately
- **PriceSnapshot:** Historical pricing data with `raw_data` JSONB field for debugging
- **NotificationRule:** Per-trip thresholds (trip_total, flight_total, hotel_total)

Composite unique index on `(user_id, trip_name)` prevents duplicate trip creation.

## Temporal Workflows

### RefreshAllTripsWorkflow
Orchestrates updating all active trips for a user. Called by:
- Manual refresh button (`POST /v1/trips/refresh-all`)
- Scheduled cron (Phase 3)

### PriceCheckWorkflow
Fetches data for a single trip:
1. Call Skiplagged `search_flights_all` (up to 4 pages)
2. Call Skiplagged `search_hotels_all` + `get_hotel_details` for top 20 hotels (parallel)
3. Apply post-fetch filters (airlines via ID parsing, room types/views via room `title`)
4. Save `PriceSnapshot` to database
5. Check notification thresholds
6. Push update to UI via SSE

### RunOptimizerWorkflow (Phase 4)
Surveys date ranges using Skiplagged flexible calendar:
1. Generate date combinations (up to 90)
2. Fetch prices in parallel with rate limiting
3. Rank candidates by total price
4. Verify top 5 with live Skiplagged data

## API Error Handling

- **Global Exception Handler:** Returns RFC 7807 Problem Details JSON
- **UI Error Boundaries:** Toasts for transient errors, empty states for load failures
- **Temporal Retries:** Automatic retry for transient network errors. Non-retriable errors mark trip as "Error" status

## OAuth Setup (Cloudflare Tunnel)

This app runs on a home server without port forwarding. Google OAuth callbacks require a public URL:

1. Configure Cloudflare Tunnel for secure ingress
2. Set callback URL to `https://yourdomain.com/v1/auth/google/callback`
3. Document tunnel setup in deployment guide

## Rate Limit Management

- **Aggressive Caching:** 24-hour TTL for identical route/date queries (Redis)
- **Per-User Throttling:** Token bucket limits prevent any single user from overwhelming the Skiplagged MCP endpoint
- **Pagination Cap:** `max_pages=4` (300 results) per worker fetch to keep individual requests bounded

## Development Phases

**Phase 1 (MVP):** Dashboard with manual refresh, Google OAuth, trip CRUD
**Phase 2:** Chat interface with Groq LLM and MCP tool integration
**Phase 3:** Daily scheduled tracking, email notifications, pause/unpause
**Phase 4:** Flexible date optimizer using SearchAPI

Refer to `docs/PROJECT_PLAN.md` for detailed checklists.

## Important Constraints

- Max 10 trips per user (configurable via `MAX_TRIPS_PER_USER`)
- Skiplagged MCP is a public endpoint with no auth and no documented rate limits
- Flight numbers are not returned as structured fields — they must be parsed from the Skiplagged `id` field using `parse_flight_segments()`
- Airline filtering requires post-fetch processing using carrier codes extracted from the `id` field
- Room type/view filtering requires fetching hotel details (`get_hotel_details`) and matching against room `title` text

## Pre-Commit Validation

**Always run `pnpm verify` before committing changes.** This command runs the same checks as CI and ensures your code will pass the pipeline.

```bash
pnpm verify
```

**Workspace note:** Run pnpm commands from the repo root (or use `pnpm --filter vacation-price-tracker-web ...`) to avoid generating `apps/web/pnpm-lock.yaml`. This repo uses a single root lockfile.

This command performs:
1. `pnpm install --frozen-lockfile` - Verify dependencies match lockfile
2. `uv sync --extra dev` - Sync Python dependencies
3. `pnpm --filter vacation-price-tracker-web build` - Build the frontend
4. `pnpm --filter vacation-price-tracker-web lint` - Lint frontend (Biome)
5. `pnpm --filter vacation-price-tracker-web test` - Run frontend tests (Jest)
6. `pnpm audit --prod` - Check for npm security vulnerabilities
7. `uv run ruff check apps/api apps/worker` - Lint backend (Ruff)
8. `uv run pytest apps/api/tests apps/worker/tests -v` - Run backend tests
9. `uv run pip-audit` - Check for Python security vulnerabilities

**Run this after adding or modifying any code** to catch issues before they reach CI.

## Verification Preference

- After making code changes, automatically run the most relevant tests or checks without asking.
- Only ask for confirmation when a command needs elevated permissions or could be destructive.

## Commit Message Conventions

Use **Conventional Commits** format with scope referring to the service modified:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Test additions/changes
- `chore` - Build process, dependencies, configs

### Scopes
- `web` - Next.js frontend (`apps/web/`)
- `api` - FastAPI backend (`apps/api/`)
- `worker` - Temporal workflows (`apps/worker/`)
- `mcp-server` - Custom MCP tools (`apps/mcp-server/`)
- **No scope** - Repo-wide changes (docs, configs, root-level files)

### Examples

```bash
# Service-specific changes
feat(api): add trip creation endpoint
fix(worker): handle missing flight data in PriceCheckWorkflow
refactor(web): migrate dashboard to server components
test(mcp-server): add unit tests for create_trip tool

# Repo-wide changes
docs: add flexible date optimizer design
chore: update Docker Compose for Redis
feat: add SearchAPI integration for Phase 4
```

### Multi-Service Changes
If a change affects multiple services, either:
1. Use the primary service scope: `feat(api): add trip endpoints and update UI`
2. Make separate commits per service when practical

## Deployment

### Frontend Hosting
The `web` app is hosted on **Vercel** for optimized Next.js deployment. Vercel provides automatic deployments, preview environments, and a global CDN. Configure the `NEXT_PUBLIC_API_URL` environment variable in Vercel to point to the FastAPI backend.

### Backend Hosting
The FastAPI backend can be hosted on platforms like **Fly.io**, **Render**, or **AWS Free Tier**. Ensure the backend is accessible to the Vercel-hosted frontend.

### CORS Configuration

Since the frontend is hosted separately on Vercel, configure **CORS** in the FastAPI backend to allow requests from the Vercel domain.

Example:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-vercel-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Replace `https://your-vercel-domain.vercel.app` with your actual Vercel domain.

### CSRF Protection

To prevent Cross-Site Request Forgery (CSRF) attacks, the backend requires CSRF tokens for all state-changing requests (e.g., `POST`, `PUT`, `DELETE`).

- **Frontend**: Include the CSRF token in the request headers or body.
- **Backend**: Validate the CSRF token in middleware or route handlers.

Example:
```python
from fastapi import Request, HTTPException

async def csrf_protection(request: Request):
    token = request.headers.get("X-CSRF-Token")
    if not token or token != "expected_token_value":
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

app.middleware("http")(csrf_protection)
```

Replace `"expected_token_value"` with your actual token logic.
