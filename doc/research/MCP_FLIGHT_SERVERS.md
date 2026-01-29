# MCP Flight Search Servers Research

**Last Updated:** January 2026
**Purpose:** Document findings from testing free hosted MCP servers for flight search integration in Phase 2.

---

## Available Free Hosted MCP Servers

| Provider | Endpoint | Free? | Auth Required |
|----------|----------|-------|---------------|
| **lastminute.com** | `mcp.lastminute.com/mcp` | Yes | No |
| **Kiwi.com** | `mcp.kiwi.com` | Yes | No |

### Important: Kiwi MCP vs Kiwi Tequila API

These are **different products**:

1. **Kiwi Tequila API** (affiliate program)
   - Full API with flight numbers, airline codes, segment details
   - Requires affiliate partnership (50K MAU minimum)
   - NOT available to individual developers

2. **Kiwi MCP Server** (free, hosted)
   - Curated subset of data for AI assistants
   - Does NOT include airline names or carrier codes
   - Available to anyone via `mcp.kiwi.com`

---

## Response Field Comparison

| Field | Kiwi MCP | lastminute.com MCP | Amadeus API |
|-------|----------|-------------------|-------------|
| Airline name | **NO** | Yes | Yes (via dictionaries) |
| Carrier code | **NO** | Yes | Yes |
| Flight number | **NO** | **NO** | **Yes** (e.g., F9 4402) |
| Route (airports) | Yes (IATA codes) | Yes (formatted) | Yes |
| Times | Yes (UTC + local) | Yes (local only) | Yes (local) |
| Duration | Yes (seconds) | Yes (text) | Yes (ISO 8601: PT6H56M) |
| Layover details | **Detailed** (airport, city, times) | "1 stop" only | **Detailed** (per segment) |
| Segment details | **NO** | **NO** | **Yes** (full breakdown) |
| Terminal info | **NO** | **NO** | **Yes** |
| Aircraft type | **NO** | **NO** | **Yes** (e.g., AIRBUS A321) |
| Cabin class | **NO** | **NO** | **Yes** (ECONOMY, BUSINESS, etc.) |
| Fare details | **NO** | **NO** | **Yes** (fareBasis, brandedFare) |
| Amenities | **NO** | **NO** | **Yes** (baggage, seats, etc.) |
| Bookable seats | **NO** | **NO** | **Yes** (availability count) |
| Last ticketing date | **NO** | **NO** | **Yes** |
| Price breakdown | **NO** | **NO** | **Yes** (base + fees) |
| Price | Yes | Yes | Yes |
| Booking link | Yes | Yes | No (requires booking flow) |
| Hotels | **NO** | **NO** | Yes |
| Virtual interlining | **Yes** | No | No |
| Free | Yes | Yes | Yes (2K/mo) |

---

## Detailed Response Formats

### lastminute.com MCP Response

```json
{
  "airline": "Ryanair",
  "carrier_id": "FR",
  "departure": "BGY 09:25",
  "arrival": "STN 10:30",
  "duration": "2 hours and 5 min",
  "stops": "Direct",
  "price": "35.85 $",
  "price_amount": 3585,
  "deeplink": "https://www.lastminute.ie/...",
  "is_roundtrip": false
}
```

**Strengths:**
- Airline names AND carrier codes
- Simple, human-readable format
- Price in cents for calculations

**Weaknesses:**
- No detailed layover info (just "1 stop")
- No flight numbers
- No segment breakdown for connections

### Kiwi MCP Response

```json
{
  "flyFrom": "MXP",
  "flyTo": "LGW",
  "cityFrom": "Milan",
  "cityTo": "London",
  "departure": {
    "utc": "2026-02-15T06:50:00.000Z",
    "local": "2026-02-15T07:50:00.000"
  },
  "arrival": {
    "utc": "2026-02-15T08:50:00.000Z",
    "local": "2026-02-15T08:50:00.000"
  },
  "totalDurationInSeconds": 7200,
  "durationInSeconds": 7200,
  "price": 51,
  "deepLink": "https://on.kiwi.com/42QuYx",
  "currency": "USD",
  "layovers": [
    {
      "at": "MUC",
      "city": "Munich",
      "cityCode": "MUC",
      "arrival": {
        "utc": "2026-02-15T08:10:00.000Z",
        "local": "2026-02-15T09:10:00.000"
      },
      "departure": {
        "utc": "2026-02-15T11:00:00.000Z",
        "local": "2026-02-15T12:00:00.000"
      }
    }
  ]
}
```

**Strengths:**
- Detailed layover information with exact times
- UTC and local timestamps
- Virtual interlining (combining non-partner airlines)
- Often cheaper prices due to creative routing
- City names included

**Weaknesses:**
- NO airline names or carrier codes
- NO flight numbers
- Cannot identify which airline is operating

### Amadeus API Response

```json
{
  "type": "flight-offer",
  "id": "1",
  "source": "GDS",
  "lastTicketingDate": "2026-01-29",
  "numberOfBookableSeats": 4,
  "itineraries": [
    {
      "duration": "PT6H56M",
      "segments": [
        {
          "departure": {
            "iataCode": "SFO",
            "terminal": "I",
            "at": "2026-02-15T20:34:00"
          },
          "arrival": {
            "iataCode": "LAS",
            "terminal": "3",
            "at": "2026-02-15T22:16:00"
          },
          "carrierCode": "F9",
          "number": "4402",
          "aircraft": { "code": "321" },
          "operating": { "carrierCode": "F9" },
          "duration": "PT1H42M",
          "numberOfStops": 0
        },
        {
          "departure": {
            "iataCode": "LAS",
            "terminal": "3",
            "at": "2026-02-15T23:03:00"
          },
          "arrival": {
            "iataCode": "MCO",
            "terminal": "0",
            "at": "2026-02-16T06:30:00"
          },
          "carrierCode": "F9",
          "number": "1876",
          "aircraft": { "code": "32Q" },
          "duration": "PT4H27M"
        }
      ]
    }
  ],
  "price": {
    "currency": "USD",
    "total": "299.96",
    "base": "232.16",
    "grandTotal": "299.96"
  },
  "validatingAirlineCodes": ["F9"],
  "travelerPricings": [
    {
      "fareDetailsBySegment": [
        {
          "segmentId": "1",
          "cabin": "ECONOMY",
          "fareBasis": "R07PXP4",
          "brandedFare": "ECO",
          "brandedFareLabel": "BASIC",
          "amenities": [
            { "description": "FIRST CHECKED BAG", "isChargeable": true },
            { "description": "PRE RESERVED SEAT ASSIGNMENT", "isChargeable": true }
          ]
        }
      ]
    }
  ],
  "dictionaries": {
    "carriers": { "F9": "FRONTIER AIRLINES" },
    "aircraft": { "321": "AIRBUS A321", "32Q": "AIRBUS A321NEO" }
  }
}
```

**Strengths (UNIQUE to Amadeus):**
- Flight numbers (e.g., F9 4402, F9 1876)
- Full segment-by-segment breakdown
- Terminal information
- Aircraft type (AIRBUS A321, A321NEO)
- Cabin class (ECONOMY, BUSINESS, FIRST)
- Fare details (fareBasis, brandedFare, brandedFareLabel)
- Amenities with chargeability (baggage, seat selection, priority boarding)
- Last ticketing date (booking deadline)
- Number of bookable seats (availability)
- Price breakdown (base price + fees)
- Operating carrier vs marketing carrier
- Dictionaries for carrier/aircraft name lookup

**Weaknesses:**
- No direct booking link (requires separate booking flow)
- Rate limited (2K calls/month free tier)
- Missing some carriers (AA, DL, BA in free tier)
- More complex response structure

**Key Amadeus-Only Fields for Price Tracking:**
- `validatingAirlineCodes` - For airline filtering
- `segments[].carrierCode` + `segments[].number` - Flight identification
- `numberOfBookableSeats` - Availability monitoring
- `lastTicketingDate` - Price validity window

---

## Airline Coverage Testing (Jan 2026)

### Routes Tested

| Route | lastminute.com Airlines | Kiwi Flights Found |
|-------|-------------------------|-------------------|
| JFK → LAX | JetBlue (B6), Hawaiian (HA) | Yes (airline unknown) |
| SFO → MCO | Southwest (WN) | Yes (airline unknown) |
| DFW → ORD | Southwest (WN), Spirit (NK) | Yes (airline unknown) |
| MIL → LON | Ryanair (FR), Wizz Air (W4), EasyJet (U2) | Yes (airline unknown) |

### Cross-Reference: Same Flights, Different Prices

By matching flight times, we confirmed both servers return the same flights:

| Route | Time | Kiwi Price | lastminute Price | Airline |
|-------|------|------------|------------------|---------|
| MIL → LON | MXP 12:55 → LTN 14:00 | **$20** | $44 | Wizz Air (W4) |
| MIL → LON | MXP 21:45 → LGW 22:55 | **$39** | $56 | EasyJet (U2) |

**Key Finding:** Kiwi often shows **cheaper prices** for the same flights (possibly different fare classes or booking sources).

### Airline Coverage Summary

**lastminute.com shows (LCCs):**
- Southwest (WN)
- JetBlue (B6)
- Spirit (NK)
- Ryanair (FR)
- EasyJet (U2)
- Wizz Air (W4)
- Hawaiian (HA)

**lastminute.com missing (Legacy carriers):**
- American (AA)
- United (UA)
- Delta (DL)
- British Airways (BA)

**Kiwi coverage:** Unknown - includes flights but doesn't expose airline info. May include legacy carriers.

---

## When to Use Each Provider

| User Request | Best Provider | Reason |
|-------------|---------------|--------|
| "Find flights to Paris" | lastminute.com | Shows airline names, quick response |
| "What's the cheapest flight?" | Kiwi | Often lower prices, virtual interlining |
| "Show layover airports and times" | Kiwi | Detailed layover data with timestamps |
| "Creative routing options" | Kiwi | Virtual interlining combines non-partners |
| "I want to fly Delta" | Amadeus | Need `validatingAirlineCodes` filtering |
| "Book me on UA200" | Amadeus | Only source with flight numbers |
| "What aircraft is this?" | Amadeus | Aircraft codes + dictionary lookup |
| "What's included in the fare?" | Amadeus | Amenities (baggage, seats, etc.) |
| "Is this a basic economy fare?" | Amadeus | `brandedFare` and `brandedFareLabel` |
| "How many seats are left?" | Amadeus | `numberOfBookableSeats` |
| "When does the price expire?" | Amadeus | `lastTicketingDate` |
| "Find hotels in Rome" | Amadeus | Only option with hotels |
| "Track this specific flight" | Amadeus | Flight number for price monitoring |

### Decision Matrix

```
User asks about flights?
├── Wants airline name? → lastminute.com
├── Wants cheapest price? → Kiwi (often cheaper)
├── Wants specific flight number? → Amadeus
├── Wants fare/amenity details? → Amadeus
├── Wants creative routing? → Kiwi (virtual interlining)
└── Just browsing? → lastminute.com (best balance)

User asks about hotels?
└── Always Amadeus (only option)

Price tracking workflow?
└── Always Amadeus (need flight numbers for matching)
```

---

## Connection Configuration

### lastminute.com MCP

**Via Claude Code CLI:**
```bash
claude mcp add --transport http --scope local lastminute https://mcp.lastminute.com/mcp
```

**Via .mcp.json:**
```json
{
  "mcpServers": {
    "lastminute": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.lastminute.com/mcp"],
      "enabled": true
    }
  }
}
```

**Features:**
- Two modes: "cheapest" (price sorted) and "best" (intelligent ranking)
- Real-time flight search
- Support: mcp@lastminute.com

### Kiwi MCP

**Via Claude Code CLI:**
```bash
claude mcp add --transport http --scope local kiwi https://mcp.kiwi.com
```

**Via .mcp.json:**
```json
{
  "mcpServers": {
    "kiwi": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.kiwi.com"],
      "enabled": true
    }
  }
}
```

---

## Cross-Provider Price Comparison (Same Route: SFO → MCO)

| Provider | Airline | Price | Flight Numbers | Notes |
|----------|---------|-------|----------------|-------|
| **Kiwi** | Unknown | $279 | N/A | Via LAS, 6h 56m |
| **lastminute.com** | Southwest (WN) | $283 | N/A | 1 stop |
| **Amadeus** | Frontier (F9) | $300 | F9 4402 → F9 1876 | Via LAS, includes fare details |

**Key Insight:** Amadeus found Frontier (F9) which neither MCP server showed. This LCC wasn't visible in the free MCP servers, demonstrating Amadeus has different inventory access.

---

## Recommendations for Phase 2

### Primary Strategy

1. **lastminute.com** as primary for chat flight searches
   - Best data quality (airline names, carrier codes)
   - Good LCC coverage
   - Simple response format

2. **Kiwi** as backup/supplement
   - Use for virtual interlining options
   - Use when detailed layover info needed
   - Cross-reference for potentially cheaper prices

3. **Custom Amadeus MCP tools** for:
   - Flight numbers (for tracking)
   - Fare/amenity details
   - Legacy carrier searches
   - Hotel searches
   - Segment-level details

### Limitations to Document for Users

- Neither free MCP server shows American, United, or Delta
- Flight numbers not available from free MCP servers
- Amadeus free tier (2K calls/month) also has carrier gaps
- For comprehensive carrier coverage, paid API may be needed in Phase 4

---

## Future Considerations

- Monitor if Kiwi adds airline info to MCP responses
- Consider caching lastminute.com results to reduce latency
- Evaluate paid flight APIs for Phase 4 if carrier coverage is insufficient
- Test Google Flights API when available
