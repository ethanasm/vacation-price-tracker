import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exchangeGoogleIdTokenForSession } from '../exchange';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const okBody = {
  access_token: 'access-jwt',
  refresh_token: 'refresh-jwt',
  user: { id: 'u1', email: 'a@b.com', email_notifications_enabled: true },
};

test('posts the Google id_token and returns the parsed session', async () => {
  let seenUrl = '';
  let seenBody = '';
  const session = await exchangeGoogleIdTokenForSession({
    idToken: 'google-id-token',
    apiUrl: 'https://api.test',
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      seenBody = String(init?.body);
      return jsonResponse(okBody);
    },
  });
  assert.equal(seenUrl, 'https://api.test/v1/auth/mobile-token');
  assert.deepEqual(JSON.parse(seenBody), { id_token: 'google-id-token' });
  assert.equal(session.accessToken, 'access-jwt');
  assert.equal(session.refreshToken, 'refresh-jwt');
  assert.equal(session.user.id, 'u1');
});

test('maps status codes to stable error messages', async () => {
  const cases: Array<[number, string]> = [
    [401, 'invalid_google_token'],
    [403, 'access_denied'],
    [429, 'rate_limited'],
    [500, 'server_error_500'],
  ];
  for (const [status, expected] of cases) {
    await assert.rejects(
      () =>
        exchangeGoogleIdTokenForSession({
          idToken: 'x',
          apiUrl: 'https://api.test',
          fetchImpl: async () => jsonResponse({ detail: 'no' }, status),
        }),
      (err: unknown) => err instanceof Error && err.message === expected,
      `status ${status} should map to ${expected}`,
    );
  }
});

test('a malformed success body throws invalid_response', async () => {
  await assert.rejects(
    () =>
      exchangeGoogleIdTokenForSession({
        idToken: 'x',
        apiUrl: 'https://api.test',
        fetchImpl: async () => jsonResponse({ access_token: 'only-this' }),
      }),
    (err: unknown) => err instanceof Error && err.message === 'invalid_response',
  );
});
