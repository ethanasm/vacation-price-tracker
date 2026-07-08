/**
 * Pure form → TripUpdate mapping for the edit-trip screen (app/trip/[id]/edit.tsx).
 * Lives in lib/ (not the screen) so the preservation invariant — pref fields the
 * mobile form doesn't expose must round-trip from the loaded trip unchanged —
 * is locked by unit tests under the lib/** coverage gate.
 */
import type { components } from './api/types';

type TripDetail = components['schemas']['TripDetail'];
type TripUpdate = components['schemas']['TripUpdate'];
type CabinClass = components['schemas']['CabinClass'];

export interface TripEditForm {
  name: string;
  origin: string;
  destination: string;
  departDate: string;
  isRoundTrip: boolean;
  returnDate: string;
  adults: string;
  flightEnabled: boolean;
  cabin: CabinClass;
  nonStopOnly: boolean;
  hotelEnabled: boolean;
  hotelCity: string;
  threshold: string;
}

/** Seed the threshold field: blank when the trip notifies on every refresh. */
export function seedThreshold(trip: TripDetail): string {
  const prefs = trip.notification_prefs;
  if (!prefs || prefs.notify_without_threshold) return '';
  const value = Number.parseFloat(prefs.threshold_value);
  return Number.isFinite(value) && value > 0 ? String(value) : '';
}

/**
 * Build the PATCH body from the form. The mobile form edits a subset of each
 * prefs object — untouched fields start from the trip's saved prefs so they
 * round-trip unchanged, and a disabled section omits its prefs object entirely
 * (the API keeps existing prefs when the key is absent) so saved preferences
 * survive a re-enable.
 */
export function buildTripUpdate(trip: TripDetail, form: TripEditForm): TripUpdate {
  // The toggle drives round-trip; the return-date guard is defensive, since
  // validation already rejects a round trip without a return date.
  const isRoundTrip = form.isRoundTrip && form.returnDate.trim().length > 0;
  const thresholdValue = Number.parseFloat(form.threshold);
  const hasThreshold = Number.isFinite(thresholdValue) && thresholdValue > 0;
  const existingNotify = trip.notification_prefs;

  const body: TripUpdate = {
    name: form.name.trim(),
    origin_airport: form.origin.trim().toUpperCase(),
    destination_code: form.destination.trim().toUpperCase(),
    is_round_trip: isRoundTrip,
    depart_date: form.departDate.trim(),
    return_date: isRoundTrip ? form.returnDate.trim() : null,
    // API bounds: 1–9 adults.
    adults: Math.min(9, Math.max(1, Number.parseInt(form.adults, 10) || 1)),
    track_flights: form.flightEnabled,
    track_hotels: form.hotelEnabled,
    notification_prefs: {
      threshold_type: existingNotify?.threshold_type ?? 'trip_total',
      threshold_value: hasThreshold ? thresholdValue : 0,
      notify_without_threshold: !hasThreshold,
      email_enabled: existingNotify?.email_enabled ?? true,
      sms_enabled: existingNotify?.sms_enabled ?? false,
    },
  };
  if (form.flightEnabled) {
    const existing = trip.flight_prefs;
    body.flight_prefs = {
      airlines: existing?.airlines ?? [],
      // The toggle only distinguishes nonstop from "not nonstop" — keep a
      // saved '1-stop' preference instead of collapsing it to 'any'.
      stops_mode: form.nonStopOnly
        ? 'nonstop'
        : existing?.stops_mode && existing.stops_mode !== 'nonstop'
          ? existing.stops_mode
          : 'any',
      max_stops: existing?.max_stops ?? null,
      cabin: form.cabin,
    };
  }
  if (form.hotelEnabled) {
    const existing = trip.hotel_prefs;
    body.hotel_prefs = {
      rooms: existing?.rooms ?? 1,
      adults_per_room: existing?.adults_per_room ?? 2,
      city: form.hotelCity.trim(),
      room_selection_mode: existing?.room_selection_mode ?? 'cheapest',
      preferred_room_types: existing?.preferred_room_types ?? [],
      preferred_views: existing?.preferred_views ?? [],
      min_star_rating: existing?.min_star_rating ?? null,
    };
  }
  return body;
}
