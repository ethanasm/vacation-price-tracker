require('./_setup-rn-mocks.cjs');

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const TestRenderer = require('react-test-renderer');

const { ThemeProvider } = require('../../lib/theme/index.tsx');
const { StatusChip } = require('../aurora/status-chip.tsx');
const { AirlineChip, AirlineChipPair } = require('../aurora/airline-chip.tsx');
const { GradientButton } = require('../aurora/gradient-button.tsx');
const { SegmentedControl } = require('../aurora/segmented-control.tsx');

function render(node) {
  let r;
  TestRenderer.act(() => {
    r = TestRenderer.create(React.createElement(ThemeProvider, null, node));
  });
  return r;
}
function texts(r) {
  return r.root.findAllByType('rn-text').map((n) => n.props.children);
}

describe('StatusChip', () => {
  it('renders the label for each tone', () => {
    const r = render(React.createElement(StatusChip, { tone: 'active', label: 'ACTIVE' }));
    assert.ok(texts(r).includes('ACTIVE'));
  });
});

describe('AirlineChipPair', () => {
  it('renders two logo chips for a multi-carrier flight', () => {
    const r = render(React.createElement(AirlineChipPair, { codes: ['UA', 'AS'] }));
    const uris = r.root.findAllByType('rn-image').map((n) => n.props.source?.uri);
    assert.deepEqual(uris, [
      'https://images.kiwi.com/airlines/64x64/UA.png',
      'https://images.kiwi.com/airlines/64x64/AS.png',
    ]);
  });
  it('AirlineChip renders the corpus carrier logo', () => {
    const r = render(React.createElement(AirlineChip, { code: 'DL' }));
    const imgs = r.root.findAllByType('rn-image');
    assert.equal(imgs.length, 1);
    assert.equal(imgs[0].props.source.uri, 'https://images.kiwi.com/airlines/64x64/DL.png');
  });
  it('AirlineChip falls back to the monogram when the logo image errors', () => {
    const r = render(React.createElement(AirlineChip, { code: 'DL' }));
    const img = r.root.findAllByType('rn-image')[0];
    TestRenderer.act(() => img.props.onError());
    assert.equal(r.root.findAllByType('rn-image').length, 0);
    assert.ok(texts(r).includes('DL'));
  });
  it('AirlineChip renders the monogram for a carrier outside the logo corpus', () => {
    const r = render(React.createElement(AirlineChip, { code: 'ZZ' }));
    assert.equal(r.root.findAllByType('rn-image').length, 0);
    assert.ok(texts(r).includes('ZZ'));
  });
});

describe('GradientButton', () => {
  it('fires onPress', () => {
    const onPress = mock.fn();
    const r = render(React.createElement(GradientButton, { label: 'Create trip', onPress }));
    const btn = r.root.findAllByType('rn-pressable')[0];
    TestRenderer.act(() => btn.props.onPress?.());
    assert.equal(onPress.mock.callCount(), 1);
  });
});

describe('SegmentedControl', () => {
  it('fires onChange for the tapped segment', () => {
    const onChange = mock.fn();
    const r = render(
      React.createElement(SegmentedControl, {
        options: [{ value: 'trips', label: 'Trips' }, { value: 'chat', label: 'Assistant' }],
        value: 'trips',
        onChange,
      }),
    );
    const pressables = r.root.findAllByType('rn-pressable');
    TestRenderer.act(() => pressables[1].props.onPress?.());
    assert.equal(onChange.mock.callCount(), 1);
    assert.equal(onChange.mock.calls[0].arguments[0], 'chat');
  });
});
