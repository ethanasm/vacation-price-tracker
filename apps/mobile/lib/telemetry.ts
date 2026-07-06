/**
 * Mobile telemetry — best-effort, fire-and-forget. The mobile twin of
 * `apps/web/src/lib/telemetry.ts` (cross-platform parity: both clients relay
 * to the same sink).
 *
 * The app has no direct path to Axiom (clients never write to Axiom directly).
 * Events POST to the FastAPI `POST /v1/telemetry/client` sink with
 * `platform: "mobile"`, which validates + bounds them and logs through the
 * shared Axiom pipeline under the `mobile.<event>` namespace
 * (`component=mobile.telemetry`). Network errors are swallowed — telemetry
 * must never break the UI, and a failed report is never itself reported (no
 * recursion).
 */
import { API_URL } from './env';

export type ClientLogLevel = 'warn' | 'error';

export interface ClientLogOptions {
  message: string;
  level?: ClientLogLevel;
  /**
   * Extra context. Only keys on the server's allowlist (status, http_status,
   * code, path, route, trip_id, conversation_id, stage, type, elapsed_ms,
   * reason) are kept; everything else is dropped server-side.
   */
  context?: Record<string, unknown>;
}

interface TelemetryConfig {
  baseUrl: string;
  /** Bearer token for user attribution; events still send when signed out. */
  getToken: () => string | null;
  fetchImpl: typeof fetch;
}

const defaultConfig: TelemetryConfig = {
  baseUrl: API_URL,
  getToken: () => null,
  fetchImpl: (...args) => fetch(...args),
};

let config: TelemetryConfig = defaultConfig;

/**
 * Bind telemetry to the session (called once by ApiClientProvider). Partial so
 * tests can inject a fetch stub; pass nothing to reset to defaults.
 */
export function configureTelemetry(overrides?: Partial<TelemetryConfig>): void {
  config = { ...defaultConfig, ...overrides };
}

/**
 * Report a client-side event to Axiom (via the API). `event` is a short dotted
 * namespace (e.g. "api.request.failed"); the server prefixes it with `mobile.`.
 */
export function logClientEvent(event: string, opts: ClientLogOptions): void {
  try {
    const body = JSON.stringify({
      event,
      message: opts.message,
      level: opts.level ?? 'error',
      platform: 'mobile',
      context: opts.context,
    });
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = config.getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    void config
      .fetchImpl(`${config.baseUrl.replace(/\/+$/, '')}/v1/telemetry/client`, {
        method: 'POST',
        headers,
        body,
      })
      .catch(() => {
        // Telemetry is best-effort; swallow network errors.
      });
  } catch {
    // Never let telemetry throw into the caller.
  }
}

/** Normalize an unknown thrown value into a log message string. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
