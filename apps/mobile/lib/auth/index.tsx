import React from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, describeGoogleOAuthMisconfiguration, GOOGLE_OAUTH_CLIENT_ID_ANDROID, GOOGLE_OAUTH_CLIENT_ID_IOS, GOOGLE_OAUTH_CLIENT_ID_WEB } from '@/lib/env';
import { exchangeGoogleIdTokenForSession, describeSignInError } from './exchange';
import { saveSession, loadSession, clearSession } from './storage';
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
    await saveSession(SecureStore, session);
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
  }, [promptAsync]);

  const signOut = React.useCallback(async () => {
    await clearSession(SecureStore).catch(() => undefined);
    setToken(null);
    setRefreshTokenValue(null);
    setUser(null);
    setError(null);
  }, []);

  // Refresh wired into the api client (Task 4). POSTs the refresh token in the
  // Authorization header; the endpoint (P5) returns a fresh pair in the body.
  const refresh = React.useCallback(async (): Promise<boolean> => {
    const rt = refreshRef.current;
    if (!rt) return false;
    try {
      const res = await fetch(`${API_URL.replace(/\/+$/, '')}/v1/auth/refresh`, {
        method: 'POST',
        headers: { authorization: `Bearer ${rt}`, 'content-type': 'application/json' },
      });
      if (!res.ok) return false;
      const body = (await res.json().catch(() => null)) as
        | { access_token?: string; refresh_token?: string }
        | null;
      if (!body?.access_token || !body?.refresh_token) return false;
      const next = { accessToken: body.access_token, refreshToken: body.refresh_token, user: user! };
      if (user) await saveSession(SecureStore, next).catch(() => undefined);
      setToken(body.access_token);
      setRefreshTokenValue(body.refresh_token);
      return true;
    } catch {
      return false;
    }
  }, [user]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, isSigningIn, error, signIn, signOut, refresh }),
    [user, token, isLoading, isSigningIn, error, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return React.useContext(AuthContext);
}
