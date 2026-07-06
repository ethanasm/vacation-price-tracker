import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestSessionRefresh } from '../refresh';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('posts the refresh token and returns the new pair', async () => {
  let seenUrl = '';
  let seenBody = '';
  const result = await requestSessionRefresh({
    apiUrl: 'https://api.test/',
    refreshToken: 'old-refresh',
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      seenBody = String(init?.body);
      return jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' });
    },
  });
  assert.equal(seenUrl, 'https://api.test/v1/auth/refresh');
  assert.deepEqual(JSON.parse(seenBody), { refresh_token: 'old-refresh' });
  assert.deepEqual(result, { ok: true, accessToken: 'new-access', refreshToken: 'new-refresh' });
});

test('401 and 403 are definitive: sessionExpired is true', async () => {
  for (const status of [401, 403]) {
    const result = await requestSessionRefresh({
      apiUrl: 'https://api.test',
      refreshToken: 'old-refresh',
      fetchImpl: async () => jsonResponse({ detail: 'rotated' }, status),
    });
    assert.deepEqual(result, { ok: false, sessionExpired: true });
  }
});

test('5xx is transient: sessionExpired is false', async () => {
  const result = await requestSessionRefresh({
    apiUrl: 'https://api.test',
    refreshToken: 'old-refresh',
    fetchImpl: async () => jsonResponse({ detail: 'boom' }, 503),
  });
  assert.deepEqual(result, { ok: false, sessionExpired: false });
});

test('a network error is transient: sessionExpired is false', async () => {
  const result = await requestSessionRefresh({
    apiUrl: 'https://api.test',
    refreshToken: 'old-refresh',
    fetchImpl: async () => {
      throw new TypeError('Network request failed');
    },
  });
  assert.deepEqual(result, { ok: false, sessionExpired: false });
});

test('a malformed success body is transient', async () => {
  for (const body of [{}, { access_token: 'a' }, { refresh_token: 'r' }]) {
    const result = await requestSessionRefresh({
      apiUrl: 'https://api.test',
      refreshToken: 'old-refresh',
      fetchImpl: async () => jsonResponse(body),
    });
    assert.deepEqual(result, { ok: false, sessionExpired: false });
  }
});

test('a non-JSON success body is transient', async () => {
  const result = await requestSessionRefresh({
    apiUrl: 'https://api.test',
    refreshToken: 'old-refresh',
    fetchImpl: async () =>
      new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }),
  });
  assert.deepEqual(result, { ok: false, sessionExpired: false });
});
