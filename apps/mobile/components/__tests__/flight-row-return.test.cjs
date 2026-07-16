require('./_setup-rn-mocks.cjs');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const TestRenderer = require('react-test-renderer');
const { ThemeProvider } = require('../../lib/theme/index.tsx');
const { FlightRow } = require('../aurora/flight-row.tsx');

// fast-flights round-trip offer: outbound itinerary only, price is the
// round-trip total, return leg not itemized by the provider.
const roundTripTotalOffer = {
  id: 'f-ff',
  airline_code: 'AS',
  airline_name: 'Alaska',
  price: '1585.00',
  stops: 0,
  round_trip_total: true,
  departure_time: '2026-12-11T08:23:00',
  arrival_time: '2026-12-11T11:48:00',
  itineraries: [
    {
      direction: 'outbound',
      stops: 0,
      segments: [
        {
          carrier_code: 'AS',
          flight_number: null,
          departure_airport: 'SFO',
          arrival_airport: 'OGG',
          departure_time: '2026-12-11T08:23:00',
          arrival_time: '2026-12-11T11:48:00',
          duration_minutes: 325,
        },
      ],
    },
  ],
};

// Kiwi-style offer with a real, itemized return leg.
const itemizedReturnOffer = {
  ...roundTripTotalOffer,
  id: 'f-kiwi',
  round_trip_total: false,
  itineraries: [
    roundTripTotalOffer.itineraries[0],
    {
      direction: 'return',
      stops: 0,
      segments: [
        {
          carrier_code: 'AS',
          flight_number: 'AS121',
          departure_airport: 'OGG',
          arrival_airport: 'SFO',
          departure_time: '2026-12-18T12:30:00',
          arrival_time: '2026-12-18T19:40:00',
          duration_minutes: 310,
        },
      ],
    },
  ],
};

function render(offer, expanded) {
  let r;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(FlightRow, {
          offer,
          nights: 7,
          selected: false,
          expanded,
          onPress: () => undefined,
        }),
      ),
    );
  });
  return r;
}

function texts(r) {
  return r.root
    .findAllByType('rn-text')
    .map((n) => n.props.children)
    .flat()
    .map(String);
}

describe('FlightRow round-trip-total (return not itemized)', () => {
  it('collapsed row says the return is included in the price', () => {
    const labels = texts(render(roundTripTotalOffer, false));
    assert.ok(labels.includes('Return · included in price'));
  });

  it('expanded detail renders a RETURN note instead of silence', () => {
    const r = render(roundTripTotalOffer, true);
    const note = r.root.findAll(
      (n) => n.type === 'rn-view' && n.props && n.props.testID === 'flight-return-included-f-ff',
    );
    assert.equal(note.length, 1);
    const labels = texts(r);
    assert.ok(labels.some((t) => t.includes('Included in the round-trip price')));
  });

  it('an itemized return leg renders normally with no included-note', () => {
    const r = render(itemizedReturnOffer, true);
    const labels = texts(r);
    assert.ok(labels.some((t) => t.includes('Return · ')));
    assert.ok(!labels.includes('Return · included in price'));
    assert.equal(
      r.root.findAll(
        (n) =>
          n.type === 'rn-view' &&
          n.props &&
          typeof n.props.testID === 'string' &&
          n.props.testID.startsWith('flight-return-included-'),
      ).length,
      0,
    );
    // Real RETURN heading present from the leg itself.
    assert.ok(labels.includes('RETURN'));
  });

  it('a plain one-way offer shows neither return line nor note', () => {
    const oneWay = { ...roundTripTotalOffer, id: 'f-ow', round_trip_total: false };
    const labels = texts(render(oneWay, true));
    assert.ok(!labels.includes('Return · included in price'));
    assert.ok(!labels.includes('RETURN'));
  });
});
