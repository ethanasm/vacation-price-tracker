/**
 * Pure Google-ID-token → VPT-session exchange. No Expo/RN imports so node:test
 * can run it directly (mirrors showbook's auth-helpers.ts split from auth.ts).
 */
import { isMobileTokenResponse, type SessionData } from './contract';

export async function exchangeGoogleIdTokenForSession(args: {
  idToken: string;
  apiUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<SessionData> {
  const { idToken, apiUrl, fetchImpl = fetch } = args;
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/v1/auth/mobile-token`;

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
  } catch (err) {
    throw new Error('api_unreachable');
  }

  if (res.status === 401) throw new Error('invalid_google_token');
  if (res.status === 403) throw new Error('access_denied');
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(`server_error_${res.status}`);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('invalid_response');
  }
  if (!isMobileTokenResponse(body)) throw new Error('invalid_response');

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    user: body.user,
  };
}

/** Translate an exchange error into an end-user message (used by the provider). */
export function describeSignInError(err: unknown): string {
  if (err instanceof Error) {
    switch (err.message) {
      case 'invalid_google_token':
        return 'Google rejected the sign-in token. Check GOOGLE_OAUTH_MOBILE_AUDIENCES on the API.';
      case 'access_denied':
        return 'Access denied. Contact the admin to be added to the allowlist.';
      case 'rate_limited':
        return 'Too many sign-in attempts. Wait a minute and try again.';
      case 'invalid_response':
        return "The server's response wasn't what we expected. Try again.";
      case 'api_unreachable':
        return 'Price Tracker is not reachable. Check EXPO_PUBLIC_API_URL.';
      case 'oauth_dismissed':
        return 'Sign-in was cancelled.';
      case 'oauth_error':
        return 'Google sign-in failed. Please try again.';
      default:
        if (err.message.startsWith('server_error_')) {
          return "We couldn't reach Price Tracker. Please try again in a moment.";
        }
    }
  }
  return "We couldn't sign you in. Please check your connection and try again.";
}
