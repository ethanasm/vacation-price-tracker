# Mobile CI/CD + E2E (P4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This is plan **P4** in the Aurora orchestration index (`docs/superpowers/plans/2026-06-23-AURORA-INDEX.md`). **Read the index's Global Constraints first.** P4 runs in **Wave 2** and **depends on P2 (mobile-foundation)** being merged. P4 runs **concurrently with P3 (mobile-screens)**; to guarantee zero merge conflicts, **P4 MUST NOT edit `apps/mobile/package.json` dependencies** and MUST NOT touch any screen file under `apps/mobile/app/**` or `apps/mobile/components/**`. P4 confines itself to the files in the File Structure below.

**Goal:** Stand up the mobile EAS → TestFlight/Play-internal CI/CD pipeline plus the Maestro Android e2e pipeline for `apps/mobile`, faithfully mirrored from showbook and adapted to VPT's names, runner labels, and toolchain.

**Architecture:** Two GitHub Actions workflows mirror showbook. `mobile-deploy.yml` runs on GitHub-hosted runners after VPT's image build completes on `main`: a `plan` job diffs native-affecting files to choose between an ungated OTA path (`eas update --branch preview`) and an approval-gated `release` path (`environment: mobile-release`) that auto-bumps the version, builds an Android AAB + iOS IPA via EAS, and `eas submit`s to Play internal + TestFlight. `mobile-e2e.yml` runs on the self-hosted `vpt-prod` Android runner: it builds an APK locally, mints an e2e bearer session from an isolated VPT e2e backend stack, runs Maestro flows on a booted emulator, and publishes screenshots to a `pr-screenshots` branch. Version bumps are driven by a conventional-commit scan in `scripts/bump-mobile-version.mjs`.

**Tech Stack:** EAS CLI (`eas-cli` via `pnpm dlx`), Expo SDK 56 / Expo Router, Maestro, GitHub Actions (`actions/checkout@v4`, `pnpm/action-setup@v4` pinned to `9.12.1`, `actions/setup-node@v4` with `node-version: 22`), Node 22, pnpm 9.12.1, Resend (failure email), Android SDK + AVD on the self-hosted prod box.

## Global Constraints

*Inherited verbatim from the Aurora index. Every task implicitly includes these.*

### PR operator docs (required)
Every PR opened for this plan MUST include an **"Operator / Deployment Steps"** section in its description listing: new **environment variables** (name · where set — web `.env` / api `.env`·`.env.prod` / `eas.json` / GitHub secret / GitHub variable · required-vs-optional · example or placeholder value); **DB migrations**; **new GitHub secrets/variables**; and any **one-time infra / runner / credential provisioning** the change introduces. If it introduces none, state **"No operator steps"** explicitly. *(This plan introduces many — EAS/store/e2e secrets, runner vars, the `vpt-e2e` stack — so its PRs carry a substantial operator section.)*

- **Package manager:** `pnpm@9.12.1` (pinned in root `package.json`). Single root `pnpm-lock.yaml` — never generate a nested lockfile in `apps/*`. **P4 does not add `package.json` dependencies** (see header); `eas-cli` and `maestro` are invoked via `pnpm dlx` / curl-installed CLI, not declared deps.
- **Node:** `.nvmrc` = `22` (added by P2). All CI uses `actions/setup-node@v4` with `node-version: 22`. (VPT's existing `nextjs.yml`/`python.yml` use `pnpm/action-setup@v4` + `actions/checkout@v4`; P4 matches those action major versions rather than showbook's `@v6`/`@v7`.)
- **Bundle identifiers:** iOS `me.ethanasm.vpt`, Android `me.ethanasm.vpt`. **HUMAN PREREQUISITE — confirm before first store submit.**
- **`EXPO_PUBLIC_API_URL` (prod):** the exact prod domain is **UNCONFIRMED**. Until the human confirms it, use the placeholder `https://CONFIRM-VPT-PROD-DOMAIN` everywhere it appears (`eas.json` preview `env`, the OTA step's inline `env`) and leave the flag comment in place. **HUMAN PREREQUISITE.** (showbook's analog is `https://showbook.ethanasm.me`.)
- **EAS / store secrets (GitHub repo secrets, provisioned by the human; referenced by name only):** `EXPO_TOKEN`, `PLAY_SERVICE_ACCOUNT_JSON`, `ASC_API_KEY_P8`, `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_APP_ID`, and a push credential for the version-bump pushback (`RELEASE_DEPLOY_KEY` preferred, or `RELEASE_PUSH_TOKEN`). Optional failure-email secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`. e2e backend secret: `VPT_E2E_BACKEND_TOKEN` (see Task 5).
- **Versioning:** `runtimeVersion: { policy: 'appVersion' }` (set by P2). The OTA path NEVER bumps. The release path bumps `version` in `app.config.ts` after approval, commits `chore(release): mobile vX.Y.Z [skip ci]`, tags `mobile-vX.Y.Z`. Pre-1.0: a breaking marker maps to minor; the 1.0.0 jump is manual.
- **Commit scope (VPT CLAUDE.md):** CI/root changes take **no scope** — `chore: …` / `ci: …`. Per-app changes use `web`/`api`/`worker`. The mobile-deploy bump commit is `chore(release): mobile vX.Y.Z [skip ci]`. **No `Co-authored-by: Claude` / "Generated with Claude Code" trailers and no `claude.ai/code/session_…` footer in any commit.**
- **Product guardrails (carried for e2e fidelity):** No "Trip members"/sharing UI. Sign-in is Google-OAuth only. Trip detail totals must reproduce Alaska+Riverhouse = $789, United+Riverhouse = $754, Delta+Eviva = $680 (the create-trip e2e flow asserts a list round-trip, not these totals — those are P3's unit-test territory).

### Dependency on P5 (mobile-backend) — read before Task 5

P5 adds **Bearer-header support to `get_current_user` and `POST /v1/auth/refresh`** plus the `POST /v1/auth/mobile-token` endpoint. VPT auth is **FastAPI JWT** (`create_access_token` / `create_refresh_token`), **not next-auth** — so the showbook e2e mint (which `encode`s a next-auth token inside the web container) does **not** port directly. P4's e2e mint instead asks the **e2e backend itself** to issue a token for a synthetic test user, authenticated by a shared `VPT_E2E_BACKEND_TOKEN` (Task 5). The mobile client attaches that JWT as `Authorization: Bearer` — which only works once **P5's Bearer-header support is merged**. Task 5 documents this dependency in-line; if P5 has not merged when P4's e2e workflow first runs, the `android-e2e` job will 401 at the trips-list assertion (the sign-in bypass still "passes" because it loads the baked session without validating it) — exactly the showbook failure signature.

---

## File Structure

P4 creates/edits **only** these paths:

- `apps/mobile/eas.json` — **create**. EAS build profiles (`development`, `preview`, `preview-store`, `production`, `e2e`) + submit profiles (`production`, `preview-store`) for Play internal + TestFlight. (Task 1)
- `apps/mobile/app.config.ts` — **edit only the release/version/submit-related fields** P2 left absent: add `updates.url` + `extra.eas.projectId`, and add an `IS_E2E_BUILD` cleartext exception for the emulator host. **Do not touch** name/slug/scheme/bundle-id/plugins/runtimeVersion. The `version: '0.1.0'` line P2 stubbed is the value the bump script (Task 2) rewrites — P4 leaves it as-is in the source and only the workflow mutates it. (Task 1 / Task 5)
- `scripts/bump-mobile-version.mjs` — **create** + unit test `scripts/__tests__/bump-mobile-version.test.mjs`. (Task 2)
- `scripts/mobile-deploy-failure-email.sh` — **create**. Resend failure-notification script shared by both deploy jobs. (Task 3)
- `.github/workflows/mobile-deploy.yml` — **create**. OTA + plan + gated release. (Task 3)
- `apps/mobile/e2e/config.yaml` — **create**. Maestro project config. (Task 4)
- `apps/mobile/e2e/flows/sign-in.yaml`, `trips-list.yaml`, `trip-detail.yaml`, `create-trip.yaml` — **create**. Maestro flows. (Task 4)
- `apps/mobile/e2e/scripts/dry-run.mjs` — **create**. YAML-shape validator. (Task 4)
- `.github/workflows/mobile-e2e.yml` — **create**. Self-hosted Android emulator + Maestro. (Task 5)
- `infra/docker-compose.e2e.yml` — **create**. Isolated `vpt-e2e` API+DB stack the emulator talks to (own `SECRET_KEY`/DB, loopback bind, e2e allowlist). P4 owns this file (it's the only plan in the e2e business; it mirrors `infra/docker-compose.prod.yml`). *Bringing it up* on the prod box stays a documented one-time human/ops step. (Task 5)
- `scripts/setup-runner-android.sh` — **create**. One-time Android SDK/AVD/Maestro provisioning on the `vpt-prod` box. (Task 6)
- `docs/mobile-cicd.md` — **create**. One-time credential / environment / runner setup notes for the human. (Task 6)
- `apps/mobile/.gitignore` — **append** the two credential filenames (`play-service-account.json`, `asc-api-key.p8`) so a misconfigured `git add` can't commit a secret. This file was created by P2; appending two ignore lines cannot conflict with P3 (P3 never edits it). (Task 1)
- `apps/mobile/package.json` — **scripts only, NOT dependencies.** Add `e2e:dry`, `e2e:ios`, and the `mobile:e2e:*` root delegators. **Caveat:** the index says if P3 and P4 run truly simultaneously P4 does not edit `package.json` at all. Therefore these scripts go into a **standalone Task 4 step that is the LAST thing committed**, and if a P3 `package.json` edit is in flight the implementer rebases the scripts in. See Task 4 Step 7 for the conflict-avoidance note. The root `mobile:e2e:*` delegators live in root `package.json` (P2 owns root `package.json` scripts; P4 appends e2e delegators there only if P2 did not already stub them — Task 4 Step 7 checks first).

> **Why `mobile-deploy.yml` triggers on "Build Prod Images", not "CI":** VPT has no single workflow named `CI` (it has separate `Next.js` and `Python` workflows). The workflow that runs on **every** merge to `main` and is the gate VPT's own `deploy.yml` keys off is **`Build Prod Images`**. Mirroring showbook's "deploy after CI is green on main" intent, P4 triggers mobile-deploy on `Build Prod Images` completing successfully on `main`. (Documented inline in the workflow header.)

---

### Task 1: EAS build/submit profiles (`eas.json`) + config wiring

**Files:**
- Create: `apps/mobile/eas.json`
- Modify: `apps/mobile/app.config.ts` (add `updates.url` + `extra.eas.projectId` only — release fields P2 left absent)
- Modify: `apps/mobile/.gitignore` (append two credential filenames)

**Interfaces:**
- Consumes (from P2): `apps/mobile/app.config.ts` exporting an `ExpoConfig` with `version: '0.1.0'`, `runtimeVersion: { policy: 'appVersion' }`, bundle id `me.ethanasm.vpt`, no `updates`/`extra.eas` blocks. P2's root `mobile:*` scripts + `apps/mobile/package.json` `start`/`ios`/`android`/`web:build` scripts.
- Produces (for Tasks 3 & 5): build profiles `preview` (internal APK + prod env), `preview-store` (store AAB/IPA, `autoIncrement`), `e2e` (extends `preview`, `EXPO_PUBLIC_E2E_MODE=1`), `production`; submit profiles `preview-store` (Play `internal` + iOS ASC) and `production` (Play `production`). Profile names referenced verbatim by the workflows.

- [ ] **Step 1: Create `apps/mobile/eas.json`**

Adapted from `/Users/ethansmith/Developer/showbook/apps/mobile/eas.json`. Differences from showbook: VPT has no Google-Maps key (drop `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`); the prod domain is the unconfirmed placeholder; the Google OAuth client IDs are **placeholders the human fills in** (VPT has its own OAuth project — flagged below).

Create `apps/mobile/eas.json`:
```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://CONFIRM-VPT-PROD-DOMAIN",
        "EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_IOS": "CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-IOS.apps.googleusercontent.com",
        "EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_ANDROID": "CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-ANDROID.apps.googleusercontent.com",
        "EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_WEB": "CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-WEB.apps.googleusercontent.com"
      }
    },
    "preview-store": {
      "extends": "preview",
      "distribution": "store",
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    },
    "e2e": {
      "extends": "preview",
      "distribution": "internal",
      "channel": "e2e",
      "env": {
        "EXPO_PUBLIC_E2E_MODE": "1"
      },
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "production",
        "serviceAccountKeyPath": "./play-service-account.json"
      },
      "ios": {
        "ascApiKeyPath": "./asc-api-key.p8"
      }
    },
    "preview-store": {
      "android": {
        "track": "internal",
        "serviceAccountKeyPath": "./play-service-account.json"
      },
      "ios": {
        "ascApiKeyPath": "./asc-api-key.p8"
      }
    }
  }
}
```

> **HUMAN PREREQUISITE flags in this file:** (1) `EXPO_PUBLIC_API_URL` placeholder — replace with the confirmed prod domain. (2) The three `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_*` placeholders — replace with VPT's iOS / Android / Web OAuth client IDs (the same IDs the human lists in the API's `GOOGLE_OAUTH_MOBILE_AUDIENCES`, per the index's auth-bridge contract). These are public client IDs (`EXPO_PUBLIC_` ships in the JS bundle anyway) so committing them is safe. (3) The OTA step in `mobile-deploy.yml` (Task 3) mirrors the same four values inline — keep them in sync.

- [ ] **Step 2: Verify `eas.json` parses and the profile graph resolves**

Run:
```bash
node --experimental-vm-modules -e "JSON.parse(require('node:fs').readFileSync('apps/mobile/eas.json','utf8')); console.log('eas.json valid JSON')"
node -e "
const j = JSON.parse(require('node:fs').readFileSync('apps/mobile/eas.json','utf8'));
const b = j.build, s = j.submit;
const need = ['development','preview','preview-store','production','e2e'];
for (const p of need) if (!b[p]) { console.error('missing build profile', p); process.exit(1); }
if (b['preview-store'].extends !== 'preview') { console.error('preview-store must extend preview'); process.exit(1); }
if (b.e2e.extends !== 'preview' || b.e2e.env.EXPO_PUBLIC_E2E_MODE !== '1') { console.error('e2e profile wrong'); process.exit(1); }
if (s['preview-store'].android.track !== 'internal') { console.error('preview-store android track must be internal'); process.exit(1); }
if (s['preview-store'].ios.ascApiKeyPath !== './asc-api-key.p8') { console.error('asc key path wrong'); process.exit(1); }
console.log('eas.json profile graph OK');
"
```
Expected:
```
eas.json valid JSON
eas.json profile graph OK
```

> The fuller schema check (`eas config` / `eas build --dry-run`) needs `EXPO_TOKEN` + network and is documented as a one-time human verification in `docs/mobile-cicd.md` (Task 6): `cd apps/mobile && EXPO_TOKEN=… pnpm dlx eas-cli config --profile preview-store --platform android` prints the resolved profile without queueing a build.

- [ ] **Step 3: Add `updates.url` + `extra.eas.projectId` to `app.config.ts`**

This is the **only** change P4 makes to `app.config.ts` in this task (the e2e cleartext exception is added in Task 5). Edit `apps/mobile/app.config.ts`. Find the trailing comment P2 left:
```ts
  // `updates.url` and `extra.eas.projectId` are intentionally absent — P4
  // adds them when it provisions the EAS project (mobile-cicd plan).
};
```
Replace it with (the `runtimeVersion` block stays exactly as P2 wrote it; this inserts the two new blocks before the closing brace):
```ts
  // P4 (mobile-cicd): EAS Update + project linkage. EXPO_PUBLIC_E2E_MODE
  // never changes these — OTA targets the runtime derived from `version`
  // via runtimeVersion.policy='appVersion' above.
  updates: {
    // CONFIRM-VPT-EAS-PROJECT-ID below is filled by `eas init` (it writes
    // extra.eas.projectId) the first time the human runs it; the updates URL
    // is derived from the same project id. Both are HUMAN PREREQUISITES —
    // see docs/mobile-cicd.md § "One-time EAS project setup".
    url: 'https://u.expo.dev/CONFIRM-VPT-EAS-PROJECT-ID',
  },
  extra: {
    eas: {
      projectId: 'CONFIRM-VPT-EAS-PROJECT-ID',
    },
  },
};
```

> **HUMAN PREREQUISITE:** `CONFIRM-VPT-EAS-PROJECT-ID` (two occurrences) is the EAS project UUID. The human runs `cd apps/mobile && eas init` once (authenticated as the `ethanasm` Expo account); it creates the project and writes the real UUID. Until then EAS commands fail fast with a clear "project not configured" error — acceptable, since no CI runs before the human provisions credentials.

- [ ] **Step 4: Append credential filenames to `apps/mobile/.gitignore`**

Append these lines to `apps/mobile/.gitignore` (P2 created the file; appending is conflict-free with P3):
```
# P4 (mobile-cicd): store-submit credentials written to apps/mobile/ at CI
# time by mobile-deploy.yml. Never commit them.
play-service-account.json
asc-api-key.p8
```

- [ ] **Step 5: Verify the config still type-resolves**

Run (from repo root, with P2's mobile install present):
```bash
pnpm --filter mobile exec expo config --type public 2>&1 | grep -E '"projectId"|u\.expo\.dev|me\.ethanasm\.vpt' | head
```
Expected: output includes the `u.expo.dev/CONFIRM-VPT-EAS-PROJECT-ID` updates URL, the `projectId`, and `me.ethanasm.vpt`. (An Expo update notice printed first is fine.)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/eas.json apps/mobile/app.config.ts apps/mobile/.gitignore
git commit -m "ci: add EAS build/submit profiles and EAS project wiring for mobile"
```

---

### Task 2: Version-bump script + unit test

**Files:**
- Create: `scripts/bump-mobile-version.mjs`
- Test: `scripts/__tests__/bump-mobile-version.test.mjs`

**Interfaces:**
- Consumes: `apps/mobile/app.config.ts` containing exactly one `version: '<x.y.z>',` line (P2 ships `version: '0.1.0'`).
- Produces (for Task 3's `release` job): CLI `node scripts/bump-mobile-version.mjs --type patch|minor|major [--floor X.Y.Z]` (writes the new version to `app.config.ts`, prints it to stdout and nothing else) and `--print` (prints current version, no write). Pre-1.0 rule: `major` maps to `minor` while the major is `0`.

- [ ] **Step 1: Write the failing unit test**

Create `scripts/__tests__/bump-mobile-version.test.mjs`. Uses `node:test` (no new deps; matches the index's "unit tests use `node --test`" rule). It copies the real `app.config.ts` into a temp file, points the script at it via the `BUMP_MOBILE_CONFIG_PATH` env override (added in Step 3), and asserts the bump arithmetic on fixture versions:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'bump-mobile-version.mjs');

function withConfig(version, run) {
  const dir = mkdtempSync(join(tmpdir(), 'bump-'));
  const path = join(dir, 'app.config.ts');
  writeFileSync(path, `const config = {\n  name: 'Price Tracker',\n  version: '${version}',\n};\nexport default config;\n`);
  try {
    return run(path, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function bump(path, args) {
  return execFileSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, BUMP_MOBILE_CONFIG_PATH: path },
  }).trim();
}

test('--print returns the current version without writing', () => {
  withConfig('0.3.2', (path) => {
    assert.equal(bump(path, ['--print']), '0.3.2');
    assert.match(readFileSync(path, 'utf8'), /version: '0\.3\.2'/);
  });
});

test('patch bump increments the patch component', () => {
  withConfig('0.3.2', (path) => {
    assert.equal(bump(path, ['--type', 'patch']), '0.3.3');
    assert.match(readFileSync(path, 'utf8'), /version: '0\.3\.3'/);
  });
});

test('minor bump increments minor and zeroes patch', () => {
  withConfig('0.3.2', (path) => {
    assert.equal(bump(path, ['--type', 'minor']), '0.4.0');
  });
});

test('major bump maps to minor while pre-1.0', () => {
  withConfig('0.3.2', (path) => {
    assert.equal(bump(path, ['--type', 'major']), '0.4.0');
  });
});

test('major bump increments major once at or above 1.0', () => {
  withConfig('1.4.2', (path) => {
    assert.equal(bump(path, ['--type', 'major']), '2.0.0');
  });
});

test('--floor raises the base when the tag is ahead of the file', () => {
  withConfig('0.3.2', (path) => {
    // file says 0.3.2 but the last tag was 0.5.0 → patch off the floor → 0.5.1
    assert.equal(bump(path, ['--type', 'patch', '--floor', '0.5.0']), '0.5.1');
  });
});

test('--floor below the file version is ignored', () => {
  withConfig('0.3.2', (path) => {
    assert.equal(bump(path, ['--type', 'patch', '--floor', '0.1.0']), '0.3.3');
  });
});

test('rejects an invalid --type', () => {
  withConfig('0.3.2', (path) => {
    assert.throws(() => bump(path, ['--type', 'bogus']));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
node --test scripts/__tests__/bump-mobile-version.test.mjs
```
Expected: FAIL — every test errors because `scripts/bump-mobile-version.mjs` does not exist yet (`Cannot find module …/bump-mobile-version.mjs`).

- [ ] **Step 3: Write the script**

Create `scripts/bump-mobile-version.mjs` (mirrors showbook's `scripts/bump-mobile-version.mjs`, with one addition: a `BUMP_MOBILE_CONFIG_PATH` env override so the unit test can target a temp file — showbook hard-codes the path):
```js
#!/usr/bin/env node
// Bumps the mobile app version in apps/mobile/app.config.ts — the single
// source of truth for the user-facing version AND the expo-updates runtime
// (`runtimeVersion: { policy: 'appVersion' }`). Mirrors showbook's
// scripts/bump-mobile-version.mjs; see the Aurora index "Versioning"
// constraint for the scheme.
//
//   node scripts/bump-mobile-version.mjs --type patch|minor|major [--floor X.Y.Z]
//   node scripts/bump-mobile-version.mjs --print
//
// --type:  the bump to apply. While the major version is 0 (the beta line),
//          `major` is mapped to `minor` — the 1.0.0 jump is a deliberate
//          manual act, never automated.
// --floor: base the bump on max(file version, floor). The deploy workflow
//          passes the highest `mobile-v*` tag here so a queued run whose
//          checkout predates the previous run's bump commit can't re-issue an
//          already-used version.
// --print: print the current file version and exit without writing.
//
// Prints the resulting version to stdout (and nothing else), so callers can do
// NEW=$(node scripts/bump-mobile-version.mjs --type patch).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CONFIG_PATH =
  process.env.BUMP_MOBILE_CONFIG_PATH ||
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'apps/mobile/app.config.ts',
  );

// Matches exactly the `version: '0.1.0',` line in the ExpoConfig literal.
const VERSION_RE = /(\n\s*version:\s*')(\d+\.\d+\.\d+)(',)/g;

function fail(msg) {
  console.error(`[bump-mobile-version] ${msg}`);
  process.exit(1);
}

function parseVersion(s) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (!m) fail(`not a MAJOR.MINOR.PATCH version: '${s}'`);
  return m.slice(1).map(Number);
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

const args = process.argv.slice(2);
function flagValue(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

const source = readFileSync(CONFIG_PATH, 'utf8');
const matches = [...source.matchAll(VERSION_RE)];
if (matches.length !== 1) {
  fail(
    `expected exactly one version line in ${CONFIG_PATH}, found ${matches.length} — ` +
      `update VERSION_RE if the config format changed`,
  );
}
const current = parseVersion(matches[0][2]);

if (args.includes('--print')) {
  console.log(current.join('.'));
  process.exit(0);
}

const type = flagValue('--type');
if (!['patch', 'minor', 'major'].includes(type ?? '')) {
  fail(`--type must be patch, minor, or major (got '${type}')`);
}

const floorArg = flagValue('--floor');
let base = current;
if (floorArg) {
  const floor = parseVersion(floorArg);
  if (compareVersions(floor, base) > 0) base = floor;
}

// Pre-1.0 (beta line): breaking changes bump minor, not major.
const effectiveType = type === 'major' && base[0] === 0 ? 'minor' : type;

const next =
  effectiveType === 'major'
    ? [base[0] + 1, 0, 0]
    : effectiveType === 'minor'
      ? [base[0], base[1] + 1, 0]
      : [base[0], base[1], base[2] + 1];

const nextStr = next.join('.');
writeFileSync(CONFIG_PATH, source.replace(VERSION_RE, `$1${nextStr}$3`), 'utf8');
console.log(nextStr);
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
node --test scripts/__tests__/bump-mobile-version.test.mjs
```
Expected: PASS — `# pass 8`, `# fail 0`.

- [ ] **Step 5: Verify `--print` against the real config**

Run:
```bash
node scripts/bump-mobile-version.mjs --print
```
Expected: `0.1.0` (the version P2 shipped; no file write).

- [ ] **Step 6: Commit**

```bash
git add scripts/bump-mobile-version.mjs scripts/__tests__/bump-mobile-version.test.mjs
git commit -m "ci: add mobile version-bump script with conventional-commit support"
```

---

### Task 3: `mobile-deploy.yml` (OTA + plan + gated release) + failure-email script

**Files:**
- Create: `scripts/mobile-deploy-failure-email.sh`
- Create: `.github/workflows/mobile-deploy.yml`

**Interfaces:**
- Consumes: Task 1's `eas.json` profiles (`preview`, `preview-store`), Task 2's `scripts/bump-mobile-version.mjs`. GitHub secrets named in Global Constraints. The `Build Prod Images` workflow (VPT's existing per-merge image build).
- Produces: continuous OTA delivery on JS-only merges; gated store releases on native-affecting merges; the `mobile-release` GitHub environment (auto-created on first run, armed by the human).

- [ ] **Step 1: Create the failure-email script**

Create `scripts/mobile-deploy-failure-email.sh` (copied near-verbatim from `/Users/ethansmith/Developer/showbook/scripts/mobile-deploy-failure-email.sh`; only the subject-line product label changes — "Showbook" → "VPT mobile"):
```bash
#!/usr/bin/env bash
# Emails the eas-cli error summary + a direct link to the EAS build page when a
# mobile-deploy job fails, so the failure is actionable from the inbox without
# digging through the Actions log to find the Expo link and then logging into
# expo.dev. Invoked from the `if: failure()` steps in
# .github/workflows/mobile-deploy.yml — the `ota` and `release` jobs share this
# script so the notifier logic isn't duplicated across jobs.
#
# Best-effort by design: always exits 0 so the notifier's own errors can never
# mask the real failure, and silently no-ops when the email secrets aren't set.
#
# Expected env (set by the workflow step):
#   RESEND_API_KEY  — Resend API key
#   EMAIL_FROM      — verified Resend sender
#   ALERT_EMAILS    — comma-separated recipient list (ADMIN_EMAILS secret)
#   RUN_URL         — link to the Actions run
#   COMMIT_SHA      — the deployed commit
#   TRIGGER         — github.event_name
#   MODE            — update | build
# Reads the combined eas-cli output from $GITHUB_WORKSPACE/eas-output.log.

set +e  # never let the notifier's own errors mask the real failure
LOG="$GITHUB_WORKSPACE/eas-output.log"

if [ -z "${RESEND_API_KEY:-}" ] || [ -z "${EMAIL_FROM:-}" ] || [ -z "${ALERT_EMAILS:-}" ]; then
  echo "::warning::Mobile-deploy failure email skipped — set RESEND_API_KEY, EMAIL_FROM and ADMIN_EMAILS secrets to enable it."
  exit 0
fi

SHORT_SHA="${COMMIT_SHA:0:7}"
SUBJECT="🔴 VPT mobile deploy failed — ${SHORT_SHA} (${TRIGGER}/${MODE})"

BUILD_LINKS=""
if [ -f "$LOG" ]; then
  BUILD_LINKS=$(grep -oiE 'https://expo\.dev/[^ ]*builds/[a-z0-9-]+' "$LOG" | sort -u | head -5)
fi

if [ -f "$LOG" ]; then
  LOG_TAIL=$(sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g' "$LOG" \
    | tr -d '\r' \
    | tail -c 14000 \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g')
else
  LOG_TAIL="(no eas-cli output captured — the deploy failed before any EAS command ran; see the Actions run)"
fi

if [ -n "$BUILD_LINKS" ]; then
  BUILD_LINKS_HTML="<p><strong>EAS build page(s):</strong></p><ul>"
  while IFS= read -r url; do
    [ -n "$url" ] && BUILD_LINKS_HTML="${BUILD_LINKS_HTML}<li><a href=\"${url}\">${url}</a></li>"
  done <<< "$BUILD_LINKS"
  BUILD_LINKS_HTML="${BUILD_LINKS_HTML}</ul>"
else
  BUILD_LINKS_HTML="<p>No EAS build-page link found in the output (OTA update, or the failure happened before a build was queued).</p>"
fi

HTML="<h2>VPT mobile deploy failed</h2>
<p><strong>Commit:</strong> ${SHORT_SHA}<br>
<strong>Trigger:</strong> ${TRIGGER} / ${MODE}<br>
<strong>Actions run:</strong> <a href=\"${RUN_URL}\">${RUN_URL}</a></p>
${BUILD_LINKS_HTML}
<p><strong>eas-cli output (tail):</strong></p>
<pre style=\"background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto;font-size:12px;line-height:1.4\">${LOG_TAIL}</pre>"

TO_JSON=$(printf '%s' "$ALERT_EMAILS" \
  | jq -R 'split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))')

PAYLOAD=$(jq -n \
  --arg from "$EMAIL_FROM" \
  --argjson to "$TO_JSON" \
  --arg subject "$SUBJECT" \
  --arg html "$HTML" \
  '{from:$from, to:$to, subject:$subject, html:$html}')

RESP=$(curl -sS -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
echo "Resend response: $RESP"
if printf '%s' "$RESP" | grep -q '"id"'; then
  echo "Failure-notification email sent."
else
  echo "::warning::Resend did not return a message id — the email may not have been delivered. See the response above."
fi
exit 0
```

- [ ] **Step 2: Make the script executable + lint it**

Run:
```bash
chmod +x scripts/mobile-deploy-failure-email.sh
bash -n scripts/mobile-deploy-failure-email.sh && echo "bash syntax OK"
```
Expected: `bash syntax OK` (no output from `bash -n` means valid syntax).

- [ ] **Step 3: Create `.github/workflows/mobile-deploy.yml`**

Adapted from `/Users/ethansmith/Developer/showbook/.github/workflows/mobile-deploy.yml`. Adaptations: trigger `workflows: ["Build Prod Images"]` instead of `["CI"]`; action majors match VPT (`checkout@v4`, `pnpm/action-setup@v4` pinned `9.12.1`, `setup-node@v4`); OTA env mirrors the `eas.json` preview placeholders; the native-diff path list drops showbook's `modules/` (VPT mobile has no local Expo Modules — keep `package.json`/`app.config.ts`/`eas.json`/`assets/`); product label in the bump commit is `mobile vX.Y.Z`.

Create `.github/workflows/mobile-deploy.yml`:
```yaml
name: Mobile Deploy (preview)

# Continuous mobile deployment, with an approval gate on store releases.
#
#  - OTA path (ungated): JS-only changes run `eas update --branch preview`,
#    pushing a fresh JS bundle to the preview channel. Stays fully automatic.
#  - Release path (gated): changes that need a new native binary (added plugin,
#    new native dep, new permission, changed assets — detected against the
#    parent commit) route to the `release` job, which targets the
#    `mobile-release` GitHub environment. With a required reviewer configured,
#    the job PAUSES before any side effect (version bump, EAS build, store
#    submit) until someone approves. Reject / let the window lapse → the run
#    dies clean: no bump, no mobile-v* tag, no build, no upload. The version
#    scan is range-based (everything since the last mobile-v* tag), so skipping
#    a release loses nothing.
#
#    ONE-TIME SETUP (the gate is FAIL-OPEN until done): GitHub auto-creates the
#    `mobile-release` environment with no protection on first run → releases
#    ship immediately. To arm the gate: Settings → Environments →
#    mobile-release → check "Required reviewers" → add yourself → Save. See
#    docs/mobile-cicd.md § "Release approval gate".
#
# Versioning is automated on the release path. After approval, before
# `eas build`, the workflow bumps `version` in apps/mobile/app.config.ts,
# commits it back to main with [skip ci], and tags `mobile-vX.Y.Z`. Minor vs
# patch is decided by scanning squash-merge subjects on main since the last
# `mobile-v*` tag: any `feat:` (or a breaking `!`) → minor, otherwise patch
# (pre-1.0 the 1.0.0 jump is manual). The OTA path NEVER bumps. A manual bump
# in the triggering merge is respected. workflow_dispatch `bump` overrides the
# scan. The bump-back push has to clear main's required-PR rule, and the
# built-in github-actions app can NOT be on a ruleset bypass list — so the push
# authenticates as a deploy key (RELEASE_DEPLOY_KEY; recommended) or a
# bypass-listed PAT (RELEASE_PUSH_TOKEN). [skip ci] in the bump commit
# suppresses CI, and this deploy only runs off Build-Prod-Images completion /
# manual dispatch, so the bump can't loop.
#
# Approved builds auto-submit to the preview store track on BOTH platforms via
# `eas submit`: Android → Play internal (PLAY_SERVICE_ACCOUNT_JSON), iOS →
# TestFlight internal (ASC_API_KEY_* secrets).
#
# Required secrets (Settings → Secrets → Actions):
#  - EXPO_TOKEN — eas-cli access token (drives update + build + submit).
#  - PLAY_SERVICE_ACCOUNT_JSON — Google service-account key JSON with Play
#    "Manage testing track releases" on the VPT app.
#  - ASC_API_KEY_P8 — App Store Connect API .p8 contents.
#  - ASC_API_KEY_ID — key id of that .p8.
#  - ASC_API_KEY_ISSUER_ID — issuer id from the ASC Integrations page.
#  - ASC_APP_ID — numeric Apple ID of the VPT app record.
#  - RELEASE_DEPLOY_KEY (or RELEASE_PUSH_TOKEN) — for the version-bump pushback.
# Optional (failure email): RESEND_API_KEY, EMAIL_FROM, ADMIN_EMAILS.

on:
  workflow_run:
    workflows: ["Build Prod Images"]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      mode:
        description: "update (OTA JS) or build (new native binary; pauses at the mobile-release gate, then auto-submits to Play internal / TestFlight)"
        type: choice
        options:
          - update
          - build
        default: update
      platform:
        description: "Platform (only used in build mode)"
        type: choice
        options:
          - ios
          - android
          - all
        default: android
      bump:
        description: "Version bump (build mode only): auto scans commits since the last mobile-v* tag; none ships the version already in app.config.ts"
        type: choice
        options:
          - auto
          - patch
          - minor
          - none
        default: auto

permissions:
  contents: read

defaults:
  run:
    shell: bash

jobs:
  plan:
    name: Decide OTA vs build
    if: >-
      ${{ github.event_name == 'workflow_dispatch' ||
          (github.event.workflow_run.conclusion == 'success' &&
           github.event.workflow_run.head_branch == 'main' &&
           github.event.workflow_run.event != 'pull_request') }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      needs_build: ${{ steps.detect-native.outputs.needs_build }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
          fetch-depth: 0

      # Native changes can't ship via `eas update` (OTA only swaps the JS
      # bundle). We watch the paths that flow into the native binary; anything
      # else under apps/mobile/ (app/, components/, lib/, e2e/, tests) is
      # OTA-shippable. VPT mobile has no local Expo Modules dir, so the watched
      # set is package.json + app.config.ts + eas.json + assets/.
      - name: Detect native changes
        id: detect-native
        run: |
          if git rev-parse HEAD~1 >/dev/null 2>&1; then
            CHANGED=$(git diff --name-only HEAD~1 HEAD -- \
              'apps/mobile/package.json' \
              'apps/mobile/app.config.ts' \
              'apps/mobile/eas.json' \
              'apps/mobile/assets/' \
              || true)
            if [ -n "$CHANGED" ]; then
              echo "needs_build=true" >> "$GITHUB_OUTPUT"
              {
                echo "### Native-affecting paths changed — routing to the gated release job"
                echo ""
                echo '```'
                echo "$CHANGED"
                echo '```'
              } >> "$GITHUB_STEP_SUMMARY"
            else
              echo "needs_build=false" >> "$GITHUB_OUTPUT"
            fi
          else
            # No parent commit — fail-safe to a build (skipping a needed binary
            # ships a broken OTA; an unnecessary build only costs EAS time + a
            # one-click approval).
            echo "needs_build=true" >> "$GITHUB_OUTPUT"
            echo "### HEAD~1 unresolvable — defaulting to build" >> "$GITHUB_STEP_SUMMARY"
          fi

  ota:
    name: Push OTA update
    needs: plan
    if: >-
      (github.event_name == 'workflow_run' && needs.plan.outputs.needs_build != 'true')
      || (github.event_name == 'workflow_dispatch' && inputs.mode == 'update')
    runs-on: ubuntu-latest
    timeout-minutes: 20
    concurrency:
      group: mobile-deploy-ota
      cancel-in-progress: false
    env:
      EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.12.1

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Push OTA update
        working-directory: apps/mobile
        env:
          # `eas update` does NOT read the eas.json build-profile `env` block —
          # that's build-only. For OTA the vars must be in the shell so Metro
          # inlines them. Mirror eas.json's preview profile. These are public
          # (EXPO_PUBLIC_ ships in the bundle anyway). KEEP IN SYNC with
          # apps/mobile/eas.json. HUMAN PREREQUISITE: replace the placeholders.
          EXPO_PUBLIC_API_URL: https://CONFIRM-VPT-PROD-DOMAIN
          EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_IOS: CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-IOS.apps.googleusercontent.com
          EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_ANDROID: CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-ANDROID.apps.googleusercontent.com
          EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_WEB: CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-WEB.apps.googleusercontent.com
        run: |
          MSG=$(git -C "$GITHUB_WORKSPACE" log -1 --pretty=%s)
          pnpm dlx eas-cli update \
            --branch preview \
            --message "$MSG" \
            --non-interactive 2>&1 | tee -a "$GITHUB_WORKSPACE/eas-output.log"

      - name: Email error logs on failure
        if: failure()
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          ALERT_EMAILS: ${{ secrets.ADMIN_EMAILS }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          COMMIT_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}
          TRIGGER: ${{ github.event_name }}
          MODE: update
        run: bash scripts/mobile-deploy-failure-email.sh

      - name: Summary
        if: always()
        run: |
          {
            echo "### Mobile deploy (OTA)"
            echo ""
            echo "- Trigger: ${{ github.event_name }}"
            echo "- Mode: update"
            echo "- Status: ${{ job.status }}"
            echo "- Channel: preview"
            echo "- Version: unchanged (OTA)"
          } >> "$GITHUB_STEP_SUMMARY"

  release:
    name: Build + submit to stores (gated)
    needs: plan
    if: >-
      (github.event_name == 'workflow_dispatch' && inputs.mode == 'build')
      || (github.event_name == 'workflow_run' && needs.plan.outputs.needs_build == 'true')
    runs-on: ubuntu-latest
    # THE RELEASE GATE. With a required reviewer on this environment, the job
    # waits here — before the bump, the builds, and the submits — until
    # approved. Without protection rules it's pass-through (fail-open). See
    # docs/mobile-cicd.md § "Release approval gate".
    environment: mobile-release
    concurrency:
      group: mobile-deploy-release
      cancel-in-progress: false
    permissions:
      contents: write
    timeout-minutes: 75
    env:
      EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
          # main's ruleset requires PRs, which rejects GITHUB_TOKEN pushes. The
          # built-in github-actions app can NOT be bypass-listed, so the
          # bump-back push authenticates with one of these (preference order):
          #  1. RELEASE_DEPLOY_KEY — deploy key with write; "Deploy keys"
          #     checked in the ruleset bypass list. Recommended.
          #  2. RELEASE_PUSH_TOKEN — fine-grained PAT (Contents: read/write)
          #     from a bypass-listed actor.
          #  3. GITHUB_TOKEN fallback — can fetch, but the bump push WILL be
          #     rejected while the required-PR rule has no usable bypass.
          ssh-key: ${{ secrets.RELEASE_DEPLOY_KEY }}
          token: ${{ secrets.RELEASE_PUSH_TOKEN || github.token }}
          fetch-depth: 0

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.12.1

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # Runs only after approval. Decides the bump, edits app.config.ts via
      # scripts/bump-mobile-version.mjs, commits + tags mobile-vX.Y.Z, pushes
      # back to main. The push happens BEFORE eas build so a binary can never
      # ship a version git doesn't know about.
      - name: Bump app version
        id: bump-version
        env:
          BUMP_INPUT: ${{ inputs.bump || 'auto' }}
        run: |
          set -euo pipefail

          git fetch origin main
          if ! git merge-base --is-ancestor HEAD origin/main; then
            echo "::warning::HEAD is not on main — skipping version bump, building with the version already in app.config.ts."
            echo "version=$(node scripts/bump-mobile-version.mjs --print)" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          BUMP="$BUMP_INPUT"

          # Respect a manual bump in the triggering commit.
          if git diff HEAD~1 HEAD -- apps/mobile/app.config.ts | grep -E "^[+-][[:space:]]*version: '" >/dev/null; then
            echo "Version line changed in the triggering commit — respecting the manual bump."
            BUMP=none
          fi

          LAST_TAG=$(git tag -l 'mobile-v*' --sort=-v:refname | sed -n 1p)

          if [ "$BUMP" = "auto" ]; then
            RANGE="${LAST_TAG:+${LAST_TAG}..HEAD}"
            RANGE="${RANGE:-HEAD~1..HEAD}"
            SUBJECTS=$(git log --format=%s "$RANGE" -- || true)
            if echo "$SUBJECTS" | grep -E '^[a-z]+(\([^)]*\))?!:' >/dev/null; then
              BUMP=major
            elif echo "$SUBJECTS" | grep -iE '^feat(\([^)]*\))?:' >/dev/null; then
              BUMP=minor
            else
              BUMP=patch
            fi
            echo "Scanned ${RANGE} → bump type: ${BUMP}"
          fi

          if [ "$BUMP" = "none" ]; then
            VERSION=$(node scripts/bump-mobile-version.mjs --print)
            echo "version=$VERSION" >> "$GITHUB_OUTPUT"
            echo "### Version: ${VERSION} (no auto-bump)" >> "$GITHUB_STEP_SUMMARY"
            exit 0
          fi

          FLOOR="${LAST_TAG#mobile-v}"
          NEW=$(node scripts/bump-mobile-version.mjs --type "$BUMP" ${LAST_TAG:+--floor "$FLOOR"})
          while git rev-parse -q --verify "refs/tags/mobile-v$NEW" >/dev/null; do
            NEW=$(node scripts/bump-mobile-version.mjs --type patch)
          done

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout -B main
          git add apps/mobile/app.config.ts
          git commit -m "chore(release): mobile v${NEW} [skip ci]"
          git tag "mobile-v${NEW}"
          for i in 1 2 3; do
            if git push --atomic origin main "mobile-v${NEW}" 2>&1 | tee /tmp/bump-push.log; then
              break
            fi
            if grep -qiE 'protected branch|GH006|GH013' /tmp/bump-push.log; then
              echo "::error::main's protection rejected the version-bump push. The built-in github-actions app cannot be added to a ruleset bypass list, so configure one of: (1) recommended — check 'Deploy keys' in the ruleset bypass list, add a write-access deploy key, save its private key as RELEASE_DEPLOY_KEY; (2) a PAT from a bypass-listed actor as RELEASE_PUSH_TOKEN. Details: docs/mobile-cicd.md § Versioning."
              exit 1
            fi
            if [ "$i" = 3 ]; then
              echo "Could not push the version-bump commit after 3 attempts." >&2
              exit 1
            fi
            git fetch origin main
            git rebase origin/main
          done

          echo "version=$NEW" >> "$GITHUB_OUTPUT"
          echo "### Version: ${NEW} (${BUMP} bump, tagged mobile-v${NEW})" >> "$GITHUB_STEP_SUMMARY"

      - name: Build Android AAB (preview-store profile)
        id: build-android
        if: >-
          github.event_name == 'workflow_run'
          || inputs.platform == 'android' || inputs.platform == 'all'
        working-directory: apps/mobile
        run: |
          pnpm dlx eas-cli build \
            --profile preview-store \
            --platform android \
            --non-interactive \
            --wait 2>&1 | tee -a "$GITHUB_WORKSPACE/eas-output.log"

      - name: Submit Android AAB to Play internal track
        if: steps.build-android.outcome == 'success'
        working-directory: apps/mobile
        env:
          PLAY_SA_JSON: ${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}
        run: |
          if [ -z "${PLAY_SA_JSON:-}" ]; then
            echo "PLAY_SERVICE_ACCOUNT_JSON secret is not set — cannot submit to Play." >&2
            echo "See workflow header comment for setup." >&2
            exit 1
          fi
          # The submit profile resolves serviceAccountKeyPath relative to
          # eas.json (working dir is apps/mobile/). Write the secret there.
          SA="./play-service-account.json"
          printf '%s' "$PLAY_SA_JSON" > "$SA"
          chmod 600 "$SA"
          pnpm dlx eas-cli submit \
            --profile preview-store \
            --platform android \
            --latest \
            --non-interactive 2>&1 | tee -a "$GITHUB_WORKSPACE/eas-output.log"
          rm -f "$SA"

      # iOS mirrors Android. Prereq (one-time, interactive): the App Store
      # distribution cert + provisioning profile must already be in EAS
      # credentials — run `eas build --profile preview-store --platform ios`
      # once locally so EAS generates them; CI can't answer the prompts.
      - name: Build iOS IPA (preview-store profile)
        id: build-ios
        if: >-
          github.event_name == 'workflow_run'
          || inputs.platform == 'ios' || inputs.platform == 'all'
        working-directory: apps/mobile
        run: |
          pnpm dlx eas-cli build \
            --profile preview-store \
            --platform ios \
            --non-interactive \
            --wait 2>&1 | tee -a "$GITHUB_WORKSPACE/eas-output.log"

      - name: Submit iOS IPA to TestFlight internal testing
        if: steps.build-ios.outcome == 'success'
        working-directory: apps/mobile
        env:
          ASC_API_KEY_P8: ${{ secrets.ASC_API_KEY_P8 }}
          ASC_API_KEY_ID: ${{ secrets.ASC_API_KEY_ID }}
          ASC_API_KEY_ISSUER_ID: ${{ secrets.ASC_API_KEY_ISSUER_ID }}
          ASC_APP_ID: ${{ secrets.ASC_APP_ID }}
        run: |
          for v in ASC_API_KEY_P8 ASC_API_KEY_ID ASC_API_KEY_ISSUER_ID ASC_APP_ID; do
            if [ -z "${!v:-}" ]; then
              echo "$v secret is not set — cannot submit to TestFlight." >&2
              echo "See workflow header comment for setup." >&2
              exit 1
            fi
          done
          # ascApiKeyPath resolves relative to eas.json; the key id / issuer id /
          # app id have no CLI flag and eas.json has no env substitution, so
          # inject them into the submit profile with jq. The edit lives only on
          # the ephemeral runner; the .p8 is gitignored so a stray git add can't
          # commit it.
          KEY="./asc-api-key.p8"
          printf '%s' "$ASC_API_KEY_P8" > "$KEY"
          chmod 600 "$KEY"
          jq --arg keyId "$ASC_API_KEY_ID" \
             --arg issuerId "$ASC_API_KEY_ISSUER_ID" \
             --arg appId "$ASC_APP_ID" \
             '.submit."preview-store".ios += {ascApiKeyId: $keyId, ascApiKeyIssuerId: $issuerId, ascAppId: $appId}' \
             eas.json > eas.json.tmp && mv eas.json.tmp eas.json
          pnpm dlx eas-cli submit \
            --profile preview-store \
            --platform ios \
            --latest \
            --non-interactive 2>&1 | tee -a "$GITHUB_WORKSPACE/eas-output.log"
          rm -f "$KEY"
          git checkout -- eas.json || true

      - name: Email error logs on failure
        if: failure()
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          ALERT_EMAILS: ${{ secrets.ADMIN_EMAILS }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          COMMIT_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}
          TRIGGER: ${{ github.event_name }}
          MODE: build
        run: bash scripts/mobile-deploy-failure-email.sh

      - name: Summary
        if: always()
        run: |
          {
            echo "### Mobile deploy (store release)"
            echo ""
            echo "- Trigger: ${{ github.event_name }}"
            echo "- Mode: build"
            echo "- Status: ${{ job.status }}"
            echo "- Channel: preview"
            echo "- Version: ${{ steps.bump-version.outputs.version || 'unknown' }}"
          } >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 4: Validate the workflow with actionlint**

Run (actionlint via its container so no install is needed; falls back to `go run` or the static binary if Docker is unavailable):
```bash
docker run --rm -v "$(git -C /Users/ethansmith/Developer/vacation-price-tracker rev-parse --show-toplevel)":/repo --workdir /repo rhysd/actionlint:latest -color .github/workflows/mobile-deploy.yml
```
Expected: no output and exit 0 (actionlint prints nothing when a workflow is clean). If Docker isn't available, run `actionlint .github/workflows/mobile-deploy.yml` after `brew install actionlint`; same expected result. (Note: actionlint does not resolve `workflow_run` cross-workflow references, so a clean run here is the gate.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/mobile-deploy.yml scripts/mobile-deploy-failure-email.sh
git commit -m "ci: add gated mobile deploy workflow (OTA + EAS build/submit)"
```

---

### Task 4: Maestro e2e flows + dry-run validator + scripts

**Files:**
- Create: `apps/mobile/e2e/config.yaml`
- Create: `apps/mobile/e2e/flows/sign-in.yaml`
- Create: `apps/mobile/e2e/flows/trips-list.yaml`
- Create: `apps/mobile/e2e/flows/trip-detail.yaml`
- Create: `apps/mobile/e2e/flows/create-trip.yaml`
- Create: `apps/mobile/e2e/scripts/dry-run.mjs`
- Modify (scripts only): `apps/mobile/package.json` and root `package.json` — add `e2e:dry` / `e2e:ios` and `mobile:e2e:*` delegators (Step 7, conflict-aware)

**Interfaces:**
- Consumes (from P2/P3): the **canonical E2E testID contract** the Aurora index defines (P3's screens expose these exact testIDs). The flows tap them verbatim — they are the contract, not ad-hoc guesses.
- Consumes (from Task 5): `EXPO_PUBLIC_E2E_MODE=1` flips `apps/mobile/lib/auth.ts` (P2) into bypass mode; `EXPO_PUBLIC_E2E_TEST_TOKEN` / `EXPO_PUBLIC_E2E_TEST_USER_JSON` are the minted session, inlined at build time.
- Produces (for Task 5): the flow directory `apps/mobile/e2e/flows/` and `pnpm --filter mobile e2e:dry` validator the workflow runs before booting the emulator.

> **Canonical E2E testID contract (authoritative — from the Aurora index).** P3's screens expose these exact testIDs; the flows below tap them verbatim. Do NOT invent ad-hoc ids.
> - Sign-in: `sign-in-google-button` (Google-OAuth-only per guardrails).
> - Tab bar: `Trips`, `Alerts`, `Chat` labels visible. Create-trip affordance: `new-trip-fab`.
> - Trips list: container `trips-list`; each trip row `trip-card` (bare — Maestro taps the first match, so no `-row-0` suffix). A seeded e2e trip named "Maestro Test Trip" renders there.
> - Trip detail: stat blocks `trip-detail-flight-stat`, `trip-detail-hotel-stat`, `trip-detail-total-stat`; selectable options `flight-option` / `hotel-option` (id-suffixed `flight-option-${id}` / `hotel-option-${id}` when disambiguation is needed).
> - Create-trip form: `create-trip-name-input`, `create-trip-origin-input`, `create-trip-destination-input`, submit `create-trip-submit`.
> - Chat: `chat-input`, `chat-send`, `assistant-message`. Alerts: `alerts-list`.
> - **Post-create assertion contract:** there is NO saved-confirmation testID. After submitting, navigate back to Trips and `assertVisible` the new trip's **name text** inside `trips-list`. That round-trip is the create contract.

- [ ] **Step 1: Create `apps/mobile/e2e/config.yaml`**

Mirrors showbook's `e2e/config.yaml`. `appId` must match `me.ethanasm.vpt` (the bundle id P2 set).
```yaml
# Maestro project-level config for the VPT mobile app.
#
# Discovery: every YAML under flows/ is a flow file Maestro executes when this
# directory is passed to `maestro test`. .github/workflows/mobile-e2e.yml runs
# the whole directory against a self-hosted Android emulator nightly + on
# push-to-main + on PRs labeled `mobile-visual`.
#
# Bundle id: must match ios.bundleIdentifier and android.package in
# apps/mobile/app.config.ts. Kept in sync manually — if either id changes,
# update this file too.
#
# `e2e` builds set EXPO_PUBLIC_E2E_MODE=1 (see apps/mobile/eas.json), which
# flips apps/mobile/lib/auth.ts into the Maestro bypass branch: the sign-in tap
# loads a pre-baked VPT JWT instead of running real Google OAuth. Production
# builds ship with the var unset, so this branch is dead code there.
flows:
  - flows/

appId: me.ethanasm.vpt

# Wider implicit waitFor budget — first launch warms the REST client and
# restores the SecureStore session, both of which take a few seconds cold in CI.
defaultTimeout: 30000
```

- [ ] **Step 2: Create `apps/mobile/e2e/flows/sign-in.yaml`**

```yaml
# Sign-in flow — Maestro
#
# The `e2e` build profile (apps/mobile/eas.json) + the mobile-e2e workflow set:
#   EXPO_PUBLIC_E2E_MODE=1            — flip lib/auth.ts into bypass mode
#   EXPO_PUBLIC_E2E_TEST_TOKEN        — pre-baked VPT JWT
#   EXPO_PUBLIC_E2E_TEST_USER_JSON    — pre-baked user JSON
#
# These are inlined at build time, so the auth helper returns the bundled
# session as soon as the user taps "Sign in with Google" — no deeplink seeding.
# The bypass guards on EXPO_PUBLIC_E2E_MODE === '1' so it's dead code in store
# builds.
appId: me.ethanasm.vpt
name: sign-in
tags:
  - critical
  - auth
---
- launchApp:
    clearState: true
    clearKeychain: true

# The CTA can sit below the fold on Pixel-6-sized AVDs; scroll it into view
# before tapping. Accept partial visibility + let each scroll settle so a cold
# launch where the CTA lands under the gesture nav doesn't time out at 100%.
- scrollUntilVisible:
    element:
      id: "sign-in-google-button"
    direction: DOWN
    visibilityPercentage: 60
    waitToSettleTimeoutMs: 500
    timeout: 30000

- assertVisible:
    id: "sign-in-google-button"

- tapOn:
    id: "sign-in-google-button"

# After the bypass writes the cached session and re-renders, the auth gate
# routes to the tab shell. Assert the three Aurora tabs + the create-trip FAB.
- assertVisible:
    text: "Trips"
- assertVisible:
    text: "Alerts"
- assertVisible:
    text: "Chat"
- assertVisible:
    id: "new-trip-fab"
```

- [ ] **Step 3: Create `apps/mobile/e2e/flows/trips-list.yaml`**

```yaml
# Trips-list flow — Maestro
#
# Verifies the trips list loads from the e2e backend. The seeded e2e trip
# ("Maestro Test Trip") is created by create-trip.yaml and persists in the e2e
# database across flows/runs, so a `trip-card` row renders here. If this
# assertion fails while sign-in passes, suspect the backend: e2e stack down, or
# P5's Bearer-header support not yet merged (the bearer token 401s → empty trips
# list). See .github/workflows/mobile-e2e.yml § "Mint e2e session".
appId: me.ethanasm.vpt
name: trips-list
tags:
  - critical
  - read
---
- launchApp:
    clearState: true
    clearKeychain: true

- scrollUntilVisible:
    element:
      id: "sign-in-google-button"
    direction: DOWN
    visibilityPercentage: 60
    waitToSettleTimeoutMs: 500
    timeout: 30000
- tapOn:
    id: "sign-in-google-button"

- assertVisible:
    text: "Trips"

# The trips list is server-fed; the seeded trip appearing proves the bearer
# round-trip and a real refetch, not just an optimistic cache. `trip-card` is
# the bare row testID — Maestro matches the first one.
- assertVisible:
    id: "trips-list"
- assertVisible:
    id: "trip-card"
- assertVisible:
    text: "Maestro Test Trip"
```

- [ ] **Step 4: Create `apps/mobile/e2e/flows/trip-detail.yaml`**

```yaml
# Trip-detail flow — Maestro
#
# Opens the seeded trip and verifies the detail screen renders its title and the
# stat blocks. Depends on a `trip-card` row = "Maestro Test Trip" from
# create-trip.yaml (Maestro taps the first `trip-card` match).
appId: me.ethanasm.vpt
name: trip-detail
tags:
  - critical
  - read
---
- launchApp:
    clearState: true
    clearKeychain: true

- scrollUntilVisible:
    element:
      id: "sign-in-google-button"
    direction: DOWN
    visibilityPercentage: 60
    waitToSettleTimeoutMs: 500
    timeout: 30000
- tapOn:
    id: "sign-in-google-button"

- assertVisible:
    text: "Trips"

- tapOn:
    id: "trip-card"

# Detail screen mounted: the seeded trip's title plus the three Aurora stat
# blocks (flight / hotel / total) confirm the detail screen and its price block
# loaded.
- assertVisible:
    text: "Maestro Test Trip"
- assertVisible:
    id: "trip-detail-flight-stat"
- assertVisible:
    id: "trip-detail-hotel-stat"
- assertVisible:
    id: "trip-detail-total-stat"
```

- [ ] **Step 5: Create `apps/mobile/e2e/flows/create-trip.yaml`**

```yaml
# Create-trip flow — Maestro
#
# End-to-end create path: sign-in, open the create-trip form, fill required
# fields, submit, verify the backend round-trip. The create call hits the e2e
# backend (infra/docker-compose.e2e.yml) which the emulator reaches at
# EXPO_PUBLIC_API_URL=http://10.0.2.2:8010 — the emulator NAT alias for the
# runner host's loopback.
#
# The created trip ("Maestro Test Trip") persists in the e2e database across
# flows/runs and is the `trip-card` target for trips-list / trip-detail. The
# create contract has NO saved-confirmation testID — the proof is the new name
# appearing back in `trips-list` after navigating to Trips. If that final
# assertion fails while the form steps pass, suspect the backend: stack down,
# P5 Bearer-header support not merged, or allowlist drift in .env.e2e.
appId: me.ethanasm.vpt
name: create-trip
tags:
  - critical
  - write
---
- launchApp:
    clearState: true
    clearKeychain: true

- scrollUntilVisible:
    element:
      id: "sign-in-google-button"
    direction: DOWN
    visibilityPercentage: 60
    waitToSettleTimeoutMs: 500
    timeout: 30000
- tapOn:
    id: "sign-in-google-button"

- assertVisible:
    text: "Trips"

# Open the create-trip form via the FAB.
- tapOn:
    id: "new-trip-fab"

- assertVisible:
    id: "create-trip-name-input"

- tapOn:
    id: "create-trip-name-input"
- inputText: "Maestro Test Trip"

- tapOn:
    id: "create-trip-origin-input"
- inputText: "SEA"

- tapOn:
    id: "create-trip-destination-input"
- inputText: "Maui"

# Dismiss the IME before submitting so Gboard's content-description elements
# don't compete with the submit control.
- hideKeyboard

- tapOn:
    id: "create-trip-submit"

# Create contract: no saved-confirmation card. Navigate back to Trips and assert
# the new trip's NAME is visible inside `trips-list` — the server-fed list
# showing the row proves the create committed and survives a refetch.
- tapOn:
    text: "Trips"
- assertVisible:
    id: "trips-list"
- assertVisible:
    text: "Maestro Test Trip"
```

- [ ] **Step 6: Create `apps/mobile/e2e/scripts/dry-run.mjs`**

Copied verbatim from showbook's `apps/mobile/e2e/scripts/dry-run.mjs` (it's project-agnostic — validates two-document YAML shape + non-empty `appId` + non-empty command list). Uses the `yaml` package, which is already in the workspace tree (it's a transitive dep + an explicit pnpm override in root `package.json`); no new dependency.
```js
#!/usr/bin/env node
// Validates Maestro flow YAML without launching a device. Maestro has no
// --dry-run flag, so we parse each file as a two-document YAML (config +
// commands) and sanity-check the shape.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseAllDocuments } from 'yaml';

const root = resolve(process.argv[2] ?? 'e2e/flows');

function collectFlowFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) return target.endsWith('.yaml') || target.endsWith('.yml') ? [target] : [];
  return readdirSync(target).flatMap((name) => collectFlowFiles(join(target, name)));
}

const files = collectFlowFiles(root);
if (files.length === 0) {
  console.error(`No flow files found under ${root}`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const docs = parseAllDocuments(source, { prettyErrors: true });

  const errors = docs.flatMap((d) => d.errors);
  if (errors.length > 0) {
    console.error(`✗ ${file}`);
    for (const err of errors) console.error(`  ${err.message}`);
    failed++;
    continue;
  }

  if (docs.length !== 2) {
    console.error(`✗ ${file}: expected 2 YAML documents (config + commands), got ${docs.length}`);
    failed++;
    continue;
  }

  const config = docs[0].toJS();
  const commands = docs[1].toJS();

  if (!config || typeof config.appId !== 'string' || config.appId.length === 0) {
    console.error(`✗ ${file}: missing or invalid appId in config document`);
    failed++;
    continue;
  }

  if (!Array.isArray(commands) || commands.length === 0) {
    console.error(`✗ ${file}: commands document must be a non-empty list`);
    failed++;
    continue;
  }

  console.log(`✓ ${file} (${commands.length} steps, appId=${config.appId})`);
}

if (failed > 0) {
  console.error(`\n${failed} flow file(s) failed validation`);
  process.exit(1);
}
console.log(`\n${files.length} flow file(s) OK`);
```

- [ ] **Step 7: Add the e2e scripts (conflict-aware) and validate**

> **Conflict-avoidance note:** Per the index, if P3 and P4 run truly simultaneously, P4 must not edit `apps/mobile/package.json`. The flows + validator + workflow above are fully functional **without** any `package.json` script — Task 5's workflow can call `node e2e/scripts/dry-run.mjs e2e/flows` directly. So this step is **optional convenience**: add the scripts only if `apps/mobile/package.json` is not being edited by an in-flight P3 change. If it is, skip the script additions (the workflow's direct `node …` invocation, given in Task 5, still works) and note it in the task's completion.

If safe to edit, add to `apps/mobile/package.json` `scripts`:
```json
{
  "e2e:dry": "node e2e/scripts/dry-run.mjs e2e/flows",
  "e2e:ios": "maestro test e2e/flows"
}
```
And to root `package.json` `scripts` (only if P2 didn't already add these — check first with the command below):
```json
{
  "mobile:e2e:dry": "pnpm --filter mobile e2e:dry",
  "mobile:e2e:ios": "pnpm --filter mobile e2e:ios"
}
```
Check before editing root:
```bash
node -e "const p=require('/Users/ethansmith/Developer/vacation-price-tracker/package.json'); console.log(p.scripts['mobile:e2e:dry'] ? 'EXISTS-skip' : 'ADD')"
```

Validate the flows regardless of whether scripts were added:
```bash
cd /Users/ethansmith/Developer/vacation-price-tracker/apps/mobile && node e2e/scripts/dry-run.mjs e2e/flows
```
Expected:
```
✓ .../e2e/flows/create-trip.yaml (N steps, appId=me.ethanasm.vpt)
✓ .../e2e/flows/sign-in.yaml (N steps, appId=me.ethanasm.vpt)
✓ .../e2e/flows/trip-detail.yaml (N steps, appId=me.ethanasm.vpt)
✓ .../e2e/flows/trips-list.yaml (N steps, appId=me.ethanasm.vpt)

4 flow file(s) OK
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/e2e
# include package.json only if Step 7 edited it:
git add apps/mobile/package.json package.json 2>/dev/null || true
git commit -m "test: add Maestro e2e flows and dry-run validator for mobile"
```

---

### Task 5: `mobile-e2e.yml` (self-hosted Android emulator + Maestro) + isolated e2e stack + e2e cleartext config

**Files:**
- Create: `infra/docker-compose.e2e.yml`
- Create: `.github/workflows/mobile-e2e.yml`
- Modify: `apps/mobile/app.config.ts` (add the `IS_E2E_BUILD` Android cleartext exception — release-adjacent config, P4's territory)

**Interfaces:**
- Consumes: Task 4's flows + `dry-run.mjs`; Task 6's `setup-runner-android.sh` (provisions the `vpt-prod` runner's Android SDK/AVD/Maestro); P2's `apps/mobile/lib/auth.ts` E2E bypass; P5's `POST /v1/e2e/mint-token` endpoint + Bearer-header support (dependencies noted below).
- Produces: `infra/docker-compose.e2e.yml` (the isolated `vpt-e2e` stack) + the nightly/push/label-gated Android e2e gate.

> **VPT e2e backend stack — P4 owns the compose file.** Showbook runs an isolated `showbook-e2e` compose stack (own DB, AUTH_SECRET, allowlist) on the prod box and mints the bearer **inside** the web container using next-auth. VPT differs: auth is FastAPI JWT. P4 **authors `infra/docker-compose.e2e.yml`** (Step 1 below) — the isolated `vpt-e2e` API+DB(+redis+temporal) stack, mirroring `infra/docker-compose.prod.yml`, with its own database, `SECRET_KEY`, a sign-in allowlist pinned to the synthetic e2e user, and the API bound to loopback `127.0.0.1:8010` (the emulator reaches it at `http://10.0.2.2:8010`). *Bringing the stack up* on the prod box stays a documented one-time human/ops step (Task 6 runbook). The mint step asks that backend to issue a JWT via **P5's** e2e-only `POST /v1/e2e/mint-token` endpoint (guarded by the `VPT_E2E_BACKEND_TOKEN` secret). **The minted token authenticates only once P5's Bearer-header support** (`get_current_user` reading `Authorization: Bearer`) is merged. Until P5 merges, the trips-list/trip-detail/create-trip flows will 401 — flagged in those flows' comments.

- [ ] **Step 1: Author `infra/docker-compose.e2e.yml` (the isolated `vpt-e2e` stack)**

Mirrors `infra/docker-compose.prod.yml` exactly in shape (named volumes, loopback binds, healthchecks, the `x-logging` anchor) but: distinct project name `vpt-e2e`, distinct ports (so it never collides with the dev or prod stacks on the same box), an **isolated database** (`vacation_tracker_e2e`), and the **api published on `127.0.0.1:8010`** — the port the emulator reaches at `http://10.0.2.2:8010`. The api/worker images are the same GHCR images as prod (pinned by `IMAGE_TAG`). The stack reads its secrets from a separate `../.env.e2e` file (operator-managed, gitignored like `.env.prod`). The e2e env file sets a throwaway `SECRET_KEY`, the sign-in allowlist pinned to `e2e@vpt.test` (the fixed user P5 mints), `VPT_E2E_BACKEND_TOKEN` (the shared secret P5's mint endpoint checks against the `X-E2E-Token` header), and `MOCK_SKIPLAGGED_API=true` (so create-trip doesn't hit the live provider). The compose `api` service sets **`E2E_MODE=1`**, which is what gates P5's mint endpoint on. No `web` service — the mobile e2e talks only to the api.

Create `infra/docker-compose.e2e.yml`:
```yaml
# Isolated end-to-end stack for the mobile Maestro pipeline.
#
# Runs alongside the dev and prod stacks on the same host without colliding:
# distinct project name (vpt-e2e), distinct ports, distinct named volumes,
# distinct database. The mobile e2e emulator (.github/workflows/mobile-e2e.yml)
# reaches this stack's api at http://10.0.2.2:8010 (the AVD host alias for the
# runner's loopback). All published ports bind to loopback only.
#
# Brought up once on the prod box by the operator (see docs/mobile-cicd.md
# § "VPT e2e backend stack"):
#   cp .env.e2e.example .env.e2e   # then fill in secrets
#   docker compose --env-file .env.e2e -f infra/docker-compose.e2e.yml up -d
#   docker compose --env-file .env.e2e -f infra/docker-compose.e2e.yml \
#     run --rm --entrypoint sh api -c 'cd /app && alembic upgrade head'
#
# Image tag is selected by IMAGE_TAG (defaults to latest); the operator pins it
# to the deployed commit SHA when refreshing the stack alongside a prod deploy.

name: vpt-e2e

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"

services:
  db:
    image: postgres:15-alpine
    container_name: vpt-e2e-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: vacation_tracker_e2e
    ports:
      - "127.0.0.1:5437:5432"
    volumes:
      - vpt_e2e_postgres_data:/var/lib/postgresql/data
    logging: *default-logging
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d vacation_tracker_e2e"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: vpt-e2e-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6382:6379"
    volumes:
      - vpt_e2e_redis_data:/data
    logging: *default-logging
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  temporal:
    image: temporalio/auto-setup:latest
    container_name: vpt-e2e-temporal
    restart: unless-stopped
    environment:
      DB: postgres12
      DB_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PWD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_SEEDS: db
    ports:
      - "127.0.0.1:7236:7233"
    depends_on:
      db:
        condition: service_healthy
    logging: *default-logging
    healthcheck:
      test: ["CMD", "tctl", "--address", "temporal:7233", "cluster", "health"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 40s

  api:
    image: ghcr.io/ethanasm/vpt-api:${IMAGE_TAG:-latest}
    container_name: vpt-e2e-api
    restart: unless-stopped
    env_file: ../.env.e2e
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@db:5432/vacation_tracker_e2e}
      REDIS_URL: ${REDIS_URL:-redis://redis:6379/0}
      TEMPORAL_ADDRESS: ${TEMPORAL_ADDRESS:-temporal:7233}
      TEMPORAL_NAMESPACE: default
      ENVIRONMENT: e2e
      # E2E_MODE=1 is what gates P5's POST /v1/e2e/mint-token endpoint on (it
      # never exists in prod, where E2E_MODE is unset). VPT_E2E_BACKEND_TOKEN is
      # the shared secret the endpoint checks against the X-E2E-Token header
      # (also the mobile-e2e.yml workflow secret).
      E2E_MODE: "1"
      VPT_E2E_BACKEND_TOKEN: ${VPT_E2E_BACKEND_TOKEN:?VPT_E2E_BACKEND_TOKEN is required}
      # Don't call the live Skiplagged provider during create-trip.
      MOCK_SKIPLAGGED_API: "true"
    ports:
      # The emulator reaches this at http://10.0.2.2:8010.
      - "127.0.0.1:8010:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      temporal:
        condition: service_healthy
    logging: *default-logging
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8000/ready || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s

  worker:
    image: ghcr.io/ethanasm/vpt-worker:${IMAGE_TAG:-latest}
    container_name: vpt-e2e-worker
    restart: unless-stopped
    env_file: ../.env.e2e
    environment:
      DATABASE_URL: ${DATABASE_URL:-postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@db:5432/vacation_tracker_e2e}
      REDIS_URL: ${REDIS_URL:-redis://redis:6379/0}
      TEMPORAL_ADDRESS: ${TEMPORAL_ADDRESS:-temporal:7233}
      TEMPORAL_NAMESPACE: default
      TEMPORAL_TASK_QUEUE: ${TEMPORAL_TASK_QUEUE:-vacation-price-tracker-tasks}
      MOCK_SKIPLAGGED_API: "true"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      temporal:
        condition: service_healthy
    logging: *default-logging

volumes:
  vpt_e2e_postgres_data:
  vpt_e2e_redis_data:
```

> **Note on `POST /v1/e2e/mint-token` (P5-owned).** The api image above serves the e2e-only mint endpoint `mobile-e2e.yml` calls. **That endpoint is owned by P5** (it lives in `apps/api/**`, gated on `E2E_MODE=1` so it never exists in prod, and authenticated via the `X-E2E-Token` header checked against `VPT_E2E_BACKEND_TOKEN`). It mints a fixed configured user (`e2e@vpt.test`) and ignores any request body. P4 owns only the compose file + the workflow that calls it; the endpoint implementation is P5's. The minted JWT authenticating the mobile client also depends on P5's Bearer-header support in `get_current_user`.

- [ ] **Step 2: Validate the e2e compose file**

Run (validates the compose schema without starting anything; uses dummy env values so the `:?required` guards pass):
```bash
POSTGRES_PASSWORD=dummy VPT_E2E_BACKEND_TOKEN=dummy \
  docker compose --env-file /dev/null -f infra/docker-compose.e2e.yml config >/dev/null \
  && echo "docker-compose.e2e.yml is valid"
```
Expected: `docker-compose.e2e.yml is valid`. (If Docker is unavailable in the dev environment, defer this to the runbook; the YAML is otherwise validated by `node -e` parse: `node -e "require('yaml').parse(require('fs').readFileSync('infra/docker-compose.e2e.yml','utf8')); console.log('yaml OK')"`.)

- [ ] **Step 3: Add the `IS_E2E_BUILD` cleartext exception to `app.config.ts`**

The e2e APK talks to the emulator-host backend over **cleartext** `http://10.0.2.2:8010`. Android blocks cleartext by default; allow it **only** in e2e builds (`EXPO_PUBLIC_E2E_MODE === '1'`) so prod policy stays strict. Edit `apps/mobile/app.config.ts`. P2's `android` block is:
```ts
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#7C3AED',
    },
  },
```
Replace it with (adds the build-time `IS_E2E_BUILD` flag + the `usesCleartextTraffic` toggle; this is release/e2e config, within P4's `app.config.ts` ownership):
```ts
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#7C3AED',
    },
    // P4 (mobile-cicd): the e2e APK reaches the emulator-host VPT e2e backend
    // over cleartext http://10.0.2.2:8010. Allow cleartext ONLY in e2e builds
    // (EXPO_PUBLIC_E2E_MODE=1, set by the e2e build profile / mobile-e2e.yml);
    // prod/preview builds keep cleartext disabled.
    usesCleartextTraffic: process.env.EXPO_PUBLIC_E2E_MODE === '1',
  },
```

Verify:
```bash
EXPO_PUBLIC_E2E_MODE=1 pnpm --filter mobile exec expo config --type public 2>&1 | grep -i cleartext
EXPO_PUBLIC_E2E_MODE= pnpm --filter mobile exec expo config --type public 2>&1 | grep -i cleartext || echo "cleartext absent when E2E_MODE unset (correct)"
```
Expected: `usesCleartextTraffic: true` printed when `EXPO_PUBLIC_E2E_MODE=1`; the second command prints `cleartext absent when E2E_MODE unset (correct)`.

- [ ] **Step 4: Create `.github/workflows/mobile-e2e.yml`**

Adapted from `/Users/ethansmith/Developer/showbook/.github/workflows/mobile-e2e.yml`. Adaptations: runner label `vpt-prod`; AVD name `vpt_e2e`; package `me.ethanasm.vpt`; backend host `http://10.0.2.2:8010` (VPT e2e API) instead of showbook's `:3004`; the mint step calls the VPT e2e backend's token endpoint (FastAPI JWT) instead of next-auth `encode`; action majors match VPT (`checkout@v4`, `pnpm/action-setup@v4` `9.12.1`, `setup-node@v4`); dry-run invoked via `node e2e/scripts/dry-run.mjs` (no package-script dependency).

Create `.github/workflows/mobile-e2e.yml`:
```yaml
name: Mobile E2E (Maestro, Android)

# Android-only e2e on a self-hosted runner inside the prod box. iOS coverage is
# manual via `maestro test e2e/flows` on the dev Mac. Android catches ~90% of
# regressions because the surface (auth gate, navigation, optimistic mutations)
# is platform-shared in RN.
on:
  push:
    branches: [main]
    paths:
      - 'apps/mobile/**'
      - '.github/workflows/mobile-e2e.yml'
  pull_request:
    types: [labeled, synchronize, opened, reopened]
  schedule:
    # 09:00 UTC — after nightly jobs settle.
    - cron: '0 9 * * *'
  workflow_dispatch: {}

permissions:
  # contents:write for the failure-publish step that pushes Maestro screenshots
  # to the pr-screenshots orphan branch.
  contents: write
  pull-requests: write

concurrency:
  group: mobile-e2e-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  android-e2e:
    name: Local Android build + Maestro on self-hosted emulator
    # PR runs require the `mobile-visual` label so opt-in stays explicit;
    # non-PR triggers (push/schedule/dispatch) always run. The in-step secret
    # checks below fail loudly if VPT_E2E_BACKEND_TOKEN / the e2e stack aren't
    # configured, so no silent-skip repo-variable gate is used.
    #
    # One-time runner setup (see docs/mobile-cicd.md):
    #   1. Bring up the isolated VPT e2e backend stack (project vpt-e2e) on the
    #      prod box from infra/docker-compose.e2e.yml — the loopback-only API the
    #      emulator reaches at http://10.0.2.2:8010. One-time operator step.
    #   2. Optional repo variable ANDROID_SDK_ROOT (default /opt/android-sdk).
    #   3. Run scripts/setup-runner-android.sh once on the prod box (Android SDK
    #      + build-tools + NDK, the vpt_e2e AVD, Maestro).
    if: >-
      github.event_name != 'pull_request' ||
      contains(github.event.pull_request.labels.*.name, 'mobile-visual')
    runs-on: [self-hosted, vpt-prod]
    timeout-minutes: 60
    env:
      ANDROID_SDK_ROOT: ${{ vars.ANDROID_SDK_ROOT || '/opt/android-sdk' }}
      ANDROID_AVD_NAME: vpt_e2e
      ANDROID_AVD_HOME: ${{ vars.ANDROID_AVD_HOME || '/home/ethan/.android-avd' }}
      # Gradle in CI: no daemon, single worker, 2 GB heap — the WSL runner OOMs
      # at higher caps when the 2 GB AVD + Metro run alongside.
      GRADLE_OPTS: '-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=1 -Dorg.gradle.parallel=false -Dorg.gradle.jvmargs="-Xmx2g -XX:MaxMetaspaceSize=512m"'
      # The isolated VPT e2e API, reached from the emulator via the AVD's host
      # alias. Deterministic for the self-hosted setup, so hardcoded.
      VPT_E2E_API_URL: http://10.0.2.2:8010
    steps:
      - uses: actions/checkout@v4

      - name: Diagnose runner
        shell: bash
        run: |
          set -u
          echo "::group::Runner diagnostics"
          uname -a
          free -h || true
          df -h /
          df -h "$HOME" || true
          echo "JAVA: $(java -version 2>&1 | head -1)"
          if [ -e /dev/kvm ] && [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
            echo "KVM accessible"
          else
            echo "KVM missing or not r/w — emulator falls back to software CPU (slow)"
          fi
          echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
          [ -d "$ANDROID_SDK_ROOT" ] && ls -la "$ANDROID_SDK_ROOT" || echo "  SDK root missing — run scripts/setup-runner-android.sh"
          echo "ANDROID_AVD_HOME=$ANDROID_AVD_HOME"
          [ -x "$ANDROID_SDK_ROOT/emulator/emulator" ] && "$ANDROID_SDK_ROOT/emulator/emulator" -list-avds || true
          echo "::endgroup::"

      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.1

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Materialize AVD on disk
        shell: bash
        env:
          ANDROID_AVD_SYSTEM_IMAGE: ${{ vars.ANDROID_AVD_SYSTEM_IMAGE || 'system-images;android-34;google_apis;x86_64' }}
        run: |
          set -euo pipefail
          mkdir -p "$ANDROID_AVD_HOME"
          if [ -d "$ANDROID_AVD_HOME/${ANDROID_AVD_NAME}.avd" ]; then
            echo "AVD already present at $ANDROID_AVD_HOME/${ANDROID_AVD_NAME}.avd"
          else
            SDKMANAGER="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
            AVDMANAGER="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/avdmanager"
            if [ ! -x "$SDKMANAGER" ] || [ ! -x "$AVDMANAGER" ]; then
              echo "::error::cmdline-tools missing — run scripts/setup-runner-android.sh on the runner"
              exit 1
            fi
            yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
            "$SDKMANAGER" --install "$ANDROID_AVD_SYSTEM_IMAGE" >/dev/null
            echo "no" | "$AVDMANAGER" create avd \
              --name "$ANDROID_AVD_NAME" \
              --package "$ANDROID_AVD_SYSTEM_IMAGE" \
              --device "pixel_6" \
              --path "$ANDROID_AVD_HOME/${ANDROID_AVD_NAME}.avd" \
              --force
            CFG="$ANDROID_AVD_HOME/${ANDROID_AVD_NAME}.avd/config.ini"
            if [ -f "$CFG" ]; then
              {
                echo "hw.ramSize=2048"
                echo "vm.heapSize=512"
                echo "disk.dataPartition.size=4096M"
                echo "hw.gpu.enabled=yes"
                echo "hw.gpu.mode=swiftshader_indirect"
              } >> "$CFG"
            fi
          fi
          ls -la "$ANDROID_AVD_HOME"

      - name: Install Maestro CLI
        shell: bash
        run: |
          if ! command -v maestro >/dev/null 2>&1; then
            curl -fsSL "https://get.maestro.mobile.dev" | bash
          fi
          echo "$HOME/.maestro/bin" >> "$GITHUB_PATH"

      - name: Validate Maestro flow YAML
        working-directory: apps/mobile
        run: node e2e/scripts/dry-run.mjs e2e/flows

      # Mint the e2e bearer from the isolated VPT e2e backend rather than from
      # hand-maintained secrets. The e2e API exposes the P5-owned token-mint
      # endpoint POST /v1/e2e/mint-token (gated on E2E_MODE=1, authenticated via
      # the X-E2E-Token header = VPT_E2E_BACKEND_TOKEN) that returns a JWT (same
      # create_access_token path the app uses) for the fixed e2e user. The
      # mobile client attaches it as Authorization: Bearer — which requires P5's
      # Bearer-header support in get_current_user. Token is short-lived + masked.
      #
      # The vpt-e2e stack (infra/docker-compose.e2e.yml, authored by P4) must be
      # up on the box, listening on the loopback port the emulator reaches at
      # http://10.0.2.2:8010. One-time operator bring-up: docs/mobile-cicd.md
      # § "VPT e2e backend stack".
      - name: Mint e2e session from the running backend
        shell: bash
        env:
          VPT_E2E_BACKEND_TOKEN: ${{ secrets.VPT_E2E_BACKEND_TOKEN }}
        run: |
          set -euo pipefail
          if [ -z "${VPT_E2E_BACKEND_TOKEN:-}" ]; then
            echo "::error::VPT_E2E_BACKEND_TOKEN secret is not set — cannot mint an e2e session. See docs/mobile-cicd.md."
            exit 1
          fi
          # The e2e backend is reachable from the runner host on loopback at the
          # same port the emulator maps to 10.0.2.2 (8010 here).
          BASE="http://127.0.0.1:8010"
          # P5 mints a FIXED configured user (e2e@vpt.test) — it ignores any
          # request body. This EMAIL is only used to build the local USER_JSON
          # below and must match the user P5 upserts + the e2e sign-in allowlist.
          EMAIL="e2e@vpt.test"
          # The e2e-only mint endpoint (P5-owned) returns
          # { access_token, user: { id, email, ... } }. It exists only when the
          # e2e backend is started with E2E_MODE=1, and is authenticated with the
          # X-E2E-Token header (NOT Authorization/Bearer). No request body. See
          # docs/mobile-cicd.md.
          RESP=$(curl -sS -X POST "${BASE}/v1/e2e/mint-token" \
            -H "X-E2E-Token: ${VPT_E2E_BACKEND_TOKEN}")
          TOKEN=$(printf '%s' "$RESP" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(j.access_token||"")')
          USERID=$(printf '%s' "$RESP" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write((j.user&&j.user.id)||"")')
          if [ -z "${TOKEN:-}" ] || [ -z "${USERID:-}" ]; then
            echo "::error::failed to mint e2e token — response was: ${RESP}"
            exit 1
          fi
          USERJSON=$(printf '{"id":"%s","email":"%s"}' "$USERID" "$EMAIL")
          echo "::add-mask::$TOKEN"
          {
            echo "E2E_TEST_TOKEN<<__E2E_EOF__"
            echo "$TOKEN"
            echo "__E2E_EOF__"
            echo "E2E_TEST_USER_JSON=$USERJSON"
          } >> "$GITHUB_ENV"
          echo "Minted e2e session for ${EMAIL} (user ${USERID})"

      # Build the RELEASE APK locally (not debug — assembleDebug needs Metro,
      # which CI doesn't run). The E2E_MODE bypass reads the inlined token, so
      # the Maestro YAML needs no deeplink seeding step.
      - name: Build Android APK locally
        working-directory: apps/mobile
        env:
          EXPO_PUBLIC_E2E_MODE: '1'
          EXPO_PUBLIC_E2E_TEST_TOKEN: ${{ env.E2E_TEST_TOKEN }}
          EXPO_PUBLIC_E2E_TEST_USER_JSON: ${{ env.E2E_TEST_USER_JSON }}
          # The emulator reaches the loopback-only VPT e2e API via 10.0.2.2.
          # Cleartext for this http:// host is allowed only in e2e builds via
          # the usesCleartextTraffic toggle in app.config.ts (Step 1).
          EXPO_PUBLIC_API_URL: ${{ env.VPT_E2E_API_URL }}
        shell: bash
        run: |
          set -euo pipefail
          if [ -z "${EXPO_PUBLIC_E2E_TEST_TOKEN:-}" ] || [ -z "${EXPO_PUBLIC_E2E_TEST_USER_JSON:-}" ]; then
            echo "::error::e2e session env is empty — the 'Mint e2e session' step did not run or failed"
            exit 1
          fi
          export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"
          pnpm exec expo prebuild --platform android --non-interactive --no-install
          # EXPO_PUBLIC_* values are inlined by Metro at bundle time; a changed
          # env var does NOT invalidate Gradle/Metro caches. On the persistent
          # self-hosted workspace, clear Metro caches + force the bundle task to
          # re-run so the current env is inlined.
          rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-map-* node_modules/.cache 2>/dev/null || true
          cd android
          ./gradlew :app:createBundleReleaseJsAndAssets \
            --rerun-tasks --no-daemon --console=plain
          ./gradlew :app:assembleRelease \
            -x lintVitalAnalyzeRelease -x lintVitalRelease \
            --no-daemon --console=plain \
            --build-cache
          APK="app/build/outputs/apk/release/app-release.apk"
          ls -lh "$APK"
          cp "$APK" /tmp/vpt-e2e.apk
          # Fail fast if the backend URL didn't get inlined into the JS bundle.
          if ! unzip -p /tmp/vpt-e2e.apk assets/index.android.bundle 2>/dev/null \
               | strings | grep -aq 'http://10.0.2.2:8010'; then
            echo "::error::APK bundle is missing http://10.0.2.2:8010 — EXPO_PUBLIC_API_URL was not inlined"
            exit 1
          fi
          echo "APK backend URL verified: http://10.0.2.2:8010"

      - name: Start Android emulator (background)
        shell: bash
        run: |
          set -euo pipefail
          export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
          adb kill-server || true
          adb start-server
          nohup env ANDROID_AVD_HOME="$ANDROID_AVD_HOME" \
            emulator -avd "$ANDROID_AVD_NAME" \
              -no-window -no-audio -no-boot-anim -no-snapshot-save \
              -accel auto \
              -gpu swiftshader_indirect \
            > /tmp/emulator.log 2>&1 &
          echo "emulator pid: $!"

      - name: Wait for emulator
        shell: bash
        run: |
          set -euo pipefail
          export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
          adb wait-for-device
          for i in $(seq 1 60); do
            BOOTED=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
            ANIM_DONE=$(adb shell getprop init.svc.bootanim 2>/dev/null | tr -d '\r' || true)
            if [ "$BOOTED" = "1" ] && [ "$ANIM_DONE" != "running" ]; then
              echo "emulator booted after $((i * 10))s"
              adb shell input keyevent 82 || true
              adb shell settings put global window_animation_scale 0 || true
              adb shell settings put global transition_animation_scale 0 || true
              adb shell settings put global animator_duration_scale 0 || true
              exit 0
            fi
            if [ $((i % 3)) -eq 0 ]; then
              echo "  $((i * 10))s — boot_completed=${BOOTED:-?} bootanim=${ANIM_DONE:-?}"
            fi
            sleep 10
          done
          echo "::error::emulator failed to boot in 10 minutes"
          tail -100 /tmp/emulator.log || true
          exit 1

      - name: Install APK
        shell: bash
        run: |
          export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
          adb install -r /tmp/vpt-e2e.apk

      - name: Capture cold-launch state
        shell: bash
        run: |
          set -uo pipefail
          export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
          mkdir -p /tmp/maestro-debug
          adb shell pm clear me.ethanasm.vpt || true
          adb shell am start -W -n me.ethanasm.vpt/.MainActivity || true
          sleep 8
          adb exec-out screencap -p > /tmp/maestro-debug/cold-launch.png || true
          adb shell uiautomator dump /sdcard/cold-launch.xml >/dev/null 2>&1 || true
          adb pull /sdcard/cold-launch.xml /tmp/maestro-debug/cold-launch.xml || true
          echo "::group::Cold-launch UI hierarchy (text nodes only)"
          if [ -f /tmp/maestro-debug/cold-launch.xml ]; then
            grep -oE 'text="[^"]*"' /tmp/maestro-debug/cold-launch.xml \
              | grep -v 'text=""' | sort -u | head -50 || true
          else
            echo "no UI dump captured"
          fi
          echo "::endgroup::"
          adb shell am force-stop me.ethanasm.vpt || true

      - name: Run Maestro flows
        shell: bash
        run: |
          set -uo pipefail
          export PATH="$ANDROID_SDK_ROOT/platform-tools:$HOME/.maestro/bin:$PATH"
          rm -rf /tmp/maestro-debug/.maestro
          mkdir -p /tmp/maestro-debug
          # Invoke maestro once per flow with an explicit pm clear between, so
          # SecureStore values from one flow don't survive into the next on the
          # AOSP system image (clearState alone proved unreliable in showbook CI).
          RC=0
          for flow in apps/mobile/e2e/flows/*.yaml; do
            echo "::group::pm clear before $(basename "$flow")"
            adb shell pm clear me.ethanasm.vpt || true
            sleep 2
            echo "::endgroup::"
            maestro test --debug-output /tmp/maestro-debug "$flow" || {
              status=$?
              echo "::warning::$(basename "$flow") failed with status $status"
              RC=$status
            }
          done
          exit $RC

      - name: Summarise Maestro debug output
        if: failure()
        shell: bash
        run: |
          set -u
          echo "::group::Maestro debug dir contents"
          ls -la /tmp/maestro-debug/ 2>/dev/null || echo "no debug dir"
          echo "::endgroup::"
          shopt -s nullglob
          for f in /tmp/maestro-debug/**/*.txt /tmp/maestro-debug/**/*.json /tmp/maestro-debug/**/*.log /tmp/maestro-debug/*.txt /tmp/maestro-debug/*.json /tmp/maestro-debug/*.log; do
            echo "::group::$f"
            tail -200 "$f" 2>/dev/null || true
            echo "::endgroup::"
          done
          echo "::group::Screenshots captured"
          find /tmp/maestro-debug -name '*.png' -printf '%p\n' 2>/dev/null | sort || true
          echo "::endgroup::"

      - name: Upload Maestro debug artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-debug-${{ github.run_id }}
          path: |
            /tmp/maestro-debug/**
            /tmp/emulator.log
          if-no-files-found: ignore
          retention-days: 7

      - name: Post failure comment on PR
        if: failure() && github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        shell: bash
        run: |
          set -uo pipefail
          BODY_FILE=$(mktemp)
          {
            printf '## Mobile e2e (Android) — failed\n\n'
            printf '[Workflow run](%s) — see the run log for the failing step.\n\n' "$RUN_URL"
            printf 'Maestro debug screenshots (if any) are uploaded as the `maestro-debug-%s` artifact.\n' "${{ github.run_id }}"
          } > "$BODY_FILE"
          set +e
          gh pr comment "$PR_NUMBER" --body-file "$BODY_FILE"
          echo "gh pr comment exit: $?"

      - name: Publish maestro debug to pr-screenshots branch
        if: failure() && github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        shell: bash
        run: |
          set -uo pipefail
          if [ ! -d /tmp/maestro-debug ]; then
            echo "no /tmp/maestro-debug — nothing to publish"
            exit 0
          fi
          FLAT=/tmp/maestro-debug-flat
          rm -rf "$FLAT"; mkdir -p "$FLAT"
          [ -f /tmp/maestro-debug/cold-launch.png ] && cp /tmp/maestro-debug/cold-launch.png "$FLAT/cold-launch.png"
          n=1
          while IFS= read -r -d '' f; do
            base="$(basename "$f")"
            flow="$(echo "$base" | sed -E 's/.*\(([^)]+)\)\.png$/\1/' | tr -c '[:alnum:]-' '-')"
            [ -z "$flow" ] && flow="unknown"
            cp "$f" "$FLAT/maestro-${flow}-${n}.png"
            n=$((n + 1))
          done < <(find /tmp/maestro-debug -name '*.png' -path '*tests*' -print0)
          git config --global user.name 'github-actions[bot]'
          git config --global user.email '41898282+github-actions[bot]@users.noreply.github.com'
          # Push the PNGs to an orphan pr-screenshots branch under
          # mobile-e2e/run-<id>/ using git plumbing (no external uploader
          # script — VPT has none). Repo is public so raw URLs are fetchable.
          RUN_DIR="mobile-e2e/run-${{ github.run_id }}"
          WT=$(mktemp -d)
          git fetch origin pr-screenshots:pr-screenshots 2>/dev/null || true
          if git show-ref --verify --quiet refs/heads/pr-screenshots; then
            git worktree add "$WT" pr-screenshots
          else
            git worktree add --detach "$WT"
            ( cd "$WT" && git checkout --orphan pr-screenshots && git rm -rf . >/dev/null 2>&1 || true )
          fi
          mkdir -p "$WT/$RUN_DIR"
          cp "$FLAT"/*.png "$WT/$RUN_DIR/" 2>/dev/null || true
          ( cd "$WT" && git add "$RUN_DIR" && git commit -m "ci: mobile-e2e screenshots run ${{ github.run_id }}" && git push origin pr-screenshots ) || echo "::warning::screenshot push failed"
          git worktree remove --force "$WT" || true
          RAW_BASE="https://raw.githubusercontent.com/${{ github.repository }}/pr-screenshots/${RUN_DIR}"
          BODY_FILE=$(mktemp)
          {
            printf '## Mobile e2e debug — `%s`\n\n' "$RUN_DIR"
            printf '[Workflow run](%s) failed.\n\n' "$RUN_URL"
            for img in "$FLAT"/*.png; do
              [ -e "$img" ] || continue
              bn=$(basename "$img")
              printf '![%s](%s/%s)\n' "$bn" "$RAW_BASE" "$bn"
            done
          } > "$BODY_FILE"
          gh pr comment "$PR_NUMBER" --body-file "$BODY_FILE" || echo "::warning::gh pr comment failed"

      - name: Shut down emulator
        if: always()
        shell: bash
        run: |
          export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
          adb emu kill || true
          adb kill-server || true
          for i in $(seq 1 30); do
            pgrep -f "emulator -avd ${ANDROID_AVD_NAME}" >/dev/null || break
            sleep 1
          done
          rm -f "$ANDROID_AVD_HOME/${ANDROID_AVD_NAME}.avd"/*.lock 2>/dev/null || true
```

- [ ] **Step 5: Validate the workflow with actionlint**

Run:
```bash
docker run --rm -v "$(git -C /Users/ethansmith/Developer/vacation-price-tracker rev-parse --show-toplevel)":/repo --workdir /repo rhysd/actionlint:latest -color .github/workflows/mobile-e2e.yml
```
Expected: no output, exit 0. (Or `actionlint .github/workflows/mobile-e2e.yml` if installed locally.)

- [ ] **Step 6: Commit**

```bash
git add infra/docker-compose.e2e.yml .github/workflows/mobile-e2e.yml apps/mobile/app.config.ts
git commit -m "ci: add isolated e2e stack and self-hosted Android Maestro workflow"
```

---

### Task 6: Runner provisioning script + credential/environment setup docs

**Files:**
- Create: `scripts/setup-runner-android.sh`
- Create: `docs/mobile-cicd.md`

**Interfaces:**
- Consumes: VPT's existing self-hosted runner on the `vpt-prod` box (registered for `deploy.yml`; this task adds the Android tooling on top of it). The AVD name `vpt_e2e` + SDK root `/opt/android-sdk` referenced by Task 5.
- Produces: the one-time provisioning script + the human runbook for EAS/ASC/Play credentials, the `mobile-release` environment, and the e2e backend stack.

- [ ] **Step 1: Create `scripts/setup-runner-android.sh`**

Adapted from `/Users/ethansmith/Developer/showbook/scripts/setup-runner-android.sh`. Adaptations: AVD name `vpt_e2e`; summary text references VPT; otherwise the SDK/build-tools/NDK/Maestro provisioning is identical (Expo SDK 56 prebuild emits the same Gradle toolchain showbook SDK 55 did — build-tools 36, compile platform android-36, NDK 27).
```bash
#!/usr/bin/env bash
# Idempotent one-time setup for Android e2e on the self-hosted vpt-prod runner.
#
# Run on the prod box AFTER the GitHub Actions runner itself is online (the same
# runner deploy.yml uses, label vpt-prod). Installs Android command-line tools +
# the packages Maestro/Gradle need and creates the AVD mobile-e2e.yml looks for.
#
# Re-running is safe — every step checks for the artifact it would create.

set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
CMDLINE_TOOLS_VERSION="${CMDLINE_TOOLS_VERSION:-13114758}"
SYSTEM_IMAGE="${SYSTEM_IMAGE:-system-images;android-34;google_apis;x86_64}"
PLATFORM="${PLATFORM:-platforms;android-34}"
# Match what Expo SDK 56's prebuild emits (apps/mobile/android/build.gradle ext
# block). Keep in sync when bumping Expo.
BUILD_TOOLS="${BUILD_TOOLS:-build-tools;36.0.0}"
COMPILE_PLATFORM="${COMPILE_PLATFORM:-platforms;android-36}"
NDK="${NDK:-ndk;27.1.12297006}"
AVD_NAME="${AVD_NAME:-vpt_e2e}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
info() { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$1"; }
fail() { printf "${RED}✗${NC} %s\n" "$1"; exit 1; }
step() { printf "\n${BOLD}%s${NC}\n" "$1"; }

step "Checking prerequisites…"
for cmd in curl unzip java; do
  command -v "$cmd" &>/dev/null || fail "$cmd is required but not found"
done
JAVA_MAJOR=$(java -version 2>&1 | awk -F'"' '/version/ {split($2, a, "."); print (a[1]=="1") ? a[2] : a[1]}')
if [ "$JAVA_MAJOR" -lt 17 ]; then
  fail "Java 17+ required (found $JAVA_MAJOR). On Ubuntu: sudo apt-get install -y openjdk-17-jdk"
fi
info "java $JAVA_MAJOR, curl, unzip"

step "Installing Android cmdline-tools at ${ANDROID_SDK_ROOT}…"
CMDLINE_BIN="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin"
if [ -x "$CMDLINE_BIN/sdkmanager" ]; then
  info "cmdline-tools already present"
else
  if [ ! -d "$ANDROID_SDK_ROOT" ]; then
    sudo mkdir -p "$ANDROID_SDK_ROOT"
    sudo chown "$USER" "$ANDROID_SDK_ROOT"
  fi
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  ZIP="$TMP/cmdline-tools.zip"
  URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"
  echo "  Downloading $URL"
  curl -sSL -o "$ZIP" "$URL"
  unzip -q "$ZIP" -d "$TMP"
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  rm -rf "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  mv "$TMP/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  info "Installed to $ANDROID_SDK_ROOT/cmdline-tools/latest"
fi

export ANDROID_SDK_ROOT
export PATH="$CMDLINE_BIN:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"

step "Installing SDK packages…"
yes | sdkmanager --licenses >/dev/null
sdkmanager --install \
  "platform-tools" \
  "emulator" \
  "$PLATFORM" \
  "$COMPILE_PLATFORM" \
  "$BUILD_TOOLS" \
  "$NDK" \
  "$SYSTEM_IMAGE" >/dev/null
info "SDK packages installed"

step "Creating AVD '$AVD_NAME'…"
if avdmanager list avd 2>/dev/null | grep -q "Name: ${AVD_NAME}\$"; then
  info "AVD already exists"
else
  echo "no" | avdmanager create avd \
    --name "$AVD_NAME" \
    --package "$SYSTEM_IMAGE" \
    --device "pixel_6" \
    --force
  CFG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"
  if [ -f "$CFG" ]; then
    {
      echo "hw.ramSize=2048"
      echo "vm.heapSize=512"
      echo "disk.dataPartition.size=4096M"
      echo "hw.gpu.enabled=yes"
      echo "hw.gpu.mode=swiftshader_indirect"
    } >> "$CFG"
  fi
  info "AVD '$AVD_NAME' created (Pixel 6, $SYSTEM_IMAGE)"
fi

step "Checking KVM acceleration…"
if [ -e /dev/kvm ] && [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
  info "/dev/kvm accessible — emulator boots hardware-accelerated"
else
  warn "/dev/kvm not accessible — emulator falls back to software rendering (slow)."
  warn "On WSL2: enable nestedVirtualization=true in .wslconfig and 'sudo usermod -aG kvm \$USER'."
fi

step "Installing Maestro CLI (idempotent)…"
if command -v maestro >/dev/null 2>&1; then
  info "Maestro already on PATH ($(maestro --version 2>&1 | head -1))"
else
  curl -fsSL "https://get.maestro.mobile.dev" | bash
  info "Maestro installed at \$HOME/.maestro"
  warn "Add 'export PATH=\"\$HOME/.maestro/bin:\$PATH\"' to your shell rc"
fi

printf "\n${BOLD}══════════════════════════════════════${NC}\n"
printf "${BOLD}  Android e2e tooling ready (VPT)${NC}\n"
printf "${BOLD}══════════════════════════════════════${NC}\n\n"
printf "  SDK:    %s\n" "$ANDROID_SDK_ROOT"
printf "  AVD:    %s\n" "$AVD_NAME"
printf "  System: %s\n\n" "$SYSTEM_IMAGE"
printf "  Repo variable to set (Settings → Variables):\n"
printf "    ANDROID_SDK_ROOT = %s\n\n" "$ANDROID_SDK_ROOT"
```

- [ ] **Step 2: Make the script executable + syntax-check**

Run:
```bash
chmod +x scripts/setup-runner-android.sh
bash -n scripts/setup-runner-android.sh && echo "bash syntax OK"
```
Expected: `bash syntax OK`.

- [ ] **Step 3: Create `docs/mobile-cicd.md`**

Create `docs/mobile-cicd.md`:
```markdown
# Mobile CI/CD — one-time setup

This is the operator runbook for the mobile pipeline added in plan P4
(`docs/superpowers/plans/2026-06-23-mobile-cicd.md`). The two workflows are
`mobile-deploy.yml` (EAS OTA + gated store release) and `mobile-e2e.yml`
(self-hosted Android Maestro). None of this runs until the prerequisites below
are provisioned.

## 1. One-time EAS project setup

From `apps/mobile/`, authenticated as the `ethanasm` Expo account:

```bash
cd apps/mobile
eas init          # creates the EAS project, writes extra.eas.projectId
```

Then replace `CONFIRM-VPT-EAS-PROJECT-ID` (two occurrences) in
`apps/mobile/app.config.ts` with the printed project UUID, and the
`https://u.expo.dev/<id>` updates URL accordingly.

Generate the EAS access token for CI:

```bash
eas-cli token:create   # or expo.dev → Account Settings → Access Tokens
```

Save it as the `EXPO_TOKEN` GitHub repo secret.

Validate the build profiles resolve (no build is queued):

```bash
EXPO_TOKEN=… pnpm dlx eas-cli config --profile preview-store --platform android
EXPO_TOKEN=… pnpm dlx eas-cli config --profile preview-store --platform ios
```

iOS credentials (one-time, interactive — CI can't answer the prompts):

```bash
pnpm dlx eas-cli build --profile preview-store --platform ios
```

Let EAS generate the App Store distribution cert + provisioning profile.

## 2. Confirm the placeholders

Before the first deploy, replace in **both** `apps/mobile/eas.json` and the OTA
step of `.github/workflows/mobile-deploy.yml` (keep them in sync):

- `https://CONFIRM-VPT-PROD-DOMAIN` → the confirmed prod API base URL.
- `CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-{IOS,ANDROID,WEB}` → VPT's OAuth client
  IDs (the same IDs the API lists in `GOOGLE_OAUTH_MOBILE_AUDIENCES`).

Confirm the bundle id `me.ethanasm.vpt` (iOS + Android) matches the App Store
Connect + Play Console app records before the first submit.

## 3. GitHub repo secrets

Settings → Secrets and variables → Actions → Secrets:

| Secret | Used by | Notes |
|---|---|---|
| `EXPO_TOKEN` | both workflows | EAS access token. |
| `PLAY_SERVICE_ACCOUNT_JSON` | mobile-deploy (Android submit) | Service-account key JSON, Play "Manage testing track releases". |
| `ASC_API_KEY_P8` | mobile-deploy (iOS submit) | App Store Connect API .p8 contents. |
| `ASC_API_KEY_ID` | mobile-deploy (iOS submit) | Key id of the .p8. |
| `ASC_API_KEY_ISSUER_ID` | mobile-deploy (iOS submit) | Issuer id from ASC Integrations. |
| `ASC_APP_ID` | mobile-deploy (iOS submit) | Numeric Apple ID of the VPT app record. |
| `RELEASE_DEPLOY_KEY` | mobile-deploy (version bump push) | Recommended. Write-access deploy key; check "Deploy keys" in the branch ruleset bypass list. |
| `RELEASE_PUSH_TOKEN` | mobile-deploy (version bump push) | Alternative to the deploy key: a fine-grained PAT (Contents: read/write) from a bypass-listed actor. |
| `VPT_E2E_BACKEND_TOKEN` | mobile-e2e (session mint) | Shared secret the e2e backend's `/v1/e2e/mint-token` endpoint checks against the `X-E2E-Token` request header. Same value set on the `vpt-e2e` api service. |
| `RESEND_API_KEY` | mobile-deploy (failure email, optional) | Same value as `.env.prod`. |
| `EMAIL_FROM` | mobile-deploy (failure email, optional) | Verified Resend sender. |
| `ADMIN_EMAILS` | mobile-deploy (failure email, optional) | Comma-separated recipients. |

## 4. Release approval gate (`mobile-release` environment)

`mobile-deploy.yml`'s `release` job targets the `mobile-release` environment.
GitHub auto-creates it (no protection) on first run, so releases ship
immediately until you arm the gate:

Settings → Environments → `mobile-release` → check **Required reviewers** → add
yourself → Save protection rules.

With a reviewer set, every store release pauses before the version bump / EAS
build / store submit until approved. Reject (or let the 30-day window lapse) and
the run dies clean — no bump, no tag, no build, no upload.

## 5. Branch-ruleset bypass for the version-bump push

The bump commit (`chore(release): mobile vX.Y.Z [skip ci]`) is pushed back to
`main`, which has a required-PR ruleset. The built-in `github-actions` app
cannot be bypass-listed, so either:

- (recommended) add a write-access **deploy key** to the repo, check **Deploy
  keys** in the ruleset's bypass list, and save the private half as
  `RELEASE_DEPLOY_KEY`; or
- save a bypass-listed actor's fine-grained PAT as `RELEASE_PUSH_TOKEN`.

`[skip ci]` in the bump message prevents the push from re-triggering CI.

## 6. Self-hosted Android runner (mobile-e2e)

`mobile-e2e.yml` runs on the existing self-hosted `vpt-prod` runner (the one
`deploy.yml` uses). Add Android tooling once:

```bash
# On the prod box:
bash scripts/setup-runner-android.sh   # Android SDK + AVD (vpt_e2e) + Maestro
```

Optionally set repo variables `ANDROID_SDK_ROOT` (default `/opt/android-sdk`)
and `ANDROID_AVD_HOME`.

## 7. VPT e2e backend stack (one-time bring-up)

`mobile-e2e.yml` mints its bearer session from an **isolated** VPT e2e backend,
NOT prod. The compose file `infra/docker-compose.e2e.yml` is authored by P4
(Task 5) — it defines the `vpt-e2e` stack (own database `vacation_tracker_e2e`,
own `SECRET_KEY`, `E2E_MODE=1` on the api, a sign-in allowlist pinned to
`e2e@vpt.test`, the api on loopback `127.0.0.1:8010` which the emulator reaches
at `http://10.0.2.2:8010`).

**One-time operator bring-up on the prod box** (this is the human/ops step; the
file itself is already in the repo):

```bash
cp .env.e2e.example .env.e2e   # then fill in POSTGRES_PASSWORD, SECRET_KEY,
                               # VPT_E2E_BACKEND_TOKEN, the e2e sign-in allowlist
docker compose --env-file .env.e2e -f infra/docker-compose.e2e.yml up -d
docker compose --env-file .env.e2e -f infra/docker-compose.e2e.yml \
  run --rm --entrypoint sh api -c 'cd /app && alembic upgrade head'
```

Refresh the stack to a new image alongside prod deploys by pinning `IMAGE_TAG`
and re-running `up -d`.

**The `POST /v1/e2e/mint-token` endpoint is owned by P5.** It lives in
`apps/api/**`, is gated on `E2E_MODE=1` so it never exists in prod, and is
authenticated via the `X-E2E-Token` header checked against
`VPT_E2E_BACKEND_TOKEN`. It mints a fixed configured user (`e2e@vpt.test`),
ignores any request body, and returns `{ access_token, user }`. P4 owns the
compose file + the workflow that calls it; the endpoint implementation is P5's.

**Dependency on P5:** the minted token is attached as `Authorization: Bearer`,
which authenticates only once P5's Bearer-header support lands in
`get_current_user`. Until then the e2e read/write flows 401 (the sign-in bypass
still passes — it loads the baked session without validating it).
```

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-runner-android.sh docs/mobile-cicd.md
git commit -m "docs: add mobile CI/CD runner provisioning script and setup runbook"
```

---

## Self-Review

**1. Spec coverage (every showbook mobile-pipeline capability has a VPT analog):**
- EAS build profiles (development/preview/preview-store/production/e2e) → Task 1. ✓
- Submit profiles (Play internal + TestFlight) → Task 1. ✓
- Version-bump script + conventional-commit scan + `mobile-v*` tag + unit test → Task 2. ✓
- `mobile-deploy.yml`: OTA job, plan/native-diff job, gated release job, version-bump pushback, per-job concurrency, failure email → Task 3. ✓
- Maestro flows (sign-in / trips list loads / open trip detail / create trip) + dry-run validator + E2E_MODE/token injection → Task 4. ✓
- `mobile-e2e.yml`: self-hosted Android, emulator boot, local APK build, e2e session mint from the running backend, Maestro run, screenshot publish to pr-screenshots → Task 5. ✓
- Runner provisioning + credential/environment setup docs → Task 6. ✓
- Failure-email script → Task 3. ✓
- e2e backend stack (isolated `vpt-e2e`, mirror showbook's e2e stack) → **`infra/docker-compose.e2e.yml` authored by P4** in Task 5; bring-up documented in Task 6 as the operator step; the `POST /v1/e2e/mint-token` endpoint is P5-owned. ✓

**2. Placeholder scan:** The only literal placeholders are the deliberately-flagged HUMAN PREREQUISITES (`CONFIRM-VPT-PROD-DOMAIN`, `CONFIRM-VPT-GOOGLE-OAUTH-CLIENT-ID-*`, `CONFIRM-VPT-EAS-PROJECT-ID`) — all called out per the index's open-confirmations list. No "TBD"/"implement later"/"add error handling" placeholders. Every workflow/eas.json/script is shown in full.

**3. Type/name consistency:** Profile names (`preview`, `preview-store`, `e2e`, `production`) match between `eas.json` (Task 1) and both workflows (Tasks 3, 5). The bump script CLI (`--type`/`--floor`/`--print`, Task 2) matches the `release` job's calls (Task 3). `appId: me.ethanasm.vpt` matches across `config.yaml`, every flow, and the package id used in `adb`/`pm clear` (Tasks 4, 5). AVD name `vpt_e2e` matches between `mobile-e2e.yml` (Task 5) and `setup-runner-android.sh` (Task 6). Backend URL `http://10.0.2.2:8010` matches between the cleartext toggle, the build-env, the APK-bundle assertion, the mint step's loopback `127.0.0.1:8010` (Task 5), and the api port bind in `docker-compose.e2e.yml` (Task 5 Step 1). **Canonical testIDs** (`sign-in-google-button`, `trips-list`, `trip-card`, `new-trip-fab`, `trip-detail-{flight,hotel,total}-stat`, `create-trip-{name,origin,destination}-input`, `create-trip-submit`) match the index contract and are used verbatim across all four flows (Task 4).

**Scope boundaries honored:** P4 edits only `eas.json`, the release/version/submit/e2e-cleartext fields of `app.config.ts`, the two workflows, `infra/docker-compose.e2e.yml` (the isolated e2e stack — assigned to P4 by the index), `bump-mobile-version.mjs` (+ test), `mobile-deploy-failure-email.sh`, `setup-runner-android.sh`, `docs/mobile-cicd.md`, `apps/mobile/e2e/**`, and — only when conflict-safe — `package.json` **scripts** (never deps). No edits to P3's screen files (`apps/mobile/app/**`, `apps/mobile/components/**`). No `apps/api/**` edits: the `POST /v1/e2e/mint-token` endpoint the workflow calls is P5-owned, and the e2e mint depends on P5's Bearer-header support (flagged). `docker-compose.e2e.yml` does not touch the prod compose file. The e2e token-mint approach is consistent with P5's Bearer-header work.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-23-mobile-cicd.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
