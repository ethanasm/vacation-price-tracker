# Vacation Price Tracker

## Overview
Vacation Price Tracker is a full-stack web application designed for travelers to track flight and hotel prices for specific vacations. Users can monitor price fluctuations and receive notifications when total costs drop below a custom threshold.

## Key Features
- **Flexible Tracking**: Track flights only, hotels only (up to 3 per trip), or both combined.
- **AI-Powered Chat**: Natural language interface using Groq (Llama 3.3) and MCP for conversational trip management.
- **Distributed Reliability**: Orchestrated workflows via **Temporal** for reliable price fetching.
- **Smart Notifications**: Automated alerts via Email (MVP) and optional SMS (Future).
- **Flexible Date Optimizer** (Phase 4): Survey date ranges to find cheaper travel windows using SearchAPI.

## Tech Stack
- **Frontend**: Next.js 14, Tailwind, shadcn/ui, assistant-ui.
- **Backend**: FastAPI (Python 3.12), SQLModel/PostgreSQL.
- **Orchestration**: Temporal SDK for Python.
- **Auth**: Google OAuth 2.0 (No local passwords).
- **Testing**: pytest (API), Jest (web).
- **Code Quality**: Ruff, SonarQube (SonarCloud).
- **Flight Data**: 
  - **Primary**: lastminute.com MCP Server (Free, shows airline names/codes).
  - **Backup**: Kiwi MCP Server (Free, better for virtual interlining).
  - **Detailed**: Amadeus API (Free tier: 2,000 calls/month, flight numbers & segments).
- **Hotel Data**: 
  - **MVP**: Amadeus API (Free tier: 2,000 calls/month).
  - **Phase 4**: SearchAPI Google Hotels (for flexible date optimization).

## External MCP Servers & Flight Data Providers

This project uses a multi-provider strategy to balance data quality, coverage, and cost:

### lastminute.com MCP Server (Primary Flight Search)
- **Endpoint**: `mcp.lastminute.com/mcp`
- **Tool**: `search_flights`
- **Cost**: Free, no API key required
- **Best For**: General flight search—shows airline names, carrier codes, routes, times, and booking links
- **Limitation**: Primarily shows LCCs (Southwest, JetBlue, Spirit, Ryanair); limited legacy carrier coverage

### Kiwi MCP Server (Backup Flight Search)
- **Endpoint**: `mcp.kiwi.com`
- **Tool**: `search-flight`
- **Cost**: Free, no API key required
- **Best For**: Virtual interlining (creative multi-carrier routing), often finds cheaper prices
- **Limitation**: Does NOT include airline names, carrier codes, or flight numbers

### Amadeus API (Detailed Flight Data & Hotels)
- **Source**: Direct Amadeus REST API (wrapped as custom MCP tools)
- **Tools**: `search_flights_amadeus`, `search_hotels`, `search_hotel_offers`
- **Cost**: Free tier (~2,000 calls/month), then €0.001-0.025/call
- **Best For**: 
  - Flight numbers, segment details, airline filtering
  - Hotel searches with availability and pricing
  - Price tracking (requires flight numbers to match offers)

### When Each Provider Is Used

| User Request | Provider | Reason |
|-------------|----------|--------|
| "Find flights to Paris" | lastminute.com | Shows airline names |
| "What's the cheapest flight?" | Kiwi | Often lower prices |
| "I want to fly Delta" | Amadeus | Airline filtering |
| "Show me flight UA200" | Amadeus | Need flight numbers |
| "Find hotels in Rome" | Amadeus | Only option with hotels |

### Custom MCP Tools (Trip Management)
Our custom MCP server handles trip management operations:
- `create_trip` - Create a new price tracking trip
- `list_trips` - List user's tracked trips
- `get_trip_details` - Get trip details with price history
- `set_notification` - Update alert thresholds
- `pause_trip` / `resume_trip` - Control tracking status
- `trigger_refresh` - Force price check for all trips

## Directory Structure
```text
vacation-price-tracker/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # FastAPI backend
│   ├── worker/           # Temporal workflows
│   └── mcp-server/       # Custom tools only (trip management)
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
   # Install Python dependencies
   uv sync --extra dev

   # Install frontend dependencies
   pnpm install
   ```

4. **Configure `.env`:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials:
   # - DATABASE_URL: Postgres connection
   # - GROQ_API_KEY: For LLM chat
   # - AMADEUS_API_KEY/SECRET: For flight details & hotel searches
   # - GOOGLE_CLIENT_ID/SECRET: For OAuth
   # - TEMPORAL_ADDRESS: Temporal server
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
   # Terminal 1: Start API with HTTPS
   pnpm api:dev

   # Terminal 2: Start web with HTTPS
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

   **Note:** Your browser will show a security warning for self-signed certificates. Click "Advanced" → "Proceed to localhost" to bypass.

## Development

### Running Tests
```bash
# Run all tests
uv run pytest apps/api/tests/ -v

# Run specific test file
uv run pytest apps/api/tests/test_auth.py -v

# Run with coverage
uv run pytest apps/api/tests/ --cov=app --cov-report=html
```

#### Frontend Tests (Jest)
```bash
# Run web tests
pnpm web:test

# Watch mode
pnpm web:test:watch
```

### Code Quality

#### Linting & Formatting (Ruff)
```bash
# Check for issues
uv run ruff check apps/api/app/

# Auto-fix issues
uv run ruff check apps/api/app/ --fix

# Format code
uv run ruff format apps/api/app/

# Run both lint and format
uv run ruff check apps/api/app/ --fix && uv run ruff format apps/api/app/
```

#### Security Scanning (pip-audit)
```bash
# Scan dependencies for known vulnerabilities
uv run pip-audit

# Ignore accepted risks (see SECURITY_AUDIT.md)
uv run pip-audit --ignore-vuln CVE-2024-23342 --ignore-vuln CVE-2026-0994 --ignore-vuln CVE-2026-1703
```

#### Security Scanning (pnpm audit)
```bash
# Scan frontend dependencies for known vulnerabilities
cd apps/web
pnpm audit

# Limit to production dependencies
pnpm audit --prod

# JSON output (CI-friendly)
pnpm audit --json
```

#### Code Quality (SonarQube)
```bash
# Run SonarQube scan (configured in sonar-project.properties)
pnpm sonar
```
Connect the SonarQube/SonarCloud project in your IDE via SonarLint to surface warnings before pushing.

#### Type Checking (mypy) - Optional
```bash
uv run mypy apps/api/app/
```

### Project Structure
```
apps/api/
├── app/
│   ├── core/          # Config, constants, security
│   ├── clients/       # External API clients (Amadeus, Groq, MCP)
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
```

## Data Provider Strategy

| Phase | Flights | Hotels | Cost |
|:------|:--------|:-------|:-----|
| MVP | lastminute.com MCP (primary) + Kiwi MCP (backup) + Amadeus (details) | Amadeus API | $0 (free tiers) |
| Phase 4 | Same as MVP | Amadeus + SearchAPI | ~$40/mo for optimizer |

## Technical Challenges Overcome

1. **Multi-Provider Flight Data Strategy:** No single free provider offers complete data. Solved by using lastminute.com for quick searches with airline info, Kiwi for cheaper prices/virtual interlining, and Amadeus for flight numbers and detailed segments needed for price tracking.
2. **Missing Airline Info from Kiwi MCP:** Research revealed Kiwi MCP (free hosted server) does NOT include airline names/codes—only the paid Tequila affiliate API does. Pivoted to lastminute.com as primary provider.
3. **Airline Filtering on Non-Filterable APIs:** Designed post-fetch filtering strategy since MCP servers return all airlines without query-level filtering.
4. **Room Type/View Filtering:** No hotel API supports query-level room filtering—implemented post-fetch parsing of room descriptions.
5. **OAuth on Home Server:** Solved using Cloudflare Tunnel to provide a public callback URL without port forwarding.
6. **Distributed Workflow Reliability:** Used Temporal's Saga pattern to ensure partial failures don't corrupt state.

## Deployment

### Frontend (Next.js)
The `web` app is hosted on **Vercel** for optimized Next.js deployment. Vercel provides:
- Automatic deployments from GitHub branches.
- Preview environments for pull requests.
- Global CDN for fast load times.

To deploy:
1. Connect your GitHub repository to Vercel.
2. Select the `apps/web/` directory as the project root.
3. Configure environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_API_URL`: URL of the FastAPI backend (e.g., `https://api.yourdomain.com`).

### Backend (FastAPI)
The FastAPI backend can be hosted on platforms like **Fly.io**, **Render**, or **AWS Free Tier**. Ensure the backend is accessible to the Vercel-hosted frontend.

### CORS Configuration

Since the frontend is hosted separately on Vercel, you need to configure **CORS** in the FastAPI backend to allow requests from the Vercel domain.

Example FastAPI CORS setup:
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

Example FastAPI middleware for CSRF validation:
```python
from fastapi import Request, HTTPException

async def csrf_protection(request: Request):
    token = request.headers.get("X-CSRF-Token")
    if not token or token != "expected_token_value":
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

app.middleware("http")(csrf_protection)
```

Replace `"expected_token_value"` with your actual token logic.
