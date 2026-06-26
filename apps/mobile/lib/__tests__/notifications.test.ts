import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPriceDropNotification } from '../notifications';

test('builds the price-drop notification content matching the handoff copy', () => {
  const n = buildPriceDropNotification({ tripName: 'Test 2', threshold: 750, total: 724, tripId: 't1' });
  assert.equal(n.title, '📉 Test 2 just dropped below $750');
  assert.equal(n.body, 'Now $724 total — tap to view the trip.');
  assert.deepEqual(n.data, { tripId: 't1' });
});

test('omits the threshold phrasing when no threshold is set', () => {
  const n = buildPriceDropNotification({ tripName: 'Maui', threshold: null, total: 1800, tripId: 't2' });
  assert.equal(n.title, '📉 Maui price drop');
  assert.equal(n.body, 'Now $1,800 total — tap to view the trip.');
});
