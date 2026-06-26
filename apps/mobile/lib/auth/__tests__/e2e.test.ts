import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildE2ESession } from '../e2e';

const TOKEN = 'minted-e2e-jwt';
const USER_JSON = '{"id":"3194b3c0-5b18-4204-9d7a-e2a9191e5148","email":"e2e@vpt.test"}';

test('builds a session from the inlined token + user json when mode is on', () => {
  const session = buildE2ESession({ mode: '1', token: TOKEN, userJson: USER_JSON });
  assert.ok(session);
  assert.equal(session.accessToken, TOKEN);
  // No refresh token in the e2e env — the access token is reused as a placeholder.
  assert.equal(session.refreshToken, TOKEN);
  assert.equal(session.user.id, '3194b3c0-5b18-4204-9d7a-e2a9191e5148');
  assert.equal(session.user.email, 'e2e@vpt.test');
  // Defaulted because the mint step omits it.
  assert.equal(session.user.email_notifications_enabled, false);
});

test('honours email_notifications_enabled when present in the user json', () => {
  const session = buildE2ESession({
    mode: '1',
    token: TOKEN,
    userJson: '{"id":"u1","email":"a@b.com","email_notifications_enabled":true}',
  });
  assert.ok(session);
  assert.equal(session.user.email_notifications_enabled, true);
});

test('returns null when the bypass is inactive', () => {
  assert.equal(buildE2ESession({ mode: undefined, token: TOKEN, userJson: USER_JSON }), null);
  assert.equal(buildE2ESession({ mode: '0', token: TOKEN, userJson: USER_JSON }), null);
});

test('returns null when the token is missing or empty', () => {
  assert.equal(buildE2ESession({ mode: '1', token: undefined, userJson: USER_JSON }), null);
  assert.equal(buildE2ESession({ mode: '1', token: '', userJson: USER_JSON }), null);
});

test('returns null when the user json is missing, malformed, or incomplete', () => {
  assert.equal(buildE2ESession({ mode: '1', token: TOKEN, userJson: undefined }), null);
  assert.equal(buildE2ESession({ mode: '1', token: TOKEN, userJson: 'not-json' }), null);
  assert.equal(buildE2ESession({ mode: '1', token: TOKEN, userJson: 'null' }), null);
  assert.equal(buildE2ESession({ mode: '1', token: TOKEN, userJson: '{"email":"a@b.com"}' }), null);
  assert.equal(buildE2ESession({ mode: '1', token: TOKEN, userJson: '{"id":"u1"}' }), null);
  assert.equal(buildE2ESession({ mode: '1', token: TOKEN, userJson: '{"id":"","email":"a@b.com"}' }), null);
});
