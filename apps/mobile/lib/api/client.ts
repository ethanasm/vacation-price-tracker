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
export type TripUpdate = components['schemas']['TripUpdate'];
export type PriceSnapshot = components['schemas']['PriceSnapshotResponse'];
export type RefreshStart = components['schemas']['RefreshStartResponse'];
export type RefreshStatus = components['schemas']['RefreshStatusResponse'];
export type UserResponse = components['schemas']['UserResponse'];
export type FeatureFlagItem = components['schemas']['FeatureFlagItem'];
export type FeatureFlagsResponse = components['schemas']['FeatureFlagsResponse'];

/** Editable per-user notification preferences; omitted fields stay unchanged. */
export interface UserPreferencesUpdate {
  email_notifications_enabled?: boolean;
  push_notifications_enabled?: boolean;
}

/**
 * PATCH /v1/users/preferences response. Hand-typed (mirroring
 * apps/api/app/routers/users.py UserPreferencesResponse) because the generated
 * types.ts predates that route.
 */
export interface UserPreferencesResponse {
  id: string;
  email: string;
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
}

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
  updateTrip(id: string, body: TripUpdate): Promise<TripDetail>;
  updateTripStatus(id: string, status: 'active' | 'paused'): Promise<TripSummary>;
  deleteTrip(id: string): Promise<void>;
  refreshTrip(id: string): Promise<RefreshStart>;
  getRefreshStatus(refreshGroupId: string): Promise<RefreshStatus>;
  sendChatMessage(body: { message: string; thread_id?: string }): Promise<Response>;
  getMe(): Promise<UserResponse>;
  updatePreferences(prefs: UserPreferencesUpdate): Promise<UserPreferencesResponse>;
  listFeatureFlags(): Promise<FeatureFlagItem[]>;
  setFeatureFlag(name: string, enabled: boolean): Promise<FeatureFlagItem>;
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

  /** Throws ApiError (reporting telemetry) when the response is not ok. */
  async function ensureOk(res: Response, path: string): Promise<void> {
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
  }

  async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const res = await request(path, init);
    await ensureOk(res, path);
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

    async updateTrip(id, body) {
      const env = await requestJson<Envelope<TripDetail>>(`/v1/trips/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: buildHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(body),
      });
      return env.data;
    },

    async updateTripStatus(id, status) {
      const env = await requestJson<Envelope<TripSummary>>(
        `/v1/trips/${encodeURIComponent(id)}/status`,
        {
          method: 'PATCH',
          headers: buildHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({ status }),
        },
      );
      return env.data;
    },

    async deleteTrip(id) {
      // 204 No Content on success — don't parse a body.
      const path = `/v1/trips/${encodeURIComponent(id)}`;
      const res = await request(path, { method: 'DELETE', headers: buildHeaders() });
      await ensureOk(res, path);
    },

    async refreshTrip(id) {
      const env = await requestJson<Envelope<RefreshStart>>(
        `/v1/trips/${encodeURIComponent(id)}/refresh`,
        { method: 'POST', headers: buildHeaders() },
      );
      return env.data;
    },

    async getRefreshStatus(refreshGroupId) {
      const q = new URLSearchParams({ refresh_group_id: refreshGroupId });
      const env = await requestJson<Envelope<RefreshStatus>>(
        `/v1/trips/refresh-status?${q.toString()}`,
        { method: 'GET', headers: buildHeaders() },
      );
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

    // The auth/user/flag endpoints below return their models directly (no
    // {data} envelope), matching the web client (apps/web/src/lib/api.ts).
    async getMe() {
      return requestJson<UserResponse>('/v1/auth/me', {
        method: 'GET',
        headers: buildHeaders(),
      });
    },

    async updatePreferences(prefs) {
      return requestJson<UserPreferencesResponse>('/v1/users/preferences', {
        method: 'PATCH',
        headers: buildHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(prefs),
      });
    },

    async listFeatureFlags() {
      const res = await requestJson<FeatureFlagsResponse>('/v1/feature-flags', {
        method: 'GET',
        headers: buildHeaders(),
      });
      return res.flags;
    },

    async setFeatureFlag(name, enabled) {
      return requestJson<FeatureFlagItem>(`/v1/feature-flags/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: buildHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ enabled }),
      });
    },
  };
}
