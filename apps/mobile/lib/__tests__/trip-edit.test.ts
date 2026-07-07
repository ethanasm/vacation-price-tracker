import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTripUpdate, seedThreshold, type TripEditForm } from '../trip-edit';
import type { components } from '../api/types';

type TripDetail = components['schemas']['TripDetail'];

/** A trip whose prefs exercise every field the mobile form does NOT expose. */
function makeTrip(overrides: Partial<TripDetail> = {}): TripDetail {
  return {
    id: 't1',
    name: 'Maui Getaway',
    origin_airport: 'SFO',
    destination_code: 'OGG',
    depart_date: '2026-09-10',
    return_date: '2026-09-17',
    status: 'active',
    track_flights: true,
    track_hotels: true,
    is_round_trip: true,
    adults: 2,
    flight_prefs: {
      airlines: ['UA', 'AS'],
      stops_mode: '1-stop',
      max_stops: 1,
      cabin: 'economy',
    },
    hotel_prefs: {
      rooms: 2,
      adults_per_room: 3,
      city: 'Maui',
      room_selection_mode: 'preferred',
      preferred_room_types: ['Suite'],
      preferred_views: ['Ocean'],
      min_star_rating: 4,
    },
    notification_prefs: {
      threshold_type: 'flight_total',
      threshold_value: '1500.00',
      notify_without_threshold: false,
      email_enabled: false,
      sms_enabled: true,
    },
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

/** Form state exactly as the edit screen seeds it from makeTrip(). */
function seededForm(overrides: Partial<TripEditForm> = {}): TripEditForm {
  return {
    name: 'Maui Getaway',
    origin: 'SFO',
    destination: 'OGG',
    departDate: '2026-09-10',
    returnDate: '2026-09-17',
    adults: '2',
    flightEnabled: true,
    cabin: 'economy',
    nonStopOnly: false,
    hotelEnabled: true,
    hotelCity: 'Maui',
    threshold: '1500',
    ...overrides,
  };
}

test('a rename-only edit preserves every pref field the form does not expose', () => {
  const body = buildTripUpdate(makeTrip(), seededForm({ name: 'Maui (Sept)' }));
  assert.equal(body.name, 'Maui (Sept)');
  assert.deepEqual(body.flight_prefs, {
    airlines: ['UA', 'AS'],
    stops_mode: '1-stop', // saved 1-stop NOT collapsed to 'any'
    max_stops: 1,
    cabin: 'economy',
  });
  assert.deepEqual(body.hotel_prefs, {
    rooms: 2,
    adults_per_room: 3,
    city: 'Maui',
    room_selection_mode: 'preferred',
    preferred_room_types: ['Suite'],
    preferred_views: ['Ocean'],
    min_star_rating: 4,
  });
  assert.deepEqual(body.notification_prefs, {
    threshold_type: 'flight_total',
    threshold_value: 1500,
    notify_without_threshold: false,
    email_enabled: false,
    sms_enabled: true,
  });
});

test('nonstop toggle: on wins; off restores a saved non-nonstop mode; off over saved nonstop becomes any', () => {
  const trip = makeTrip();
  assert.equal(buildTripUpdate(trip, seededForm({ nonStopOnly: true })).flight_prefs?.stops_mode, 'nonstop');
  assert.equal(buildTripUpdate(trip, seededForm({ nonStopOnly: false })).flight_prefs?.stops_mode, '1-stop');
  const nonstopTrip = makeTrip({
    flight_prefs: { airlines: [], stops_mode: 'nonstop', max_stops: null, cabin: 'economy' },
  });
  assert.equal(buildTripUpdate(nonstopTrip, seededForm({ nonStopOnly: false })).flight_prefs?.stops_mode, 'any');
});

test('disabled sections omit their prefs object so saved prefs survive a re-enable', () => {
  const body = buildTripUpdate(makeTrip(), seededForm({ flightEnabled: false, hotelEnabled: false }));
  assert.equal(body.track_flights, false);
  assert.equal(body.track_hotels, false);
  assert.ok(!('flight_prefs' in body));
  assert.ok(!('hotel_prefs' in body));
});

test('a trip without saved prefs gets the create-form defaults', () => {
  const bare = makeTrip({ flight_prefs: null, hotel_prefs: null, notification_prefs: null });
  const body = buildTripUpdate(bare, seededForm({ threshold: '' }));
  assert.deepEqual(body.flight_prefs, { airlines: [], stops_mode: 'any', max_stops: null, cabin: 'economy' });
  assert.deepEqual(body.hotel_prefs, {
    rooms: 1,
    adults_per_room: 2,
    city: 'Maui',
    room_selection_mode: 'cheapest',
    preferred_room_types: [],
    preferred_views: [],
    min_star_rating: null,
  });
  assert.deepEqual(body.notification_prefs, {
    threshold_type: 'trip_total',
    threshold_value: 0,
    notify_without_threshold: true,
    email_enabled: true,
    sms_enabled: false,
  });
});

test('blank threshold means notify on every refresh; a value sets the threshold', () => {
  const trip = makeTrip();
  const blank = buildTripUpdate(trip, seededForm({ threshold: '' }));
  assert.equal(blank.notification_prefs?.notify_without_threshold, true);
  assert.equal(blank.notification_prefs?.threshold_value, 0);
  const set = buildTripUpdate(trip, seededForm({ threshold: '800' }));
  assert.equal(set.notification_prefs?.notify_without_threshold, false);
  assert.equal(set.notification_prefs?.threshold_value, 800);
});

test('normalization: trims + uppercases codes, clamps adults to 1–9, blank return goes one-way', () => {
  const body = buildTripUpdate(
    makeTrip(),
    seededForm({ origin: ' sfo ', destination: 'ogg', adults: '99', returnDate: '' }),
  );
  assert.equal(body.origin_airport, 'SFO');
  assert.equal(body.destination_code, 'OGG');
  assert.equal(body.adults, 9);
  assert.equal(body.is_round_trip, false);
  assert.equal(body.return_date, null);
  assert.equal(buildTripUpdate(makeTrip(), seededForm({ adults: '' })).adults, 1);
  assert.equal(buildTripUpdate(makeTrip(), seededForm({ adults: '0' })).adults, 1);
});

test('seedThreshold: blank for notify-on-every-refresh or missing prefs, numeric otherwise', () => {
  assert.equal(seedThreshold(makeTrip()), '1500');
  assert.equal(seedThreshold(makeTrip({ notification_prefs: null })), '');
  const notifyAlways = makeTrip({
    notification_prefs: {
      threshold_type: 'trip_total',
      threshold_value: '0.00',
      notify_without_threshold: true,
      email_enabled: true,
      sms_enabled: false,
    },
  });
  assert.equal(seedThreshold(notifyAlways), '');
});
