import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { googleAndroidRedirectUri, googleReversedClientIdScheme } from '../google-redirect';

const CLIENT_ID = '222563763412-9qslaeisquai4hsi930c2bihcj3p34bk.apps.googleusercontent.com';

test('reverses a Google client id into its custom URI scheme', () => {
  assert.equal(
    googleReversedClientIdScheme(CLIENT_ID),
    'com.googleusercontent.apps.222563763412-9qslaeisquai4hsi930c2bihcj3p34bk',
  );
});

test('builds the full Android redirect URI', () => {
  assert.equal(
    googleAndroidRedirectUri(CLIENT_ID),
    'com.googleusercontent.apps.222563763412-9qslaeisquai4hsi930c2bihcj3p34bk:/oauthredirect',
  );
});

test('returns undefined when the client id is missing', () => {
  assert.equal(googleReversedClientIdScheme(undefined), undefined);
  assert.equal(googleAndroidRedirectUri(undefined), undefined);
  assert.equal(googleAndroidRedirectUri(''), undefined);
});

test('returns undefined for ids without the googleusercontent suffix', () => {
  assert.equal(googleAndroidRedirectUri('unconfigured'), undefined);
  assert.equal(googleAndroidRedirectUri('123-abc.example.com'), undefined);
});

test('returns undefined when the prefix cannot form a valid URI scheme', () => {
  // underscores are the exact failure this module exists to avoid
  assert.equal(googleAndroidRedirectUri('bad_prefix.apps.googleusercontent.com'), undefined);
  assert.equal(googleAndroidRedirectUri('.apps.googleusercontent.com'), undefined);
});

test('app.config.ts inline copy stays in sync with this module', () => {
  // Expo's config loader cannot import sibling TS modules, so app.config.ts
  // carries an inline duplicate of googleReversedClientIdScheme. Pin its three
  // load-bearing literals so an edit to one copy fails here until both match.
  const appConfig = readFileSync(new URL('../../../app.config.ts', import.meta.url), 'utf8');
  assert.ok(appConfig.includes('.apps.googleusercontent.com'));
  assert.ok(appConfig.includes('^[a-z0-9][a-z0-9+.-]*$'));
  assert.ok(appConfig.includes('com.googleusercontent.apps.${prefix}'));
});
