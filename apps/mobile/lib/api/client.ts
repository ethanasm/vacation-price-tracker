/**
 * Typed REST client for the VPT FastAPI backend (/v1/*). Bearer-JWT auth with
 * refresh-on-401 + single retry. Mirrors the contract of apps/web/src/lib/api.ts
 * but uses an Authorization header (not cookies) because mobile authenticates
 * with the JWT pair minted by POST /v1/auth/mobile-token (see lib/auth).
 *
 * Responses are wrapped in VPT's APIResponse<T> envelope `{ data, meta }`; the
 * typed methods unwrap and return `data`.
 */
import type { components } from './types';
import { logClientEvent } from '../telemetry';
import { ApiError, AuthError, NetworkError } from './errors';

export type TripStatus = components['schemas']['TripStatus'];
export type TripSummary = components['schemas']['TripResponse'];
export type TripDetail = components['schemas']['TripDetail'];
export type TripDetailResponse = components['schemas']['TripDetailResponse'];
export type TripCreate = components['schemas']['TripCreate'];
export type PriceSnapshot = components['schemas']['PriceSnapshotResponse'];

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  refresh: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  listTrips(params?: { page?: number; limit?: number; status?: TripStatus }): Promise<TripSummary[]>;
  getTrip(id: string): Promise<TripDetailResponse>;
  createTrip(body: TripCreate, idempotencyKey: string): Promise<TripDetail>;
  sendChatMessage(body: { message: string; thread_id?: string }): Promise<Response>;
}

interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown> | null;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');

  function buildHeaders(extra?: Record<string, string>): Headers {
    const headers = new Headers(extra);
    const token = opts.getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  }

  // Single-flight refresh: concurrent 401s (parallel requests) must share ONE
  // refresh call. The backend rotates the refresh token on every use, so a
  // second parallel refresh would send an already-rotated token and 401 →
  // spurious sign-out. Coalesce them onto the same in-flight promise.
  let refreshInFlight: Promise<boolean> | null = null;
  function refreshOnce(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = Promise.resolve(opts.refresh()).finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  /** Fetch with refresh-on-401 + single retry. Returns the raw Response. */
  async function request(path: string, init: RequestInit): Promise<Response> {
    const url = `${base}${path}`;
    const baseHeaders = init.headers instanceof Headers ? init.headers : new Headers(init.headers);

    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, headers: baseHeaders });
    } catch {
      logClientEvent('api.network_error', {
        message: `Network error for ${path}`,
        context: { path },
      });
      throw new NetworkError();
    }

    if (res.status === 401) {
      const ok = await refreshOnce();
      if (!ok) {
        // warn, not error: routine session expiry, but worth charting (this is
        // how showbook spotted its mobile auth-churn via mobile.trpc.error).
        logClientEvent('api.auth_expired', {
          message: 'Session expired and token refresh failed',
          level: 'warn',
          context: { path, status: 401 },
        });
        throw new AuthError('Session expired. Please sign in again.');
      }
      // Rebuild headers so the refreshed bearer token is attached.
      const retryHeaders = buildHeaders();
      for (const [k, v] of baseHeaders.entries()) {
        if (k.toLowerCase() !== 'authorization') retryHeaders.set(k, v);
      }
      try {
        res = await fetchImpl(url, { ...init, headers: retryHeaders });
      } catch {
        logClientEvent('api.network_error', {
          message: `Network error for ${path} (post-refresh retry)`,
          context: { path },
        });
        throw new NetworkError();
      }
      if (res.status === 401) {
        logClientEvent('api.auth_expired', {
          message: 'Still unauthorized after token refresh',
          level: 'warn',
          context: { path, status: 401 },
        });
        throw new AuthError('Authentication failed after token refresh.');
      }
    }

    return res;
  }

  async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const res = await request(path, init);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { title?: string; detail?: string };
      // Every failed API op reports (the mobile analogue of showbook's
      // errorReporterLink → mobile.trpc.error): server faults at error,
      // client-side 4xx at warn.
      logClientEvent('api.request.failed', {
        message: body.title ?? `Request failed (${res.status})`,
        level: res.status >= 500 ? 'error' : 'warn',
        context: { path, status: res.status },
      });
      throw new ApiError(res.status, body.title ?? `Request failed (${res.status})`, body.detail);
    }
    return (await res.json()) as T;
  }

  return {
    async listTrips(params) {
      const q = new URLSearchParams();
      q.set('page', String(params?.page ?? 1));
      q.set('limit', String(params?.limit ?? 20));
      if (params?.status) q.set('status', params.status);
      const env = await requestJson<Envelope<TripSummary[]>>(`/v1/trips?${q.toString()}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      return env.data;
    },

    async getTrip(id) {
      const env = await requestJson<Envelope<TripDetailResponse>>(`/v1/trips/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      return env.data;
    },

    async createTrip(body, idempotencyKey) {
      const env = await requestJson<Envelope<TripDetail>>('/v1/trips', {
        method: 'POST',
        headers: buildHeaders({
          'content-type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        }),
        body: JSON.stringify(body),
      });
      return env.data;
    },

    async sendChatMessage(body) {
      // Returns the raw SSE Response — the chat screen (P3) consumes the
      // text/event-stream chunks. /v1/chat/messages streams, it is not enveloped.
      return request('/v1/chat/messages', {
        method: 'POST',
        headers: buildHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(body),
      });
    },
  };
}
