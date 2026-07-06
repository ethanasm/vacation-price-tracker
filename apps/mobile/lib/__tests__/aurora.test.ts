import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  airlineChip,
  stopsBadge,
  layoverLabel,
  multiCarrierSubtitle,
  parsePrice,
  formatMoneyString,
  hotelPerNight,
  initialSelection,
  selectReducer,
  computeTripTotal,
  buildChartSeries,
  flightSummaryLine,
  returnSummaryLine,
  clockLabel,
  makeIdempotencyKey,
  type Selection,
  type FlightOffer,
  type HotelOffer,
} from '../aurora';

// --- Fixture matching the handoff + the three verified totals ---
const flights = [
  { id: 'f-as', airline_code: 'AS', airline_name: 'Alaska', price: '177.00', stops: 0,
    departure_time: '2025-08-22T07:05:00', arrival_time: '2025-08-22T09:00:00',
    itineraries: [{ direction: 'outbound', stops: 0, segments: [
      { carrier_code: 'AS', flight_number: '120', departure_airport: 'SFO', arrival_airport: 'RDM', departure_time: '2025-08-22T07:05:00', arrival_time: '2025-08-22T09:00:00' }] }] },
  { id: 'f-ua', airline_code: 'UA', airline_name: 'United', price: '142.00', stops: 1,
    itineraries: [{ direction: 'outbound', stops: 1, segments: [
      { carrier_code: 'UA', flight_number: '508', departure_airport: 'SFO', arrival_airport: 'DEN', departure_time: '2025-08-22T06:00:00', arrival_time: '2025-08-22T09:30:00', duration_minutes: 150 },
      { carrier_code: 'AS', flight_number: '2201', departure_airport: 'DEN', arrival_airport: 'RDM', departure_time: '2025-08-22T10:40:00', arrival_time: '2025-08-22T12:10:00' }] }] },
  { id: 'f-dl', airline_code: 'DL', airline_name: 'Delta', price: '142.00', stops: 0,
    itineraries: [{ direction: 'outbound', stops: 0, segments: [
      { carrier_code: 'DL', flight_number: '900', departure_airport: 'SFO', arrival_airport: 'RDM', departure_time: '2025-08-22T08:00:00', arrival_time: '2025-08-22T10:00:00' }] }] },
] as never[];
const hotels = [
  { id: 'h-river', name: 'Riverhouse', price: '153.00', rating: 4 },     // $153/night * 4 nights = $612 total
  { id: 'h-eviva', name: 'Eviva', price: '134.50', rating: 3 },          // $134.50 * 4 = $538 total
] as never[];
const NIGHTS = 4;

test('airlineChip maps known carriers and falls back to null', () => {
  assert.deepEqual(airlineChip('AS').colors, ['#10617F', '#093247']);
  assert.equal(airlineChip('UA').label, 'UA');
  assert.equal(airlineChip('DL').code, 'DL');
  assert.equal(airlineChip('XX').code, null);
  assert.equal(airlineChip(null).code, null);
});

test('stopsBadge renders NON-STOP green vs 1 STOP amber with via airport', () => {
  assert.deepEqual(stopsBadge(0), { tone: 'nonstop', label: 'NON-STOP' });
  assert.deepEqual(stopsBadge(1, 'DEN'), { tone: 'stop', label: '1 STOP · DEN' });
  assert.equal(stopsBadge(2, 'DEN').label, '2 STOPS · DEN');
});

test('layoverLabel + multiCarrierSubtitle compose the amber pill + subtitle', () => {
  assert.equal(layoverLabel(70, 'Denver', 'DEN'), '1h 10m layover in Denver (DEN)');
  assert.equal(multiCarrierSubtitle(['United', 'Alaska']), 'Operated by United & Alaska');
  assert.equal(multiCarrierSubtitle(['United']), null);
  assert.equal(multiCarrierSubtitle([]), null);
});

test('price parsing + formatting', () => {
  assert.equal(parsePrice('177.00'), 177);
  assert.equal(parsePrice(null), null);
  assert.equal(formatMoneyString('177.00'), '$177');
  assert.equal(formatMoneyString('1838'), '$1,838');
  assert.equal(hotelPerNight(612, 4), 153);
});

test('initialSelection pre-selects the cheapest flight and hotel', () => {
  const sel = initialSelection(flights, hotels);
  // Cheapest flight is a tie at 142 (UA, DL) — the first cheapest wins: UA.
  assert.equal(sel.selectedFlightId, 'f-ua');
  assert.equal(sel.selectedHotelId, 'h-eviva'); // 134.50 < 153
  assert.equal(sel.expandedFlightId, null);
  assert.equal(sel.expandedHotelId, null);
});

test('selectReducer: selecting expands; re-tapping selected collapses but stays selected; one-expanded-at-a-time', () => {
  let s: Selection = { selectedFlightId: null, expandedFlightId: null, selectedHotelId: null, expandedHotelId: null };
  s = selectReducer(s, { kind: 'flight', id: 'f-as' });
  assert.equal(s.selectedFlightId, 'f-as');
  assert.equal(s.expandedFlightId, 'f-as');     // selecting also expands
  s = selectReducer(s, { kind: 'flight', id: 'f-ua' });
  assert.equal(s.selectedFlightId, 'f-ua');
  assert.equal(s.expandedFlightId, 'f-ua');     // only one expanded
  s = selectReducer(s, { kind: 'flight', id: 'f-ua' });
  assert.equal(s.selectedFlightId, 'f-ua');     // still selected
  assert.equal(s.expandedFlightId, null);       // re-tap collapses
  // hotels are independent of flights
  s = selectReducer(s, { kind: 'hotel', id: 'h-river' });
  assert.equal(s.selectedHotelId, 'h-river');
  assert.equal(s.expandedHotelId, 'h-river');
  assert.equal(s.selectedFlightId, 'f-ua');     // flight untouched
});

test('computeTripTotal reproduces the three verified totals (total = flightPrice + hotelTotal)', () => {
  const asF = (flights as FlightOffer[]).find((f) => f.id === 'f-as')!;
  const uaF = (flights as FlightOffer[]).find((f) => f.id === 'f-ua')!;
  const dlF = (flights as FlightOffer[]).find((f) => f.id === 'f-dl')!;
  const river = { id: 'h-river', name: 'Riverhouse', price: String(612 / NIGHTS) } as HotelOffer;
  const eviva = { id: 'h-eviva', name: 'Eviva', price: String(538 / NIGHTS) } as HotelOffer;
  // computeTripTotal takes hotel TOTAL via a {total} accessor; the screen passes nights.
  assert.equal(computeTripTotal(asF, river, NIGHTS), 789); // 177 + 612
  assert.equal(computeTripTotal(uaF, river, NIGHTS), 754); // 142 + 612
  assert.equal(computeTripTotal(dlF, eviva, NIGHTS), 680); // 142 + 538
});

test('flightSummaryLine builds a departure→arrival + stop count label', () => {
  const nonstop = (flights as FlightOffer[])[0]; // f-as: SFO→RDM nonstop
  assert.equal(flightSummaryLine(nonstop), '7:05a SFO → 9:00a RDM · nonstop');
  const oneStop = (flights as FlightOffer[])[1]; // f-ua: 1 stop
  assert.ok(flightSummaryLine(oneStop).includes('1 stop'));
});

test('returnSummaryLine summarizes the return itinerary, or null for one-way', () => {
  // One-way offers (no itineraries[1]) return null.
  assert.equal(returnSummaryLine((flights as FlightOffer[])[0]), null);

  const roundTrip = {
    id: 'f-rt',
    airline_code: 'AS',
    airline_name: 'Alaska',
    price: '185.00',
    stops: 0,
    itineraries: [
      { direction: 'outbound', stops: 0, segments: [
        { carrier_code: 'AS', flight_number: '3361', departure_airport: 'SFO', arrival_airport: 'RDM', departure_time: '2025-08-22T16:28:00', arrival_time: '2025-08-22T18:07:00' }] },
      { direction: 'return', stops: 0, segments: [
        { carrier_code: 'AS', flight_number: '3360', departure_airport: 'RDM', arrival_airport: 'SFO', departure_time: '2025-08-26T18:47:00', arrival_time: '2025-08-26T20:33:00' }] },
    ],
  } as unknown as FlightOffer;
  assert.equal(returnSummaryLine(roundTrip), '6:47p RDM → 8:33p SFO · nonstop');

  // A connecting return leg reports its stop count from the itinerary, not the offer.
  const connectingReturn = {
    id: 'f-rt2',
    price: '200.00',
    stops: 0,
    itineraries: [
      { direction: 'outbound', stops: 0, segments: [
        { carrier_code: 'UA', flight_number: '1', departure_airport: 'SFO', arrival_airport: 'RDM', departure_time: '2025-08-22T08:00:00', arrival_time: '2025-08-22T10:00:00' }] },
      { direction: 'return', stops: 1, segments: [
        { carrier_code: 'UA', flight_number: '2', departure_airport: 'RDM', arrival_airport: 'DEN', departure_time: '2025-08-26T11:00:00', arrival_time: '2025-08-26T13:00:00' },
        { carrier_code: 'UA', flight_number: '3', departure_airport: 'DEN', arrival_airport: 'SFO', departure_time: '2025-08-26T14:00:00', arrival_time: '2025-08-26T16:00:00' }] },
    ],
  } as unknown as FlightOffer;
  assert.equal(returnSummaryLine(connectingReturn), '11:00a RDM → 4:00p SFO · 1 stop');
});

test('clockLabel handles noon, midnight, and empty input', () => {
  assert.equal(clockLabel('2025-08-22T00:00:00'), '12:00a');
  assert.equal(clockLabel('2025-08-22T12:00:00'), '12:00p');
  assert.equal(clockLabel(null), '');
  assert.equal(clockLabel(''), '');
});

test('multiCarrierSubtitle handles 3+ carriers', () => {
  assert.equal(
    multiCarrierSubtitle(['United', 'Alaska', 'Delta']),
    'Operated by United, Alaska & Delta',
  );
});

test('hotelPerNight edge: zero nights returns total', () => {
  assert.equal(hotelPerNight(600, 0), 600);
});

test('computeTripTotal handles null flight or hotel', () => {
  const hotel = { id: 'h-x', name: 'X', price: '100.00' } as HotelOffer;
  assert.equal(computeTripTotal(null, hotel, 3), 300);
  assert.equal(computeTripTotal(null, null, 3), 0);
});

test('buildChartSeries appends a Now point at the current total and labels it', () => {
  const history = [
    { created_at: '2025-08-01T00:00:00Z', flight_price: '200', hotel_price: '650' },
    { created_at: '2025-08-10T00:00:00Z', flight_price: '180', hotel_price: '620' },
  ] as never[];
  const { points, nowLabel } = buildChartSeries(history, 789, 612);
  assert.equal(points[points.length - 1].total, 789);
  assert.equal(points[points.length - 1].hotel, 612);
  assert.equal(nowLabel, 'Now $789');
  // point labels are parsed to "Aug 1" and "Aug 10"
  assert.equal(points[0].label, 'Aug 1');
  assert.equal(points[1].label, 'Aug 10');
});

test('buildChartSeries deduplicates same-day snapshots, keeping the cheapest', () => {
  const history = [
    { created_at: '2025-08-01T00:00:00Z', flight_price: '200', hotel_price: '650' },
    { created_at: '2025-08-01T12:00:00Z', flight_price: '150', hotel_price: '600' }, // cheaper
  ] as never[];
  const { points } = buildChartSeries(history, 700, 500);
  // one historical point (Aug 1, cheapest total 750) + Now
  assert.equal(points.length, 2);
  assert.equal(points[0].total, 750);
});

test('buildChartSeries skips snapshots without a created_at date', () => {
  const history = [
    { created_at: '', flight_price: '200', hotel_price: '650' }, // skipped
    { created_at: '2025-08-05T00:00:00Z', flight_price: '180', hotel_price: '620' },
  ] as never[];
  const { points } = buildChartSeries(history, 789, 612);
  // only 1 historical point + Now
  assert.equal(points.length, 2);
});

test('makeIdempotencyKey returns a non-empty string and two calls differ (default crypto branch)', () => {
  const a = makeIdempotencyKey();
  const b = makeIdempotencyKey();
  assert.equal(typeof a, 'string');
  assert.ok(a.length > 0);
  assert.notEqual(a, b);
});

test('makeIdempotencyKey uses the injected rand (fallback branch) and stays unique', () => {
  let n = 0;
  const rand = (): string => `r${(n += 1)}`;
  const a = makeIdempotencyKey(rand);
  const b = makeIdempotencyKey(rand);
  assert.equal(a, 'r1');
  assert.equal(b, 'r2');
  assert.notEqual(a, b);
  assert.ok(a.length > 0);
});

test('makeIdempotencyKey falls back to timestamp+random when crypto is absent', () => {
  // `crypto` is a getter-only global in Node, so swap its descriptor (save + restore).
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    // (1) crypto entirely absent -> timestamp fallback
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const a = makeIdempotencyKey();
    const b = makeIdempotencyKey();
    assert.equal(typeof a, 'string');
    assert.ok(a.length > 0);
    assert.notEqual(a, b);

    // (2) crypto present but randomUUID is not a function -> still timestamp fallback
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      configurable: true,
      writable: true,
    });
    const c = makeIdempotencyKey();
    assert.equal(typeof c, 'string');
    assert.ok(c.length > 0);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'crypto', saved);
  }
});

test('buildChartSeries gracefully handles malformed date keys (dayLabel fallback)', () => {
  // Snapshot where created_at produces a non-parseable date segment — dayLabel falls back to raw string
  const history = [
    { created_at: 'BADDATE', flight_price: '100', hotel_price: '400' },
  ] as never[];
  // "BADDATE".slice(0,10) = "BADDATE" — but the key lookup will be an empty string, which is filtered; no crash
  const { points } = buildChartSeries(history, 500, 400);
  // The BADDATE key's slice(0,10) = 'BADDATE' which has no '-' so mo/dom are undefined → MONTHS[NaN-1] = undefined → dayLabel returns raw 'BADDATE'
  // expect only the Now point
  assert.equal(points.length, 2); // BADDATE + Now (dayLabel returns fallback 'BADDATE')
});
