import type { ApiFlightOffer, ApiHotelOffer, PriceSnapshot } from "@/lib/api";

/**
 * Build a stable flight key from carrier, flight number, route, and date.
 * Format: "UA-100|SFO-LAX|2024-03-15" for each segment, joined by "+".
 * This key remains stable across API responses for the "same" flight.
 */
export const flightStableKey = (flight: ApiFlightOffer): string => {
  const segments = (flight.itineraries ?? []).flatMap((it) => it.segments ?? []);
  if (segments.length === 0) {
    // Fallback for flat structure - use airline code, flight number, and departure date
    const code = flight.airline_code ?? "";
    const num = flight.flight_number ?? "";
    const date = flight.departure_time?.slice(0, 10) ?? "";
    if (code && num && date) {
      return `${code}-${num}|${date}`;
    }
    // Last resort: use ID (not stable across API calls, but better than nothing)
    return flight.id;
  }
  return segments
    .map((s) => {
      const code = s.carrier_code ?? "";
      const num = s.flight_number ?? "";
      const dep = s.departure_airport ?? "";
      const arr = s.arrival_airport ?? "";
      const date = s.departure_time?.slice(0, 10) ?? "";
      return `${code}-${num}|${dep}-${arr}|${date}`;
    })
    .join("+");
};

/**
 * Build a stable hotel key from the hotel name (normalized).
 * This key remains stable across API responses for the "same" hotel.
 */
export const hotelStableKey = (hotel: ApiHotelOffer): string => {
  // Normalize: lowercase, trim, remove extra whitespace
  return (hotel.name ?? "").toLowerCase().trim().replace(/\s+/g, " ");
};

export const parsePrice = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format an ISO "YYYY-MM-DD" day key into a short label like "Jul 15". */
const formatDayLabel = (day: string): string => {
  const [, month, dom] = day.split("-");
  const monthIdx = Number.parseInt(month, 10) - 1;
  const name = MONTHS[monthIdx];
  if (!name || !dom) return day;
  return `${name} ${Number.parseInt(dom, 10)}`;
};

export interface DailyPricePoint {
  /** ISO calendar day (UTC) used for chronological ordering. */
  day: string;
  /** Short, human-readable axis label, e.g. "Jul 15". */
  label: string;
  total: number;
  minFlight: number;
  minHotel: number;
  selectedFlight?: number;
  selectedHotel?: number;
}

interface AggregateOptions {
  selectedFlightKey?: string | null;
  selectedHotelKey?: string | null;
}

const snapshotTotal = (snapshot: PriceSnapshot): number => {
  const minFlight = parsePrice(snapshot.flight_price) ?? 0;
  const minHotel = parsePrice(snapshot.hotel_price) ?? 0;
  return minFlight + minHotel;
};

/**
 * Collapse a list of price snapshots into one point per calendar day so the
 * price-history chart stays readable over long tracking windows.
 *
 * For each UTC day we keep the snapshot with the cheapest total (flight + hotel),
 * which represents the best price seen that day. Optional selected-flight and
 * selected-hotel lines carry their last known price forward across days where
 * the selected offer wasn't returned, matching the chart's existing behaviour.
 *
 * Input may be in any order (the API returns newest-first); output is always
 * sorted oldest -> newest.
 */
export function aggregateDailyPriceHistory(
  priceHistory: PriceSnapshot[],
  options: AggregateOptions = {}
): DailyPricePoint[] {
  const { selectedFlightKey, selectedHotelKey } = options;

  // Group snapshots by UTC calendar day, keeping the cheapest-total snapshot.
  const cheapestByDay = new Map<string, PriceSnapshot>();
  for (const snapshot of priceHistory) {
    const day = snapshot.created_at.slice(0, 10);
    if (!day) continue;
    const existing = cheapestByDay.get(day);
    if (!existing || snapshotTotal(snapshot) < snapshotTotal(existing)) {
      cheapestByDay.set(day, snapshot);
    }
  }

  const days = [...cheapestByDay.keys()].sort();

  let lastKnownSelectedFlight: number | null = null;
  let lastKnownSelectedHotel: number | null = null;

  return days.map((day) => {
    const snapshot = cheapestByDay.get(day) as PriceSnapshot;
    const minFlight = parsePrice(snapshot.flight_price) ?? 0;
    const minHotel = parsePrice(snapshot.hotel_price) ?? 0;

    let selectedHotel: number | undefined;
    if (selectedHotelKey && snapshot.hotel_offers) {
      const match = (snapshot.hotel_offers as ApiHotelOffer[]).find(
        (h) => hotelStableKey(h) === selectedHotelKey
      );
      if (match) {
        const price = parsePrice(match.price);
        if (price != null) {
          selectedHotel = price;
          lastKnownSelectedHotel = price;
        }
      } else if (lastKnownSelectedHotel != null) {
        selectedHotel = lastKnownSelectedHotel;
      }
    }

    let selectedFlight: number | undefined;
    if (selectedFlightKey && snapshot.flight_offers) {
      const match = (snapshot.flight_offers as ApiFlightOffer[]).find(
        (f) => flightStableKey(f) === selectedFlightKey
      );
      if (match) {
        const price = parsePrice(match.price);
        if (price != null) {
          selectedFlight = price;
          lastKnownSelectedFlight = price;
        }
      } else if (lastKnownSelectedFlight != null) {
        selectedFlight = lastKnownSelectedFlight;
      }
    }

    return {
      day,
      label: formatDayLabel(day),
      total: minFlight + minHotel,
      minFlight,
      selectedFlight,
      minHotel,
      selectedHotel,
    };
  });
}
