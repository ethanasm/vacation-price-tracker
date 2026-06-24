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
