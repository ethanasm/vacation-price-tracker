/**
 * Intercepts incoming native deep links before Expo Router matches them.
 *
 * The Google OAuth callback (`<scheme>:/oauthredirect?...`) is consumed by
 * expo-auth-session's Linking listener, not by a route — without this rewrite
 * the router shows "Unmatched Route" over the completing sign-in. Send it to
 * the root instead; the auth gate takes over from there.
 */
import { rewriteNativeIntentPath } from '@/lib/auth/native-intent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return rewriteNativeIntentPath(path);
}
