/**
 * Pure flight/hotel rendering + Trip-detail selection helpers for the Aurora
 * mobile screens. No React/RN imports so node:test imports this directly — this
 * file carries the mobile lib/** coverage. Mirrors the SEMANTICS of the web
 * app's helpers (airlineChip / stopsBadge / layoverLabel / multiCarrierSubtitle)
 * but is an independent recreation (mobile never imports apps/web code).
 */
import type { components } from './api/types';

export type FlightOffer = components['schemas']['FlightOffer'];
export type FlightItinerary = components['schemas']['FlightItinerary'];
export type FlightSegment = components['schemas']['FlightSegment'];
export type HotelOffer = components['schemas']['HotelOffer'];
export type PriceSnapshot = components['schemas']['PriceSnapshotResponse'];

export type AirlineCode = 'AS' | 'UA' | 'DL';

const AIRLINE: Record<AirlineCode, { colors: readonly [string, string]; label: string }> = {
  AS: { colors: ['#10617F', '#093247'], label: 'AS' },
  UA: { colors: ['#2456C9', '#13357F'], label: 'UA' },
  DL: { colors: ['#C8102E', '#7A0A1C'], label: 'DL' },
};
const NEUTRAL: readonly [string, string] = ['#6B6680', '#4A4660'];

export function airlineChip(code?: string | null): {
  code: AirlineCode | null;
  colors: readonly [string, string];
  label: string;
} {
  const key = (code ?? '').toUpperCase();
  if (key === 'AS' || key === 'UA' || key === 'DL') {
    return { code: key, colors: AIRLINE[key].colors, label: AIRLINE[key].label };
  }
  return { code: null, colors: NEUTRAL, label: key.slice(0, 2) || '··' };
}

export function stopsBadge(
  stops: number,
  viaAirport?: string | null,
): { tone: 'nonstop' | 'stop'; label: string } {
  if (stops <= 0) return { tone: 'nonstop', label: 'NON-STOP' };
  const noun = stops === 1 ? 'STOP' : 'STOPS';
  const via = viaAirport ? ` · ${viaAirport}` : '';
  return { tone: 'stop', label: `${stops} ${noun}${via}` };
}

export function layoverLabel(durationMinutes: number, airportName: string, airportCode: string): string {
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `${dur} layover in ${airportName} (${airportCode})`;
}

export function multiCarrierSubtitle(carriers: string[]): string | null {
  const unique = [...new Set(carriers.filter(Boolean))];
  if (unique.length < 2) return null;
  if (unique.length === 2) return `Operated by ${unique[0]} & ${unique[1]}`;
  return `Operated by ${unique.slice(0, -1).join(', ')} & ${unique[unique.length - 1]}`;
}

export function parsePrice(value?: string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a stable flight key from carrier, flight number, route, and date —
 * "UA-UA670|SFO-RDM|2026-08-22" per segment, joined by "+". Stays stable
 * across API responses for the "same" round trip, so the chart can find a
 * selected pairing in historical snapshots. Mirrors the web app's
 * `flightStableKey` (apps/web/src/lib/price-history.ts).
 */
export function flightStableKey(flight: FlightOffer): string {
  const segments = (flight.itineraries ?? []).flatMap((it) => it.segments ?? []);
  if (segments.length === 0) {
    // Fallback for flat structure - airline code, flight number, departure date
    const code = flight.airline_code ?? '';
    const num = flight.flight_number ?? '';
    const date = flight.departure_time?.slice(0, 10) ?? '';
    if (code && num && date) return `${code}-${num}|${date}`;
    // Last resort: the id (not stable across API calls, but better than nothing)
    return flight.id;
  }
  return segments
    .map((s) => {
      const code = s.carrier_code ?? '';
      const num = s.flight_number ?? '';
      const dep = s.departure_airport ?? '';
      const arr = s.arrival_airport ?? '';
      const date = s.departure_time?.slice(0, 10) ?? '';
      return `${code}-${num}|${dep}-${arr}|${date}`;
    })
    .join('+');
}

/** Stable hotel key: the normalized hotel name. Mirrors the web app. */
export function hotelStableKey(hotel: HotelOffer): string {
  return (hotel.name ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Display label for a flight: flight numbers across both itineraries, e.g.
 * "UA670 / UA702" for a typical round trip (segments within a leg join with
 * "+"). Mirrors the web trip-detail's chart-legend label.
 */
export function flightDisplayLabel(flight: FlightOffer): string | null {
  const legLabels = (flight.itineraries ?? [])
    .map((it) =>
      (it.segments ?? [])
        .map((s) => s.flight_number ?? s.carrier_code ?? '')
        .filter(Boolean)
        .join('+'),
    )
    .filter(Boolean);
  if (legLabels.length > 0) return legLabels.join(' / ');
  return flight.flight_number ?? flight.airline_code ?? null;
}

export function formatMoneyString(value?: string | null): string {
  const n = parsePrice(value) ?? 0;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function hotelPerNight(total: number, nights: number): number {
  if (nights <= 0) return total;
  return Math.round(total / nights);
}

/** '7:05a' style clock from an ISO datetime. */
export function clockLabel(iso?: string | null): string {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return '';
  let h = Number.parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min}${ampm}`;
}

function stopsWord(stops: number): string {
  return stops <= 0 ? 'nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;
}

/** A renderable flight leg with a stable OUTBOUND/RETURN label. */
export interface FlightLeg {
  label: 'OUTBOUND' | 'RETURN';
  segments: FlightSegment[];
  stops: number;
  totalMinutes: number | null;
}

/**
 * Renderable legs of an offer, labeled by their **original** itinerary position
 * (index 0 = outbound, any later itinerary = return) and skipping legs that
 * carry no segments. Both the collapsed summary and the expanded detail read
 * from this single source, so a leg can never be labeled OUTBOUND in one place
 * and RETURN in the other, and dropping an empty outbound leg never relabels
 * the return as outbound. Mirrors the web trip detail, which renders itinerary 0
 * as "Outbound" and itinerary 1 as "Return" positionally.
 */
export function displayLegs(offer: FlightOffer): FlightLeg[] {
  const legs: FlightLeg[] = [];
  (offer.itineraries ?? []).forEach((itin, i) => {
    const segments = itin.segments ?? [];
    if (segments.length === 0) return;
    legs.push({
      label: i === 0 ? 'OUTBOUND' : 'RETURN',
      segments,
      stops: itin.stops ?? Math.max(segments.length - 1, 0),
      totalMinutes: itin.total_duration_minutes ?? null,
    });
  });
  return legs;
}

function legSummary(segs: FlightSegment[], stops: number): string {
  const first = segs[0];
  const last = segs[segs.length - 1];
  const dep = first?.departure_airport ?? '';
  const arr = last?.arrival_airport ?? '';
  const depT = clockLabel(first?.departure_time);
  const arrT = clockLabel(last?.arrival_time);
  return `${depT} ${dep} → ${arrT} ${arr} · ${stopsWord(stops)}`.trim();
}

export function flightSummaryLine(offer: FlightOffer): string {
  const outbound = displayLegs(offer).find((l) => l.label === 'OUTBOUND');
  const segs = outbound?.segments ?? [];
  const first = segs[0];
  const last = segs[segs.length - 1];
  const dep = first?.departure_airport ?? '';
  const arr = last?.arrival_airport ?? '';
  const depT = clockLabel(first?.departure_time ?? offer.departure_time);
  const arrT = clockLabel(last?.arrival_time ?? offer.arrival_time);
  return `${depT} ${dep} → ${arrT} ${arr} · ${stopsWord(offer.stops)}`.trim();
}

/**
 * Summary line for the return leg of a round trip, or `null` for a one-way
 * offer. Reads the RETURN leg from {@link displayLegs} so it stays consistent
 * with the expanded detail's labeling.
 */
export function returnSummaryLine(offer: FlightOffer): string | null {
  const ret = displayLegs(offer).find((l) => l.label === 'RETURN');
  if (!ret) return null;
  return legSummary(ret.segments, ret.stops);
}

/**
 * A unique idempotency key for `POST /v1/trips` (sent as `X-Idempotency-Key`).
 * Prefers `crypto.randomUUID()` when available; otherwise falls back to a
 * timestamp + random suffix. `rand` is injectable for deterministic testing of
 * the fallback branch.
 */
export function makeIdempotencyKey(rand?: () => string): string {
  if (rand) return rand();
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// --- Trip-detail selection state (same shape as P1) ---

export interface Selection {
  selectedFlightId: string | null;
  expandedFlightId: string | null;
  selectedHotelId: string | null;
  expandedHotelId: string | null;
}
export type SelectAction = { kind: 'flight'; id: string } | { kind: 'hotel'; id: string };

function cheapestId<T extends { id: string; price: string }>(items: T[]): string | null {
  let best: T | null = null;
  for (const it of items) {
    const p = parsePrice(it.price);
    if (p === null) continue;
    if (best === null || p < (parsePrice(best.price) ?? Infinity)) best = it;
  }
  return best?.id ?? null;
}

export function initialSelection(flights: FlightOffer[], hotels: HotelOffer[]): Selection {
  return {
    selectedFlightId: cheapestId(flights),
    expandedFlightId: null,
    selectedHotelId: cheapestId(hotels),
    expandedHotelId: null,
  };
}

export function selectReducer(state: Selection, action: SelectAction): Selection {
  if (action.kind === 'flight') {
    const reTap = state.selectedFlightId === action.id && state.expandedFlightId === action.id;
    return {
      ...state,
      selectedFlightId: action.id,
      expandedFlightId: reTap ? null : action.id, // selecting expands; re-tap collapses, stays selected
    };
  }
  const reTap = state.selectedHotelId === action.id && state.expandedHotelId === action.id;
  return {
    ...state,
    selectedHotelId: action.id,
    expandedHotelId: reTap ? null : action.id,
  };
}

/** total = flightPrice + hotelTotal, where hotelTotal = hotel.price (per-night) * nights. */
export function computeTripTotal(
  flight: FlightOffer | null,
  hotel: HotelOffer | null,
  nights: number,
): number {
  const f = flight ? parsePrice(flight.price) ?? 0 : 0;
  const perNight = hotel ? parsePrice(hotel.price) ?? 0 : 0;
  return Math.round(f + perNight * Math.max(nights, 0));
}

export interface ChartPoint {
  label: string;
  total: number;
  hotel: number;
  /** Cheapest flight seen that day (the dashed "Flight (min)" series). */
  minFlight: number;
  /** The selected round trip's price that day (carried forward across gaps). */
  selectedFlight?: number;
  /** The selected hotel's price that day (carried forward across gaps). */
  selectedHotel?: number;
}

export interface ChartSeriesOptions {
  selectedFlightKey?: string | null;
  selectedHotelKey?: string | null;
  /** Live price of the currently selected flight, for the synthetic Now point. */
  nowSelectedFlight?: number | null;
  /** Live price of the currently selected hotel, for the synthetic Now point. */
  nowSelectedHotel?: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayLabel(day: string): string {
  const [, mo, dom] = day.split('-');
  const idx = Number.parseInt(mo, 10) - 1;
  return MONTHS[idx] && dom ? `${MONTHS[idx]} ${Number.parseInt(dom, 10)}` : day;
}

/**
 * Cheapest price for the selected offer across ALL of a day's snapshots.
 *
 * A day can hold several snapshots (daily cron + manual refreshes), and the
 * selected offer's best quote may live in a snapshot other than the day's
 * cheapest-total one. Mirrors the web app's matching.
 */
function selectedOfferDailyMin<T>(
  snapshots: PriceSnapshot[],
  offersOf: (snapshot: PriceSnapshot) => T[],
  keyOf: (offer: T) => string,
  selectedKey: string,
): number | null {
  let min: number | null = null;
  for (const snapshot of snapshots) {
    for (const offer of offersOf(snapshot)) {
      if (keyOf(offer) !== selectedKey) continue;
      const price = parsePrice((offer as { price?: string | null }).price);
      if (price !== null && (min === null || price < min)) min = price;
    }
  }
  return min;
}

/**
 * One point per calendar day — total/hotel/minFlight from the day's
 * cheapest-total snapshot; the selected flight/hotel matched across ALL of the
 * day's snapshots by stable key (carried forward across days with no match) —
 * then a synthetic "Now" point at the live selection so the chart's current
 * dot and the "Now $X" badge track the selection. Mirrors the web
 * price-history chart, including dropping degraded snapshots (no priced
 * component) so they don't plot a fake $0 point.
 */
export function buildChartSeries(
  history: PriceSnapshot[],
  currentTotal: number,
  currentHotel: number,
  options: ChartSeriesOptions = {},
): { points: ChartPoint[]; nowLabel: string } {
  const { selectedFlightKey, selectedHotelKey, nowSelectedFlight, nowSelectedHotel } = options;
  const cheapestByDay = new Map<string, { total: number; hotel: number; flight: number }>();
  const snapshotsByDay = new Map<string, PriceSnapshot[]>();
  for (const snap of history) {
    const day = (snap.created_at ?? '').slice(0, 10);
    if (!day) continue;
    const flightPrice = parsePrice(snap.flight_price);
    const hotelPrice = parsePrice(snap.hotel_price);
    // No priced component at all = a degraded provider response, not a $0 trip.
    if (flightPrice === null && hotelPrice === null) continue;
    const flight = flightPrice ?? 0;
    const hotel = hotelPrice ?? 0;
    const total = flight + hotel;
    snapshotsByDay.set(day, [...(snapshotsByDay.get(day) ?? []), snap]);
    const existing = cheapestByDay.get(day);
    if (!existing || total < existing.total) cheapestByDay.set(day, { total, hotel, flight });
  }
  const days = [...cheapestByDay.keys()].sort((a, b) => a.localeCompare(b));

  let lastSelectedFlight: number | null = null;
  let lastSelectedHotel: number | null = null;
  const points: ChartPoint[] = days.map((day) => {
    const v = cheapestByDay.get(day) as { total: number; hotel: number; flight: number };
    const daySnapshots = snapshotsByDay.get(day) ?? [];

    let selectedFlight: number | undefined;
    if (selectedFlightKey) {
      const match = selectedOfferDailyMin(
        daySnapshots,
        (s) => (s.flight_offers ?? []) as FlightOffer[],
        flightStableKey,
        selectedFlightKey,
      );
      if (match !== null) {
        selectedFlight = match;
        lastSelectedFlight = match;
      } else if (lastSelectedFlight !== null) {
        selectedFlight = lastSelectedFlight;
      }
    }

    let selectedHotel: number | undefined;
    if (selectedHotelKey) {
      const match = selectedOfferDailyMin(
        daySnapshots,
        (s) => (s.hotel_offers ?? []) as HotelOffer[],
        hotelStableKey,
        selectedHotelKey,
      );
      if (match !== null) {
        selectedHotel = match;
        lastSelectedHotel = match;
      } else if (lastSelectedHotel !== null) {
        selectedHotel = lastSelectedHotel;
      }
    }

    return {
      label: dayLabel(day),
      total: v.total,
      hotel: v.hotel,
      minFlight: v.flight,
      selectedFlight,
      selectedHotel,
    };
  });

  const lastDay = points[points.length - 1];
  points.push({
    label: 'Now',
    total: currentTotal,
    hotel: currentHotel,
    minFlight: lastDay ? lastDay.minFlight : Math.max(currentTotal - currentHotel, 0),
    selectedFlight: nowSelectedFlight ?? lastSelectedFlight ?? undefined,
    selectedHotel: nowSelectedHotel ?? lastSelectedHotel ?? undefined,
  });
  return { points, nowLabel: `Now $${Math.round(currentTotal).toLocaleString('en-US')}` };
}

/**
 * Clean y-axis ticks from $0 up to a rounded ceiling ≥ the plotted maximum
 * (1/2/2.5/5 × power of ten steps, aiming for ~4 intervals). Replaces the
 * chart's old fixed $0–$1000 scale, which squashed cheap trips against the
 * baseline and clipped expensive ones.
 */
export function yAxisTicks(maxValue: number): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [0, 250, 500, 750, 1000];
  const rawStep = maxValue / 4;
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rawStep) ?? 10 * pow;
  const intervals = Math.ceil(maxValue / step);
  const ticks: number[] = [];
  for (let i = 0; i <= intervals; i += 1) ticks.push(i * step);
  return ticks;
}

/**
 * Window after creation during which a snapshot-less trip is assumed to have
 * its initial server-side price fetch still in flight (trip creation starts a
 * PriceCheckWorkflow). Mirrors the web trip-detail page.
 */
export const INITIAL_FETCH_WINDOW_MS = 15 * 60_000;

/**
 * True when a just-created active trip has no snapshots yet — the detail
 * screen shows a fetching indicator and polls until the first snapshot lands.
 * Recency-gated so an old snapshot-less trip doesn't poll on every visit.
 */
export function isAwaitingInitialFetch(
  trip: { status: string; created_at?: string | null } | null | undefined,
  history: unknown[],
  now: number = Date.now(),
): boolean {
  if (!trip || history.length > 0) return false;
  if (trip.status !== 'active') return false;
  const created = Date.parse(trip.created_at ?? '');
  if (!Number.isFinite(created)) return false;
  return now - created <= INITIAL_FETCH_WINDOW_MS;
}
