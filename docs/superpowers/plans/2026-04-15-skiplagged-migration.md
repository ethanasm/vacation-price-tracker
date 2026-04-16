# Skiplagged Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Amadeus, Kiwi, and Google Flights with Skiplagged MCP as the sole flight and hotel data provider, add hotel chat search, and add Playwright E2E tests with theme validation.

**Architecture:** A single `SkiplaggedClient` speaks JSON-RPC over Streamable HTTP to `mcp.skiplagged.com/mcp`. Two chat tools (`search_flights`, `search_hotels`) expose it to the LLM. Worker activities use multi-page fetching for comprehensive price tracking. Playwright tests validate all flows in light and dark mode.

**Tech Stack:** Python 3.12, FastAPI, httpx, Pydantic, Temporal SDK, Next.js 14, Playwright, shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-15-skiplagged-migration-design.md`

---

## Agent Assignment

| Task Group | Agent | Depends On |
|------------|-------|------------|
| Tasks 1-4 | `skiplagged-client` | Nothing (starts immediately) |
| Tasks 5-8 | `chat-tools` | Tasks 1-4 complete |
| Tasks 9-12 | `worker-migration` | Tasks 1-4 complete |
| Tasks 13-17 | `playwright-setup` | Tasks 5-8 complete |
| Tasks 18-20 | `cleanup` | All others complete |

---

## Task 1: Skiplagged Response Schemas

**Files:**
- Create: `apps/api/app/schemas/skiplagged.py`
- Create: `apps/api/app/schemas/hotel_search.py`

- [ ] **Step 1: Create Skiplagged raw response models**

```python
# apps/api/app/schemas/skiplagged.py
"""Raw response models for Skiplagged MCP API.

These match the JSON structure returned by mcp.skiplagged.com/mcp.
They are normalized into FlightSearchResult/HotelSearchResult for downstream use.
"""

from __future__ import annotations

from pydantic import BaseModel


class SkiplaggedFlightSegment(BaseModel):
    """Parsed flight segment from Skiplagged ID field."""
    carrier_code: str
    flight_number: str


class SkiplaggedFlightEndpoint(BaseModel):
    airport: str
    dateTime: str  # ISO 8601 with timezone


class SkiplaggedPrice(BaseModel):
    amount: float
    currency: str


class SkiplaggedReturnFlight(BaseModel):
    airlines: str
    departure: SkiplaggedFlightEndpoint
    arrival: SkiplaggedFlightEndpoint
    duration: str
    layovers: int
    attributes: list[str] = []


class SkiplaggedFlight(BaseModel):
    id: str
    airlines: str
    departure: SkiplaggedFlightEndpoint
    arrival: SkiplaggedFlightEndpoint
    duration: str
    layovers: int
    price: SkiplaggedPrice
    deepLink: str
    attributes: list[str] = []
    returnFlight: SkiplaggedReturnFlight | None = None
    parsed_segments: list[SkiplaggedFlightSegment] = []


class SkiplaggedPagination(BaseModel):
    totalAvailable: int
    currentlyShowing: int
    offset: int
    limit: int
    hasMoreResults: bool


class SkiplaggedFlightsResponse(BaseModel):
    searchUrl: str | None = None
    flights: list[SkiplaggedFlight] = []
    pagination: SkiplaggedPagination | None = None


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
    imageUrl: str | None = None
    rating: SkiplaggedHotelRating | None = None
    price: SkiplaggedHotelPrice
    chain: str | None = None
    location: str | None = None
    amenities: list[str] = []
    deepLink: str


class SkiplaggedHotelsResponse(BaseModel):
    searchUrl: str | None = None
    results: list[SkiplaggedHotel] = []
    pagination: SkiplaggedPagination | None = None


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
    bedTypes: list[str] = []
    bookingLink: str
    source: str | None = None


class SkiplaggedHotelLocation(BaseModel):
    lat: float
    lng: float


class SkiplaggedHotelDetail(BaseModel):
    hotelId: str
    hotelName: str
    starRating: int | None = None
    reviewRating: float | None = None
    reviewCount: int | None = None
    totalPriceInDollars: float
    chainName: str | None = None
    amenityNames: list[str] = []
    address: str | None = None
    cityName: str | None = None
    countryName: str | None = None
    description: str | None = None
    checkinDate: str
    checkoutDate: str
    location: SkiplaggedHotelLocation | None = None
    rooms: list[SkiplaggedRoom] = []
```

- [ ] **Step 2: Create normalized hotel search types**

```python
# apps/api/app/schemas/hotel_search.py
"""Normalized hotel search result types.

Provider-agnostic models consumed by chat tools and worker activities.
Mirrors the pattern in flight_search.py.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class HotelRoom(BaseModel):
    title: str
    occupancy_limit: int
    price_per_night: Decimal
    price_total: Decimal
    taxes_and_fees: Decimal
    currency: str
    refundable: bool
    free_cancellation: bool
    bed_types: list[str] = []
    booking_link: str | None = None


class HotelSearchHotel(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    star_rating: int | None = None
    review_rating: float | None = None
    review_count: int | None = None
    price_per_night: Decimal
    price_total: Decimal | None = None
    price_currency: str
    chain: str | None = None
    address: str | None = None
    amenities: list[str] = []
    booking_link: str | None = None
    rooms: list[HotelRoom] = []
    provider: str = "skiplagged"
    raw_data: dict[str, Any] | None = None


class HotelSearchResult(BaseModel):
    hotels: list[HotelSearchHotel]
    city: str
    checkin: str
    checkout: str
    provider: str = "skiplagged"
    total_results: int = 0
    currency: str = "USD"
    success: bool = True
    error: str | None = None
```

- [ ] **Step 3: Run linter on new files**

Run: `uv run ruff check apps/api/app/schemas/skiplagged.py apps/api/app/schemas/hotel_search.py`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/schemas/skiplagged.py apps/api/app/schemas/hotel_search.py
git commit -m "feat(api): add Skiplagged response schemas and normalized hotel types"
```

---

## Task 2: Flight Number Parser

**Files:**
- Create: `apps/api/app/clients/skiplagged_parser.py`
- Create: `apps/api/tests/clients/test_skiplagged_parser.py`

- [ ] **Step 1: Write failing tests for flight number parsing**

```python
# apps/api/tests/clients/test_skiplagged_parser.py
"""Tests for Skiplagged flight number parser."""

import pytest

from app.clients.skiplagged_parser import parse_flight_segments


class TestParseFlightSegments:
    def test_single_outbound_segment(self):
        flight_id = "SFO-CDG-2026-06-15-trip=AF81"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 1
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"
        assert return_segs == []

    def test_multi_segment_outbound(self):
        flight_id = "SFO-CDG-2026-06-15-trip=AC744-LH6825"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 2
        assert outbound[0].carrier_code == "AC"
        assert outbound[0].flight_number == "744"
        assert outbound[1].carrier_code == "LH"
        assert outbound[1].flight_number == "6825"
        assert return_segs == []

    def test_round_trip(self):
        flight_id = "SFO-CDG-2026-06-15-2026-06-22-trip=AF81,TS251-AC401"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 1
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"
        assert len(return_segs) == 2
        assert return_segs[0].carrier_code == "TS"
        assert return_segs[0].flight_number == "251"
        assert return_segs[1].carrier_code == "AC"
        assert return_segs[1].flight_number == "401"

    def test_hidden_city_marker_stripped(self):
        flight_id = "SFO-CDG-2026-06-15-trip=AF81~"
        outbound, _ = parse_flight_segments(flight_id)
        assert len(outbound) == 1
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"

    def test_hidden_city_round_trip(self):
        flight_id = "SFO-CDG-2026-06-15-2026-06-22-trip=AF81~,TS251-AC401-AC741"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"
        assert len(return_segs) == 3

    def test_no_trip_marker(self):
        flight_id = "SFO-CDG-2026-06-15"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert outbound == []
        assert return_segs == []

    def test_empty_string(self):
        outbound, return_segs = parse_flight_segments("")
        assert outbound == []
        assert return_segs == []

    def test_complex_real_id(self):
        flight_id = "SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 2
        assert len(return_segs) == 3
        assert outbound[0].carrier_code == "AC"
        assert return_segs[2].carrier_code == "AC"
        assert return_segs[2].flight_number == "741"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest apps/api/tests/clients/test_skiplagged_parser.py -v`
Expected: FAIL with ModuleNotFoundError

- [ ] **Step 3: Implement the parser**

```python
# apps/api/app/clients/skiplagged_parser.py
"""Parser for Skiplagged flight IDs to extract flight numbers.

Skiplagged encodes flight segments in the `id` field:
    "SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"

Format after "trip=":
    {outbound segments joined by -},{return segments joined by -}

Each segment is: {carrier_code}{flight_number}
A trailing ~ indicates a hidden-city itinerary.
"""

from __future__ import annotations

import re

from app.schemas.skiplagged import SkiplaggedFlightSegment

# Matches carrier code (2-3 uppercase letters) followed by flight number (digits)
_SEGMENT_PATTERN = re.compile(r"^([A-Z]{2,3})(\d+)$")


def _parse_segment(raw: str) -> SkiplaggedFlightSegment | None:
    """Parse a single segment string like 'AC744' or 'AF81~'."""
    cleaned = raw.strip().rstrip("~")
    if not cleaned:
        return None
    match = _SEGMENT_PATTERN.match(cleaned)
    if not match:
        return None
    return SkiplaggedFlightSegment(
        carrier_code=match.group(1),
        flight_number=match.group(2),
    )


def _parse_leg(leg_str: str) -> list[SkiplaggedFlightSegment]:
    """Parse a leg string like 'AC744-LH6825' into segment list."""
    if not leg_str.strip():
        return []
    segments = []
    for raw in leg_str.split("-"):
        seg = _parse_segment(raw)
        if seg:
            segments.append(seg)
    return segments


def parse_flight_segments(
    flight_id: str,
) -> tuple[list[SkiplaggedFlightSegment], list[SkiplaggedFlightSegment]]:
    """Parse a Skiplagged flight ID into outbound and return segments.

    Args:
        flight_id: The Skiplagged flight `id` field.

    Returns:
        Tuple of (outbound_segments, return_segments).
        Both are empty lists if the ID cannot be parsed.
    """
    if "trip=" not in flight_id:
        return [], []

    trip_part = flight_id.split("trip=", 1)[1]

    if "," in trip_part:
        outbound_str, return_str = trip_part.split(",", 1)
        return _parse_leg(outbound_str), _parse_leg(return_str)

    return _parse_leg(trip_part), []
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/api/tests/clients/test_skiplagged_parser.py -v`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/clients/skiplagged_parser.py apps/api/tests/clients/test_skiplagged_parser.py
git commit -m "feat(api): add Skiplagged flight number parser with tests"
```

---

## Task 3: Skiplagged MCP Client

**Files:**
- Create: `apps/api/app/clients/skiplagged.py`
- Create: `apps/api/tests/clients/test_skiplagged.py`

- [ ] **Step 1: Write failing tests for the client**

```python
# apps/api/tests/clients/test_skiplagged.py
"""Tests for Skiplagged MCP client."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.clients.skiplagged import (
    SkiplaggedClient,
    SkiplaggedConnectionError,
    SkiplaggedMCPError,
    SkiplaggedRequestError,
)


def _make_sse_response(data: dict, status_code: int = 200, session_id: str = "test-session") -> httpx.Response:
    """Create a mock SSE response."""
    import json
    body = f"event: message\ndata: {json.dumps(data)}\n\n"
    headers = {
        "content-type": "text/event-stream",
        "mcp-session-id": session_id,
    }
    return httpx.Response(status_code=status_code, text=body, headers=headers)


def _init_response() -> httpx.Response:
    """Create a successful initialize response."""
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "@skiplagged/mcp", "version": "0.0.4"},
        },
    })


def _flights_response(num_flights: int = 3, has_more: bool = False) -> httpx.Response:
    """Create a mock flights search response."""
    flights = []
    for i in range(num_flights):
        flights.append({
            "type": "FlightCard",
            "id": f"SFO-CDG-2026-06-15-trip=AF{80 + i}",
            "airlines": "Air France",
            "departure": {"airport": "SFO", "dateTime": "2026-06-15T20:10:00-07:00"},
            "arrival": {"airport": "CDG", "dateTime": "2026-06-16T15:50:00+02:00"},
            "duration": "10h 40m",
            "layovers": 0,
            "price": {"amount": 1200 + i * 50, "currency": "USD"},
            "deepLink": f"https://skiplagged.com/flights/test#{i}",
            "attributes": ["standard", "nonstop"],
        })
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 2,
        "result": {
            "content": [{"type": "text", "text": "flights found"}],
            "structuredContent": {
                "flights": flights,
                "pagination": {
                    "totalAvailable": 100 if has_more else num_flights,
                    "currentlyShowing": num_flights,
                    "offset": 0,
                    "limit": 75,
                    "hasMoreResults": has_more,
                },
            },
        },
    })


def _hotels_response(num_hotels: int = 2, has_more: bool = False) -> httpx.Response:
    """Create a mock hotels search response."""
    hotels = []
    for i in range(num_hotels):
        hotels.append({
            "type": "HotelCard",
            "id": f"hotel_{1000 + i}",
            "name": f"Test Hotel {i}",
            "imageUrl": f"https://example.com/hotel{i}.jpg",
            "rating": {"stars": 4, "text": "4 stars"},
            "price": {"amount": 100.0 + i * 20, "currency": "USD", "text": f"${100 + i * 20}/night"},
            "chain": "Test Chain",
            "location": f"{i} Test Street",
            "amenities": ["Free internet", "Pool"],
            "deepLink": f"https://skiplagged.com/hotel/{1000 + i}",
        })
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 2,
        "result": {
            "content": [{"type": "text", "text": "hotels found"}],
            "structuredContent": {
                "results": hotels,
                "pagination": {
                    "totalAvailable": 50 if has_more else num_hotels,
                    "currentlyShowing": num_hotels,
                    "offset": 0,
                    "limit": 75,
                    "hasMoreResults": has_more,
                },
            },
        },
    })


class TestSkiplaggedClientInit:
    @pytest.mark.anyio
    async def test_initialize_captures_session_id(self):
        client = SkiplaggedClient()
        mock_post = AsyncMock(return_value=_init_response())
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            await client._ensure_initialized()
        assert client._session_id == "test-session"
        assert client._initialized is True

    @pytest.mark.anyio
    async def test_connection_error_on_timeout(self):
        client = SkiplaggedClient()
        mock_post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedConnectionError):
                await client._ensure_initialized()


class TestSkiplaggedFlightSearch:
    @pytest.mark.anyio
    async def test_search_flights_success(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(3))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        assert result.success is True
        assert len(result.flights) == 3
        assert result.provider == "skiplagged"
        assert result.flights[0].airline_name == "Air France"
        assert result.flights[0].price_amount == Decimal("1200")

    @pytest.mark.anyio
    async def test_search_flights_parses_flight_numbers(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(1))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        flight = result.flights[0]
        assert flight.carrier_code == "AF"
        # Flight number parsed from id "SFO-CDG-2026-06-15-trip=AF80"

    @pytest.mark.anyio
    async def test_search_flights_empty_results(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(0))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        assert result.success is True
        assert result.flights == []
        assert result.total_results == 0


class TestSkiplaggedHotelSearch:
    @pytest.mark.anyio
    async def test_search_hotels_success(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_hotels_response(2))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_hotels("Paris", "2026-06-15", "2026-06-18")
        assert result.success is True
        assert len(result.hotels) == 2
        assert result.hotels[0].name == "Test Hotel 0"
        assert result.hotels[0].price_per_night == Decimal("100.0")


class TestSkiplaggedPagination:
    @pytest.mark.anyio
    async def test_search_flights_all_follows_pages(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        # Page 1: has more. Page 2: no more.
        responses = [_flights_response(3, has_more=True), _flights_response(2, has_more=False)]
        mock_post = AsyncMock(side_effect=responses)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights_all("SFO", "CDG", "2026-06-15", max_pages=4)
        assert result.success is True
        assert len(result.flights) == 5  # 3 + 2

    @pytest.mark.anyio
    async def test_search_flights_all_respects_max_pages(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        # All pages have more, but we cap at 2
        responses = [_flights_response(3, has_more=True), _flights_response(3, has_more=True)]
        mock_post = AsyncMock(side_effect=responses)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights_all("SFO", "CDG", "2026-06-15", max_pages=2)
        assert len(result.flights) == 6  # 3 + 3, stopped at max_pages


class TestSkiplaggedErrorHandling:
    @pytest.mark.anyio
    async def test_session_reset_on_400(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "old-session"
        error_response = httpx.Response(400, text="Bad Request", headers={"content-type": "text/plain"})
        mock_post = AsyncMock(return_value=error_response)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRequestError):
                await client.search_flights("SFO", "CDG", "2026-06-15")
        assert client._initialized is False
        assert client._session_id is None

    @pytest.mark.anyio
    async def test_connection_error_on_network_failure(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedConnectionError):
                await client.search_flights("SFO", "CDG", "2026-06-15")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest apps/api/tests/clients/test_skiplagged.py -v`
Expected: FAIL with ModuleNotFoundError

- [ ] **Step 3: Implement the Skiplagged client**

Create `apps/api/app/clients/skiplagged.py`. This is a large file — implement the full client following the `KiwiMCPClient` pattern in `apps/api/app/clients/kiwi_mcp.py`. Key elements:

- `SkiplaggedMCPError`, `SkiplaggedConnectionError`, `SkiplaggedRequestError` exception hierarchy
- `SkiplaggedClient` class with `__init__` accepting `mcp_url` and `timeout_seconds`
- `_ensure_initialized()` — JSON-RPC initialize handshake, captures `mcp-session-id`
- `_call_mcp(tool_name, params)` — sends `tools/call` JSON-RPC request
- `_send_request(payload)` — HTTP POST with session header, handles SSE
- `_parse_sse_json_rpc(response)` — extracts JSON from SSE `data:` lines
- `_extract_result(data)` — gets `structuredContent` (preferred) or `content` text
- `search_flights()` — calls `sk_flights_search`, normalizes to `FlightSearchResult`
- `search_flights_all()` — loops `search_flights` following `pagination.hasMoreResults` up to `max_pages=4`
- `search_hotels()` — calls `sk_hotels_search`, normalizes to `HotelSearchResult`
- `search_hotels_all()` — same pagination pattern
- `get_hotel_details()` — calls `sk_hotel_details`, returns `SkiplaggedHotelDetail`
- Uses `parse_flight_segments()` from `skiplagged_parser.py` to populate `carrier_code` on normalized flights
- Singleton: `skiplagged_client = SkiplaggedClient()`

The normalization converts `SkiplaggedFlight` → `FlightSearchFlight` (existing type from `flight_search.py`) and `SkiplaggedHotel` → `HotelSearchHotel` (new type from `hotel_search.py`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/api/tests/clients/test_skiplagged.py -v`
Expected: All tests PASS

- [ ] **Step 5: Run linter**

Run: `uv run ruff check apps/api/app/clients/skiplagged.py apps/api/tests/clients/test_skiplagged.py`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/clients/skiplagged.py apps/api/tests/clients/test_skiplagged.py
git commit -m "feat(api): add Skiplagged MCP client with flight and hotel search"
```

---

## Task 4: Skiplagged Mock Data

**Files:**
- Create: `apps/api/app/clients/skiplagged_mock.py`

- [ ] **Step 1: Create mock data module**

Create `apps/api/app/clients/skiplagged_mock.py` with mock functions that return Skiplagged-shaped data. Follow the pattern in `apps/api/app/clients/amadeus_mock.py`:

- `mock_flight_search()` — returns 8-10 flights with varied airlines (Air France, United, Delta, Ryanair), prices ($200-$1500), stops (0-2), and realistic IDs with parseable flight numbers
- `mock_hotel_search()` — returns 5-8 hotels with varied star ratings (1-5), prices ($50-$400/night), chains, amenities
- `mock_hotel_details()` — returns hotel detail with 3-5 room types (Standard, Suite, Deluxe, etc.) with varied pricing, cancellation policies, bed types
- Uses random price variation (±15%) like the existing mock for realistic tracking data

- [ ] **Step 2: Run linter**

Run: `uv run ruff check apps/api/app/clients/skiplagged_mock.py`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/clients/skiplagged_mock.py
git commit -m "feat(api): add Skiplagged mock data for development"
```

---

## Task 5: Search Flights Chat Tool

**Files:**
- Create: `apps/api/app/tools/search_flights_skiplagged.py`
- Create: `apps/api/tests/tools/test_search_flights_skiplagged.py`

- [ ] **Step 1: Write failing tests**

Follow the exact pattern from `apps/api/tests/tools/test_search_tools.py` (the `TestSearchFlightsKiwiTool` class). Create tests for:

- `test_tool_attributes` — verify name="search_flights", description set
- `test_execute_success` — mock `SkiplaggedClient.search_flights()`, verify formatted output includes airline names, flight numbers, prices, booking links
- `test_execute_missing_required_params` — missing origin/destination/departure_date returns error
- `test_execute_client_error` — `SkiplaggedConnectionError` returns graceful error
- `test_execute_empty_results` — zero flights returns "no flights found" message
- `test_execute_with_optional_params` — offset, limit, max_stops, sort forwarded to client
- `test_format_includes_flight_numbers` — parsed flight numbers appear in formatted text

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest apps/api/tests/tools/test_search_flights_skiplagged.py -v`
Expected: FAIL

- [ ] **Step 3: Implement the tool**

Create `apps/api/app/tools/search_flights_skiplagged.py` following the `SearchFlightsKiwiTool` pattern. Key differences:
- Tool name: `search_flights` (not `search_flights_kiwi`)
- Uses `SkiplaggedClient` instead of `KiwiMCPClient`
- Parameters: `origin`, `destination`, `departure_date`, `return_date`, `adults`, `max_stops`, `sort`, `limit` (default 75), `offset` (default 0)
- `_format_results()` includes airline names and parsed flight numbers in output text

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/api/tests/tools/test_search_flights_skiplagged.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/tools/search_flights_skiplagged.py apps/api/tests/tools/test_search_flights_skiplagged.py
git commit -m "feat(api): add search_flights chat tool using Skiplagged"
```

---

## Task 6: Search Hotels Chat Tool

**Files:**
- Create: `apps/api/app/tools/search_hotels_skiplagged.py`
- Create: `apps/api/tests/tools/test_search_hotels_skiplagged.py`

- [ ] **Step 1: Write failing tests**

Same pattern as Task 5. Tests for:
- `test_tool_attributes` — name="search_hotels"
- `test_execute_success` — mock client, verify formatted output has hotel name, stars, price/night, amenities, booking link
- `test_execute_missing_required_params` — missing city/checkin/checkout
- `test_execute_client_error` — connection error returns graceful message
- `test_execute_empty_results` — "no hotels found"
- `test_execute_with_optional_params` — adults, rooms, sort, limit, offset forwarded

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest apps/api/tests/tools/test_search_hotels_skiplagged.py -v`
Expected: FAIL

- [ ] **Step 3: Implement the tool**

Create `apps/api/app/tools/search_hotels_skiplagged.py`. Same `BaseTool` pattern:
- Tool name: `search_hotels`
- Uses `SkiplaggedClient.search_hotels()`
- Parameters: `city`, `checkin`, `checkout`, `adults`, `rooms`, `sort`, `limit` (default 75), `offset` (default 0)
- `_format_results()` shows hotel name, star rating, review score, price/night, amenities list, booking link

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/api/tests/tools/test_search_hotels_skiplagged.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/tools/search_hotels_skiplagged.py apps/api/tests/tools/test_search_hotels_skiplagged.py
git commit -m "feat(api): add search_hotels chat tool using Skiplagged"
```

---

## Task 7: MCP Router & Schema Registration

**Files:**
- Modify: `apps/api/app/tools/__init__.py`
- Modify: `apps/api/app/services/mcp_router.py`
- Modify: `apps/api/app/schemas/mcp.py`

- [ ] **Step 1: Update tool __init__.py**

Replace `SearchFlightsKiwiTool` and `SearchAirportsTool` imports with new tools:

```python
# Remove these imports:
# from app.tools.search_airports import SearchAirportsTool
# from app.tools.search_flights_kiwi import SearchFlightsKiwiTool

# Add these imports:
from app.tools.search_flights_skiplagged import SearchFlightsSkiplaggedTool
from app.tools.search_hotels_skiplagged import SearchHotelsSkiplaggedTool
```

Update `__all__` and `TRIP_TOOLS` dict: remove `"SearchAirportsTool"`, `"SearchFlightsKiwiTool"`, `"search_airports"`, `"search_flights_kiwi"`. Add `"SearchFlightsSkiplaggedTool"`, `"SearchHotelsSkiplaggedTool"`, `"search_flights"`, `"search_hotels"`.

- [ ] **Step 2: Update MCP router registration**

In `apps/api/app/services/mcp_router.py`, update `_register_tools()` (around line 461):

```python
# Remove:
# from app.tools import SearchAirportsTool, SearchFlightsKiwiTool
# router.register("search_airports", SearchAirportsTool())
# router.register("search_flights_kiwi", SearchFlightsKiwiTool())

# Add:
from app.tools import SearchFlightsSkiplaggedTool, SearchHotelsSkiplaggedTool
router.register("search_flights", SearchFlightsSkiplaggedTool())
router.register("search_hotels", SearchHotelsSkiplaggedTool())
```

- [ ] **Step 3: Update MCP tool schemas**

In `apps/api/app/schemas/mcp.py`:
- Remove `SEARCH_AIRPORTS_TOOL` definition (lines 283-297)
- Remove `SEARCH_FLIGHTS_KIWI_TOOL` definition (lines 300-343)
- Add `SEARCH_FLIGHTS_TOOL` with parameters: origin, destination, departure_date, return_date, adults (1-9), max_stops (enum: none/one/many), sort (enum: price/duration/value), limit (1-300, default 75), offset (min 0, default 0)
- Add `SEARCH_HOTELS_TOOL` with parameters: city, checkin, checkout, adults (1-9, default 2), rooms (1-9, default 1), sort (enum: price/ranking/value), limit (1-300, default 75), offset (min 0, default 0)
- Update `MCP_TOOLS` list and `TOOL_SCHEMAS` dict

- [ ] **Step 4: Run existing MCP router tests**

Run: `uv run pytest apps/api/tests/services/test_mcp_router.py -v`
Expected: PASS (tests should work with new tool names)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/tools/__init__.py apps/api/app/services/mcp_router.py apps/api/app/schemas/mcp.py
git commit -m "feat(api): register Skiplagged tools in MCP router and schema"
```

---

## Task 8: System Prompt Update

**Files:**
- Modify: `apps/api/app/core/prompts.py`

- [ ] **Step 1: Rewrite tool descriptions in system prompt**

In `apps/api/app/core/prompts.py`, update the flight/hotel search section (around lines 75-107):

- Remove references to `search_flights_kiwi`, `search_flights_amadeus`, `search_airports`
- Remove "always pass currency=USD" caveat
- Remove "no airline names" warning
- Add `search_flights` tool description: "Search for flights between airports. Returns airline names, flight numbers, prices, durations, stops, and booking links."
- Add `search_hotels` tool description: "Search for hotels in a city. Returns hotel name, star rating, review score, nightly price, amenities, and booking links."
- Keep IATA code examples and general travel assistant instructions

- [ ] **Step 2: Run prompt-related tests**

Run: `uv run pytest apps/api/tests/ -k "prompt" -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/core/prompts.py
git commit -m "feat(api): update system prompt for Skiplagged tools"
```

---

## Task 9: Worker Flight Activity Migration

**Files:**
- Modify: `apps/worker/worker/activities/price_check.py`

- [ ] **Step 1: Write failing test for new fetch_flights_activity**

In `apps/worker/tests/test_price_check_activities.py`, add/update test:

```python
@pytest.mark.anyio
async def test_fetch_flights_uses_skiplagged(monkeypatch):
    """Verify fetch_flights_activity calls SkiplaggedClient.search_flights_all."""
    from unittest.mock import AsyncMock, patch
    from app.schemas.flight_search import FlightSearchResult

    mock_result = FlightSearchResult(
        flights=[], origin="SFO", destination="CDG",
        departure_date="2026-06-15", return_date="2026-06-22",
        is_round_trip=True, provider="skiplagged", total_results=0,
        currency="USD", success=True, error=None,
    )
    mock_client = AsyncMock()
    mock_client.search_flights_all = AsyncMock(return_value=mock_result)

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        result = await fetch_flights_activity(sample_trip_details)

    mock_client.search_flights_all.assert_called_once()
    call_kwargs = mock_client.search_flights_all.call_args
    assert call_kwargs.kwargs.get("max_pages") == 4 or call_kwargs[1].get("max_pages") == 4
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py::test_fetch_flights_uses_skiplagged -v`
Expected: FAIL

- [ ] **Step 3: Rewrite fetch_flights_activity**

In `apps/worker/worker/activities/price_check.py`:
- Remove imports: `AmadeusClient`, `AmadeusClientError`, `get_provider_name`, `flight_provider`
- Remove: `_flight_provider` global, `_get_flight_provider()`, `_map_cabin_class()`, `CABIN_CLASS_MAP`
- Remove: `_amadeus_client` module-level instance
- Add import: `from app.clients.skiplagged import SkiplaggedClient`
- Replace `fetch_flights_activity` body with Skiplagged client call using `search_flights_all(max_pages=4)`
- Update mock check from `settings.mock_amadeus_api` to `settings.mock_skiplagged_api`

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py::test_fetch_flights_uses_skiplagged -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/worker/activities/price_check.py apps/worker/tests/test_price_check_activities.py
git commit -m "feat(worker): migrate fetch_flights_activity to Skiplagged"
```

---

## Task 10: Worker Hotel Activity Migration

**Files:**
- Modify: `apps/worker/worker/activities/price_check.py`

- [ ] **Step 1: Write failing test for new fetch_hotels_activity**

```python
@pytest.mark.anyio
async def test_fetch_hotels_uses_skiplagged_with_details(monkeypatch):
    """Verify fetch_hotels_activity calls search_hotels_all then get_hotel_details for top 20."""
    from unittest.mock import AsyncMock, patch
    from app.schemas.hotel_search import HotelSearchResult, HotelSearchHotel
    from app.schemas.skiplagged import SkiplaggedHotelDetail, SkiplaggedRoom
    from decimal import Decimal

    # Create 25 mock hotels (should only detail-check top 20)
    hotels = [
        HotelSearchHotel(
            id=f"hotel_{i}", name=f"Hotel {i}", price_per_night=Decimal(str(50 + i * 10)),
            price_currency="USD", provider="skiplagged",
        )
        for i in range(25)
    ]
    mock_hotel_result = HotelSearchResult(
        hotels=hotels, city="PAR", checkin="2026-06-15", checkout="2026-06-22",
        total_results=25, success=True,
    )
    mock_detail = SkiplaggedHotelDetail(
        hotelId="1", hotelName="Test", totalPriceInDollars=500.0,
        checkinDate="2026-06-15", checkoutDate="2026-06-22",
        rooms=[SkiplaggedRoom(
            id="r1", title="Standard Room", occupancyLimit=2,
            pricePerNightInDollars=70.0, totalPriceInDollars=490.0,
            taxesAndFeesInDollars=50.0, currency="USD",
            refundable=False, freeCancellation=False, bookingLink="https://example.com",
        )],
    )

    mock_client = AsyncMock()
    mock_client.search_hotels_all = AsyncMock(return_value=mock_hotel_result)
    mock_client.get_hotel_details = AsyncMock(return_value=mock_detail)

    with patch("worker.activities.price_check.SkiplaggedClient", return_value=mock_client):
        result = await fetch_hotels_activity(sample_trip_details)

    # Should call get_hotel_details exactly 20 times (capped)
    assert mock_client.get_hotel_details.call_count == 20
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py::test_fetch_hotels_uses_skiplagged_with_details -v`
Expected: FAIL

- [ ] **Step 3: Rewrite fetch_hotels_activity**

Replace the Amadeus hotel fetch with Skiplagged: `search_hotels_all(max_pages=4)` then `get_hotel_details` for top 20 by price. Normalize results using `_normalize_hotel_detail()` helper.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py::test_fetch_hotels_uses_skiplagged_with_details -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/worker/activities/price_check.py apps/worker/tests/test_price_check_activities.py
git commit -m "feat(worker): migrate fetch_hotels_activity to Skiplagged with room details"
```

---

## Task 11: Worker Filter Updates

**Files:**
- Modify: `apps/worker/worker/activities/price_check.py`

- [ ] **Step 1: Write failing tests for updated filters**

```python
def test_extract_carrier_codes_skiplagged_format():
    """Carrier codes extracted from Skiplagged flight ID."""
    flight = {"id": "SFO-CDG-2026-06-15-trip=AF81-LH200,TS251"}
    codes = _extract_carrier_codes(flight)
    assert "AF" in codes
    assert "LH" in codes

def test_filter_hotels_by_room_title():
    """Hotels filtered by room title matching preferred_room_types."""
    hotels = [
        {"rooms": [{"title": "Deluxe Suite"}, {"title": "Standard Room"}]},
        {"rooms": [{"title": "Standard Room"}]},
    ]
    prefs = {"preferred_room_types": ["suite"], "preferred_views": []}
    result = _filter_hotels(hotels, prefs)
    assert len(result) == 1  # Only the one with "Deluxe Suite"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest apps/worker/tests/test_price_check_activities.py -k "carrier_codes_skiplagged or room_title" -v`
Expected: FAIL

- [ ] **Step 3: Update filter functions**

Update `_extract_carrier_codes()` to parse Skiplagged ID format using `parse_flight_segments()`. Update `_filter_hotels()` to match against room `title` fields from hotel details.

- [ ] **Step 4: Run all worker tests**

Run: `uv run pytest apps/worker/tests/ -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/worker/activities/price_check.py apps/worker/tests/test_price_check_activities.py
git commit -m "feat(worker): update filters for Skiplagged response format"
```

---

## Task 12: Worker Full Test Suite

**Files:**
- Modify: `apps/worker/tests/test_price_check_activities.py`

- [ ] **Step 1: Update all remaining worker tests for new response shapes**

Review every test in `test_price_check_activities.py` and update fixtures/assertions that reference Amadeus response formats. Ensure DummySession fixtures return Skiplagged-shaped data.

- [ ] **Step 2: Run full worker test suite**

Run: `uv run pytest apps/worker/tests/ -v`
Expected: All PASS

- [ ] **Step 3: Run full backend test suite**

Run: `uv run ruff check apps/api apps/worker && uv run pytest apps/api/tests apps/worker/tests -v`
Expected: All PASS, no lint errors

- [ ] **Step 4: Commit**

```bash
git add apps/worker/tests/
git commit -m "test(worker): update all worker tests for Skiplagged migration"
```

---

## Task 13: Playwright Setup & Auth Bypass

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/auth.setup.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/api/app/routers/auth.py`
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright**

Run: `cd /Users/ethansmith/Developer/vacation-price-tracker/.claude/worktrees/zen-dhawan && pnpm --filter vacation-price-tracker-web add -D @playwright/test`
Then: `cd apps/web && npx playwright install chromium`

- [ ] **Step 2: Create Playwright config**

```typescript
// apps/web/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  baseURL: "http://localhost:3000",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  reporter: [["html", { open: "never" }]],
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "light" },
    {
      name: "light",
      use: { colorScheme: "light", storageState: "./playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "dark",
      use: { colorScheme: "dark", storageState: "./playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "echo 'Assumes Docker stack is running'",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Add test-login endpoint to FastAPI**

Add to `apps/api/app/routers/auth.py`:

```python
@router.post("/v1/auth/test-login")
async def test_login(
    response: Response,
    db: AsyncSession = Depends(get_session),
):
    """Test-only login. Creates a test user and sets JWT cookie.
    Only available when ENVIRONMENT=test.
    """
    if settings.environment != "test":
        raise HTTPException(status_code=403, detail="Test login only available in test environment")

    # Find or create test user
    from app.models.user import User
    test_google_sub = "test-user-000"
    result = await db.execute(select(User).where(User.google_sub == test_google_sub))
    user = result.scalars().first()
    if not user:
        user = User(
            google_sub=test_google_sub,
            email="test@example.com",
            display_name="Test User",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Set JWT cookie
    from app.core.security import create_access_token
    token = create_access_token(user_id=str(user.id))
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=3600,
    )
    return {"id": str(user.id), "email": user.email, "display_name": user.display_name}
```

- [ ] **Step 4: Create auth setup for Playwright**

```typescript
// apps/web/e2e/auth.setup.ts
import { test as setup } from "@playwright/test";

const AUTH_FILE = "./playwright/.auth/user.json";

setup("authenticate", async ({ request }) => {
  await request.post("http://localhost:8000/v1/auth/test-login");
  await request.storageState({ path: AUTH_FILE });
});
```

- [ ] **Step 5: Add scripts to package.json**

Add to `apps/web/package.json` scripts:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 6: Update .gitignore**

Add to root `.gitignore`:
```
# Playwright
apps/web/playwright/
apps/web/playwright-report/
apps/web/test-results/
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e/auth.setup.ts apps/web/package.json apps/api/app/routers/auth.py .gitignore
git commit -m "feat: add Playwright E2E setup with auth bypass"
```

---

## Task 14: E2E Chat Flight Search Tests

**Files:**
- Create: `apps/web/e2e/chat-flight-search.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/chat-flight-search.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Chat Flight Search", () => {
  test("searches for flights and displays results", async ({ page }) => {
    await page.goto("/");

    // Find chat input and type search query
    const chatInput = page.getByRole("textbox", { name: /message/i });
    await chatInput.fill("Find flights from SFO to Paris June 15-22");
    await chatInput.press("Enter");

    // Wait for tool call indicator (search in progress)
    await expect(page.getByText(/search_flights/i)).toBeVisible({ timeout: 30_000 });

    // Wait for results to render
    await expect(page.getByText(/Air/i)).toBeVisible({ timeout: 60_000 });

    // Assert flight results
    const results = page.locator("[data-testid='flight-result'], .flight-card, [class*='flight']");
    await expect(results.first()).toBeVisible();

    // Assert airline names are shown
    await expect(page.getByText(/airline|Air France|United|Delta|American/i).first()).toBeVisible();

    // Assert prices in USD
    await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible();

    // Assert booking links contain skiplagged.com
    const bookingLink = page.locator("a[href*='skiplagged.com']").first();
    await expect(bookingLink).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test (expect it may need selector adjustments)**

Run: `cd apps/web && npx playwright test chat-flight-search --project=light`
Expected: PASS (adjust selectors based on actual DOM if needed)

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/chat-flight-search.spec.ts
git commit -m "test(web): add E2E test for chat flight search"
```

---

## Task 15: E2E Chat Hotel Search Tests

**Files:**
- Create: `apps/web/e2e/chat-hotel-search.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/chat-hotel-search.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Chat Hotel Search", () => {
  test("searches for hotels and displays results", async ({ page }) => {
    await page.goto("/");

    const chatInput = page.getByRole("textbox", { name: /message/i });
    await chatInput.fill("Find hotels in Paris June 15-18");
    await chatInput.press("Enter");

    // Wait for tool call
    await expect(page.getByText(/search_hotels/i)).toBeVisible({ timeout: 30_000 });

    // Wait for results
    await expect(page.getByText(/hotel/i)).toBeVisible({ timeout: 60_000 });

    // Assert hotel name visible
    const hotelCards = page.locator("[data-testid='hotel-result'], .hotel-card, [class*='hotel']");
    await expect(hotelCards.first()).toBeVisible();

    // Assert star rating
    await expect(page.getByText(/star/i).first()).toBeVisible();

    // Assert price per night
    await expect(page.getByText(/\$[\d,.]+\/night|\$[\d,.]+\s*per night/i).first()).toBeVisible();

    // Assert booking links
    const bookingLink = page.locator("a[href*='skiplagged.com']").first();
    await expect(bookingLink).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd apps/web && npx playwright test chat-hotel-search --project=light`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/chat-hotel-search.spec.ts
git commit -m "test(web): add E2E test for chat hotel search"
```

---

## Task 16: E2E Trip Creation & Refresh Tests

**Files:**
- Create: `apps/web/e2e/trip-creation-refresh.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// apps/web/e2e/trip-creation-refresh.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Trip Creation and Price Refresh", () => {
  test("creates a trip, refreshes prices, and shows results", async ({ page }) => {
    // Navigate to create trip
    await page.goto("/trips/new");

    // Fill trip form - adjust selectors to match actual form
    await page.getByLabel(/trip name/i).fill("Paris Vacation E2E");
    await page.getByLabel(/origin/i).fill("SFO");
    await page.getByLabel(/destination/i).fill("CDG");
    await page.getByLabel(/depart/i).fill("2026-06-15");
    await page.getByLabel(/return/i).fill("2026-06-22");

    // Submit
    await page.getByRole("button", { name: /create|save|submit/i }).click();

    // Should redirect to trip detail page
    await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/);

    // Click refresh button
    const refreshButton = page.getByRole("button", { name: /refresh/i });
    await refreshButton.click();

    // Wait for refresh to complete
    await expect(refreshButton).toBeEnabled({ timeout: 120_000 });

    // Assert price data appeared
    // Price history chart should have data
    const chart = page.locator("[class*='chart'], canvas, svg.recharts-surface");
    await expect(chart).toBeVisible();

    // Assert flight offers section
    await expect(page.getByText(/flight/i).first()).toBeVisible();

    // Assert hotel offers section
    await expect(page.getByText(/hotel/i).first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd apps/web && npx playwright test trip-creation-refresh --project=light`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/trip-creation-refresh.spec.ts
git commit -m "test(web): add E2E test for trip creation and price refresh"
```

---

## Task 17: E2E Theme Validation Tests

**Files:**
- Create: `apps/web/e2e/theme-validation.spec.ts`

- [ ] **Step 1: Write the theme validation test**

```typescript
// apps/web/e2e/theme-validation.spec.ts
import { test, expect, type Page } from "@playwright/test";

// Expected colors from globals.css
const LIGHT = {
  background: "rgb(250, 248, 255)",    // hsl(250, 30%, 98%) = #faf8ff
  foreground: "rgb(29, 29, 46)",        // hsl(240, 20%, 14%) ~ #1d1d2e
  card: "rgb(255, 255, 255)",           // hsl(0, 0%, 100%)
};

const DARK = {
  background: "rgb(13, 13, 20)",        // hsl(250, 20%, 6%) = #0d0d14
  foreground: "rgb(255, 255, 255)",     // hsl(0, 0%, 100%)
};

async function assertLightMode(page: Page) {
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  const body = page.locator("body");
  await expect(body).toHaveCSS("background-color", LIGHT.background);

  // Check text color on a heading or body text
  const heading = page.locator("h1, h2, h3").first();
  if (await heading.isVisible()) {
    const color = await heading.evaluate((el) => getComputedStyle(el).color);
    // Should be dark text in light mode
    expect(color).not.toBe(DARK.foreground);
  }
}

async function assertDarkMode(page: Page) {
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  const body = page.locator("body");
  await expect(body).toHaveCSS("background-color", DARK.background);
}

// Only run in light project to avoid duplicate
test.describe("Theme Validation", () => {
  test.skip(({ }, testInfo) => testInfo.project.name === "dark", "Theme tests manage their own mode");

  test("dashboard light mode colors", async ({ page }) => {
    await page.goto("/");
    await assertLightMode(page);

    // Cards should be white
    const card = page.locator("[class*='card']").first();
    if (await card.isVisible()) {
      await expect(card).toHaveCSS("background-color", LIGHT.card);
    }
  });

  test("dashboard dark mode colors", async ({ page }) => {
    await page.goto("/");
    // Toggle to dark mode
    await page.locator("[data-testid='theme-toggle'], button:has(svg)").first().click();
    await page.getByText(/dark/i).click();
    await assertDarkMode(page);
  });

  test("theme toggle switches correctly", async ({ page }) => {
    await page.goto("/");

    // Start in light mode
    await assertLightMode(page);

    // Switch to dark
    const toggle = page.locator("[data-testid='theme-toggle'], button:has(svg)").first();
    await toggle.click();
    await page.getByText(/dark/i).click();
    await assertDarkMode(page);

    // Switch back to light
    await toggle.click();
    await page.getByText(/light/i).click();
    await assertLightMode(page);
  });

  test("trip detail page respects theme", async ({ page }) => {
    // Navigate to a trip (assumes at least one exists from other tests)
    await page.goto("/");
    const tripLink = page.locator("a[href*='/trips/']").first();
    if (await tripLink.isVisible()) {
      await tripLink.click();
      await assertLightMode(page);

      // Check chart colors use CSS variables
      const chartElement = page.locator("svg.recharts-surface").first();
      if (await chartElement.isVisible()) {
        // Verify chart is rendered (existence check)
        await expect(chartElement).toBeVisible();
      }
    }
  });

  test("create trip page respects theme", async ({ page }) => {
    await page.goto("/trips/new");
    await assertLightMode(page);

    // Toggle to dark
    const toggle = page.locator("[data-testid='theme-toggle'], button:has(svg)").first();
    await toggle.click();
    await page.getByText(/dark/i).click();
    await assertDarkMode(page);
  });
});
```

- [ ] **Step 2: Run the theme tests**

Run: `cd apps/web && npx playwright test theme-validation --project=light`
Expected: PASS

- [ ] **Step 3: Run ALL E2E tests in both modes**

Run: `cd apps/web && npx playwright test`
Expected: All suites PASS in both light and dark projects

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/theme-validation.spec.ts
git commit -m "test(web): add E2E theme validation for light and dark mode"
```

---

## Task 18: Delete Old Provider Code

**Files:**
- Delete: `apps/api/app/clients/amadeus.py`
- Delete: `apps/api/app/clients/amadeus_mock.py`
- Delete: `apps/api/app/clients/kiwi_mcp.py`
- Delete: `apps/api/app/clients/google_flights.py`
- Delete: `apps/api/app/clients/flight_provider.py`
- Delete: `apps/api/app/tools/amadeus_flights.py`
- Delete: `apps/api/app/tools/amadeus_hotels.py`
- Delete: `apps/api/app/tools/amadeus_hotel_offers.py`
- Delete: `apps/api/app/tools/search_flights_kiwi.py`
- Delete: `apps/api/app/tools/search_airports.py`
- Delete: `apps/api/tests/test_amadeus_client.py`
- Delete: `apps/api/tests/tools/test_amadeus_tools.py`
- Delete: `apps/api/tests/tools/test_search_tools.py`
- Delete: `apps/api/tests/clients/test_kiwi_mcp.py`
- Delete: `apps/worker/tests/test_mcp_client.py`

- [ ] **Step 1: Delete all old provider files**

```bash
rm apps/api/app/clients/amadeus.py \
   apps/api/app/clients/amadeus_mock.py \
   apps/api/app/clients/kiwi_mcp.py \
   apps/api/app/clients/google_flights.py \
   apps/api/app/clients/flight_provider.py \
   apps/api/app/tools/amadeus_flights.py \
   apps/api/app/tools/amadeus_hotels.py \
   apps/api/app/tools/amadeus_hotel_offers.py \
   apps/api/app/tools/search_flights_kiwi.py \
   apps/api/app/tools/search_airports.py \
   apps/api/tests/test_amadeus_client.py \
   apps/api/tests/tools/test_amadeus_tools.py \
   apps/api/tests/tools/test_search_tools.py \
   apps/api/tests/clients/test_kiwi_mcp.py \
   apps/worker/tests/test_mcp_client.py
```

- [ ] **Step 2: Grep for any remaining imports of deleted modules**

Run: `grep -rn "from app.clients.amadeus\|from app.clients.kiwi\|from app.clients.google_flights\|from app.clients.flight_provider\|from app.tools.amadeus\|from app.tools.search_flights_kiwi\|from app.tools.search_airports" apps/`

Fix any remaining references.

- [ ] **Step 3: Run full test suite**

Run: `uv run ruff check apps/api apps/worker && uv run pytest apps/api/tests apps/worker/tests -v`
Expected: All PASS, no import errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove Amadeus, Kiwi, and Google Flights provider code"
```

---

## Task 19: Config & Environment Updates

**Files:**
- Modify: `apps/api/app/core/config.py`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update config.py**

Remove settings (around lines 35-65):
- `amadeus_api_key`, `amadeus_api_secret`, `amadeus_base_url`, `mock_amadeus_api`
- `external_flight_price_provider`, `fast_flights_fetch_mode`
- `mcp_node_path`, `amadeus_mcp_path`

Add settings:
```python
skiplagged_mcp_url: str = "https://mcp.skiplagged.com/mcp"
mock_skiplagged_api: bool = False
```

- [ ] **Step 2: Update .env.example**

Remove all Amadeus, fast-flights, and MCP node path variables (lines 54-90). Add:
```bash
# Skiplagged MCP (no auth required)
SKIPLAGGED_MCP_URL=https://mcp.skiplagged.com/mcp
MOCK_SKIPLAGGED_API=false
```

- [ ] **Step 3: Update docker-compose.yml**

Remove `AMADEUS_MCP_PATH` from worker service environment (line 110). Remove any Amadeus env vars from api service.

- [ ] **Step 4: Run build to verify no config errors**

Run: `uv run ruff check apps/api apps/worker && uv run pytest apps/api/tests apps/worker/tests -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/config.py .env.example docker-compose.yml
git commit -m "chore: update config and env for Skiplagged, remove Amadeus vars"
```

---

## Task 20: Documentation Updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `doc/PROJECT_PLAN.md`
- Modify: `doc/DESIGN_OVERVIEW.md`
- Modify: `doc/research/MCP_FLIGHT_SERVERS.md`

- [ ] **Step 1: Update CLAUDE.md**

Major sections to rewrite:
- **Amadeus API Integration** → **Skiplagged MCP Integration**: Single provider, no auth, `mcp.skiplagged.com/mcp`, JSON-RPC over Streamable HTTP
- **Flight Search APIs table** → Single entry for Skiplagged `search_flights` (with `search_flights_all` for worker)
- **Hotel Search APIs** → Skiplagged `search_hotels` + `get_hotel_details` for room-level data
- **External Flight Search MCP Servers** → Remove Kiwi/Amadeus comparison, document Skiplagged only
- **Data Provider Strategy table** → All phases use Skiplagged for both flights and hotels
- **Post-Fetch Filtering Strategy** → Update to reference Skiplagged response format (room `title` for hotel filtering, flight `id` for carrier codes)
- **Environment Configuration** → Remove Amadeus vars, add Skiplagged vars
- **Important Constraints** → Remove Amadeus free tier limits, carrier restrictions. Note Skiplagged has no auth/rate limit documented.
- **Flight Display Requirements** → Update to note flight numbers parsed from Skiplagged ID field

- [ ] **Step 2: Update doc/PROJECT_PLAN.md**

- Phase 2: Mark external MCP integration as complete (Skiplagged)
- Phase 3/4: Replace Amadeus references with Skiplagged
- Remove SearchAPI hotel references (Skiplagged covers hotels now)

- [ ] **Step 3: Update doc/DESIGN_OVERVIEW.md**

- Update architecture diagram: remove Kiwi MCP, Amadeus MCP, replace with Skiplagged MCP
- Update MCP routing section

- [ ] **Step 4: Update doc/research/MCP_FLIGHT_SERVERS.md**

- Add Skiplagged section with API contract, response formats, flight number parsing
- Mark Amadeus and Kiwi sections as "Removed — replaced by Skiplagged"

- [ ] **Step 5: Final validation**

Run: `pnpm verify`
Expected: All checks pass (build, lint, tests, security audit)

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md doc/
git commit -m "docs: update all documentation for Skiplagged migration"
```

---

## Final Validation Checklist

After all tasks complete:

- [ ] `pnpm verify` passes (build, lint, unit tests, security audit)
- [ ] `uv run pytest apps/api/tests apps/worker/tests -v` — all tests pass
- [ ] `cd apps/web && npx playwright test` — all E2E tests pass in light + dark mode
- [ ] `grep -rn "amadeus\|kiwi_mcp\|google_flights\|flight_provider" apps/ --include="*.py" --include="*.ts" --include="*.tsx"` — no remaining references (except mock file names in git history)
- [ ] No TypeScript errors: `pnpm --filter vacation-price-tracker-web build`
- [ ] No Ruff errors: `uv run ruff check apps/api apps/worker`
