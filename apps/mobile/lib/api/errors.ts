/** Error classes mirroring apps/web/src/lib/api.ts so call-sites read alike. */

export class AuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail ?? message;
  }
}

/**
 * A transport-level failure (offline, DNS, TLS, connection reset) — distinct
 * from AuthError so a "signed-out on AuthError" handler doesn't force sign-out
 * on a transient connectivity blip. The request never reached an auth verdict.
 */
export class NetworkError extends Error {
  constructor(message = 'Unable to connect to server') {
    super(message);
    this.name = 'NetworkError';
  }
}
