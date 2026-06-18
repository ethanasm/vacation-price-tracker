# Vacation Price Tracker

## Overview
Vacation Price Tracker is a full-stack web application designed for travelers to track flight and hotel prices for specific vacations. Users can monitor price fluctuations and receive notifications when total costs drop below a custom threshold.

## Key Features
- **Flexible Tracking**: Track flights only, hotels only (up to 3 per trip), or both combined.
- **AI-Powered Chat**: Natural language interface using Groq (GPT OSS 120B) and MCP for conversational trip management.
- **Distributed Reliability**: Orchestrated workflows via **Temporal** for reliable price fetching.
- **Smart Notifications**: Automated alerts via Email (MVP) and optional SMS (Future).
- **Flexible Date Optimizer** (Phase 4): Survey date ranges to find cheaper travel windows.

## Tech Stack
- **Frontend**: Next.js 14, Tailwind, shadcn/ui, assistant-ui.
- **Backend**: FastAPI (Python 3.12), SQLModel/PostgreSQL.
- **Orchestration**: Temporal SDK for Python.
- **Auth**: Google OAuth 2.0 (No local passwords).
- **Testing**: pytest (API), Jest (web), Playwright (E2E).
- **Code Quality**: Ruff, SonarQube (SonarCloud).
- **Flight & Hotel Data**: [Skiplagged MCP](https://mcp.skiplagged.com/mcp) — public, no auth required. Provides flights and hotels through a single JSON-RPC endpoint with airline names, flight numbers (parsed from the offer ID), room-level pricing, and booking links.

## Flight & Hotel Data Provider

### Skiplagged MCP
- **Endpoint**: `https://mcp.skiplagged.com/mcp`
- **Transport**: JSON-RPC 2.0 over Streamable HTTP with SSE responses
- **Auth**: None — public endpoint
- **Tools used**:
  - `sk_flights_search` — flights by route and dates, with pagination, airline names, flight numbers encoded in the offer ID, deep booking links
  - `sk_hotels_search` — hotels by city and dates, with ratings, amenities, nightly prices
  - `sk_hotel_details` — room-level data for a specific hotel (room types, bed configurations, cancellation policies, taxes)

### Flight Numbers
Skiplagged encodes flight numbers inside the offer `id` field (e.g., `trip=AC744-LH6825,TS251-AC401`). The `SkiplaggedClient` parses this into structured carrier codes and flight numbers via `app.clients.skiplagged_parser`.

### Pagination
The client exposes `search_flights_all()` and `search_hotels_all()` that follow `pagination.hasMoreResults`, with `limit=75` and `max_pages=4` (up to 300 results) for comprehensive price tracking.

### Custom MCP Tools (Trip Management)
In addition to Skiplagged search, the app exposes custom MCP tools to the chat LLM for trip management:
- `create_trip` / `delete_trip` — create or remove a price tracking trip
- `list_trips` / `get_trip_details` — inspect tracked trips and price history
- `set_notification` — update alert thresholds
- `pause_trip` / `resume_trip` — toggle tracking
- `refresh_trip_prices` / `refresh_all_trip_prices` — force an immediate price check
- `search_flights` / `search_hotels` — conversational search powered by Skiplagged

## Directory Structure
```text
vacation-price-tracker/
├── apps/
│   ├── web/              # Next.js frontend (+ Playwright E2E in apps/web/e2e/)
│   ├── api/              # FastAPI backend
│   └── worker/           # Temporal workflows
├── docs/                 # Design specs, implementation plans, research notes
├── infra/                # Docker Compose
└── .env.example          # Configuration template
```

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+ (for frontend)
- pnpm 9+ (frontend package manager)
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Docker & Docker Compose (for services)

### Installation

1. **Clone the repo:**
   ```bash
   git clone https://github.com/your-repo/vacation-price-tracker
   cd vacation-price-tracker
   ```

2. **Generate SSL certificates (for HTTPS development):**
   ```bash
   # macOS
   brew install mkcert
   mkcert -install
   mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost-cert.pem localhost 127.0.0.1 ::1
   ```

3. **Install dependencies:**
   ```bash
   uv sync --extra dev
   pnpm install
   ```

4. **Configure `.env`:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials:
   # - DATABASE_URL: Postgres connection (pre-configured for Docker)
   # - GROQ_API_KEY: For LLM chat
   # - GOOGLE_CLIENT_ID/SECRET: For OAuth
   # - TEMPORAL_ADDRESS: Temporal server
   # - SKIPLAGGED_MCP_URL: defaults to https://mcp.skiplagged.com/mcp
   # - SEARCHAPI_KEY: (Phase 4) For date optimizer
   ```

5. **Run services with Docker:**
   ```bash
   docker compose up -d db redis temporal
   ```

6. **Run database migrations:**
   ```bash
   uv run alembic upgrade head
   ```

7. **Start development servers:**
   ```bash
   pnpm api:dev
   pnpm web:dev
   ```

   **Fallback to HTTP (if needed):**
   ```bash
   pnpm api:dev:http  # API on http://localhost:8000
   pnpm web:dev:http  # Web on http://localhost:3000
   ```

8. **Access:**
   - Web App: `https://localhost:3000`
   - API: `https://localhost:8000`
   - API Docs: `https://localhost:8000/docs`
   - Temporal UI: `http://localhost:8080`

## Development

### Running Tests

#### Backend (pytest)
```bash
uv run pytest apps/api/tests/ -v
uv run pytest apps/worker/tests/ -v
uv run pytest apps/api/tests/ --cov=app --cov-report=html
```

#### Frontend (Jest)
```bash
pnpm web:test
pnpm web:test:watch
```

#### E2E (Playwright)
End-to-end tests live in `apps/web/e2e/` and run against the full Docker stack. They exercise chat flight/hotel search, trip creation + refresh, and theme validation in both light and dark mode.

```bash
# Start the full stack first
docker compose up -d

# Run all E2E tests
pnpm web:test:e2e

# Interactive UI mode
pnpm web:test:e2e:ui
```

#### Full Verification
`pnpm verify` runs dependency install, build, lint, typecheck, unit test coverage, security audits, and E2E tests across all projects.

```bash
pnpm verify
```

### Code Quality

#### Linting & Formatting (Ruff)
```bash
uv run ruff check apps/api/app/
uv run ruff check apps/api/app/ --fix
uv run ruff format apps/api/app/
```

#### Security Scanning
```bash
uv run pip-audit
pnpm --filter vacation-price-tracker-web audit --prod
```

#### Code Quality (SonarQube)
```bash
pnpm sonar
```

#### Local Code Review (mcp-review) — Optional
You can optionally use [mcp-review](https://github.com/ethanasm/mcp-review) for AI-powered, context-aware code review against your local git history — no PR required. It's pre-configured via `.mcp-review.yml`.

```bash
mcp-review --staged
mcp-review --last 3
```

### Project Structure
```
apps/api/
├── app/
│   ├── core/          # Config, constants, security
│   ├── clients/       # External API clients (Skiplagged, Groq)
│   ├── db/            # Database session, deps
│   ├── models/        # SQLModel database models
│   ├── routers/       # FastAPI route handlers
│   ├── middleware/    # CSRF, rate limiting, idempotency
│   ├── services/      # Business logic services
│   ├── tools/         # MCP tool implementations
│   └── main.py        # FastAPI app entry point
└── tests/
    ├── clients/       # API client tests
    ├── integration/   # End-to-end tests
    ├── middleware/    # Middleware tests
    ├── routers/       # Endpoint tests
    ├── services/      # Service layer tests
    ├── tools/         # MCP tool tests
    └── *.py           # Unit tests (auth, models, schemas, etc.)

apps/web/
├── src/               # Next.js app
├── e2e/               # Playwright E2E tests
└── playwright.config.ts
```

## Data Provider Strategy

| Phase | Flights | Hotels | Date Optimizer | Cost |
|:------|:--------|:-------|:---------------|:-----|
| MVP (Phase 1-3) | Skiplagged MCP | Skiplagged MCP | N/A | $0 |
| Phase 4 | Skiplagged MCP | Skiplagged MCP | SearchAPI (optional) | ~$40/mo for optimizer |

## Technical Notes

1. **Single-Provider Strategy**: Skiplagged MCP provides both flights and hotels via one public endpoint. No auth, no quota juggling, no carrier gaps to work around.
2. **Airline Filtering**: MCP responses don't expose query-level airline filters, so the worker extracts carrier codes from Skiplagged flight IDs and filters post-fetch against `trip.flight_prefs.airlines`.
3. **Room Type / View Filtering**: For each trip refresh the worker pulls `sk_hotel_details` for the top 20 hotels by price and matches room titles / amenities against `preferred_room_types` and `preferred_views`.
4. **OAuth on Home Server**: Resolved via Cloudflare Tunnel for a public OAuth callback URL without port forwarding.
5. **Distributed Workflow Reliability**: Temporal's Saga pattern ensures partial failures don't corrupt state during multi-step price fetches.

## Deployment

### Frontend (Next.js)
The `web` app is hosted on **Vercel**:
1. Connect your GitHub repository to Vercel.
2. Select the `apps/web/` directory as the project root.
3. Configure `NEXT_PUBLIC_API_URL` in the Vercel dashboard to point at your FastAPI backend.

### Backend (FastAPI)
Host on **Fly.io**, **Render**, **AWS**, or any container platform. Must be reachable from the Vercel frontend.

### CORS Configuration
With the frontend on Vercel and backend elsewhere, configure CORS:
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

### CSRF Protection
All state-changing requests require a CSRF token. Frontend includes the token in request headers; backend middleware validates it.
