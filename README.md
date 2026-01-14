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
- **Flight Data**: Kiwi MCP Server (Free, no API key required).
- **Hotel Data**: 
  - **MVP**: Amadeus MCP Server (Free tier: 2,000 calls/month).
  - **Phase 4**: SearchAPI Google Hotels (for flexible date optimization).

## External MCP Servers (No Custom Build Required)

This project leverages existing open-source MCP servers to minimize custom development:

### Kiwi MCP Server (Flights)
- **Source**: Available via Claude.ai connectors
- **Tools**: `search-flight`
- **Cost**: Free, no API key required

### Amadeus MCP Server (Hotels)
- **Source**: [github.com/soren-olympus/amadeus-mcp](https://github.com/soren-olympus/amadeus-mcp)
- **Tools Exposed**:
  - `amadeus_hotel_list` - Search hotels by city with filters (amenities, star rating)
  - `amadeus_hotel_search` - Get hotel offers with pricing for specific dates
  - `amadeus_hotel_offer` - Get detailed info about a specific offer
  - `amadeus_hotel_booking` - Book hotel rooms (if needed)
- **Cost**: Free tier (~2,000 calls/month), then €0.001-0.025/call

### What We Build (Custom MCP Tools)
Since flights and hotels are covered by existing MCP servers, our custom MCP server only needs:
- `create_trip` - Create a new price tracking trip
- `list_trips` - List user's tracked trips
- `set_notification` - Update alert thresholds
- `trigger_refresh` - Force price check
- `search_airports` - IATA code lookup (thin wrapper)

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

2. **Install dependencies:**
   ```bash
   # Install Python dependencies
   uv sync --extra dev
   ```
   ```bash
   # Install frontend dependencies
   cd apps/web
   pnpm install
   ```

3. **Configure `.env`:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials:
   # - DATABASE_URL: Postgres connection
   # - GROQ_API_KEY: For LLM chat
   # - AMADEUS_CLIENT_ID/SECRET: For hotel data
   # - GOOGLE_CLIENT_ID/SECRET: For OAuth
   # - TEMPORAL_ADDRESS: Temporal server
   # - SEARCHAPI_KEY: (Phase 4) For date optimizer
   ```

4. **Run services with Docker:**
   ```bash
   docker compose up -d db redis temporal
   ```

5. **Run database migrations:**
   ```bash
   uv run alembic upgrade head
   ```

6. **Start development server:**
   ```bash
   cd apps/api
   uv run uvicorn app.main:app --reload
   ```

7. **Access:**
   - API: `http://localhost:8000`
   - API Docs: `http://localhost:8000/docs`
   - Temporal UI: `http://localhost:8080`

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
uv run pip-audit --ignore-vuln CVE-2024-23342
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
│   ├── db/            # Database session, deps
│   ├── models/        # SQLModel database models
│   ├── routers/       # FastAPI route handlers
│   └── main.py        # FastAPI app entry point
└── tests/
    ├── test_auth.py   # Auth logic tests
    ├── test_models.py # Database model tests
    └── test_security.py # JWT/security tests
```

## Data Provider Strategy

| Phase | Flights | Hotels | Cost |
|:------|:--------|:-------|:-----|
| MVP | Kiwi MCP | Amadeus MCP | $0 (free tiers) |
| Phase 4 | Kiwi MCP | Amadeus + SearchAPI | ~$40/mo for optimizer |

## Technical Challenges Overcome

1. **Managing Rate Limits Across Multiple Travel APIs:** Implemented token-bucket throttling per user to stay within Amadeus/Kiwi free tiers.
2. **Airline Filtering on Non-Filterable APIs:** Designed post-fetch filtering strategy since Kiwi MCP returns all airlines.
3. **Room Type/View Filtering:** No hotel API supports query-level room filtering—implemented post-fetch parsing of room descriptions.
4. **OAuth on Home Server:** Solved using Cloudflare Tunnel to provide a public callback URL without port forwarding.
5. **Distributed Workflow Reliability:** Used Temporal's Saga pattern to ensure partial failures don't corrupt state.

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
