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

const snapshotTotal = (snapshot: PriceSnapshot): number | null => {
  const minFlight = parsePrice(snapshot.flight_price);
  const minHotel = parsePrice(snapshot.hotel_price);
  // No priced component at all (e.g. a degraded provider response with only
  // unpriced/$0 offers) is not a real $0 total — signal "nothing to plot".
  if (minFlight === null && minHotel === null) return null;
  return (minFlight ?? 0) + (minHotel ?? 0);
};

/**
 * Cheapest price for the selected offer across ALL of a day's snapshots.
 *
 * A day can hold several snapshots (daily cron + manual refreshes), and the
 * selected offer's best quote may live in a snapshot other than the day's
 * cheapest-total one — matching only there would show a stale carried-forward
 * value even though the offer WAS quoted that day.
 */
function selectedOfferDailyMin<T>(
  snapshots: PriceSnapshot[],
  offersOf: (snapshot: PriceSnapshot) => T[],
  keyOf: (offer: T) => string,
  selectedKey: string
): number | null {
  let min: number | null = null;
  for (const snapshot of snapshots) {
    for (const offer of offersOf(snapshot)) {
      if (keyOf(offer) !== selectedKey) continue;
      const price = parsePrice((offer as { price?: string | null }).price);
      if (price != null && (min === null || price < min)) {
        min = price;
      }
    }
  }
  return min;
}

/**
 * Collapse a list of price snapshots into one point per calendar day so the
 * price-history chart stays readable over long tracking windows.
 *
 * For each UTC day the total/min lines come from the snapshot with the
 * cheapest total (flight + hotel) — the best price seen that day. The optional
 * selected-flight and selected-hotel lines are matched across ALL of the day's
 * snapshots (cheapest match wins) and carry their last known price forward
 * across days where the selected offer wasn't returned at all.
 *
 * Input may be in any order (the API returns newest-first); output is always
 * sorted oldest -> newest.
 */
export function aggregateDailyPriceHistory(
  priceHistory: PriceSnapshot[],
  options: AggregateOptions = {}
): DailyPricePoint[] {
  const { selectedFlightKey, selectedHotelKey } = options;

  // Group snapshots by UTC calendar day, tracking the cheapest-total snapshot.
  const cheapestByDay = new Map<string, PriceSnapshot>();
  const snapshotsByDay = new Map<string, PriceSnapshot[]>();
  for (const snapshot of priceHistory) {
    const day = snapshot.created_at.slice(0, 10);
    if (!day) continue;
    const total = snapshotTotal(snapshot);
    // Skip degraded snapshots (no priced offers) so they neither plot a fake $0
    // point nor displace a genuinely-priced snapshot as the day's cheapest.
    if (total === null) continue;
    snapshotsByDay.set(day, [...(snapshotsByDay.get(day) ?? []), snapshot]);
    const existing = cheapestByDay.get(day);
    const existingTotal = existing ? snapshotTotal(existing) : null;
    if (existingTotal === null || total < existingTotal) {
      cheapestByDay.set(day, snapshot);
    }
  }

  // ISO YYYY-MM-DD keys sort chronologically; use localeCompare for a stable,
  // explicit string comparison.
  const days = [...cheapestByDay.keys()].sort((a, b) => a.localeCompare(b));

  let lastKnownSelectedFlight: number | null = null;
  let lastKnownSelectedHotel: number | null = null;

  return days.map((day) => {
    const snapshot = cheapestByDay.get(day) as PriceSnapshot;
    const daySnapshots = snapshotsByDay.get(day) ?? [];
    const minFlight = parsePrice(snapshot.flight_price) ?? 0;
    const minHotel = parsePrice(snapshot.hotel_price) ?? 0;

    let selectedHotel: number | undefined;
    if (selectedHotelKey) {
      const price = selectedOfferDailyMin(
        daySnapshots,
        (s) => (s.hotel_offers ?? []) as ApiHotelOffer[],
        hotelStableKey,
        selectedHotelKey
      );
      if (price != null) {
        selectedHotel = price;
        lastKnownSelectedHotel = price;
      } else if (lastKnownSelectedHotel != null) {
        selectedHotel = lastKnownSelectedHotel;
      }
    }

    let selectedFlight: number | undefined;
    if (selectedFlightKey) {
      const price = selectedOfferDailyMin(
        daySnapshots,
        (s) => (s.flight_offers ?? []) as ApiFlightOffer[],
        flightStableKey,
        selectedFlightKey
      );
      if (price != null) {
        selectedFlight = price;
        lastKnownSelectedFlight = price;
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
