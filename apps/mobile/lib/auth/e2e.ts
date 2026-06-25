/**
 * Maestro e2e sign-in bypass. The `e2e` build profile (apps/mobile/eas.json +
 * .github/workflows/mobile.yml) inlines a pre-baked VPT session at build time:
 *
 *   EXPO_PUBLIC_E2E_MODE=1             — activate the bypass
 *   EXPO_PUBLIC_E2E_TEST_TOKEN         — a real VPT access JWT (minted by the
 *                                        e2e backend's POST /v1/e2e/mint-token)
 *   EXPO_PUBLIC_E2E_TEST_USER_JSON     — {"id":"...","email":"..."}
 *
 * When active, `signIn()` loads this session instead of running real Google
 * OAuth (which can't complete on the headless CI emulator). The bypass guards
 * on EXPO_PUBLIC_E2E_MODE === '1', so it's dead code in prod/preview store
 * builds (the var is unset there).
 *
 * This module is pure (no Expo/RN imports) so node:test can exercise it
 * directly, mirroring the exchange.ts / contract.ts split.
 */
import type { SessionData } from './contract';

export interface E2EBuildEnv {
  mode?: string;
  token?: string;
  userJson?: string;
}

/**
 * Build the pre-baked e2e session from the build-inlined env, or return null
 * when the bypass is inactive or the env is missing/malformed (so the caller
 * falls through to the real OAuth path).
 *
 * The mint step only carries `id` + `email`, and there is no refresh token in
 * the e2e env — the flows are short-lived and never exercise a real refresh
 * round-trip, so the access token is reused as the refresh placeholder and
 * `email_notifications_enabled` defaults to false.
 */
export function buildE2ESession(env: E2EBuildEnv): SessionData | null {
  if (env.mode !== '1') return null;
  const token = env.token;
  if (typeof token !== 'string' || token.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(env.userJson ?? '');
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const u = parsed as Record<string, unknown>;
  if (typeof u.id !== 'string' || u.id.length === 0) return null;
  if (typeof u.email !== 'string' || u.email.length === 0) return null;

  return {
    accessToken: token,
    refreshToken: token,
    user: {
      id: u.id,
      email: u.email,
      email_notifications_enabled:
        typeof u.email_notifications_enabled === 'boolean' ? u.email_notifications_enabled : false,
    },
  };
}
