# Skiplagged Migration Design Spec

**Date:** 2026-04-15
**Status:** Draft
**Scope:** Replace Amadeus, Kiwi, and Google Flights with Skiplagged for all flight and hotel data.

## Summary

Full migration from Amadeus (hotels + flights), Kiwi MCP (chat flight search), and Google Flights (worker fallback) to a single provider: Skiplagged MCP. This removes three providers, their clients, tools, tests, config, and docs — replacing them with one HTTP client calling `https://mcp.skiplagged.com/mcp` via JSON-RPC over Streamable HTTP.

Additionally: add Playwright E2E tests with light/dark theme validation, and add a `search_hotels` chat tool (previously hotels had no chat integration).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | HTTP/JSON-RPC (Streamable HTTP) | Verified working via curl. Same pattern as existing Kiwi client. No auth required. |
| Provider strategy | All-in Skiplagged, remove all others | Clean slate. One provider, one client, less code. |
| Google Flights | Remove entirely | No fallback needed. Skiplagged covers flights comprehensively. |
| Flight number parsing | Extract from Skiplagged `id` field | Format: `trip={outbound segments joined by -},{return segments}`. `~` suffix = hidden-city. |
| Hotel room filtering | Call `get_hotel_details` for top 20 hotels | Required for `preferred_room_types` and `preferred_views` matching on `TripHotelPrefs`. |
| Chat hotel search | New `search_hotels` tool | Hotels had no chat integration before. Now users can browse hotels conversationally. |
| Airport resolution | Remove `search_airports` tool | Skiplagged handles city/airport resolution internally. |
| Pagination | limit=75, max_pages=4 (up to 300 results) | Applies to both flights and hotels across chat and worker. |
| E2E testing | Playwright with light/dark theme matrix | 3 functional suites + 1 theme validation suite. Auth via test bypass endpoint. |
| Execution | Agent team with Opus lead + Sonnet teammates | 5 parallel workstreams in isolated worktrees. |

## 1. Skiplagged Client

**File:** `apps/api/app/clients/skiplagged.py`

Async HTTP client using `httpx`. Speaks JSON-RPC 2.0 over Streamable HTTP to `https://mcp.skiplagged.com/mcp`. Mirrors the existing `KiwiMCPClient` architecture.

### Protocol

1. `initialize` handshake — sends `protocolVersion: "2024-11-05"`, receives session ID in `mcp-session-id` header
2. `tools/call` with session ID header — receives SSE response with `result.content` (text) and `result.structuredContent` (typed data)
3. Session auto-resets on 400/401/403 errors

### Public Methods

```python
class SkiplaggedClient:
    async def search_flights(
        self,
        origin: str,              # IATA code
        destination: str,          # IATA code
        departure_date: str,       # YYYY-MM-DD
        return_date: str | None,   # YYYY-MM-DD for round trips
        adults: int = 1,
        max_stops: str | None = None,  # "none", "one", "many"
        sort: str = "value",       # "price", "duration", "value"
        limit: int = 75,
        offset: int = 0,
    ) -> FlightSearchResult: ...

    async def search_flights_all(
        self,
        # same params as search_flights minus offset
        max_pages: int = 4,        # up to 300 results
    ) -> FlightSearchResult: ...

    async def search_hotels(
        self,
        city: str,                 # city name (Skiplagged resolves)
        checkin: str,              # YYYY-MM-DD
        checkout: str,             # YYYY-MM-DD
        adults: int = 2,
        rooms: int = 1,
        sort: str = "value",       # "price", "ranking", "value"
        limit: int = 75,
        offset: int = 0,
    ) -> HotelSearchResult: ...

    async def search_hotels_all(
        self,
        # same params as search_hotels minus offset
        max_pages: int = 4,
    ) -> HotelSearchResult: ...

    async def get_hotel_details(
        self,
        hotel_id: int,
        checkin: str,
        checkout: str,
        adults: int = 2,
        rooms: int = 1,
    ) -> HotelDetailResult: ...
```

### Flight Number Parsing

Skiplagged embeds flight numbers in the `id` field:

```
id: "SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"
```

Parser logic:
1. Split on `trip=` to get the segment string
2. Split on `,` to separate outbound and return
3. Split each on `-` to get individual segments
4. Strip `~` suffix (hidden-city marker)
5. Extract carrier code (letters) and flight number (digits) from each segment

Result: `[{"carrier_code": "AC", "flight_number": "744"}, ...]`

### Response Models

**File:** `apps/api/app/schemas/skiplagged.py`

```python
class SkiplaggedFlightSegment(BaseModel):
    carrier_code: str
    flight_number: str

class SkiplaggedFlightEndpoint(BaseModel):
    airport: str
    dateTime: str  # ISO 8601

class SkiplaggedPrice(BaseModel):
    amount: float
    currency: str

class SkiplaggedReturnFlight(BaseModel):
    airlines: str
    departure: SkiplaggedFlightEndpoint
    arrival: SkiplaggedFlightEndpoint
    duration: str
    layovers: int
    attributes: list[str]

class SkiplaggedFlight(BaseModel):
    id: str
    airlines: str
    departure: SkiplaggedFlightEndpoint
    arrival: SkiplaggedFlightEndpoint
    duration: str
    layovers: int
    price: SkiplaggedPrice
    deepLink: str
    attributes: list[str]
    returnFlight: SkiplaggedReturnFlight | None
    parsed_segments: list[SkiplaggedFlightSegment]  # populated by parser

class SkiplaggedHotelRating(BaseModel):
    stars: int
    text: str

class SkiplaggedHotelPrice(BaseModel):
    amount: float
    currency: str
    text: str

class SkiplaggedHotel(BaseModel):
    id: str
    name: str
    imageUrl: str | None
    rating: SkiplaggedHotelRating | None
    price: SkiplaggedHotelPrice
    chain: str | None
    location: str | None
    amenities: list[str]
    deepLink: str

class SkiplaggedRoom(BaseModel):
    id: str
    title: str
    occupancyLimit: int
    pricePerNightInDollars: float
    totalPriceInDollars: float
    taxesAndFeesInDollars: float
    currency: str
    refundable: bool
    freeCancellation: bool
    bedTypes: list[str]
    bookingLink: str
    source: str | None

class SkiplaggedHotelDetail(BaseModel):
    hotelId: str
    hotelName: str
    starRating: int | None
    reviewRating: float | None
    reviewCount: int | None
    totalPriceInDollars: float
    chainName: str | None
    amenityNames: list[str]
    address: str | None
    cityName: str | None
    countryName: str | None
    description: str | None
    checkinDate: str
    checkoutDate: str
    location: dict | None  # {"lat": float, "lng": float}
    rooms: list[SkiplaggedRoom]
```

These raw models are normalized into the existing `FlightSearchResult`/`FlightSearchFlight` and a new `HotelSearchResult` type for downstream consumption.

### New Normalized Hotel Types

**File:** `apps/api/app/schemas/hotel_search.py`

```python
class HotelSearchHotel(BaseModel):
    id: str
    name: str
    image_url: str | None
    star_rating: int | None
    review_rating: float | None
    review_count: int | None
    price_per_night: Decimal
    price_total: Decimal | None
    price_currency: str
    chain: str | None
    address: str | None
    amenities: list[str]
    booking_link: str | None
    rooms: list[HotelRoom]  # populated from get_hotel_details
    provider: str
    raw_data: dict | None

class HotelRoom(BaseModel):
    title: str
    occupancy_limit: int
    price_per_night: Decimal
    price_total: Decimal
    taxes_and_fees: Decimal
    currency: str
    refundable: bool
    free_cancellation: bool
    bed_types: list[str]
    booking_link: str | None

class HotelSearchResult(BaseModel):
    hotels: list[HotelSearchHotel]
    city: str
    checkin: str
    checkout: str
    provider: str
    total_results: int
    currency: str
    success: bool
    error: str | None
```

### Error Handling

- `SkiplaggedMCPError` (base)
- `SkiplaggedConnectionError` — network/timeout failures
- `SkiplaggedRequestError` — JSON-RPC errors, bad status codes
- Session auto-reset on 400/401/403

### Unit Tests

**File:** `apps/api/tests/clients/test_skiplagged.py`

- Mock HTTP transport (monkeypatch `httpx.AsyncClient`)
- Test JSON-RPC initialize handshake + session ID capture
- Test `search_flights` response parsing
- Test `search_hotels` response parsing
- Test `get_hotel_details` response parsing
- Test flight number parser (normal, hidden-city `~`, multi-segment, single segment)
- Test `search_flights_all` pagination (mock `hasMoreResults: true` for 3 pages, then `false`)
- Test `search_hotels_all` pagination
- Test `max_pages` cap (stops even if `hasMoreResults: true`)
- Test error handling (connection timeout, 500, malformed JSON, SSE parse failure)
- Test session reset on 400/401

## 2. Chat Tools

### SearchFlightsSkiplaggedTool

**File:** `apps/api/app/tools/search_flights_skiplagged.py`

Registered in MCP router as `search_flights`. Replaces `search_flights_kiwi`.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| origin | string | yes | | IATA airport code |
| destination | string | yes | | IATA airport code |
| departure_date | string | yes | | YYYY-MM-DD |
| return_date | string | no | | YYYY-MM-DD for round trips |
| adults | integer | no | 1 | 1-9 passengers |
| max_stops | string | no | | "none", "one", "many" |
| sort | string | no | "value" | "price", "duration", "value" |
| limit | integer | no | 75 | Max results per page |
| offset | integer | no | 0 | Pagination offset |

**Response:** Formatted text for LLM with flight cards showing airlines, flight numbers (parsed), times, duration, stops, price, booking link. Raw `structuredContent` stored for frontend.

### SearchHotelsSkiplaggedTool

**File:** `apps/api/app/tools/search_hotels_skiplagged.py`

Registered in MCP router as `search_hotels`. New tool (hotels had no chat integration before).

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| city | string | yes | | City name |
| checkin | string | yes | | YYYY-MM-DD |
| checkout | string | yes | | YYYY-MM-DD |
| adults | integer | no | 2 | Adults per room |
| rooms | integer | no | 1 | Number of rooms |
| sort | string | no | "value" | "price", "ranking", "value" |
| limit | integer | no | 75 | Max results per page |
| offset | integer | no | 0 | Pagination offset |

**Response:** Formatted hotel cards with name, stars, review score, nightly price, amenities, booking link.

### Schema Updates

**File:** `apps/api/app/schemas/mcp.py`

- Remove `search_flights_kiwi` tool definition
- Remove `search_airports` tool definition
- Add `search_flights` tool definition (parameters above)
- Add `search_hotels` tool definition (parameters above)
- Update `MCP_TOOLS` list and `TOOL_SCHEMAS` dict

### System Prompt Updates

**File:** `apps/api/app/core/prompts.py`

- Replace Kiwi/Amadeus flight search instructions with Skiplagged tool description
- Add hotel search instructions
- Remove caveats about missing airline names
- Remove `search_airports` references (Skiplagged resolves internally)
- Update IATA code examples

### MCP Router Updates

**File:** `apps/api/app/services/mcp_router.py`

- Remove `SearchFlightsKiwiTool` and `SearchAirportsTool` imports/registration
- Add `SearchFlightsSkiplaggedTool` and `SearchHotelsSkiplaggedTool` imports/registration

### Tool __init__ Updates

**File:** `apps/api/app/tools/__init__.py`

- Remove old tool imports (`SearchFlightsKiwiTool`, `SearchAirportsTool`)
- Add new tool imports
- Update `TRIP_TOOLS` registry

### Unit Tests

**Files:**
- `apps/api/tests/tools/test_search_flights_skiplagged.py`
- `apps/api/tests/tools/test_search_hotels_skiplagged.py`

- Mock `SkiplaggedClient` via monkeypatch
- Test parameter validation (missing required, invalid types, out-of-range)
- Test LLM-friendly response formatting
- Test flight number display in formatted output
- Test pagination pass-through (offset/limit forwarded correctly)
- Test error cases (client timeout, empty results)

## 3. Worker Migration

**File:** `apps/worker/worker/activities/price_check.py`

### fetch_flights_activity

Replace `FlightProvider` strategy with direct Skiplagged call:

```python
@activity.defn
async def fetch_flights_activity(trip: TripDetails) -> FetchResult:
    if settings.mock_skiplagged_api:
        return _mock_flight_response(trip)

    client = SkiplaggedClient()
    result = await client.search_flights_all(
        origin=trip["origin_airport"],
        destination=trip["destination_code"],
        departure_date=trip["depart_date"],
        return_date=trip["return_date"] if trip["is_round_trip"] else None,
        adults=trip["adults"],
        max_pages=4,
    )
    offers = _normalize_flight_offers(result)
    return {"offers": offers, "raw": result.raw_data, "error": result.error}
```

Remove: `_get_flight_provider()`, `_flight_provider` global, `_map_cabin_class()`, `CABIN_CLASS_MAP`, all Amadeus/Google Flights imports.

### fetch_hotels_activity

Replace Amadeus HTTP client with Skiplagged:

```python
@activity.defn
async def fetch_hotels_activity(trip: TripDetails) -> FetchResult:
    if settings.mock_skiplagged_api:
        return _mock_hotel_response(trip)

    client = SkiplaggedClient()
    # Step 1: Get hotel list (Skiplagged resolves both IATA codes and city names)
    hotel_result = await client.search_hotels_all(
        city=trip["destination_code"],  # IATA code; Skiplagged resolves to city
        checkin=trip["depart_date"],
        checkout=trip["return_date"],
        adults=trip["hotel_prefs"]["adults_per_room"],
        rooms=trip["hotel_prefs"]["rooms"],
        max_pages=4,
    )

    # Step 2: Get room details for top 20 by price
    top_hotels = sorted(hotel_result.hotels, key=lambda h: h.price.amount)[:20]
    detailed_offers = []
    for hotel in top_hotels:
        detail = await client.get_hotel_details(
            hotel_id=int(hotel.id.replace("hotel_", "")),
            checkin=trip["depart_date"],
            checkout=trip["return_date"],
            adults=trip["hotel_prefs"]["adults_per_room"],
            rooms=trip["hotel_prefs"]["rooms"],
        )
        detailed_offers.append(_normalize_hotel_detail(detail))

    return {"offers": detailed_offers, "raw": hotel_result.raw_data, "error": None}
```

Remove: `_amadeus_client` module-level instance, all Amadeus imports.

### filter_results_activity

Update `_extract_carrier_codes()` to handle Skiplagged format:
- Parse carrier codes from the flight `id` field (same parser as client)
- Also check `airlines` field for name-based matching if carrier codes are in the airline filter

Update `_filter_hotels()`:
- Match `preferred_room_types` against room `title` field from hotel details
- Match `preferred_views` against room `title` and hotel `amenityNames`

### Mock Data

**File:** `apps/api/app/clients/skiplagged_mock.py`

Replace `amadeus_mock.py`. Returns Skiplagged-shaped responses with:
- 8-10 mock flights with varied airlines, prices, stops
- 5-8 mock hotels with varied star ratings, prices, amenities
- Room details with varied room types and pricing

Used when `MOCK_SKIPLAGGED_API=true` in env.

### Unit Tests

**File:** `apps/worker/tests/test_price_check_activities.py` (update existing)

- Update `DummySession` fixtures for new response shapes
- Mock `SkiplaggedClient` methods
- Test `fetch_flights_activity` calls `search_flights_all(max_pages=4)`
- Test `fetch_hotels_activity` calls `search_hotels_all` then `get_hotel_details` for top 20
- Test hotel detail cap at 20 (pass 25 hotels, verify only 20 detail calls)
- Test `_extract_carrier_codes` with Skiplagged format
- Test `_filter_hotels` with Skiplagged room titles
- Test mock mode (`mock_skiplagged_api=true`)
- Test error handling (client failures return empty offers with error message)

## 4. Playwright E2E Tests

### Setup

**Install:** `pnpm --filter vacation-price-tracker-web add -D @playwright/test`

**Config:** `apps/web/playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  baseURL: 'http://localhost:3000',
  timeout: 60_000,
  retries: 1,
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' } },
  ],
  use: {
    storageState: './playwright/.auth/user.json',
  },
  webServer: {
    command: 'echo "Assumes Docker stack is running"',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
```

**Scripts:** Add to `apps/web/package.json`:
- `"test:e2e": "playwright test"`
- `"test:e2e:ui": "playwright test --ui"`

**Gitignore:** Add `apps/web/playwright/` and `apps/web/test-results/`

### Auth Bypass

**File:** `apps/api/app/routers/auth.py` (add endpoint)

```python
@router.post("/v1/auth/test-login")
async def test_login(response: Response, db: AsyncSession = Depends(get_session)):
    """Test-only endpoint. Creates/returns a test user session. Gated behind ENVIRONMENT=test."""
    if settings.environment != "test":
        raise HTTPException(403, "Test login only available in test environment")
    # Create or get test user, set JWT cookie, return user data
```

**Playwright auth setup:** `apps/web/e2e/auth.setup.ts`

```typescript
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ request }) => {
  const response = await request.post('http://localhost:8000/v1/auth/test-login');
  // Save storage state with auth cookies
  await request.storageState({ path: './playwright/.auth/user.json' });
});
```

### Test Suites

#### `e2e/chat-flight-search.spec.ts`

1. Navigate to dashboard
2. Type "Find flights from SFO to Paris June 15-22" in chat
3. Wait for tool call indicator to appear
4. Assert flight results render with:
   - Airline names visible
   - Prices in USD
   - At least 1 result with a parsed flight number (matches `[A-Z]{2}\d+` pattern)
   - Booking links present (href contains "skiplagged.com")
5. Runs in both light and dark mode via project matrix

#### `e2e/chat-hotel-search.spec.ts`

1. Type "Find hotels in Paris June 15-18" in chat
2. Wait for tool call indicator
3. Assert hotel cards render with:
   - Hotel name visible
   - Star rating displayed
   - Nightly price in USD
   - Amenities listed
   - Booking links present
   - At least 1 result
4. Runs in both light and dark mode

#### `e2e/trip-creation-refresh.spec.ts`

1. Navigate to create trip page
2. Fill form: origin SFO, destination CDG, dates June 15-22, 2 adults
3. Submit and assert redirect to trip detail page
4. Click refresh button
5. Wait for refresh completion (spinner disappears or status updates)
6. Assert price history chart has at least 1 data point
7. Assert flight offers section shows results with airline names and prices
8. Assert hotel offers section shows results with names and prices
9. Runs in both light and dark mode

#### `e2e/theme-validation.spec.ts`

Tests every page (dashboard, trip detail, create trip) in both modes.

**Light mode assertions:**

| Element | Property | Expected Value |
|---------|----------|----------------|
| page background | background-color | `#faf8ff` (hsl 250 30% 98%) |
| body text | color | `#1d1d2e` (hsl 240 20% 14%) |
| cards | background-color | `#ffffff` (hsl 0 0% 100%) |
| primary buttons | background-color | hsl(262, 83%, 58%) |
| borders | border-color | hsl(240, 10%, 85%) |
| muted text | color | hsl(240, 10%, 45%) |
| destructive buttons | background-color | hsl(0, 72%, 50%) |

**Dark mode assertions:**

| Element | Property | Expected Value |
|---------|----------|----------------|
| page background | background-color | `#0d0d14` (hsl 250 20% 6%) |
| body text | color | `#ffffff` (hsl 0 0% 100%) |
| cards | background-color | hsl(250, 15%, 10%) |
| primary buttons | background-color | hsl(262, 83%, 65%) |
| borders | border-color | hsl(0, 0%, 45%) |

**Theme switching test:**
1. Load in light mode, assert light colors
2. Click theme toggle dropdown, select "Dark"
3. Assert dark colors applied (`.dark` class on `<html>`)
4. Click theme toggle, select "Light"
5. Assert light colors restored

**Chart colors (trip detail page):**
- Flight line: `--chart-1` (262 83% 58% light / 262 83% 65% dark)
- Hotel line: `--chart-2` (190 60% 50% light / 190 60% 55% dark)
- Total line: `--chart-3` (340 75% 55% light / 340 75% 60% dark)

**Implementation:** Uses Playwright's `toHaveCSS` matcher and `page.evaluate(() => getComputedStyle(...))` for CSS variable resolution.

## 5. Cleanup

### Files to Delete

**Clients:**
- `apps/api/app/clients/amadeus.py`
- `apps/api/app/clients/amadeus_mock.py`
- `apps/api/app/clients/kiwi_mcp.py`
- `apps/api/app/clients/google_flights.py`
- `apps/api/app/clients/flight_provider.py`

**Tools:**
- `apps/api/app/tools/amadeus_flights.py`
- `apps/api/app/tools/amadeus_hotels.py`
- `apps/api/app/tools/amadeus_hotel_offers.py`
- `apps/api/app/tools/search_flights_kiwi.py`
- `apps/api/app/tools/search_airports.py`

**Tests:**
- `apps/api/tests/test_amadeus_client.py`
- `apps/api/tests/tools/test_amadeus_tools.py`
- `apps/api/tests/tools/test_search_tools.py`
- `apps/api/tests/clients/test_kiwi_mcp.py`
- `apps/worker/tests/test_mcp_client.py`

### Files to Update

**Code:**
- `apps/api/app/tools/__init__.py` — remove old imports, add new
- `apps/api/app/services/mcp_router.py` — register new tools, remove old
- `apps/api/app/core/config.py` — remove `amadeus_*`, `mcp_node_path`, `amadeus_mcp_path`, `fast_flights_*`, `external_flight_price_provider`. Add `skiplagged_mcp_url` (default: `https://mcp.skiplagged.com/mcp`), `mock_skiplagged_api` (default: `false`)
- `apps/api/app/core/prompts.py` — rewrite for Skiplagged tools
- `apps/api/app/schemas/mcp.py` — replace tool definitions
- `.env.example` — remove Amadeus/Kiwi/Google Flights vars, add `SKIPLAGGED_MCP_URL`, `MOCK_SKIPLAGGED_API`
- `docker-compose.yml` — remove `AMADEUS_MCP_PATH` from worker env

**Docs:**
- `CLAUDE.md` — rewrite: data provider strategy table, API integration sections, environment config, flight display requirements, constraints, phase descriptions
- `doc/PROJECT_PLAN.md` — update Phase 2 checklist (mark Skiplagged as done), update Phase 3/4 Amadeus references
- `doc/DESIGN_OVERVIEW.md` — update architecture diagram, MCP routing section
- `doc/research/MCP_FLIGHT_SERVERS.md` — add Skiplagged findings, note Amadeus/Kiwi removal

## 6. Agent Team Structure

**Team lead (Opus):** Orchestrates, reviews, handles complex integration.

**Teammates (Sonnet, isolated worktrees):**

| Agent | Scope | Depends On | Deliverables |
|-------|-------|------------|-------------|
| `skiplagged-client` | Client + schemas + mock | Nothing | `skiplagged.py`, `skiplagged_mock.py`, `schemas/skiplagged.py`, unit tests |
| `chat-tools` | MCP tools + router + prompts + schemas | `skiplagged-client` | Tool files, mcp.py updates, prompts.py, router updates, unit tests |
| `worker-migration` | Worker activities + filter updates | `skiplagged-client` | `price_check.py` rewrite, updated worker tests |
| `playwright-setup` | E2E config + all test suites | `chat-tools` (needs working chat) | Playwright config, auth setup, 4 test suites |
| `cleanup` | Delete dead code, update docs/config | All others complete | File deletions, doc updates, config updates |

**Sequencing:**
1. `skiplagged-client` starts immediately
2. `chat-tools` and `worker-migration` start after `skiplagged-client` completes
3. `playwright-setup` starts after `chat-tools` completes
4. `cleanup` starts after all others complete

**Validation gate:** Every agent runs `pnpm verify` before declaring done. Playwright agent runs `pnpm test:e2e` and confirms all suites pass in both light and dark mode.

## 7. Validation Requirements

### Unit Tests
- All existing tests updated or replaced (no broken tests)
- New tests for: Skiplagged client, flight number parser, chat tools, worker activities
- Coverage maintains >=95% functions/lines/statements, >=85% branches

### Integration Tests
- Chat flow: send message with flight/hotel search intent, verify tool dispatch and response
- Worker flow: trigger price check workflow, verify Skiplagged client called correctly
- Update existing integration tests in `apps/api/tests/integration/` that reference Kiwi/Amadeus tools

### E2E Tests (Playwright)
- Chat flight search in light + dark mode
- Chat hotel search in light + dark mode
- Trip creation + refresh in light + dark mode
- Theme validation across all pages
- All assertions passing

### Build & Lint
- `pnpm verify` passes (build, lint, unit tests, security audit for both frontend and backend)
- `pnpm test:e2e` passes (all Playwright suites)
- No TypeScript errors
- No Ruff lint errors
- No security vulnerabilities in `pnpm audit` or `pip-audit`
