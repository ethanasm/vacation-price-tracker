# MCP Server Setup Guide

This document describes how to configure the external MCP servers used by the Vacation Price Tracker.

## Overview

The application uses a hybrid MCP architecture with **stdio-based subprocesses**:

1. **Amadeus MCP Server** (Hotels) - Spawned as subprocess by FastAPI
2. **Kiwi MCP Server** (Flights) - Via Claude.ai built-in connector or spawned subprocess
3. **Custom MCP Server** (Trip Management) - Built with the application (Phase 1 sections 3-4)

**Important:** MCP servers communicate via stdin/stdout, not HTTP. They are spawned as child processes by the FastAPI backend, not run as standalone containers.

## 1. Amadeus MCP Server (Hotels)

**Source:** [github.com/soren-olympus/amadeus-mcp](https://github.com/soren-olympus/amadeus-mcp)

**Tools:** `amadeus_hotel_list`, `amadeus_hotel_search`, `amadeus_hotel_offer`, `amadeus_hotel_booking`

**Cost:** Free tier ~2,000 calls/month

### Setup

The Amadeus MCP server will be installed and spawned by the FastAPI backend in **Phase 1 Section 4**.

#### Prerequisites

1. Get API credentials from [developers.amadeus.com](https://developers.amadeus.com):
   - Sign up for a free account
   - Create a new app
   - Copy your API Key and API Secret

2. Configure in `.env`:
   ```bash
   AMADEUS_API_KEY=your_amadeus_api_key
   AMADEUS_API_SECRET=your_amadeus_api_secret
   ```

#### Integration Approach

The FastAPI backend will:
1. Install the Amadeus MCP server via npm during API setup
2. Spawn it as a child process when hotel search tools are called
3. Communicate via stdin/stdout using the MCP protocol
4. Cache results in Redis to minimize API calls

## 2. Kiwi MCP Server (Flights)

**Tools:** `search-flight`

**Cost:** Free (no API key required for basic usage). Optional Tequila API key for higher rate limits.

### Setup via Claude.ai (Recommended for Phase 1-2)

The Kiwi MCP server is pre-installed in Claude.ai and Claude Desktop:

- **Claude.ai Web Chat:** Automatically available, no configuration needed
- **Claude Desktop App:** Enabled by default
- **LLM Integration (Phase 2):** The Temporal worker will call Kiwi MCP via tool calling

### Alternative: Self-Hosted

For full control or Tequila API key usage:

1. Find or build a self-hosted implementation using the MCP SDK
2. Add as a sidecar container in `docker-compose.yml`
3. Configure API keys in `.env`

Note: Self-hosted Kiwi setup is deferred to post-Phase 1.

## 3. Custom MCP Server (Trip Management)

**Location:** `apps/mcp-server/`

**Tools:**
- `create_trip` - Create new price tracking trip
- `list_trips` - List user's tracked trips
- `get_trip_details` - Get price history and offers
- `set_notification` - Update alert thresholds
- `pause_trip` / `resume_trip` - Toggle tracking
- `trigger_refresh` - Force price check

### Setup

Implemented in Phase 1 sections 3-4:

1. Build using Python MCP SDK
2. Connect to the same PostgreSQL database as the API
3. Add as a sidecar service in `docker-compose.yml`
4. Integrate with the FastAPI MCP router

## Rate Limits & Caching

### Amadeus API
- Free Tier: ~2,000 calls/month
- Caching: 24-hour TTL for identical queries (Redis)
- Throttling: Token bucket per user

### Kiwi API
- Free Tier: Rate limited by IP
- With Tequila Key: Higher rate limits
- Caching: 24-hour TTL for identical route/date queries

### Implementation

The Temporal worker implements aggressive caching:
- Cache key: `(route, dates, passengers, preferences)` hash in Redis
- Return cached response if within TTL
- Call external API only on cache miss

## Troubleshooting

### Amadeus MCP Server Issues

When implementing the API (Phase 1 Section 4), if you encounter issues with the Amadeus MCP server:

1. Verify `AMADEUS_API_KEY` and `AMADEUS_API_SECRET` are set in `.env`
2. Check the Amadeus MCP installation: `npm list @modelcontextprotocol/server-amadeus-travel`
3. Test credentials: Visit [developers.amadeus.com](https://developers.amadeus.com) and verify API access
4. Check API logs for subprocess spawn errors

### Kiwi Connector Not Working in Claude.ai

1. Ensure you're using official Claude.ai or Claude Desktop
2. Restart the application
3. Use explicit phrasing: "Search for flights from SFO to MCO on March 15"

### Tool Not Found Errors

1. Check MCP router configuration in FastAPI
2. Verify tool name matches exactly (case-sensitive)
3. Ensure MCP server container is running and healthy

## Next Steps

1. **Phase 1 Section 1.3 (Current):** Infrastructure configured
2. **Phase 1 Section 4:** Implement MCP router in FastAPI
3. **Phase 2:** Integrate LLM chat with tool calling
4. **Phase 3:** Connect Temporal workflows to MCP servers for automated price checks
