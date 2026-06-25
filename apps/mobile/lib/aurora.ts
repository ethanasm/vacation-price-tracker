/**
 * Pure flight/hotel rendering + Trip-detail selection helpers for the Aurora
 * mobile screens. No React/RN imports so node:test imports this directly — this
 * file carries the mobile lib/** coverage. Mirrors the SEMANTICS of the web
 * app's helpers (airlineChip / stopsBadge / layoverLabel / multiCarrierSubtitle)
 * but is an independent recreation (mobile never imports apps/web code).
 */
import type { components } from './api/types';

export type FlightOffer = components['schemas']['FlightOffer'];
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

export function flightSummaryLine(offer: FlightOffer): string {
  const segs = (offer.itineraries ?? [])[0]?.segments ?? [];
  const first = segs[0];
  const last = segs[segs.length - 1];
  const dep = first?.departure_airport ?? '';
  const arr = last?.arrival_airport ?? '';
  const depT = clockLabel(first?.departure_time ?? offer.departure_time);
  const arrT = clockLabel(last?.arrival_time ?? offer.arrival_time);
  const stops = offer.stops <= 0 ? 'nonstop' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`;
  return `${depT} ${dep} → ${arrT} ${arr} · ${stops}`.trim();
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
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dayLabel(day: string): string {
  const [, mo, dom] = day.split('-');
  const idx = Number.parseInt(mo, 10) - 1;
  return MONTHS[idx] && dom ? `${MONTHS[idx]} ${Number.parseInt(dom, 10)}` : day;
}

/**
 * One point per calendar day (cheapest total that day), then append a synthetic
 * "Now" point at the live selection's total/hotel so the chart's current dot and
 * the "Now $X" badge track the selection. Mirrors the web price-history chart.
 */
export function buildChartSeries(
  history: PriceSnapshot[],
  currentTotal: number,
  currentHotel: number,
): { points: ChartPoint[]; nowLabel: string } {
  const cheapestByDay = new Map<string, { total: number; hotel: number }>();
  for (const snap of history) {
    const day = (snap.created_at ?? '').slice(0, 10);
    if (!day) continue;
    const flight = parsePrice(snap.flight_price) ?? 0;
    const hotel = parsePrice(snap.hotel_price) ?? 0;
    const total = flight + hotel;
    const existing = cheapestByDay.get(day);
    if (!existing || total < existing.total) cheapestByDay.set(day, { total, hotel });
  }
  const days = [...cheapestByDay.keys()].sort((a, b) => a.localeCompare(b));
  const points: ChartPoint[] = days.map((day) => {
    const v = cheapestByDay.get(day) as { total: number; hotel: number };
    return { label: dayLabel(day), total: v.total, hotel: v.hotel };
  });
  points.push({ label: 'Now', total: currentTotal, hotel: currentHotel });
  return { points, nowLabel: `Now $${Math.round(currentTotal).toLocaleString('en-US')}` };
}
