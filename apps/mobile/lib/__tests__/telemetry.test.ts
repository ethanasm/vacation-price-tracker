import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { configureTelemetry, errorMessage, logClientEvent } from '../telemetry';

interface Captured {
  url: string;
  init: RequestInit;
}

function captureFetch(store: Captured[], result: () => Promise<Response>): typeof fetch {
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    store.push({ url: String(url), init: init ?? {} });
    return result();
  }) as typeof fetch;
}

afterEach(() => {
  configureTelemetry(); // reset to defaults between tests
});

test('POSTs the event to /v1/telemetry/client with platform=mobile', () => {
  const calls: Captured[] = [];
  configureTelemetry({
    baseUrl: 'https://api.test/',
    getToken: () => null,
    fetchImpl: captureFetch(calls, async () => new Response('{"ok":true}')),
  });

  logClientEvent('trip.load.failed', {
    message: 'boom',
    context: { trip_id: 't-1', status: 500 },
  });

  assert.equal(calls.length, 1);
  // Trailing slash on the base URL must not double up.
  assert.equal(calls[0].url, 'https://api.test/v1/telemetry/client');
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.event, 'trip.load.failed');
  assert.equal(body.message, 'boom');
  assert.equal(body.level, 'error'); // default
  assert.equal(body.platform, 'mobile');
  assert.deepEqual(body.context, { trip_id: 't-1', status: 500 });
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['content-type'], 'application/json');
  assert.equal(headers.authorization, undefined); // signed out → no header
});

test('attaches the bearer token when signed in and honors the warn level', () => {
  const calls: Captured[] = [];
  configureTelemetry({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt-123',
    fetchImpl: captureFetch(calls, async () => new Response('{"ok":true}')),
  });

  logClientEvent('api.auth_expired', { message: 'expired', level: 'warn' });

  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer jwt-123');
  assert.equal(JSON.parse(String(calls[0].init.body)).level, 'warn');
});

test('swallows network failures (telemetry never throws into the caller)', async () => {
  const calls: Captured[] = [];
  configureTelemetry({
    baseUrl: 'https://api.test',
    getToken: () => null,
    fetchImpl: captureFetch(calls, async () => {
      throw new Error('offline');
    }),
  });

  logClientEvent('x', { message: 'm' }); // must not throw
  assert.equal(calls.length, 1);
  // Let the rejected promise settle so an unhandled rejection would surface.
  await new Promise((resolve) => setImmediate(resolve));
});

test('swallows synchronous failures (e.g. a token getter that throws)', () => {
  configureTelemetry({
    baseUrl: 'https://api.test',
    getToken: () => {
      throw new Error('secure store unavailable');
    },
    fetchImpl: captureFetch([], async () => new Response('{"ok":true}')),
  });
  logClientEvent('x', { message: 'm' }); // must not throw
});

test('errorMessage normalizes Error, string, object, and unserializable values', () => {
  assert.equal(errorMessage(new Error('boom')), 'boom');
  assert.equal(errorMessage('plain'), 'plain');
  assert.equal(errorMessage({ code: 1 }), '{"code":1}');
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(errorMessage(circular), '[object Object]');
});
