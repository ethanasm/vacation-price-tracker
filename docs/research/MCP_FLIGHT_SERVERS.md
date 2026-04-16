# MCP Flight Search Servers Research

**Last Updated:** April 2026
**Purpose:** Document findings from testing free hosted MCP servers for flight and hotel search integration.

---

## Current Provider: Skiplagged MCP

> **Status: ACTIVE — sole provider as of April 2026 migration.**
> Amadeus and Kiwi sections below are retained for historical reference.

### Skiplagged MCP

**Endpoint:** `https://mcp.skiplagged.com/mcp`
**Protocol:** JSON-RPC 2.0 over Streamable HTTP
**Auth:** None required (public endpoint)
**Client:** `apps/api/app/clients/skiplagged.py`

#### Session Protocol

```bash
# 1. Initialize (get session ID)
curl -X POST https://mcp.skiplagged.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Response includes mcp-session-id header and server info:
# {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","serverInfo":{"name":"@skiplagged/mcp","version":"0.0.4"},...}}

# 2. Call a tool (use the session ID from step 1)
curl -X POST https://mcp.skiplagged.com/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"sk_flights_search","arguments":{"origin":"SFO","destination":"CDG","departureDate":"2026-06-15"}}}'
```

#### Flight Response Format

```json
{
  "type": "FlightCard",
  "id": "SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741",
  "airlines": "Air Canada, Lufthansa",
  "departure": { "airport": "SFO", "dateTime": "2026-06-15T13:00:00-07:00" },
  "arrival": { "airport": "CDG", "dateTime": "2026-06-16T08:45:00+02:00" },
  "duration": "13h 45m",
  "layovers": 1,
  "price": { "amount": 892.0, "currency": "USD" },
  "deepLink": "https://skiplagged.com/flights/SFO/CDG/2026-06-15/...",
  "attributes": ["standard"],
  "returnFlight": {
    "airlines": "Air Canada",
    "departure": { "airport": "CDG", "dateTime": "2026-06-22T10:30:00+02:00" },
    "arrival": { "airport": "SFO", "dateTime": "2026-06-22T14:15:00-07:00" },
    "duration": "12h 45m",
    "layovers": 1
  }
}
```

#### Flight Number Parsing

Flight numbers are not returned as structured fields. They are encoded in the `id` field:

```
"SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"
                                         ^^^^^^^^^ ^^^^^^^^
                                         outbound  return
```

Format after `trip=`:
- `,` separates outbound from return legs
- `-` separates segments within a leg
- Each segment is `{CARRIER_CODE}{FLIGHT_NUMBER}` (e.g., `AC744`, `LH6825`)
- Trailing `~` indicates a hidden-city itinerary (strip before parsing)

Parser: `apps/api/app/clients/skiplagged_parser.py` → `parse_flight_segments(flight_id)`

```python
# Returns: (outbound_segments, return_segments)
# Each segment: SkiplaggedFlightSegment(carrier_code="AC", flight_number="744")
parse_flight_segments("SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741")
# → ([AC744, LH6825], [TS251, AC401, AC741])
```

#### Hotel Response Format

```json
{
  "type": "HotelCard",
  "id": "hotel_12345",
  "name": "Le Grand Hotel Paris",
  "imageUrl": "https://images.skiplagged.com/hotels/12345.jpg",
  "rating": { "stars": 4, "text": "4 stars" },
  "price": { "amount": 220.0, "currency": "USD", "text": "$220/night" },
  "chain": "Marriott",
  "location": "Paris, France",
  "amenities": ["Free Wi-Fi", "Pool", "Fitness Center", "Restaurant"],
  "deepLink": "https://skiplagged.com/hotels/paris/..."
}
```

#### Hotel Detail Response (from `sk_hotel_details`)

```json
{
  "hotelId": "12345",
  "hotelName": "Le Grand Hotel Paris",
  "starRating": 4,
  "reviewRating": 8.7,
  "reviewCount": 1243,
  "totalPriceInDollars": 1540.0,
  "amenityNames": ["Free Wi-Fi", "Pool", "Fitness Center", "Restaurant", "Spa"],
  "address": "2 Rue Scribe, 75009 Paris",
  "checkinDate": "2026-06-15",
  "checkoutDate": "2026-06-22",
  "rooms": [
    {
      "id": "room_1",
      "title": "Standard Double Room",
      "occupancyLimit": 2,
      "pricePerNightInDollars": 200.0,
      "totalPriceInDollars": 1400.0,
      "taxesAndFeesInDollars": 140.0,
      "currency": "USD",
      "refundable": false,
      "freeCancellation": false,
      "bedTypes": ["Double"],
      "bookingLink": "https://skiplagged.com/book/...",
      "source": "Booking.com"
    },
    {
      "id": "room_2",
      "title": "Deluxe King Suite with City View",
      "occupancyLimit": 2,
      "pricePerNightInDollars": 320.0,
      "totalPriceInDollars": 2240.0,
      "taxesAndFeesInDollars": 224.0,
      "currency": "USD",
      "refundable": true,
      "freeCancellation": true,
      "bedTypes": ["King"],
      "bookingLink": "https://skiplagged.com/book/...",
      "source": "Hotels.com"
    }
  ]
}
```

#### Pagination

All search endpoints support pagination:

```json
"pagination": {
  "totalAvailable": 342,
  "currentlyShowing": 75,
  "offset": 0,
  "limit": 75,
  "hasMoreResults": true
}
```

The `search_flights_all` and `search_hotels_all` client methods follow `hasMoreResults` up to `max_pages=4` (default), yielding up to 300 results.

#### Airline Coverage

Skiplagged aggregates from multiple booking sources and covers a broad set of airlines including LCCs, legacy carriers, and international carriers. The `airlines` field returns airline display names (e.g., "Air Canada, Lufthansa").

**Note:** Carrier codes are parsed from the `id` field, not returned directly. Not all flights have parseable flight numbers (some complex itineraries may omit the `trip=` segment encoding).

---

## Removed Providers

### Kiwi MCP — Removed (replaced by Skiplagged)

> **Status: REMOVED as of April 2026 migration.**
> Kiwi MCP (`mcp.kiwi.com`) was the primary chat flight search provider in Phases 1-2. It was removed because it did not return airline names or carrier codes, making it impossible to display or filter by airline without a secondary Amadeus lookup.

**Key limitation that drove removal:** `airlines` field was absent from all responses; no carrier codes; no flight numbers.

### Amadeus MCP + HTTP API — Removed (replaced by Skiplagged)

> **Status: REMOVED as of April 2026 migration.**
> Amadeus was used for:
> - Flight details with flight numbers and segment data (via HTTP API)
> - Hotel search and offer details (via custom MCP tools calling `apps/api/app/clients/amadeus.py`)
>
> Removed because: 2,000 calls/month free tier was shared between flights and hotels; missing major carriers (AA, DL, BA) in free tier; complex MCP server setup required; Skiplagged provides equivalent data with no rate limits and no auth.

**What Amadeus provided (now handled by Skiplagged):**

| Capability | Amadeus approach | Skiplagged approach |
|-----------|-----------------|---------------------|
| Flight numbers | `segments[].carrierCode` + `segments[].number` | Parsed from `id` field via `parse_flight_segments()` |
| Airline names | `dictionaries.carriers` lookup | Returned directly in `airlines` field |
| Hotel list | `/v2/shopping/hotel-offers` | `sk_hotels_search` |
| Room details | `/v2/shopping/hotel-offers/{id}` | `sk_hotel_details` with `rooms[]` |
| Booking links | Separate booking flow required | `deepLink` / `bookingLink` fields |

---

## Historical: lastminute.com MCP

**Status: Evaluated but not adopted.** Considered as an alternative to Kiwi during Phase 2 research. Skiplagged was selected instead for its broader airline coverage and hotel support.

lastminute.com MCP (`mcp.lastminute.com/mcp`) returned airline names and carrier codes but lacked hotel support and showed limited carrier coverage (LCCs only, no legacy carriers).
