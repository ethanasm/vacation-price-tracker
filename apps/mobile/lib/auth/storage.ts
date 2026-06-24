/**
 * Persists the session in expo-secure-store. `SecureStoreLike` is injectable
 * so the round-trip is unit-tested without expo (node:test).
 */
import type { SessionData, SessionUser } from './contract';

export interface SecureStoreLike {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

const ACCESS_KEY = 'vpt.auth.accessToken';
const REFRESH_KEY = 'vpt.auth.refreshToken';
const USER_KEY = 'vpt.auth.user';

export async function saveSession(store: SecureStoreLike, session: SessionData): Promise<void> {
  await Promise.all([
    store.setItemAsync(ACCESS_KEY, session.accessToken),
    store.setItemAsync(REFRESH_KEY, session.refreshToken),
    store.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
}

export async function loadSession(store: SecureStoreLike): Promise<SessionData | null> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    store.getItemAsync(ACCESS_KEY),
    store.getItemAsync(REFRESH_KEY),
    store.getItemAsync(USER_KEY),
  ]);
  if (!accessToken || !refreshToken || !userJson) return null;
  let user: SessionUser;
  try {
    user = JSON.parse(userJson) as SessionUser;
  } catch {
    return null;
  }
  if (typeof user?.id !== 'string' || typeof user?.email !== 'string') return null;
  return { accessToken, refreshToken, user };
}

export async function clearSession(store: SecureStoreLike): Promise<void> {
  await Promise.all([
    store.deleteItemAsync(ACCESS_KEY),
    store.deleteItemAsync(REFRESH_KEY),
    store.deleteItemAsync(USER_KEY),
  ]);
}
