/**
 * Pure date + validation helpers behind the trip create/edit forms
 * (app/trip/new.tsx, app/trip/[id]/edit.tsx) and the Aurora DateField
 * calendar. Mirrors web's trip-form constraints
 * (apps/web/src/components/trip-form/validation.ts): 3-letter IATA codes,
 * departure within [today, today + 359 days], return strictly after
 * departure. Lives in lib/ so the rules sit under the coverage gate.
 */

export const MAX_DATE_DAYS_OUT = 359;

export const AIRPORT_CODE_RE = /^[A-Z]{3}$/;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Format a Date as local YYYY-MM-DD. */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD to a local-midnight Date; null for malformed/impossible dates. */
export function parseIsoDate(iso: string): Date | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // new Date() silently rolls over out-of-range parts (2026-02-30 → Mar 2);
  // reject those instead of accepting the shifted date.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** Today's date as local YYYY-MM-DD. */
export function todayIso(): string {
  return isoDate(new Date());
}

/** Add (or subtract) whole days to a YYYY-MM-DD date. */
export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/** Short display form for a picked date: '2026-08-22' → 'Aug 22, 2026'. */
export function formatDisplayDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Calendar header label: (2026, 7) → 'August 2026'. `month` is 0-based. */
export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/**
 * Day-of-month cells for one calendar month, Sunday-aligned: leading and
 * trailing `null`s pad the grid to whole weeks (length is a multiple of 7).
 * `month` is 0-based.
 */
export function monthGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Step a (year, 0-based month) pair by `delta` months. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** True when some day of (year, month) falls inside [minIso, maxIso]. */
export function monthInRange(year: number, month: number, minIso: string, maxIso: string): boolean {
  const monthStart = isoDate(new Date(year, month, 1));
  const monthEnd = isoDate(new Date(year, month + 1, 0));
  return monthEnd >= minIso && monthStart <= maxIso;
}

/**
 * Keep only characters that form a non-negative decimal number: digits and a
 * single '.' — the type constraint behind the threshold field, where the
 * numeric soft keyboard still exposes separators and paste is unrestricted.
 */
export function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
}

export interface TripFormValues {
  name: string;
  origin: string;
  destination: string;
  isRoundTrip: boolean;
  departDate: string;
  returnDate: string;
  flightEnabled: boolean;
  hotelEnabled: boolean;
  hotelCity: string;
}

/**
 * First validation error for the trip form, or null when valid. Mirrors
 * web's validateTripForm messages. `minDepartIso` is today for the create
 * form; the edit form passes min(today, saved depart) so a trip that already
 * departed can still be renamed without touching its dates.
 */
export function validateTripForm(values: TripFormValues, minDepartIso: string): string | null {
  if (!values.name.trim()) return 'Trip name is required.';
  if (values.name.trim().length > 100) return 'Trip name must be 100 characters or less.';
  if (!AIRPORT_CODE_RE.test(values.origin.trim().toUpperCase())) {
    return 'Enter a valid 3-letter airport code for From (origin).';
  }
  if (!AIRPORT_CODE_RE.test(values.destination.trim().toUpperCase())) {
    return 'Enter a valid 3-letter airport code for To (destination).';
  }

  const depart = values.departDate.trim();
  if (!parseIsoDate(depart)) return 'Departure date is required.';
  if (depart < minDepartIso) return 'Departure date cannot be in the past.';
  const maxIso = addDaysIso(todayIso(), MAX_DATE_DAYS_OUT);
  if (depart > maxIso) return `Departure date cannot be more than ${MAX_DATE_DAYS_OUT} days out.`;

  if (values.isRoundTrip) {
    const ret = values.returnDate.trim();
    if (!parseIsoDate(ret)) return 'Return date is required for a round trip.';
    if (ret <= depart) return 'Return date must be after departure.';
    if (ret > maxIso) return `Return date cannot be more than ${MAX_DATE_DAYS_OUT} days out.`;
  }

  if (!values.flightEnabled && !values.hotelEnabled) return 'Track at least flights or hotels.';
  if (values.hotelEnabled) {
    if (!values.hotelCity.trim()) return 'Hotel city is required when tracking hotels.';
    if (values.hotelCity.trim().length > 200) return 'Hotel city must be 200 characters or less.';
  }
  return null;
}
