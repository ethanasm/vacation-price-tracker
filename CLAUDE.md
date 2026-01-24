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

## External MCP Server Architecture

This project uses a **hybrid MCP architecture** that leverages existing open-source MCP servers rather than building custom ones:

### Pre-Built External MCP Servers
- **Kiwi MCP Server** (Flights): Provides `search-flight` tool. Free, no API key required.
- **Amadeus MCP Server** (Hotels): Provides `amadeus_hotel_list`, `amadeus_hotel_search`, `amadeus_hotel_offer`, `amadeus_hotel_booking`. Source: [github.com/soren-olympus/amadeus-mcp](https://github.com/soren-olympus/amadeus-mcp). Free tier ~2,000 calls/month.

### Custom MCP Server (Trip Management Only)
Since flights and hotels are covered externally, our custom MCP server only implements:
- `create_trip` - Create new price tracking trip
- `list_trips` - List user's tracked trips
- `get_trip_details` - Get price history and offers
- `set_notification` - Update alert thresholds
- `pause_trip` / `resume_trip` - Toggle tracking
- `trigger_refresh` - Force price check

**Do NOT build custom flight/hotel search tools** - use the external MCP servers instead.

## Data Provider Strategy

| Phase | Flights | Hotels | Optimizer | Monthly Cost |
|:------|:--------|:-------|:----------|:-------------|
| MVP (Phase 1-3) | Kiwi MCP | Amadeus MCP | N/A | $0 |
| Phase 4 | Kiwi MCP | Amadeus MCP + SearchAPI | SearchAPI | ~$40 |

**Phase 4 SearchAPI Rationale:** The flexible date optimizer needs to survey 90+ date combinations. Amadeus free tier (2,000 calls/month) is insufficient for this bulk querying. SearchAPI provides $40/month for 10,000 searches, making it cost-effective for date-range surveying.

## Post-Fetch Filtering Strategy

Both airline and room type/view preferences require **post-fetch filtering** because the underlying APIs don't support these filters natively:

1. **Airline Filtering:** Kiwi MCP returns all airlines. The `PriceCheckWorkflow` (Temporal worker) filters results in-memory against `trip.flight_prefs.airlines`.

2. **Room Type/View Filtering:** No hotel API supports query-level room filtering. The worker parses `room.description` text for keywords like "King", "Suite", "Ocean View", etc.

Implementation is in the Temporal worker's `filter_results_activity`.

## Core Architectural Patterns

- **Saga Pattern:** Managed via Temporal. Multi-step price fetches (Kiwi + Amadeus) either complete or fail gracefully with automatic retries.
- **Strategy Pattern:** Different hotel providers (Amadeus for MVP, SearchAPI for Phase 4) use unified `HotelProvider` interface.
- **Outbox Pattern:** Notification events queued in database during price runs, processed by dedicated activity for at-least-once delivery.
- **Idempotency:** `X-Idempotency-Key` header required for `POST /v1/trips`. Stored in Redis with 24-hour TTL.

## Environment Configuration

Copy `.env.example` to `.env` and configure:

**Required (MVP):**
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `GROQ_API_KEY` - LLM chat functionality
- `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` - Hotel data

**Optional:**
- `KIWI_API_KEY` - Higher rate limits (not required for basic usage)
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

**Note:** As of this writing, the `apps/` directory has not been created yet. This is a greenfield project with documentation only.

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
1. Call Kiwi MCP `search-flight` (parallel)
2. Call Amadeus MCP `amadeus_hotel_search` (parallel)
3. Apply post-fetch filters (airlines, room types, views)
4. Save `PriceSnapshot` to database
5. Check notification thresholds
6. Push update to UI via SSE

### RunOptimizerWorkflow (Phase 4)
Surveys date ranges using SearchAPI:
1. Generate date combinations (up to 90)
2. Fetch prices in parallel with rate limiting
3. Rank candidates by total price
4. Verify top 5 with live Amadeus data

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
- **Token Bucket Throttling:** Per-user limits to stay within Amadeus/Kiwi free tiers
- **SearchAPI Hourly Limit:** Phase 4 optimizer spreads queries across hours (20% of plan credits/hour)

## Development Phases

**Phase 1 (MVP):** Dashboard with manual refresh, Google OAuth, trip CRUD
**Phase 2:** Chat interface with Groq LLM and MCP tool integration
**Phase 3:** Daily scheduled tracking, email notifications, pause/unpause
**Phase 4:** Flexible date optimizer using SearchAPI

Refer to `doc/PROJECT_PLAN.md` for detailed checklists.

## Important Constraints

- Max 10 trips per user (configurable via `MAX_TRIPS_PER_USER`)
- Amadeus free tier: ~2,000 calls/month
- Amadeus max check-in date: 359 days out
- No room images in Amadeus V3 API
- Kiwi MCP returns all airlines (requires post-fetch filtering)

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
