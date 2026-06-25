/**
 * The exact request/response contract for POST /v1/auth/mobile-token.
 * P2 (this plan) builds the device side against these types; P5 builds the
 * matching FastAPI endpoint. Keep this file and the P5 endpoint in lockstep.
 */

export interface SessionUser {
  id: string;
  email: string;
  email_notifications_enabled: boolean;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** Request body the device POSTs to /v1/auth/mobile-token. */
export interface MobileTokenRequest {
  id_token: string;
}

/** Success (200) body the endpoint must return. */
export interface MobileTokenResponse {
  access_token: string;
  refresh_token: string;
  user: SessionUser;
}

/**
 * Request body the device POSTs to `POST /v1/auth/refresh`. The mobile client
 * has no cookie, so it sends the refresh token in the body; P5 detects
 * mobile-mode by the body's presence and returns a fresh `MobileTokenResponse`
 * in the body (NOT `Set-Cookie`). The web client's cookie path is unchanged.
 */
export interface RefreshRequest {
  refresh_token: string;
}

export function isMobileTokenResponse(value: unknown): value is MobileTokenResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.access_token !== 'string' || v.access_token.length === 0) return false;
  if (typeof v.refresh_token !== 'string' || v.refresh_token.length === 0) return false;
  const u = v.user as Record<string, unknown> | undefined;
  if (typeof u !== 'object' || u === null) return false;
  if (typeof u.id !== 'string' || u.id.length === 0) return false;
  if (typeof u.email !== 'string' || u.email.length === 0) return false;
  if (typeof u.email_notifications_enabled !== 'boolean') return false;
  return true;
}
