import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isOAuthRedirectPath } from '../native-intent';

test('matches the app-scheme callback URL Android delivers', () => {
  // Exact shape from the "Unmatched Route" screen: two slashes, query string.
  assert.ok(isOAuthRedirectPath('vpt://oauthredirect?state=G7Bak4wVtX&code=4/0AX&scope=email'));
});

test('matches the reversed-client-id callback URL', () => {
  assert.ok(
    isOAuthRedirectPath(
      'com.googleusercontent.apps.222563763412-9qslaeisquai4hsi930c2bihcj3p34bk:/oauthredirect?state=x&code=y',
    ),
  );
});

test('matches already-stripped path forms', () => {
  assert.ok(isOAuthRedirectPath('/oauthredirect?state=x'));
  assert.ok(isOAuthRedirectPath('oauthredirect'));
  assert.ok(isOAuthRedirectPath('/oauthredirect'));
});

test('ignores real routes and near-misses', () => {
  assert.ok(!isOAuthRedirectPath('/'));
  assert.ok(!isOAuthRedirectPath('/trip/123'));
  assert.ok(!isOAuthRedirectPath('vpt://trip/123'));
  assert.ok(!isOAuthRedirectPath('/settings'));
  assert.ok(!isOAuthRedirectPath('/oauthredirect2'));
  assert.ok(!isOAuthRedirectPath('/nested/oauthredirect'));
  assert.ok(!isOAuthRedirectPath(''));
});

test('app/+native-intent.tsx routes the callback through this helper', () => {
  // The route file itself sits outside the lib coverage gate; pin its
  // load-bearing pieces so a refactor that drops the rewrite fails here.
  const nativeIntent = readFileSync(
    new URL('../../../app/+native-intent.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(nativeIntent.includes('isOAuthRedirectPath'));
  assert.ok(nativeIntent.includes('redirectSystemPath'));
});
