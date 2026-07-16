import type { ApiFlightOffer, ApiHotelOffer, PriceSnapshot } from "../../lib/api";
import {
  PROVIDER_META,
  aggregateDailyPriceHistory,
  flightStableKey,
  hotelStableKey,
  parsePrice,
  providersInHistory,
} from "../../lib/price-history";

function snapshot(overrides: Partial<PriceSnapshot> & { created_at: string }): PriceSnapshot {
  return {
    id: overrides.id ?? `snap-${overrides.created_at}`,
    flight_price: null,
    hotel_price: null,
    total_price: null,
    flight_offers: [],
    hotel_offers: [],
    ...overrides,
  } as PriceSnapshot;
}

function hotelOffer(name: string, price: string): ApiHotelOffer {
  return { name, price } as unknown as ApiHotelOffer;
}

function flightOffer(carrier: string, number: string, dep: string, arr: string, date: string, price: string): ApiFlightOffer {
  return {
    price,
    itineraries: [
      {
        segments: [
          {
            carrier_code: carrier,
            flight_number: number,
            departure_airport: dep,
            arrival_airport: arr,
            departure_time: `${date}T08:00:00Z`,
          },
        ],
      },
    ],
  } as unknown as ApiFlightOffer;
}

describe("parsePrice", () => {
  it("parses numeric strings and rejects junk", () => {
    expect(parsePrice("123.45")).toBe(123.45);
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice("not-a-number")).toBeNull();
  });
});

describe("aggregateDailyPriceHistory", () => {
  it("returns an empty array for no history", () => {
    expect(aggregateDailyPriceHistory([])).toEqual([]);
  });

  it("collapses multiple same-day snapshots to the cheapest total", () => {
    const history = [
      snapshot({ created_at: "2026-07-15T18:00:00Z", flight_price: "300", hotel_price: "200" }),
      snapshot({ created_at: "2026-07-15T09:00:00Z", flight_price: "250", hotel_price: "180" }),
      snapshot({ created_at: "2026-07-15T12:00:00Z", flight_price: "260", hotel_price: "200" }),
    ];

    const result = aggregateDailyPriceHistory(history);

    expect(result).toHaveLength(1);
    expect(result[0].day).toBe("2026-07-15");
    expect(result[0].label).toBe("Jul 15");
    // cheapest total is 250 + 180 = 430
    expect(result[0].minFlight).toBe(250);
    expect(result[0].minHotel).toBe(180);
    expect(result[0].total).toBe(430);
  });

  it("produces one chronological row per day regardless of input order", () => {
    const history = [
      snapshot({ created_at: "2026-07-17T10:00:00Z", flight_price: "200", hotel_price: "100" }),
      snapshot({ created_at: "2026-07-15T10:00:00Z", flight_price: "300", hotel_price: "150" }),
      snapshot({ created_at: "2026-07-16T10:00:00Z", flight_price: "250", hotel_price: "120" }),
    ];

    const result = aggregateDailyPriceHistory(history);

    expect(result.map((r) => r.day)).toEqual(["2026-07-15", "2026-07-16", "2026-07-17"]);
    expect(result.map((r) => r.label)).toEqual(["Jul 15", "Jul 16", "Jul 17"]);
  });

  it("drops a degraded snapshot with no priced component (no fake $0 point)", () => {
    // Both prices null = a degraded provider response (only unpriced/$0 offers).
    // It must not plot a misleading $0 point.
    const result = aggregateDailyPriceHistory([snapshot({ created_at: "2026-01-05T10:00:00Z" })]);
    expect(result).toEqual([]);
  });

  it("keeps a snapshot with only one priced component", () => {
    // Flights-only trip: hotel price absent should count as 0, not drop the day.
    const result = aggregateDailyPriceHistory([
      snapshot({ created_at: "2026-01-05T10:00:00Z", flight_price: "175" }),
    ]);
    expect(result[0]).toMatchObject({ minFlight: 175, minHotel: 0, total: 175, label: "Jan 5" });
  });

  it("does not let a degraded snapshot displace a priced one on the same day", () => {
    const result = aggregateDailyPriceHistory([
      snapshot({ created_at: "2026-01-05T09:00:00Z", flight_price: "175", hotel_price: "120" }),
      snapshot({ created_at: "2026-01-05T18:00:00Z" }), // degraded, would be $0
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ minFlight: 175, minHotel: 120, total: 295 });
  });

  it("carries the selected hotel price forward across a gap day", () => {
    const key = hotelStableKey(hotelOffer("Grand Plaza", "0"));
    const history = [
      snapshot({
        created_at: "2026-07-15T10:00:00Z",
        flight_price: "200",
        hotel_price: "150",
        hotel_offers: [hotelOffer("Grand Plaza", "150")],
      }),
      // Day 2: selected hotel not in results -> should carry 150 forward
      snapshot({
        created_at: "2026-07-16T10:00:00Z",
        flight_price: "200",
        hotel_price: "140",
        hotel_offers: [hotelOffer("Other Inn", "140")],
      }),
      snapshot({
        created_at: "2026-07-17T10:00:00Z",
        flight_price: "200",
        hotel_price: "150",
        hotel_offers: [hotelOffer("Grand Plaza", "160")],
      }),
    ];

    const result = aggregateDailyPriceHistory(history, { selectedHotelKey: key });

    expect(result.map((r) => r.selectedHotel)).toEqual([150, 150, 160]);
  });

  it("tracks a selected flight by its stable key", () => {
    const offer = flightOffer("UA", "100", "SFO", "JFK", "2026-07-15", "320");
    const key = flightStableKey(offer);
    const history = [
      snapshot({
        created_at: "2026-07-15T10:00:00Z",
        flight_price: "320",
        hotel_price: "150",
        flight_offers: [offer],
      }),
    ];

    const result = aggregateDailyPriceHistory(history, { selectedFlightKey: key });

    expect(result[0].selectedFlight).toBe(320);
  });

  it("matches the selected offer across ALL of a day's snapshots, not just the cheapest one", () => {
    // The day's cheapest-total snapshot (manual refresh, UA-only sample) is
    // missing the selected flight; an earlier snapshot the same day quoted it.
    // The selected line must show the real same-day quote, not a carried-over
    // value from the previous day.
    const selected = flightOffer("AS", "AS3361", "SFO", "RDM", "2026-08-22", "185");
    const key = flightStableKey(selected);
    const history = [
      snapshot({
        created_at: "2026-07-06T10:00:00Z",
        flight_price: "200",
        flight_offers: [flightOffer("AS", "AS3361", "SFO", "RDM", "2026-08-22", "200")],
      }),
      snapshot({
        created_at: "2026-07-07T06:00:00Z",
        flight_price: "185",
        flight_offers: [selected],
      }),
      // Cheaper-total snapshot later that day WITHOUT the selected pairing.
      snapshot({
        created_at: "2026-07-07T19:30:00Z",
        flight_price: "175",
        flight_offers: [flightOffer("UA", "UA670", "SFO", "RDM", "2026-08-22", "175")],
      }),
    ];

    const result = aggregateDailyPriceHistory(history, { selectedFlightKey: key });

    expect(result.map((r) => r.minFlight)).toEqual([200, 175]);
    expect(result.map((r) => r.selectedFlight)).toEqual([200, 185]);
  });

  it("uses the cheapest same-day quote when the selected offer appears in several snapshots", () => {
    const offer = hotelOffer("Grand Plaza", "150");
    const key = hotelStableKey(offer);
    const history = [
      snapshot({
        created_at: "2026-07-15T06:00:00Z",
        flight_price: "200",
        hotel_price: "150",
        hotel_offers: [hotelOffer("Grand Plaza", "150")],
      }),
      snapshot({
        created_at: "2026-07-15T18:00:00Z",
        flight_price: "210",
        hotel_price: "145",
        hotel_offers: [hotelOffer("Grand Plaza", "145")],
      }),
    ];

    const result = aggregateDailyPriceHistory(history, { selectedHotelKey: key });

    expect(result).toHaveLength(1);
    expect(result[0].selectedHotel).toBe(145);
  });

  it("leaves selected lines undefined when nothing is selected", () => {
    const result = aggregateDailyPriceHistory([
      snapshot({ created_at: "2026-07-15T10:00:00Z", flight_price: "100", hotel_price: "50" }),
    ]);
    expect(result[0].selectedFlight).toBeUndefined();
    expect(result[0].selectedHotel).toBeUndefined();
  });

  it("carries the plotted snapshot's provider marker onto each day point", () => {
    const result = aggregateDailyPriceHistory([
      snapshot({
        created_at: "2026-07-14T10:00:00Z",
        flight_price: "100",
        provider: "kiwi",
      }),
      snapshot({
        created_at: "2026-07-15T10:00:00Z",
        flight_price: "90",
        provider: "fast_flights",
      }),
      // Legacy snapshot predating the provider marker.
      snapshot({ created_at: "2026-07-16T10:00:00Z", flight_price: "95" }),
    ]);
    expect(result.map((p) => p.provider)).toEqual(["kiwi", "fast_flights", null]);
  });

  it("provider follows the day's cheapest snapshot when several exist", () => {
    const result = aggregateDailyPriceHistory([
      snapshot({
        created_at: "2026-07-15T06:00:00Z",
        flight_price: "120",
        provider: "skiplagged",
      }),
      snapshot({
        created_at: "2026-07-15T18:00:00Z",
        flight_price: "100",
        provider: "fast_flights",
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe(100);
    expect(result[0].provider).toBe("fast_flights");
  });
});

describe("provider metadata", () => {
  it("maps each known provider to a distinct marker shape", () => {
    const shapes = Object.values(PROVIDER_META).map((meta) => meta.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(PROVIDER_META.skiplagged.label).toBe("Skiplagged");
    expect(PROVIDER_META.kiwi.label).toBe("Kiwi");
    expect(PROVIDER_META.fast_flights.label).toBe("Fast Flights");
  });

  it("lists providers present in chart data in fixed registry order", () => {
    const points = aggregateDailyPriceHistory([
      snapshot({
        created_at: "2026-07-14T10:00:00Z",
        flight_price: "100",
        provider: "fast_flights",
      }),
      snapshot({
        created_at: "2026-07-15T10:00:00Z",
        flight_price: "90",
        provider: "skiplagged",
      }),
      snapshot({ created_at: "2026-07-16T10:00:00Z", flight_price: "95" }),
    ]);
    // Registry order (not appearance order); null providers are excluded.
    expect(providersInHistory(points)).toEqual(["skiplagged", "fast_flights"]);
  });

  it("appends unknown providers after the known ones", () => {
    const points = aggregateDailyPriceHistory([
      snapshot({
        created_at: "2026-07-14T10:00:00Z",
        flight_price: "100",
        provider: "mystery_provider",
      }),
      snapshot({
        created_at: "2026-07-15T10:00:00Z",
        flight_price: "90",
        provider: "kiwi",
      }),
    ]);
    expect(providersInHistory(points)).toEqual(["kiwi", "mystery_provider"]);
  });
});
