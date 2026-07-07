/**
 * Google OAuth redirect URI for Android.
 *
 * expo-auth-session defaults the native redirect to
 * `<applicationId>:/oauthredirect`, but our Android package
 * (me.ethanasm.vacation_price_tracker) contains underscores, which are invalid
 * in a URI scheme (RFC 3986: letters, digits, `+`, `-`, `.` only). Google's
 * authorization server therefore rejects the whole request with
 * `400 invalid_request` before the consent screen ever appears.
 *
 * Google's documented alternative for installed apps is the reversed-client-id
 * scheme: `com.googleusercontent.apps.<client-id-prefix>:/oauthredirect`. It is
 * always a valid URI scheme and is accepted for any Google OAuth client without
 * extra console configuration. app.config.ts registers the scheme in the
 * Android manifest at prebuild so the browser can route the callback back to
 * the app.
 *
 * Pure module (no Expo/RN imports) so app.config.ts can share it at prebuild
 * and node:test can cover it.
 */

const GOOGLE_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

// The prefix becomes part of a URI scheme, so it must stay within the RFC 3986
// scheme alphabet.
const SCHEME_SAFE_PREFIX = /^[a-z0-9][a-z0-9+.-]*$/i;

/**
 * Reverses a Google OAuth client id (`<prefix>.apps.googleusercontent.com`)
 * into its custom URI scheme (`com.googleusercontent.apps.<prefix>`).
 * Returns undefined when the id is missing or not a usable client id.
 */
export function googleReversedClientIdScheme(clientId: string | undefined): string | undefined {
  if (!clientId?.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) return undefined;
  const prefix = clientId.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length);
  if (!SCHEME_SAFE_PREFIX.test(prefix)) return undefined;
  return `com.googleusercontent.apps.${prefix}`;
}

/**
 * Full redirect URI for the Android Google OAuth flow, or undefined when the
 * client id is missing/invalid (the caller falls back to expo-auth-session's
 * default and the sign-in screen surfaces the misconfiguration).
 */
export function googleAndroidRedirectUri(clientId: string | undefined): string | undefined {
  const scheme = googleReversedClientIdScheme(clientId);
  return scheme ? `${scheme}:/oauthredirect` : undefined;
}
