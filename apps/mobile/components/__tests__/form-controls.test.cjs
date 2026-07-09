require('./_setup-rn-mocks.cjs');

const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const TestRenderer = require('react-test-renderer');

const { ThemeProvider } = require('../../lib/theme/index.tsx');
const { DateField } = require('../aurora/date-field.tsx');
const { AirportField } = require('../aurora/airport-field.tsx');
const { SelectField } = require('../aurora/select-field.tsx');

function render(node) {
  let r;
  TestRenderer.act(() => {
    r = TestRenderer.create(React.createElement(ThemeProvider, null, node));
  });
  return r;
}
function byTestId(r, testID) {
  const found = r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === testID);
  assert.ok(found.length > 0, `no host element with testID ${testID}`);
  return found[0];
}
function texts(r) {
  return r.root
    .findAllByType('rn-text')
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children));
}

describe('DateField', () => {
  const props = {
    label: 'Depart',
    value: '2026-08-22',
    minDate: '2026-08-10',
    maxDate: '2026-09-10',
    testID: 'df',
  };

  it('shows the formatted value and the visible month', () => {
    const r = render(React.createElement(DateField, { ...props, onChange: () => {} }));
    const rendered = texts(r);
    assert.ok(rendered.includes('Aug 22, 2026'));
    assert.ok(rendered.includes('August 2026'));
  });

  it('shows the placeholder when empty', () => {
    const r = render(
      React.createElement(DateField, { ...props, value: '', placeholder: 'Select date', onChange: () => {} }),
    );
    assert.ok(texts(r).includes('Select date'));
  });

  it('selects an in-range day as YYYY-MM-DD', () => {
    const onChange = mock.fn();
    const r = render(React.createElement(DateField, { ...props, onChange }));
    TestRenderer.act(() => byTestId(r, 'df-day-25').props.onPress());
    assert.equal(onChange.mock.callCount(), 1);
    assert.equal(onChange.mock.calls[0].arguments[0], '2026-08-25');
  });

  it('ignores presses on days outside [minDate, maxDate]', () => {
    const onChange = mock.fn();
    const r = render(React.createElement(DateField, { ...props, onChange }));
    // Aug 5 is before the Aug 10 floor.
    TestRenderer.act(() => byTestId(r, 'df-day-5').props.onPress());
    assert.equal(onChange.mock.callCount(), 0);
  });

  it('steps months forward but not past the range', () => {
    const r = render(React.createElement(DateField, { ...props, onChange: () => {} }));
    TestRenderer.act(() => byTestId(r, 'df-next-month').props.onPress());
    assert.ok(texts(r).includes('September 2026'));
    // October is entirely after maxDate, so next is now a no-op.
    TestRenderer.act(() => byTestId(r, 'df-next-month').props.onPress());
    assert.ok(texts(r).includes('September 2026'));
    // Back to August, then July is entirely before minDate — another no-op.
    TestRenderer.act(() => byTestId(r, 'df-prev-month').props.onPress());
    TestRenderer.act(() => byTestId(r, 'df-prev-month').props.onPress());
    assert.ok(texts(r).includes('August 2026'));
  });
});

describe('AirportField', () => {
  it('suggests airports once two characters are typed and fills the code on pick', () => {
    let value = '';
    const onChangeText = mock.fn((v) => {
      value = v;
    });
    const r = render(
      React.createElement(AirportField, { label: 'From', value, onChangeText, testID: 'af' }),
    );
    TestRenderer.act(() => byTestId(r, 'af').props.onChangeText('sea'));
    const option = byTestId(r, 'af-option-SEA');
    TestRenderer.act(() => option.props.onPressIn());
    const calls = onChangeText.mock.calls.map((c) => c.arguments[0]);
    assert.deepEqual(calls, ['sea', 'SEA']);
  });

  it('shows no suggestions for short queries', () => {
    const r = render(
      React.createElement(AirportField, { label: 'From', value: '', onChangeText: () => {}, testID: 'af' }),
    );
    TestRenderer.act(() => byTestId(r, 'af').props.onChangeText('s'));
    const dropdowns = r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'af-suggestions');
    assert.equal(dropdowns.length, 0);
  });
});

describe('SelectField', () => {
  const options = [
    { value: '1', label: '1 Adult' },
    { value: '2', label: '2 Adults' },
    { value: '3', label: '3 Adults' },
  ];

  it('shows the selected label and fires onChange for a tapped option', () => {
    const onChange = mock.fn();
    const r = render(
      React.createElement(SelectField, { label: 'Adults', value: '2', options, onChange, testID: 'sf' }),
    );
    assert.ok(texts(r).includes('2 Adults'));
    TestRenderer.act(() => byTestId(r, 'sf-option-3').props.onPress());
    assert.equal(onChange.mock.callCount(), 1);
    assert.equal(onChange.mock.calls[0].arguments[0], '3');
  });
});
