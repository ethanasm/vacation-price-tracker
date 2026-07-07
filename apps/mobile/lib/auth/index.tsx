import React from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, describeGoogleOAuthMisconfiguration, GOOGLE_OAUTH_CLIENT_ID_ANDROID, GOOGLE_OAUTH_CLIENT_ID_IOS, GOOGLE_OAUTH_CLIENT_ID_WEB } from '@/lib/env';
import { exchangeGoogleIdTokenForSession, describeSignInError } from './exchange';
import { requestSessionRefresh } from './refresh';
import { buildE2ESession } from './e2e';
import { saveSession, loadSession, clearSession } from './storage';
import { logClientEvent } from '@/lib/telemetry';
import type { SessionData, SessionUser } from './contract';

export type { SessionUser, SessionData } from './contract';

WebBrowser.maybeCompleteAuthSession();

export interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  isLoading: boolean;
  isSigningIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  isSigningIn: false,
  error: null,
  signIn: async () => undefined,
  signOut: async () => undefined,
  refresh: async () => false,
});

const PLACEHOLDER_CLIENT_ID = 'unconfigured.apps.googleusercontent.com';

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    refreshRef.current = refreshTokenValue;
  }, [refreshTokenValue]);

  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_OAUTH_CLIENT_ID_IOS ?? PLACEHOLDER_CLIENT_ID,
    androidClientId: GOOGLE_OAUTH_CLIENT_ID_ANDROID ?? PLACEHOLDER_CLIENT_ID,
    webClientId: GOOGLE_OAUTH_CLIENT_ID_WEB ?? PLACEHOLDER_CLIENT_ID,
  });

  // Restore cached session on mount.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await loadSession(SecureStore);
        if (cancelled || !session) return;
        setToken(session.accessToken);
        setRefreshTokenValue(session.refreshToken);
        setUser(session.user);
      } catch {
        // stay signed out
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = React.useCallback(async (session: SessionData) => {
    // Best-effort, matching the refresh path below: a storage failure (e.g.
    // SecureStore is unavailable on the web e2e harness) must not fail
    // sign-in — the session just won't survive an app restart.
    await saveSession(SecureStore, session).catch(() => {
      logClientEvent('auth.persist_failed', {
        message: 'Session could not be persisted to secure storage',
        level: 'warn',
      });
    });
    setToken(session.accessToken);
    setRefreshTokenValue(session.refreshToken);
    setUser(session.user);
  }, []);

  const exchangeAndPersist = React.useCallback(
    async (idToken: string) => {
      try {
        const session = await exchangeGoogleIdTokenForSession({ idToken, apiUrl: API_URL });
        await persist(session);
      } catch (err) {
        setError(describeSignInError(err));
      } finally {
        setIsSigningIn(false);
      }
    },
    [persist],
  );

  // Native: the id_token only appears on `response` after the hook's internal
  // code exchange — read it here, not from promptAsync's return value.
  React.useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') return;
    const idToken = response.params?.id_token;
    if (typeof idToken !== 'string' || !idToken) {
      setError(describeSignInError(new Error('invalid_response')));
      setIsSigningIn(false);
      return;
    }
    void exchangeAndPersist(idToken);
  }, [response, exchangeAndPersist]);

  const signIn = React.useCallback(async () => {
    setError(null);
    // Maestro e2e bypass: the e2e build inlines a pre-baked VPT session, so the
    // sign-in tap loads it directly instead of running real Google OAuth (which
    // can't complete on the headless CI emulator). Dead code in store builds —
    // EXPO_PUBLIC_E2E_MODE is unset there. The literal process.env reads let
    // Metro inline the values at bundle time.
    const e2eSession = buildE2ESession({
      mode: process.env.EXPO_PUBLIC_E2E_MODE,
      token: process.env.EXPO_PUBLIC_E2E_TEST_TOKEN,
      userJson: process.env.EXPO_PUBLIC_E2E_TEST_USER_JSON,
    });
    if (e2eSession) {
      setIsSigningIn(true);
      try {
        await persist(e2eSession);
      } catch {
        setError(describeSignInError(new Error('invalid_response')));
      } finally {
        setIsSigningIn(false);
      }
      return;
    }
    const platform: 'ios' | 'android' | 'web' =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const configError = describeGoogleOAuthMisconfiguration(platform);
    if (configError) {
      setError(`Sign-in is not configured: ${configError}`);
      return;
    }
    setIsSigningIn(true);
    try {
      const result = await promptAsync();
      if (result?.type === 'cancel' || result?.type === 'dismiss') {
        setIsSigningIn(false);
        return;
      }
      if (result?.type === 'error') {
        setError(describeSignInError(new Error('oauth_error')));
        setIsSigningIn(false);
        return;
      }
      // 'success' is handled by the response useEffect above.
    } catch (err) {
      setError(describeSignInError(err));
      setIsSigningIn(false);
    }
  }, [promptAsync, persist]);

  const signOut = React.useCallback(async () => {
    await clearSession(SecureStore).catch(() => undefined);
    setToken(null);
    setRefreshTokenValue(null);
    setUser(null);
    setError(null);
  }, []);

  // Refresh wired into the api client (Task 4). POSTs the refresh token in the
  // JSON body ({ refresh_token }); the endpoint (P5 /v1/auth/refresh) detects
  // mobile-mode by the body's presence and returns a fresh pair in the body.
  const refresh = React.useCallback(async (): Promise<boolean> => {
    const rt = refreshRef.current;
    if (!rt) return false;
    const result = await requestSessionRefresh({ apiUrl: API_URL, refreshToken: rt });
    if (!result.ok) {
      if (result.sessionExpired) {
        // The server definitively rejected this session — retrying can never
        // succeed. Sign out so the auth gate routes to the sign-in screen
        // instead of stranding the user on a "check your connection" error.
        await signOut();
      }
      return false;
    }
    const next = { accessToken: result.accessToken, refreshToken: result.refreshToken, user: user! };
    if (user) await saveSession(SecureStore, next).catch(() => undefined);
    setToken(result.accessToken);
    setRefreshTokenValue(result.refreshToken);
    return true;
  }, [user, signOut]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, isSigningIn, error, signIn, signOut, refresh }),
    [user, token, isLoading, isSigningIn, error, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return React.useContext(AuthContext);
}
