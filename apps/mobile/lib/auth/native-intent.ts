/**
 * Path rewriting for the Google OAuth callback deep link.
 *
 * Google's authorization server hands the browser back to the app via the
 * redirect deep link (`<scheme>:/oauthredirect?...`, see google-redirect.ts).
 * expo-auth-session's pending browser session consumes that URL through its
 * own Linking listener to finish the sign-in — but Expo Router independently
 * treats the same link as a navigation, and no `oauthredirect` route exists,
 * so the router covers the app with its "Unmatched Route" screen right as the
 * sign-in completes. app/+native-intent.tsx uses this helper to rewrite the
 * callback to the root route; the auth gate in app/_layout.tsx then lands the
 * user on the right screen once the token exchange resolves.
 *
 * Pure module (no Expo/RN imports) so node:test can cover it.
 */

// Expo Router hands redirectSystemPath the raw deep-link string, whose shape
// varies by launch path: a full URL (`vpt://oauthredirect?...`, one or two
// slashes) or an already-stripped path (`/oauthredirect?...`).
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/{0,2}/i;

/** True when the deep link targets the OAuth callback pseudo-route. */
export function isOAuthRedirectPath(path: string): boolean {
  const firstSegment = path
    .replace(SCHEME_PREFIX, '')
    .replace(/^\/+/, '')
    .split(/[/?#]/, 1)[0];
  return firstSegment.toLowerCase() === 'oauthredirect';
}
