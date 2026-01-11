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
vacation-tracker/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # FastAPI backend
│   ├── worker/           # Temporal workflows
│   └── mcp-server/       # Custom tools only (trip management)
├── infra/                # Docker Compose
└── .env.example          # Configuration template
```

## Setup
1. **Clone the repo:**
   ```bash
   git clone https://github.com/your-repo/vacation-tracker
   cd vacation-tracker
   cp .env.example .env
   ```

2. **Configure `.env`:**
   - `DATABASE_URL`: Postgres connection.
   - `GROQ_API_KEY`: For the LLM chat.
   - `AMADEUS_CLIENT_ID/SECRET`: For hotel data via Amadeus MCP.
   - `GOOGLE_CLIENT_ID/SECRET`: For OAuth.
   - `TEMPORAL_ADDRESS`: Temporal server.
   - `SEARCHAPI_KEY`: (Phase 4) For flexible date optimizer.

3. **Run with Docker:**
   ```bash
   docker compose up --build
   ```

4. **Access:**
   - Web: `http://localhost:3000`
   - Temporal UI: `http://localhost:8080`

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
