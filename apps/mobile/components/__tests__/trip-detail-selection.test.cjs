require('./_setup-rn-mocks.cjs');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const { ThemeProvider, formatUsd } = require('../../lib/theme/index.tsx');
const aurora = require('../../lib/aurora.ts');
const { FlightRow } = require('../aurora/flight-row.tsx');
const { HotelRow } = require('../aurora/hotel-row.tsx');

// Same fixture as lib/__tests__/aurora.test.ts: AS $177 nonstop, UA $142 1-stop
// (UA+AS legs via DEN), DL $142 nonstop; hotels Riverhouse $153/night, Eviva
// $134.50/night, nights = 4. Verified totals: AS+Riverhouse 789, UA+Riverhouse
// 754, DL+Eviva 680.
const flights = [
  {
    id: 'f-as',
    airline_code: 'AS',
    airline_name: 'Alaska',
    price: '177.00',
    stops: 0,
    departure_time: '2025-08-22T07:05:00',
    arrival_time: '2025-08-22T09:00:00',
    itineraries: [
      {
        direction: 'outbound',
        stops: 0,
        segments: [
          {
            carrier_code: 'AS',
            flight_number: '120',
            departure_airport: 'SFO',
            arrival_airport: 'RDM',
            departure_time: '2025-08-22T07:05:00',
            arrival_time: '2025-08-22T09:00:00',
          },
        ],
      },
    ],
  },
  {
    id: 'f-ua',
    airline_code: 'UA',
    airline_name: 'United',
    price: '142.00',
    stops: 1,
    itineraries: [
      {
        direction: 'outbound',
        stops: 1,
        segments: [
          {
            carrier_code: 'UA',
            flight_number: '508',
            departure_airport: 'SFO',
            arrival_airport: 'DEN',
            departure_time: '2025-08-22T06:00:00',
            arrival_time: '2025-08-22T09:30:00',
            duration_minutes: 150,
          },
          {
            carrier_code: 'AS',
            flight_number: '2201',
            departure_airport: 'DEN',
            arrival_airport: 'RDM',
            departure_time: '2025-08-22T10:40:00',
            arrival_time: '2025-08-22T12:10:00',
          },
        ],
      },
    ],
  },
  {
    id: 'f-dl',
    airline_code: 'DL',
    airline_name: 'Delta',
    price: '142.00',
    stops: 0,
    itineraries: [
      {
        direction: 'outbound',
        stops: 0,
        segments: [
          {
            carrier_code: 'DL',
            flight_number: '900',
            departure_airport: 'SFO',
            arrival_airport: 'RDM',
            departure_time: '2025-08-22T08:00:00',
            arrival_time: '2025-08-22T10:00:00',
          },
        ],
      },
    ],
  },
];
const hotels = [
  { id: 'h-river', name: 'Riverhouse', price: '153.00', rating: 4 },
  { id: 'h-eviva', name: 'Eviva', price: '134.50', rating: 3 },
];
const NIGHTS = 4;

// Holder the test mutates to reach the live dispatch from outside the tree.
const handle = { dispatch: null };

function Harness() {
  const [sel, dispatch] = React.useReducer(
    aurora.selectReducer,
    aurora.initialSelection(flights, hotels),
  );
  React.useEffect(() => {
    handle.dispatch = dispatch;
  }, [dispatch]);
  const f = flights.find((x) => x.id === sel.selectedFlightId) ?? null;
  const h = hotels.find((x) => x.id === sel.selectedHotelId) ?? null;
  const total = aurora.computeTripTotal(f, h, NIGHTS);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('rn-text', { testID: 'trip-detail-total-stat' }, formatUsd(total)),
    ...flights.map((fl) =>
      React.createElement(FlightRow, {
        key: fl.id,
        offer: fl,
        nights: NIGHTS,
        selected: sel.selectedFlightId === fl.id,
        expanded: sel.expandedFlightId === fl.id,
        onPress: () => dispatch({ kind: 'flight', id: fl.id }),
      }),
    ),
    ...hotels.map((ho) =>
      React.createElement(HotelRow, {
        key: ho.id,
        offer: ho,
        nights: NIGHTS,
        selected: sel.selectedHotelId === ho.id,
        expanded: sel.expandedHotelId === ho.id,
        onPress: () => dispatch({ kind: 'hotel', id: ho.id }),
      }),
    ),
  );
}

function totalText(r) {
  return r.root.findAll((n) => n.props && n.props.testID === 'trip-detail-total-stat')[0].props
    .children;
}

describe('Trip detail selection → total', () => {
  it('reproduces 789 / 754 / 680 by selection through the real rows', () => {
    let r;
    TestRenderer.act(() => {
      r = TestRenderer.create(
        React.createElement(ThemeProvider, null, React.createElement(Harness)),
      );
    });
    // Initial selection: cheapest flight (UA, first $142) + cheapest hotel (Eviva
    // $134.50) → 142 + 538 = 680.
    assert.equal(totalText(r), '$680');

    TestRenderer.act(() => {
      handle.dispatch({ kind: 'flight', id: 'f-as' });
      handle.dispatch({ kind: 'hotel', id: 'h-river' });
    });
    assert.equal(totalText(r), '$789'); // 177 + 612

    TestRenderer.act(() => {
      handle.dispatch({ kind: 'flight', id: 'f-ua' });
    });
    assert.equal(totalText(r), '$754'); // 142 + 612

    TestRenderer.act(() => {
      handle.dispatch({ kind: 'flight', id: 'f-dl' });
      handle.dispatch({ kind: 'hotel', id: 'h-eviva' });
    });
    assert.equal(totalText(r), '$680'); // 142 + 538
  });

  it('expands exactly one flight row at a time (Alaska → United)', () => {
    let r;
    TestRenderer.act(() => {
      r = TestRenderer.create(
        React.createElement(ThemeProvider, null, React.createElement(Harness)),
      );
    });
    TestRenderer.act(() => {
      handle.dispatch({ kind: 'flight', id: 'f-as' });
    });
    TestRenderer.act(() => {
      handle.dispatch({ kind: 'flight', id: 'f-ua' });
    });
    // The expanded detail block carries testID 'flight-detail-*'; only United's
    // is present (one-expanded-at-a-time).
    const details = r.root.findAll(
      (n) =>
        n.type === 'rn-view' &&
        n.props &&
        typeof n.props.testID === 'string' &&
        n.props.testID.startsWith('flight-detail-'),
    );
    assert.equal(details.length, 1);
    assert.equal(details[0].props.testID, 'flight-detail-f-ua');

    // The selected flight row reports accessibilityState.selected = true on UA.
    const uaRow = r.root.findAll((n) => n.props && n.props.testID === 'flight-option-f-ua')[0];
    assert.equal(uaRow.props.accessibilityState.selected, true);
    const asRow = r.root.findAll((n) => n.props && n.props.testID === 'flight-option-f-as')[0];
    assert.equal(asRow.props.accessibilityState.selected, false);
  });
});
