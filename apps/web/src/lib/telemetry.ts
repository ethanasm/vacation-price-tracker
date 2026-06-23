/**
 * Client-side telemetry — best-effort, fire-and-forget.
 *
 * The browser has no direct path to Axiom (showbook's rule: clients never write
 * to Axiom directly). We POST events to the FastAPI `/v1/telemetry/client` sink,
 * which validates + bounds them and logs through the shared Axiom pipeline under
 * the `web.<event>` namespace. Network errors are swallowed — telemetry must
 * never break the UI.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8000";

export type ClientLogLevel = "warn" | "error";

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

/**
 * Report a client-side event to Axiom (via the API). `event` is a short dotted
 * namespace (e.g. "trip.load.failed"); the server prefixes it with `web.`.
 */
export function logClientEvent(event: string, opts: ClientLogOptions): void {
  try {
    const body = JSON.stringify({
      event,
      message: opts.message,
      level: opts.level ?? "error",
      context: opts.context,
    });
    void fetch(`${API_BASE_URL}/v1/telemetry/client`, {
      method: "POST",
      keepalive: true,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {
      // Telemetry is best-effort; swallow network errors.
    });
  } catch {
    // Never let telemetry throw into the caller.
  }
}

/** Normalize an unknown thrown value into a log message string. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
