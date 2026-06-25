/**
 * Env access for the mobile app. EXPO_PUBLIC_* vars are inlined at build time
 * by Expo. API_URL defaults to the iOS-simulator localhost dev host; CI / EAS
 * (P4) sets EXPO_PUBLIC_API_URL to the prod VPT domain.
 */

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://localhost:8000';

export const GOOGLE_OAUTH_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_IOS;
export const GOOGLE_OAUTH_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_ANDROID;
export const GOOGLE_OAUTH_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_WEB;

/** Returns a human-readable misconfiguration message, or null if API_URL is usable. */
export function describeApiMisconfiguration(apiUrl: string = API_URL): string | null {
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'EXPO_PUBLIC_API_URL must be a full http:// or https:// URL.';
    }
  } catch {
    return 'EXPO_PUBLIC_API_URL must be a full http:// or https:// URL.';
  }
  return null;
}

/** Returns a misconfiguration message if the Google OAuth client IDs are missing. */
export function describeGoogleOAuthMisconfiguration(
  platform: 'ios' | 'android' | 'web',
): string | null {
  if (!GOOGLE_OAUTH_CLIENT_ID_WEB) {
    return 'EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_WEB is required (used as the ID-token audience on every platform).';
  }
  if (platform === 'ios' && !GOOGLE_OAUTH_CLIENT_ID_IOS) {
    return 'EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_IOS is required for iOS sign-in.';
  }
  if (platform === 'android' && !GOOGLE_OAUTH_CLIENT_ID_ANDROID) {
    return 'EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_ANDROID is required for Android sign-in.';
  }
  return null;
}
