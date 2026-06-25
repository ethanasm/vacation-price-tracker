import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokens, formatUsd } from '../tokens';

test('primary violet matches the Aurora token', () => {
  assert.equal(tokens.color.primary, '#7C3AED');
  assert.equal(tokens.color.primaryDeep, '#6D28D9');
});

test('gradients are two-stop tuples usable by expo-linear-gradient', () => {
  assert.deepEqual(tokens.gradient.primary, ['#A78BFA', '#7C3AED']);
  assert.deepEqual(tokens.gradient.totalCard, ['#7C3AED', '#9333EA']);
});

test('airline monogram chips carry the original-mark gradients', () => {
  assert.deepEqual(tokens.airline.AS.colors, ['#10617F', '#093247']);
  assert.deepEqual(tokens.airline.UA.colors, ['#2456C9', '#13357F']);
  assert.deepEqual(tokens.airline.DL.colors, ['#C8102E', '#7A0A1C']);
});

test('Manrope weights 400-800 are registered', () => {
  for (const w of [400, 500, 600, 700, 800] as const) {
    assert.equal(typeof tokens.font[w], 'string');
    assert.ok(tokens.font[w].length > 0);
  }
});

test('formatUsd renders the verified behavioral totals without decimals', () => {
  assert.equal(formatUsd(789), '$789');
  assert.equal(formatUsd(754), '$754');
  assert.equal(formatUsd(680), '$680');
  assert.equal(formatUsd(1838), '$1,838');
});

test('tokens object is frozen so screens cannot mutate the shared source', () => {
  assert.ok(Object.isFrozen(tokens));
  assert.ok(Object.isFrozen(tokens.color));
});
