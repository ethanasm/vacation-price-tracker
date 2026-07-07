require('./_setup-rn-mocks.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const TestRenderer = require('react-test-renderer');

const { ThemeProvider } = require('../../lib/theme/index.tsx');
const { PriceChart } = require('../aurora/price-chart.tsx');

function render(node) {
  let r;
  TestRenderer.act(() => {
    r = TestRenderer.create(React.createElement(ThemeProvider, null, node));
  });
  // The SVG renders only once the container reports a width.
  const measured = r.root.findAll((n) => n.type === 'rn-view' && typeof n.props.onLayout === 'function');
  TestRenderer.act(() => {
    measured[0].props.onLayout({ nativeEvent: { layout: { width: 320 } } });
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
function paths(r) {
  return r.root.findAllByType('svg-path').filter((p) => p.props.stroke);
}

// Two days + Now; selected pairing quoted both days.
const points = [
  { label: 'Jul 6', total: 185, hotel: 0, minFlight: 185, selectedFlight: 263 },
  { label: 'Jul 7', total: 262, hotel: 0, minFlight: 262, selectedFlight: 262 },
  { label: 'Now', total: 262, hotel: 0, minFlight: 262, selectedFlight: 262 },
];

describe('PriceChart (flights-only)', () => {
  const el = React.createElement(PriceChart, {
    points,
    nowLabel: 'Now $262',
    showHotel: false,
    selectedFlightLabel: 'UA670 / UA702',
  });

  it('draws the flight-min and selected-flight lines but no total/hotel series', () => {
    const r = render(el);
    // dashed flight-min + solid selected flight = exactly 2 stroked paths
    const stroked = paths(r);
    assert.equal(stroked.length, 2);
    assert.equal(stroked.filter((p) => p.props.strokeDasharray).length, 1);
  });

  it('names the visible series in the legend, and skips hotel entries', () => {
    const labels = texts(render(el));
    assert.ok(labels.includes('Flight (min)'));
    assert.ok(labels.includes('UA670 / UA702'));
    assert.ok(!labels.includes('Total'));
    assert.ok(!labels.includes('Hotel (min)'));
  });

  it('scales the y-axis to the data instead of the fixed $0–$1000 window', () => {
    const labels = texts(render(el));
    assert.ok(labels.includes('$300'));
    assert.ok(!labels.includes('$1,000'));
  });

  it('labels the x extent and shows the Now badge', () => {
    const labels = texts(render(el));
    assert.ok(labels.includes('Jul 6'));
    assert.ok(labels.includes('Now'));
    assert.ok(labels.includes('Now $262'));
  });
});

describe('PriceChart (flights-only, no selection)', () => {
  const bare = points.map(({ selectedFlight, ...p }) => p);
  const el = React.createElement(PriceChart, {
    points: bare,
    nowLabel: 'Now $262',
    showHotel: false,
  });

  it('draws the flight minimum once (solid hero), not doubled with a dashed twin', () => {
    const stroked = paths(render(el));
    assert.equal(stroked.length, 1);
    assert.equal(stroked.filter((p) => p.props.strokeDasharray).length, 0);
  });
});

describe('PriceChart (hotel-tracking)', () => {
  const hotelPoints = points.map((p) => ({
    ...p,
    hotel: 400,
    total: p.minFlight + 400,
    selectedHotel: 450,
  }));
  const el = React.createElement(PriceChart, {
    points: hotelPoints,
    nowLabel: 'Now $712',
    showHotel: true,
    selectedFlightLabel: 'UA670 / UA702',
    selectedHotelLabel: 'Riverhouse',
  });

  it('draws total, flight pair, and hotel pair series', () => {
    const stroked = paths(render(el));
    // total + minFlight + selectedFlight + minHotel + selectedHotel
    assert.equal(stroked.length, 5);
    assert.equal(stroked.filter((p) => p.props.strokeDasharray).length, 2);
  });

  it('legend includes Total and both hotel entries', () => {
    const labels = texts(render(el));
    assert.ok(labels.includes('Total'));
    assert.ok(labels.includes('Hotel (min)'));
    assert.ok(labels.includes('Riverhouse'));
  });
});
