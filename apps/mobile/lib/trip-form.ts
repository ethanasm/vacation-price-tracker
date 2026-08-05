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

/** Per-field validation errors; a key is present only when that field is invalid. */
export interface TripFormErrors {
  name?: string;
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  tracking?: string;
  hotelCity?: string;
}

/** Field order used to pick the "first" error for the legacy single-message API. */
const ERROR_FIELD_ORDER: (keyof TripFormErrors)[] = [
  'name', 'origin', 'destination', 'departDate', 'returnDate', 'tracking', 'hotelCity',
];

/**
 * Validate every trip-form field at once and return the full error map, so
 * the form can highlight each invalid field inline instead of surfacing one
 * bottom-anchored message per submit. Constraints mirror web's trip-form
 * rules (3-letter IATA codes, departure within [today, today + 359 days],
 * return strictly after departure); the airport copy is phrased around the
 * typeahead ("choose … from the list") rather than raw IATA codes.
 * `minDepartIso` is today for the create form; the edit form passes
 * min(today, saved depart) so a trip that already departed can still be
 * renamed without touching its dates.
 */
export function validateTripFormFields(values: TripFormValues, minDepartIso: string): TripFormErrors {
  const errors: TripFormErrors = {};

  if (!values.name.trim()) errors.name = 'Trip name is required.';
  else if (values.name.trim().length > 100) errors.name = 'Trip name must be 100 characters or less.';

  if (!AIRPORT_CODE_RE.test(values.origin.trim().toUpperCase())) {
    errors.origin = 'Choose an origin airport from the list.';
  }
  if (!AIRPORT_CODE_RE.test(values.destination.trim().toUpperCase())) {
    errors.destination = 'Choose a destination airport from the list.';
  }

  const depart = values.departDate.trim();
  const maxIso = addDaysIso(todayIso(), MAX_DATE_DAYS_OUT);
  if (!parseIsoDate(depart)) errors.departDate = 'Departure date is required.';
  else if (depart < minDepartIso) errors.departDate = 'Departure date cannot be in the past.';
  else if (depart > maxIso) errors.departDate = `Departure date cannot be more than ${MAX_DATE_DAYS_OUT} days out.`;

  if (values.isRoundTrip) {
    const ret = values.returnDate.trim();
    if (!parseIsoDate(ret)) errors.returnDate = 'Return date is required for a round trip.';
    else if (!errors.departDate && ret <= depart) errors.returnDate = 'Return date must be after departure.';
    else if (ret > maxIso) errors.returnDate = `Return date cannot be more than ${MAX_DATE_DAYS_OUT} days out.`;
  }

  if (!values.flightEnabled && !values.hotelEnabled) {
    errors.tracking = 'Track at least flights or hotels.';
  }
  if (values.hotelEnabled) {
    if (!values.hotelCity.trim()) errors.hotelCity = 'Hotel city is required when tracking hotels.';
    else if (values.hotelCity.trim().length > 200) errors.hotelCity = 'Hotel city must be 200 characters or less.';
  }
  return errors;
}

/** True when the error map has no entries. */
export function hasNoErrors(errors: TripFormErrors): boolean {
  return ERROR_FIELD_ORDER.every((key) => !errors[key]);
}

/**
 * First validation error for the trip form, or null when valid — the legacy
 * single-message wrapper over validateTripFormFields.
 */
export function validateTripForm(values: TripFormValues, minDepartIso: string): string | null {
  const errors = validateTripFormFields(values, minDepartIso);
  for (const key of ERROR_FIELD_ORDER) {
    const message = errors[key];
    if (message) return message;
  }
  return null;
}

/** Whole days between two ISO dates (b - a); null when either is malformed. */
export function diffDaysIso(aIso: string, bIso: string): number | null {
  const a = parseIsoDate(aIso);
  const b = parseIsoDate(bIso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Recompute the return date after the departure moves. A return that is still
 * after the new departure is the user's explicit pick — keep it. Otherwise
 * preserve the trip's previous length (return − old departure, min 1 night)
 * instead of silently clearing the field; fall back to clearing only when the
 * preserved date would land past `maxIso` or the inputs are malformed.
 */
export function adjustReturnDate(
  prevDepartIso: string,
  newDepartIso: string,
  returnIso: string,
  maxIso: string,
): string {
  if (!returnIso) return '';
  if (!parseIsoDate(newDepartIso)) return returnIso;
  if (returnIso > newDepartIso) return returnIso;
  const nights = diffDaysIso(prevDepartIso, returnIso);
  const preserved = addDaysIso(newDepartIso, Math.max(1, nights ?? 1));
  if (!parseIsoDate(preserved) || preserved > maxIso) return '';
  return preserved;
}

/**
 * Hotel occupancy derived from the trip's traveler count instead of a
 * hardcoded 2-adult double: as few rooms as the API's 4-adults-per-room cap
 * allows, then the smallest per-room count that still fits everyone — so
 * rooms × adultsPerRoom never books meaningfully past the party size
 * (5 adults → 2 rooms × 3, not 2 × 4).
 */
export function hotelOccupancy(adults: number): { rooms: number; adultsPerRoom: number } {
  const total = Math.min(9, Math.max(1, Math.trunc(adults) || 1));
  const rooms = Math.ceil(total / 4);
  return { rooms, adultsPerRoom: Math.ceil(total / rooms) };
}

/** Human summary of hotelOccupancy: "1 room · 2 adults", "2 rooms · 4 adults each". */
export function describeHotelOccupancy(adults: number): string {
  const { rooms, adultsPerRoom } = hotelOccupancy(adults);
  const roomsLabel = rooms === 1 ? '1 room' : `${rooms} rooms`;
  const adultsLabel = adultsPerRoom === 1 ? '1 adult' : `${adultsPerRoom} adults${rooms > 1 ? ' each' : ''}`;
  return `${roomsLabel} · ${adultsLabel}`;
}

/** 'Aug 20' short date for name suggestions. */
function shortDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return '';
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

/**
 * Suggested trip name from the destination + dates, e.g. "Maui · Aug 20–27",
 * "Kahului · Aug 28 – Sep 3" across months, or "Maui · Aug 20" one-way.
 * Empty when there is no destination to name the trip after.
 */
export function suggestTripName(
  destinationLabel: string,
  departIso: string,
  returnIso: string,
  isRoundTrip: boolean,
): string {
  const place = destinationLabel.trim();
  if (!place) return '';
  const depart = parseIsoDate(departIso);
  if (!depart) return place.slice(0, 100);
  const departLabel = shortDate(departIso);
  const ret = isRoundTrip ? parseIsoDate(returnIso) : null;
  if (!ret) return `${place} · ${departLabel}`.slice(0, 100);
  const sameMonth = depart.getMonth() === ret.getMonth() && depart.getFullYear() === ret.getFullYear();
  const range = sameMonth ? `${departLabel}–${ret.getDate()}` : `${departLabel} – ${shortDate(returnIso)}`;
  return `${place} · ${range}`.slice(0, 100);
}
