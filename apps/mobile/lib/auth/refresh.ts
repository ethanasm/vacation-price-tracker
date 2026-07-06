/**
 * Pure refresh round-trip against POST /v1/auth/refresh (mobile body mode).
 *
 * The outcome distinguishes a *definitive* server rejection (401/403 — the
 * session is gone and retrying can never succeed) from a *transient* failure
 * (network drop, 5xx, malformed body — the stored tokens may still be good).
 * The auth provider signs the user out only on the definitive case; treating
 * both alike is how a connectivity blip used to strand users on an endless
 * "check your connection" screen with a dead session.
 */

export type RefreshOutcome =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; sessionExpired: boolean };

export async function requestSessionRefresh(opts: {
  apiUrl: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<RefreshOutcome> {
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${opts.apiUrl.replace(/\/+$/, '')}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: opts.refreshToken }),
    });
  } catch {
    return { ok: false, sessionExpired: false };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, sessionExpired: true };
  }
  if (!res.ok) {
    return { ok: false, sessionExpired: false };
  }
  const body = (await res.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string }
    | null;
  if (!body?.access_token || !body?.refresh_token) {
    return { ok: false, sessionExpired: false };
  }
  return { ok: true, accessToken: body.access_token, refreshToken: body.refresh_token };
}
