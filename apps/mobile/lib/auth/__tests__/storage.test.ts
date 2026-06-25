import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveSession, loadSession, clearSession, type SecureStoreLike } from '../storage';

function memoryStore(): SecureStoreLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItemAsync: async (k) => map.get(k) ?? null,
    setItemAsync: async (k, v) => {
      map.set(k, v);
    },
    deleteItemAsync: async (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map),
  };
}

const session = {
  accessToken: 'a',
  refreshToken: 'r',
  user: { id: 'u1', email: 'a@b.com', email_notifications_enabled: true },
};

test('save then load round-trips the session', async () => {
  const store = memoryStore();
  await saveSession(store, session);
  const loaded = await loadSession(store);
  assert.deepEqual(loaded, session);
});

test('loadSession returns null when nothing is stored', async () => {
  const store = memoryStore();
  assert.equal(await loadSession(store), null);
});

test('loadSession returns null on a corrupt user blob', async () => {
  const store = memoryStore();
  await store.setItemAsync('vpt.auth.accessToken', 'a');
  await store.setItemAsync('vpt.auth.refreshToken', 'r');
  await store.setItemAsync('vpt.auth.user', '{not json');
  assert.equal(await loadSession(store), null);
});

test('clearSession removes every key', async () => {
  const store = memoryStore();
  await saveSession(store, session);
  await clearSession(store);
  assert.deepEqual(store.dump(), {});
});
