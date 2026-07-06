import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../client';
import { ApiError, AuthError, NetworkError } from '../errors';
import { configureTelemetry } from '../../telemetry';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// The client reports failed ops through lib/telemetry; stub its transport so
// error-path tests never touch the network, and capture what was reported.
const reportedEvents: { event: string; level: string; context?: Record<string, unknown> }[] = [];
beforeEach(() => {
  reportedEvents.length = 0;
  configureTelemetry({
    fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      reportedEvents.push(JSON.parse(String(init?.body)));
      return new Response('{"ok":true}');
    }) as typeof fetch,
  });
});

test('listTrips unwraps the {data} envelope and attaches the bearer token', async () => {
  let seenAuth: string | null = null;
  let seenUrl = '';
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt-123',
    refresh: async () => true,
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      seenAuth = new Headers(init?.headers).get('authorization');
      return jsonResponse({ data: [{ id: 't1', name: 'Maui' }], meta: { total: 1 } });
    },
  });
  const trips = await client.listTrips();
  assert.equal(seenUrl, 'https://api.test/v1/trips?page=1&limit=20');
  assert.equal(seenAuth, 'Bearer jwt-123');
  assert.equal(trips.length, 1);
  assert.equal(trips[0].id, 't1');
});

test('a 401 triggers refresh then a single retry of the original request', async () => {
  const calls: number[] = [];
  let refreshed = false;
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => (refreshed ? 'jwt-new' : 'jwt-old'),
    refresh: async () => {
      refreshed = true;
      return true;
    },
    fetchImpl: async (_url, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      calls.push(1);
      if (auth === 'Bearer jwt-old') return jsonResponse({ detail: 'expired' }, 401);
      return jsonResponse({ data: [], meta: { total: 0 } });
    },
  });
  const trips = await client.listTrips();
  assert.equal(calls.length, 2); // original 401 + retry
  assert.deepEqual(trips, []);
});

test('a 401 with a failing refresh throws AuthError', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt-old',
    refresh: async () => false,
    fetchImpl: async () => jsonResponse({ detail: 'expired' }, 401),
  });
  await assert.rejects(() => client.listTrips(), (err: unknown) => err instanceof AuthError);
});

test('a non-401 error surfaces as ApiError carrying status + detail', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt',
    refresh: async () => true,
    fetchImpl: async () => jsonResponse({ detail: 'Trip not found', title: 'Not found' }, 404),
  });
  await assert.rejects(
    () => client.getTrip('missing'),
    (err: unknown) => err instanceof ApiError && (err as ApiError).status === 404,
  );
});

test('failed requests report telemetry: 4xx at warn, 5xx at error, network as network_error', async () => {
  const failing = (status: number) =>
    createApiClient({
      baseUrl: 'https://api.test',
      getToken: () => 'jwt',
      refresh: async () => true,
      fetchImpl: async () => jsonResponse({ title: 'nope' }, status),
    });

  await assert.rejects(() => failing(404).getTrip('t1'));
  assert.equal(reportedEvents.at(-1)?.event, 'api.request.failed');
  assert.equal(reportedEvents.at(-1)?.level, 'warn');
  assert.equal(reportedEvents.at(-1)?.context?.status, 404);

  await assert.rejects(() => failing(503).listTrips());
  assert.equal(reportedEvents.at(-1)?.event, 'api.request.failed');
  assert.equal(reportedEvents.at(-1)?.level, 'error');

  const offline = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt',
    refresh: async () => true,
    fetchImpl: async () => {
      throw new TypeError('Network request failed');
    },
  });
  await assert.rejects(() => offline.listTrips(), NetworkError);
  assert.equal(reportedEvents.at(-1)?.event, 'api.network_error');
});

test('an expired session (401 + failed refresh) reports api.auth_expired at warn', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt-old',
    refresh: async () => false,
    fetchImpl: async () => jsonResponse({ detail: 'expired' }, 401),
  });
  await assert.rejects(() => client.listTrips(), AuthError);
  assert.equal(reportedEvents.at(-1)?.event, 'api.auth_expired');
  assert.equal(reportedEvents.at(-1)?.level, 'warn');
});

test('createTrip sends the X-Idempotency-Key header and POST body', async () => {
  let seenKey: string | null = null;
  let seenMethod = '';
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt',
    refresh: async () => true,
    fetchImpl: async (_url, init) => {
      seenKey = new Headers(init?.headers).get('x-idempotency-key');
      seenMethod = init?.method ?? 'GET';
      return jsonResponse({ data: { id: 'new-trip', name: 'Tokyo' } }, 201);
    },
  });
  const trip = await client.createTrip(
    { name: 'Tokyo' } as never,
    'idem-key-abc',
  );
  assert.equal(seenMethod, 'POST');
  assert.equal(seenKey, 'idem-key-abc');
  assert.equal((trip as { id: string }).id, 'new-trip');
});

test('a transport failure surfaces as NetworkError, not AuthError', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt',
    refresh: async () => true,
    fetchImpl: async () => {
      throw new TypeError('Network request failed');
    },
  });
  await assert.rejects(
    () => client.listTrips(),
    (err: unknown) => err instanceof NetworkError && !(err instanceof AuthError),
  );
});

test('concurrent 401s coalesce into a single refresh (single-flight)', async () => {
  let refreshCalls = 0;
  let refreshed = false;
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => (refreshed ? 'jwt-new' : 'jwt-old'),
    refresh: async () => {
      refreshCalls += 1;
      // Simulate async rotation so both in-flight requests overlap on it.
      await new Promise((r) => setTimeout(r, 5));
      refreshed = true;
      return true;
    },
    fetchImpl: async (_url, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      if (auth === 'Bearer jwt-old') return jsonResponse({ detail: 'expired' }, 401);
      return jsonResponse({ data: [], meta: { total: 0 } });
    },
  });
  // Fire two requests at once; both get 401 and must share ONE refresh.
  await Promise.all([client.listTrips(), client.getTrip('t1')]);
  assert.equal(refreshCalls, 1);
});
