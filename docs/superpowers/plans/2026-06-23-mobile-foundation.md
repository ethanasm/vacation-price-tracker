# Mobile Foundation (Expo Scaffold + Workspace Wiring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a brand-new Expo (SDK 56) + Expo Router app at `apps/mobile` — workspace wiring, design-token module, a REST/JWT API client against VPT's `/v1/*` FastAPI backend, device-side Google auth, and the navigation shell (tab bar Trips/Alerts/Chat + stack for detail/create/sign-in) — so that P3 (screens) and P4 (CI/CD) have a booting, navigable foundation to build on.

**Architecture:** This is plan **P2** of the "Aurora" effort (see `docs/superpowers/plans/2026-06-23-AURORA-INDEX.md`). It owns the **new `apps/mobile/**` scaffold** plus the root workspace files (`.nvmrc`, root `package.json` scripts, `.npmrc`, `nx.json`, `pnpm-workspace.yaml`). It mirrors the `showbook` mobile app's structure and tooling (`/Users/ethansmith/Developer/showbook/apps/mobile`) but talks to VPT's **REST + JWT** API, **not tRPC**: a typed `fetch` client replaces showbook's `lib/trpc.ts`, and a Google-ID-token → `POST /v1/auth/mobile-token` → JWT-pair bridge replaces showbook's `/api/auth/mobile-token` bridge. The OpenAPI types are **regenerated** into `apps/mobile/lib/api/types.ts` (decision justified in Task 4) so mobile never imports web React code. This plan builds the **shell + tokens + nav only** — the full Aurora phone screens are P3's, and release/version/submit config is P4's.

**Tech Stack:** Expo SDK ~56 · React Native 0.85.3 · React 19.2.3 · Expo Router ~56.2.10 · expo-secure-store · `@tanstack/react-query` · expo-notifications · expo-auth-session · lucide-react-native · react-native-svg · `@expo-google-fonts/manrope` · TypeScript · node:test + `@testing-library/react-native` (mobile unit tests, run via Nx) · Nx + pnpm monorepo.

## Global Constraints

*Every task in this plan implicitly includes this section. Values copied verbatim from `2026-06-23-AURORA-INDEX.md` (mobile-relevant entries) and the repo.*

### PR operator docs (required)
Every PR opened for this plan MUST include an **"Operator / Deployment Steps"** section in its description listing: new **environment variables** (name · where set — web `.env` / api `.env`·`.env.prod` / `eas.json` / GitHub secret / GitHub variable · required-vs-optional · example or placeholder value); **DB migrations**; **new GitHub secrets/variables**; and any **one-time infra / runner / credential provisioning** the change introduces. If it introduces none, state **"No operator steps"** explicitly.

### Monorepo / toolchain
- **Package manager:** `pnpm@9.12.1` (pinned in root `package.json`). **Single `pnpm-lock.yaml` at the repo root** — never generate a nested lockfile in `apps/*`.
- **Workspace:** Nx monorepo, `pnpm-workspace.yaml` globs `apps/*`. P2 adds `apps/mobile` under that existing glob (no glob change needed) and registers Nx targets.
- **Node:** repo currently ships no `.nvmrc`. P2 **adds `.nvmrc` = `22`** (matches showbook + Expo SDK 56 minimum) and root `engines.node >= 22`. All CI uses `actions/setup-node@v6` with `node-version: 22`.
- **Verify gate:** `pnpm verify` must stay green (install --frozen-lockfile → build → lint → typecheck → test:coverage → audit).

### Mobile (P2–P5) stack — mirror showbook
- **Expo SDK 56** (`expo ~56.0.x`) · **React Native 0.85.3** · React **19.2.3** · **Expo Router ~56.2.10** · **expo-secure-store** (JWT storage) · `@tanstack/react-query` · **expo-notifications** (price-drop push) · `lucide-react-native` (icons) · `react-native-svg` + a charting approach for the price-history chart.
- **API access:** the VPT backend is **REST + JWT** (FastAPI, `/v1/*`), **not tRPC**. Mobile uses a typed `fetch` client (P2) that reads the generated OpenAPI types from `apps/web/src/lib/api/types.ts` *concept* — P2 decides whether to share or regenerate; it must not depend on web React code.
- **Auth bridge (mirror showbook):** Google ID token on device → `POST /v1/auth/mobile-token` (new, P5) → API returns the same JWT pair the web OAuth callback issues → store in `expo-secure-store`. P2 builds the device side against this contract; P5 builds the endpoint.
- **Bundle identifiers:** iOS `me.ethanasm.vpt`, Android `me.ethanasm.vpt` (mirror showbook's `me.ethanasm.showbook` scheme). Confirm with the human before first store submit.
- **EXPO_PUBLIC_API_URL:** production VPT API base URL (mirror showbook's `https://showbook.ethanasm.me`). The repo uses `FRONTEND_URL` / `BACKEND_URL` env vars set per-deploy; **the exact prod domain must be confirmed with the human** before P4 hard-codes it into `eas.json`. Until confirmed, use the placeholder `https://CONFIRM-VPT-PROD-DOMAIN` and flag it.
- **Mobile coverage scope:** mirror showbook — gate only `apps/mobile/lib/**` (layout/screen shells excluded), threshold 80% lines/branches/functions. Unit tests use `node --test` + `@testing-library/react-native` (showbook pattern), run via Nx target.
- **EAS secrets (P4, GitHub repo secrets):** `EXPO_TOKEN`, `PLAY_SERVICE_ACCOUNT_JSON`, `ASC_API_KEY_P8`, `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_APP_ID`, and a push token for the version-bump pushback. Provisioned by the human; referenced by name only.

### Aurora design tokens (shared source of truth — consumed by Task 3)
- **Primary violet** `#7C3AED` · hover/deep `#6D28D9` · **primary gradient** `linear-gradient(135deg,#A78BFA,#7C3AED)` · **total-card gradient** `linear-gradient(135deg,#7C3AED,#9333EA)`.
- **Accents:** pink `#EC4899`, cyan `#22D3EE`. **Backgrounds:** page `#FAF8FF`, surfaces `#F4F1FC`/`#F8F5FE`, chip `#EDE9FE`, card `#FFFFFF`, hairline `#F1EEF8`/`#ECE8F5`, selected border `#C9B8F5`.
- **Text:** strong `#1A1A2E`, body `#4A4660`/`#6B6680`, muted `#8B86A0`, faint `#BDB6D4`.
- **Status:** success `#059669` on `#ECFDF5`; warning/stops `#9A7B18` on `#FEF6DD`; layover amber `#C98A3A` on `#FDF6E9` (border `#F6E7C8`); star gold `#F5A623`.
- **Radius:** cards 14–16px · inner 12–13px · pills/chips 8–10px · status badges 999px. **Shadows:** card-on-canvas `0 16px 50px rgba(60,40,120,.13)`; primary button `0 4–6px 12–16px rgba(124,58,237,.32)`; total card `0 8px 22px rgba(124,58,237,.30)`.
- **Airline monogram chips (original marks, not trademarks):** Alaska `AS` `linear-gradient(135deg,#10617F,#093247)`; United `UA` `linear-gradient(135deg,#2456C9,#13357F)`; Delta `DL` `linear-gradient(135deg,#C8102E,#7A0A1C)`; white text weight 800, radius 8px.
- **Fonts:** Manrope (Google Fonts), weights **400, 500, 600, 700, 800**.

### Product guardrails
- **No "Trip members"/sharing UI** anywhere. Settings = Notifications only (Email + SMS).
- Sign-in is **Google-OAuth only**; "We never store passwords" caption.
- Airline logos are **original CSS monogram chips**, never real airline trademarks.

---

## File Structure

### Files to Create

**Root workspace wiring (Task 1):**
- `.nvmrc` — single line `22`; pins Node for nvm + CI parity with showbook.
- `.npmrc` — pnpm `public-hoist-pattern[]=*` so Metro (with `disableHierarchicalLookup`) resolves Expo/RN transitive deps from a flat `node_modules`, plus fetch-retry tolerance.

**Expo app scaffold (Task 2):**
- `apps/mobile/package.json` — Expo app manifest: deps (Expo core, router, secure-store, react-query, notifications, lucide, svg, Manrope fonts) + scripts (start/ios/android/typecheck/lint/test/test:coverage), mirroring showbook.
- `apps/mobile/app.config.ts` — Expo config: name "Price Tracker", slug `vpt`, scheme `vpt` + bundle ids `me.ethanasm.vpt`, plugins (router/font/secure-store/notifications), `runtimeVersion {policy:'appVersion'}`. **Only later editor is P4** (version/submit fields).
- `apps/mobile/metro.config.js` — monorepo Metro config (watch workspace root, flat node_modules paths, `disableHierarchicalLookup`).
- `apps/mobile/tsconfig.json` — extends `expo/tsconfig.base`, strict, `@/*` path alias.
- `apps/mobile/babel.config.js` — `babel-preset-expo`.
- `apps/mobile/.eslintrc.js` — `eslint-config-expo`.
- `apps/mobile/eslint.config.js` — flat-config shim that re-exports the expo config (for `expo lint` under ESLint 9).
- `apps/mobile/project.json` — Nx project: `typecheck`, `lint`, `test`, `test:coverage` targets.
- `apps/mobile/expo-env.d.ts` — Expo-generated ambient types reference (committed stub).
- `apps/mobile/.gitignore` — ignores `.expo/`, `dist-web/`, `coverage/`, native `ios/`/`android/` prebuild output.

**Design tokens (Task 3):**
- `apps/mobile/lib/theme/tokens.ts` — Aurora token constants (colors, gradients, radii, shadows, monogram gradients, type scale). **No React/RN imports** so it is node:test-importable.
- `apps/mobile/lib/theme/index.ts` — `ThemeProvider`, `useTheme()`, and `makeStyles`/`useThemedStyles` helper that consumes `tokens`.
- `apps/mobile/lib/fonts.ts` — `loadAppFonts()` loading Manrope 400–800 via `@expo-google-fonts/manrope`; exports `FONT` family-name map.
- `apps/mobile/lib/theme/__tests__/tokens.test.ts` — asserts the load-bearing token values (primary violet, gradients, the three behavioral totals' currency formatting helper, monogram map).

**REST/JWT API client (Task 4):**
- `apps/mobile/lib/api/types.ts` — OpenAPI types regenerated from the VPT FastAPI spec (same generator the web app uses).
- `apps/mobile/lib/api/client.ts` — `createApiClient({ baseUrl, getToken, onTokensRefreshed, fetchImpl? })`: typed `fetch` wrapper, `Authorization: Bearer <jwt>`, refresh-on-401, typed calls (`listTrips`, `getTrip`, `createTrip`, `sendChatMessage`).
- `apps/mobile/lib/api/errors.ts` — `ApiError` / `AuthError` classes (mirror web's `lib/api.ts`).
- `apps/mobile/lib/env.ts` — reads `EXPO_PUBLIC_API_URL`, Google client IDs; exports `API_URL` + misconfiguration describers.
- `apps/mobile/lib/api/__tests__/client.test.ts` — unit tests with an injected `fetchImpl` mock (success, `{data}` unwrap, 401→refresh→retry, refresh-fail→AuthError, create-trip idempotency header).

**Auth — device side (Task 5):**
- `apps/mobile/lib/auth/contract.ts` — the exact request/response types the device sends/expects from `POST /v1/auth/mobile-token` (the P5 contract).
- `apps/mobile/lib/auth/exchange.ts` — pure `exchangeGoogleIdTokenForSession()` (no Expo/RN imports) — POSTs the Google ID token, parses the JWT pair + user.
- `apps/mobile/lib/auth/storage.ts` — secure-store read/write/clear of the token pair + user (thin wrapper, injectable store for tests).
- `apps/mobile/lib/auth/index.tsx` — `AuthProvider` + `useAuth()` (Google sign-in via expo-auth-session, session restore, sign-out).
- `apps/mobile/lib/auth/__tests__/exchange.test.ts` — unit tests (200 happy path, 401, 403, 429, malformed body, network error).
- `apps/mobile/lib/auth/__tests__/storage.test.ts` — unit tests with an in-memory store double.

**Navigation shell (Task 6):**
- `apps/mobile/app/_layout.tsx` — root provider chain (gesture root, safe-area, theme, auth, query client, api client, fonts/splash) + root `<Stack>` + the auth gate redirect.
- `apps/mobile/app/(auth)/_layout.tsx` — stack layout for the auth group.
- `apps/mobile/app/(auth)/sign-in.tsx` — placeholder sign-in wired to `useAuth().signIn` (full styling is P3).
- `apps/mobile/app/(tabs)/_layout.tsx` — tab bar Trips / Alerts / Chat (lucide icons, Aurora active color).
- `apps/mobile/app/(tabs)/index.tsx` — Trips tab stub.
- `apps/mobile/app/(tabs)/alerts.tsx` — Alerts tab stub.
- `apps/mobile/app/(tabs)/chat.tsx` — Chat tab stub.
- `apps/mobile/app/trip/[id].tsx` — trip-detail stub (reads `id` param).
- `apps/mobile/app/trip/new.tsx` — create-trip stub.
- `apps/mobile/components/screen-stub.tsx` — tiny shared `<ScreenStub title=.../>` so each stub renders its title and the app boots.
- `apps/mobile/assets/icon.png`, `apps/mobile/assets/splash.png`, `apps/mobile/assets/adaptive-icon.png` — placeholder 1024×1024 / 1242×2436 / 1024×1024 solid-violet PNGs so `expo config`/prebuild resolve (P4 replaces with brand art).

**Repo docs (Task 7):**
- `apps/mobile/CLAUDE.md` — per-app guide for the Expo app (layout, REST/JWT auth bridge, Aurora tokens, navigation map, coverage gate, commands, sandbox-verification note).

### Files to Modify

- `package.json` (repo root) — add `engines` block and `mobile:*` scripts (`mobile:start`, `mobile:ios`, `mobile:android`, `mobile:ios:go`, `mobile:android:go`, `mobile:typecheck`, `mobile:lint`, `mobile:test`, `mobile:test:coverage`), each delegating to `pnpm --filter mobile …`.
- `nx.json` — add a `test:coverage` entry to `targetDefaults` cache list if needed (the mobile project registers its own targets in `apps/mobile/project.json`; no glob change to `pnpm-workspace.yaml`, which already globs `apps/*`).
- `CLAUDE.md` (repo root) — drop the web-only line, Next.js 14→16, add the Mobile/Expo bullet, `apps/mobile` Per-App-Guide + directory-tree entries, the verbatim `## Cross-platform parity` section, the `mobile` commit scope + PR-title→mobile-version-bump note, and the mobile coverage/deployment notes (Task 7).

---

## Task 1: Workspace wiring & root config

**Files:**
- Create: `.nvmrc`
- Create: `.npmrc`
- Modify: `package.json` (repo root)
- Modify: `nx.json`
- Test: verification commands (config files have no unit tests)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - Root npm scripts `mobile:start`, `mobile:ios`, `mobile:android`, `mobile:ios:go`, `mobile:android:go`, `mobile:typecheck`, `mobile:lint`, `mobile:test`, `mobile:test:coverage` — each delegates to `pnpm --filter mobile <script>`. Task 2 creates the matching `apps/mobile/package.json` scripts these call.
  - `.nvmrc` = `22`; root `engines.node = ">=22"`, `engines.pnpm = ">=9"`.
  - `.npmrc` with `public-hoist-pattern[]=*` (required by Task 2's `metro.config.js`, which sets `disableHierarchicalLookup: true`).

- [ ] **Step 1: Write the failing verification (assert the scripts/files are absent first)**

Run:
```bash
test -f .nvmrc && echo "EXISTS" || echo "MISSING"; \
node -e "const p=require('./package.json'); console.log(p.scripts['mobile:start'] ? 'HAS' : 'NONE')"
```
Expected: `MISSING` then `NONE` — confirms we start from a clean slate.

- [ ] **Step 2: Create `.nvmrc`**

Create `.nvmrc`:
```
22
```

- [ ] **Step 3: Create `.npmrc`**

Mirrors `showbook/.npmrc`. The `public-hoist-pattern[]=*` line is load-bearing: Task 2's `metro.config.js` sets `config.resolver.disableHierarchicalLookup = true`, so Metro only looks in the workspace + app `node_modules` and pnpm must flatten there like npm/yarn.

Create `.npmrc`:
```
# Hoist everything so Metro (apps/mobile) can resolve the long tail of
# transitive deps that Expo / RN packages import inline. metro.config.js
# sets disableHierarchicalLookup: true, so Metro only looks in the workspace
# + app node_modules — not pnpm's nested store — so pnpm needs to behave like
# npm/yarn for this monorepo.
public-hoist-pattern[]=*

# Tolerate flaky registry edges (single-tarball ECONNRESETs on large RN/Expo
# packages exhaust the default 2-retry budget mid-install).
fetch-retries=5
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
```

- [ ] **Step 4: Add `engines` + `mobile:*` scripts to root `package.json`**

In `package.json`, add an `engines` block immediately after the `"packageManager"` line:
```json
  "packageManager": "pnpm@9.12.1",
  "engines": {
    "node": ">=22",
    "pnpm": ">=9"
  },
```

Then, inside `"scripts"`, add the mobile block (place it after the `"worker:test:coverage"` line). Each delegates to the `apps/mobile/package.json` script of the same name created in Task 2:
```json
    "mobile:start": "pnpm --filter mobile start",
    "mobile:start:go": "pnpm --filter mobile start:go",
    "mobile:ios": "pnpm --filter mobile ios",
    "mobile:ios:go": "pnpm --filter mobile ios:go",
    "mobile:android": "pnpm --filter mobile android",
    "mobile:android:go": "pnpm --filter mobile android:go",
    "mobile:typecheck": "pnpm --filter mobile typecheck",
    "mobile:lint": "pnpm --filter mobile lint",
    "mobile:test": "pnpm --filter mobile test",
    "mobile:test:coverage": "pnpm --filter mobile test:coverage",
```

- [ ] **Step 5: Confirm `nx.json` needs no glob change; add `test:coverage` to cached targets**

`pnpm-workspace.yaml` already globs `apps/*`, so `apps/mobile` is auto-included — **no change to `pnpm-workspace.yaml`.** The Nx project graph picks up `apps/mobile/project.json` (created in Task 2). Add a cache entry for `test:coverage` so the mobile coverage target is cached like the others.

In `nx.json`, inside `"targetDefaults"`, after the `"typecheck"` entry add:
```json
    "typecheck": {
      "cache": true
    },
    "test:coverage": {
      "cache": true
    }
```

- [ ] **Step 6: Verify scripts/files now resolve**

Run:
```bash
cat .nvmrc; \
node -e "const p=require('./package.json'); console.log(p.engines.node, p.scripts['mobile:start'], p.scripts['mobile:test:coverage'])"; \
grep -c 'public-hoist-pattern\[\]=\*' .npmrc
```
Expected: `22` / `>=22 pnpm --filter mobile start pnpm --filter mobile test:coverage` / `1`.

- [ ] **Step 7: Verify the lockfile rule still holds (no nested lockfile, install stays frozen-clean later)**

Run:
```bash
git status --porcelain | grep -E 'apps/.*/pnpm-lock.yaml' && echo "BAD: nested lockfile" || echo "OK: single root lockfile"
```
Expected: `OK: single root lockfile`.

- [ ] **Step 8: Commit**

```bash
git add .nvmrc .npmrc package.json nx.json
git commit -m "chore: wire mobile workspace (.nvmrc, .npmrc, mobile:* scripts, nx target)"
```

---

## Task 2: Expo app scaffold

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.config.ts`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/.eslintrc.js`
- Create: `apps/mobile/eslint.config.js`
- Create: `apps/mobile/project.json`
- Create: `apps/mobile/expo-env.d.ts`
- Create: `apps/mobile/.gitignore`
- Create: `apps/mobile/assets/icon.png`, `apps/mobile/assets/splash.png`, `apps/mobile/assets/adaptive-icon.png`
- Test: verification commands (`pnpm install`, `expo config`, `pnpm --filter mobile typecheck`).

**Interfaces:**
- Consumes: Task 1's root `mobile:*` scripts (they call these package scripts), `.npmrc` hoist (so install produces a Metro-resolvable tree).
- Produces:
  - `apps/mobile/package.json` with `"name": "mobile"`, `"main": "expo-router/entry"`, and scripts `start`, `start:go`, `ios`, `ios:go`, `android`, `android:go`, `web`, `typecheck`, `lint`, `test`, `test:coverage`, `web:build`.
  - `app.config.ts` exporting an `ExpoConfig` with `slug: 'vpt'`, `scheme: ['vpt', 'me.ethanasm.vpt']`, iOS/Android bundle id `me.ethanasm.vpt`, `runtimeVersion: { policy: 'appVersion' }`, plugins `['expo-router','expo-font','expo-secure-store','expo-notifications']`.
  - Nx project `mobile` with targets `typecheck`, `lint`, `test`, `test:coverage`.
  - The `@/*` TS path alias → `apps/mobile/*` (consumed by every later task's imports).

- [ ] **Step 1: Write the failing verification**

Run:
```bash
test -f apps/mobile/package.json && echo "EXISTS" || echo "MISSING"
```
Expected: `MISSING`.

- [ ] **Step 2: Create `apps/mobile/package.json`**

Versions pinned to showbook's (`/Users/ethansmith/Developer/showbook/apps/mobile/package.json`). The `test` / `test:coverage` scripts mirror showbook's `node --import tsx --test` runner (scoped to `lib/**/__tests__` since the mobile coverage gate is `apps/mobile/lib/**` only). No tRPC, no `@showbook/*` workspace packages, no maps/audio/sqlite deps — VPT mobile is REST and does not need them.

Create `apps/mobile/package.json`:
```json
{
  "name": "mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --dev-client",
    "start:go": "expo start",
    "ios": "expo run:ios",
    "ios:go": "expo start --ios",
    "android": "expo run:android",
    "android:go": "expo start --android",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "lint": "expo lint",
    "test": "find lib -path '*/__tests__/*' \\( -name '*.test.ts' -o -name '*.test.tsx' \\) -print0 2>/dev/null | xargs -0 -I{} node --import tsx --test {}",
    "test:coverage": "mkdir -p coverage && find lib -path '*/__tests__/*' \\( -name '*.test.ts' -o -name '*.test.tsx' \\) -print0 2>/dev/null | xargs -0 node --import tsx --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/mobile-unit.info --test-reporter=spec --test-reporter-destination=stdout",
    "web:build": "EXPO_PUBLIC_E2E_MODE=1 expo export --platform web --output-dir dist-web --clear"
  },
  "dependencies": {
    "@expo-google-fonts/manrope": "^0.4.1",
    "@expo/metro-runtime": "~56.0.15",
    "@react-native-community/netinfo": "12.0.1",
    "@tanstack/react-query": "^5.101.0",
    "expo": "~56.0.11",
    "expo-auth-session": "~56.0.14",
    "expo-constants": "~56.0.18",
    "expo-crypto": "~56.0.4",
    "expo-dev-client": "~56.0.20",
    "expo-font": "~56.0.6",
    "expo-linear-gradient": "~56.0.4",
    "expo-linking": "~56.0.14",
    "expo-notifications": "~56.0.17",
    "expo-router": "~56.2.10",
    "expo-secure-store": "~56.0.4",
    "expo-splash-screen": "~56.0.10",
    "expo-status-bar": "~56.0.4",
    "expo-updates": "~56.0.19",
    "expo-web-browser": "~56.0.5",
    "lucide-react-native": "^1.17.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.85.3",
    "react-native-gesture-handler": "~2.31.1",
    "react-native-reanimated": "4.3.1",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "4.25.2",
    "react-native-svg": "15.15.5",
    "react-native-web": "~0.21.2",
    "react-native-worklets": "0.8.3"
  },
  "devDependencies": {
    "@babel/core": "^7.29.7",
    "@testing-library/react-native": "^14.0.0",
    "@types/node": "^25.9.3",
    "@types/react": "^19.2.15",
    "babel-preset-expo": "~56.0.15",
    "eslint": "^9.39.4",
    "eslint-config-expo": "~56.0.4",
    "react-test-renderer": "19.2.3",
    "tsx": "^4.22.4",
    "typescript": "~6.0.3"
  }
}
```

- [ ] **Step 3: Create `apps/mobile/app.config.ts`**

Adapted from `/Users/ethansmith/Developer/showbook/apps/mobile/app.config.ts` — stripped of showbook's maps/spotify/wallet/e2e-cleartext specifics, kept the SDK-56-correct splash plugin wiring, the `usesNonExemptEncryption` guard, the `scheme` array with the Android package (required for expo-auth-session's `me.ethanasm.vpt:/oauthredirect` Google callback), and `runtimeVersion {policy:'appVersion'}`. **P4 is the only later editor** (version/`updates.url`/`extra.eas.projectId`/submit). `EXPO_PUBLIC_API_URL` defaults to the localhost dev cert host for the simulator.

Create `apps/mobile/app.config.ts`:
```ts
import type { ExpoConfig } from 'expo/config';

// Google OAuth on native uses the *application id* as the redirect scheme.
// expo-auth-session's Google provider builds
// `me.ethanasm.vpt:/oauthredirect` from Application.applicationId. iOS appends
// the bundle id to CFBundleURLSchemes automatically; Android does NOT, so the
// package name must be listed in `scheme` explicitly or Chrome drops the
// callback. (See the showbook app.config.ts header for the full rationale.)
const ANDROID_PACKAGE = 'me.ethanasm.vpt';

const config: ExpoConfig = {
  name: 'Price Tracker',
  slug: 'vpt',
  owner: 'ethanasm',
  // runtimeVersion below derives the expo-updates runtime from this string.
  // P4 owns version bumps; foundation ships 0.1.0.
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: ['vpt', ANDROID_PACKAGE],
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'me.ethanasm.vpt',
    supportsTablet: true,
    // ios.config must be a defined object — Expo's withUsesNonExemptEncryption
    // plugin does `'usesNonExemptEncryption' in config.ios.config`.
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      ITSAppUsesNonExemptEncryption: false,
      // The iOS simulator hits the FastAPI dev server on localhost over the
      // dev cert; scope the insecure exception to localhost so prod policy
      // stays strict.
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          localhost: {
            NSIncludesSubdomains: true,
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#7C3AED',
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        // image MUST stay set or the release Android build fails at
        // processReleaseResources ("drawable/splashscreen_logo not found").
        image: './assets/splash.png',
        imageWidth: 200,
        backgroundColor: '#FAF8FF',
        resizeMode: 'contain',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  // `updates.url` and `extra.eas.projectId` are intentionally absent — P4
  // adds them when it provisions the EAS project (mobile-cicd plan).
};

export default config;
```

- [ ] **Step 4: Create `apps/mobile/metro.config.js`**

Copied near-verbatim from `/Users/ethansmith/Developer/showbook/apps/mobile/metro.config.js`, minus showbook's native-module web-shim block (VPT mobile has no expo-sqlite/maps/spotify; the web target only needs secure-store/auth-session/notifications shims, which P3/P4 add if and when a web-verification loop is wired). The blockList + `disableHierarchicalLookup` + dual `nodeModulesPaths` are the monorepo-critical parts.

Create `apps/mobile/metro.config.js`:
```js
// Learn more https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Block stale pnpm _tmp_ directories that cause ENOENT spam in the watcher.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /_tmp_\d+/,
];

// 1. Watch all files within the monorepo.
config.watchFolders = [workspaceRoot];

// 2. Resolve packages from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies only from nodeModulesPaths.
//    Paired with .npmrc `public-hoist-pattern[]=*` so the flat tree resolves.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 5: Create `apps/mobile/tsconfig.json`, `babel.config.js`, eslint configs, `expo-env.d.ts`, `.gitignore`**

Create `apps/mobile/tsconfig.json` (mirrors showbook's):
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "types": ["expo/types", "node"]
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

Create `apps/mobile/babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

Create `apps/mobile/.eslintrc.js`:
```js
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist-web', '/coverage', '/.expo'],
};
```

Create `apps/mobile/eslint.config.js` (ESLint 9 flat-config entry that `expo lint` resolves):
```js
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist-web/*', 'coverage/*', '.expo/*'],
  },
];
```

Create `apps/mobile/expo-env.d.ts`:
```ts
/// <reference types="expo/types" />

// NOTE: This file should not be edited and should be in your .gitignore-ignored
// build output normally, but is committed here as a stub so `tsc --noEmit`
// resolves the Expo ambient types before the first `expo` run regenerates it.
```

Create `apps/mobile/.gitignore`:
```
# Expo / RN build + cache output
.expo/
dist/
dist-web/
web-build/
coverage/

# Native prebuild output (regenerated by `expo prebuild` / `expo run:*`)
/ios
/android

# Metro / Babel caches
.metro-health-check*
```

- [ ] **Step 6: Create `apps/mobile/project.json` (Nx targets)**

Create `apps/mobile/project.json`:
```json
{
  "name": "mobile",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "apps/mobile",
  "targets": {
    "typecheck": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pnpm --filter mobile typecheck"
      },
      "cache": true
    },
    "lint": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pnpm --filter mobile lint"
      },
      "cache": true
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pnpm --filter mobile test"
      },
      "cache": true
    },
    "test:coverage": {
      "executor": "nx:run-commands",
      "options": {
        "command": "pnpm --filter mobile test:coverage"
      },
      "cache": true
    }
  }
}
```

- [ ] **Step 7: Create the placeholder brand assets**

P4 replaces these with real art. Generate solid-violet PNGs at the sizes Expo expects so `expo config` and prebuild resolve. Run from the repo root:
```bash
mkdir -p apps/mobile/assets
python3 - <<'PY'
import struct, zlib
def png(path, w, h, rgb):
    def chunk(typ, data):
        c = typ + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    row = b'\x00' + bytes(rgb) * w
    raw = row * h
    idat = zlib.compress(raw, 9)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))
v = (124, 58, 237)  # #7C3AED
png('apps/mobile/assets/icon.png', 1024, 1024, v)
png('apps/mobile/assets/adaptive-icon.png', 1024, 1024, v)
png('apps/mobile/assets/splash.png', 1242, 2436, v)
print('wrote placeholder assets')
PY
```
Expected: `wrote placeholder assets`.

- [ ] **Step 8: Install and verify the workspace resolves the new project**

Run from the repo root:
```bash
pnpm install
```
Expected: completes; `apps/mobile` is linked; **no** `apps/mobile/pnpm-lock.yaml` created.

Run:
```bash
git status --porcelain | grep 'apps/mobile/pnpm-lock.yaml' && echo "BAD" || echo "OK: single root lockfile"
```
Expected: `OK: single root lockfile`.

- [ ] **Step 9: Verify Expo config resolves (no native build needed)**

Run:
```bash
pnpm --filter mobile exec expo config --type public 2>&1 | grep -E '"slug"|"scheme"|me.ethanasm.vpt' | head
```
Expected: output includes `"slug": "vpt"` and `me.ethanasm.vpt`. (If `expo` prints an update notice first, that's fine.)

Run:
```bash
pnpm --filter mobile exec expo-doctor 2>&1 | tail -5 || true
```
Expected: no fatal config errors (warnings about EAS project id / missing native dirs are acceptable at this stage — P4 wires EAS).

- [ ] **Step 10: Verify typecheck passes on the empty app**

Run:
```bash
pnpm --filter mobile typecheck
```
Expected: exits 0 (no `.ts`/`.tsx` source yet beyond configs; `tsc` finds nothing to complain about).

- [ ] **Step 11: Confirm the Nx project is registered**

Run:
```bash
pnpm nx show projects | grep '^mobile$'
```
Expected: `mobile`.

- [ ] **Step 12: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.config.ts apps/mobile/metro.config.js \
  apps/mobile/tsconfig.json apps/mobile/babel.config.js apps/mobile/.eslintrc.js \
  apps/mobile/eslint.config.js apps/mobile/project.json apps/mobile/expo-env.d.ts \
  apps/mobile/.gitignore apps/mobile/assets pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo SDK 56 app (config, metro, tsconfig, nx targets)"
```

---

## Task 3: Design-token module

**Files:**
- Create: `apps/mobile/lib/theme/tokens.ts`
- Create: `apps/mobile/lib/theme/index.ts`
- Create: `apps/mobile/lib/fonts.ts`
- Test: `apps/mobile/lib/theme/__tests__/tokens.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure constants); the app scaffold from Task 2 (path alias `@/*`).
- Produces (consumed by Task 6 layouts and all of P3's screens):
  - `tokens` — frozen object: `tokens.color.primary` (`'#7C3AED'`), `tokens.color.primaryDeep`, `tokens.color.accentPink`, `tokens.color.accentCyan`, `tokens.color.pageBg`, `tokens.color.surface`, `tokens.color.surfaceAlt`, `tokens.color.chipBg`, `tokens.color.card`, `tokens.color.hairline`, `tokens.color.selectedBorder`, `tokens.color.textStrong`, `tokens.color.textBody`, `tokens.color.textMuted`, `tokens.color.textFaint`, `tokens.color.success`/`successBg`, `tokens.color.warning`/`warningBg`, `tokens.color.layover`/`layoverBg`/`layoverBorder`, `tokens.color.star`.
  - `tokens.gradient.primary` / `tokens.gradient.totalCard` — `readonly [string, string]` color-stop tuples for `expo-linear-gradient`.
  - `tokens.airline` — `Record<'AS'|'UA'|'DL', { colors: readonly [string,string]; label: string }>`.
  - `tokens.radius` (`{ card, inner, pill, badge }`), `tokens.shadow` (RN shadow objects `cardOnCanvas`, `primaryButton`, `totalCard`), `tokens.font` (Manrope family-name map keyed by weight), `tokens.type` (size/weight scale).
  - `formatUsd(n: number): string` — `formatUsd(789) === '$789'` (the behavioral-check totals render verbatim).
  - `ThemeProvider`, `useTheme(): { tokens: typeof tokens }`, and `useThemedStyles<T>(factory: (t: typeof tokens) => T): T`.
  - `FONT` (re-export of `tokens.font`) and `loadAppFonts(): Promise<void>` from `lib/fonts.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/theme/__tests__/tokens.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokens, formatUsd } from '../tokens';

test('primary violet matches the Aurora token', () => {
  assert.equal(tokens.color.primary, '#7C3AED');
  assert.equal(tokens.color.primaryDeep, '#6D28D9');
});

test('gradients are two-stop tuples usable by expo-linear-gradient', () => {
  assert.deepEqual(tokens.gradient.primary, ['#A78BFA', '#7C3AED']);
  assert.deepEqual(tokens.gradient.totalCard, ['#7C3AED', '#9333EA']);
});

test('airline monogram chips carry the original-mark gradients', () => {
  assert.deepEqual(tokens.airline.AS.colors, ['#10617F', '#093247']);
  assert.deepEqual(tokens.airline.UA.colors, ['#2456C9', '#13357F']);
  assert.deepEqual(tokens.airline.DL.colors, ['#C8102E', '#7A0A1C']);
});

test('Manrope weights 400-800 are registered', () => {
  for (const w of [400, 500, 600, 700, 800] as const) {
    assert.equal(typeof tokens.font[w], 'string');
    assert.ok(tokens.font[w].length > 0);
  }
});

test('formatUsd renders the verified behavioral totals without decimals', () => {
  assert.equal(formatUsd(789), '$789');
  assert.equal(formatUsd(754), '$754');
  assert.equal(formatUsd(680), '$680');
  assert.equal(formatUsd(1838), '$1,838');
});

test('tokens object is frozen so screens cannot mutate the shared source', () => {
  assert.ok(Object.isFrozen(tokens));
  assert.ok(Object.isFrozen(tokens.color));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/theme/__tests__/tokens.test.ts
```
Expected: FAIL — `Cannot find module '../tokens'`.

- [ ] **Step 3: Implement `apps/mobile/lib/theme/tokens.ts`**

No React/RN imports — keeps it node:test-importable (mirrors showbook's `theme-utils.ts`/`theme.ts` split). Manrope family names match the `@expo-google-fonts/manrope` exports loaded in `lib/fonts.ts` (Task 3 Step 6).

Create `apps/mobile/lib/theme/tokens.ts`:
```ts
/**
 * Aurora design tokens — the single source of truth the mobile screens (P3)
 * consume. Pure data + helpers, no React Native imports, so node:test can
 * import this file directly. Values are copied verbatim from the Aurora
 * handoff (design_handoff_price_tracker/README.md) and apps/web globals.css.
 */

export const tokens = Object.freeze({
  color: Object.freeze({
    primary: '#7C3AED',
    primaryDeep: '#6D28D9',
    accentPink: '#EC4899',
    accentPinkLight: '#F9A8D4',
    accentCyan: '#22D3EE',
    pageBg: '#FAF8FF',
    surface: '#F4F1FC',
    surfaceAlt: '#F8F5FE',
    chipBg: '#EDE9FE',
    card: '#FFFFFF',
    hairline: '#F1EEF8',
    hairlineAlt: '#ECE8F5',
    selectedBorder: '#C9B8F5',
    textStrong: '#1A1A2E',
    textBody: '#4A4660',
    textBodyAlt: '#6B6680',
    textMuted: '#8B86A0',
    textFaint: '#BDB6D4',
    success: '#059669',
    successBg: '#ECFDF5',
    warning: '#9A7B18',
    warningBg: '#FEF6DD',
    layover: '#C98A3A',
    layoverBg: '#FDF6E9',
    layoverBorder: '#F6E7C8',
    star: '#F5A623',
    starEmpty: '#E0D9EF',
  }),
  gradient: Object.freeze({
    primary: Object.freeze(['#A78BFA', '#7C3AED'] as const),
    totalCard: Object.freeze(['#7C3AED', '#9333EA'] as const),
  }),
  airline: Object.freeze({
    AS: Object.freeze({ colors: Object.freeze(['#10617F', '#093247'] as const), label: 'AS' }),
    UA: Object.freeze({ colors: Object.freeze(['#2456C9', '#13357F'] as const), label: 'UA' }),
    DL: Object.freeze({ colors: Object.freeze(['#C8102E', '#7A0A1C'] as const), label: 'DL' }),
  }),
  radius: Object.freeze({ card: 16, inner: 13, pill: 10, badge: 999 }),
  shadow: Object.freeze({
    // RN shadow objects (iOS) + elevation (Android). rgba(60,40,120,.13) etc.
    cardOnCanvas: Object.freeze({
      shadowColor: '#3C2878',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.13,
      shadowRadius: 50,
      elevation: 8,
    }),
    primaryButton: Object.freeze({
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.32,
      shadowRadius: 14,
      elevation: 6,
    }),
    totalCard: Object.freeze({
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 22,
      elevation: 7,
    }),
  }),
  // Manrope family names exactly as @expo-google-fonts/manrope exports them
  // (loaded in lib/fonts.ts). Weight key -> RN fontFamily string.
  font: Object.freeze({
    400: 'Manrope_400Regular',
    500: 'Manrope_500Medium',
    600: 'Manrope_600SemiBold',
    700: 'Manrope_700Bold',
    800: 'Manrope_800ExtraBold',
  } as Record<400 | 500 | 600 | 700 | 800, string>),
  type: Object.freeze({
    h1: { fontSize: 26, weight: 800 as const, letterSpacing: -0.5 },
    sectionTitle: { fontSize: 16, weight: 700 as const, letterSpacing: 0 },
    statValue: { fontSize: 22, weight: 800 as const, letterSpacing: -0.4 },
    body: { fontSize: 14, weight: 500 as const, letterSpacing: 0 },
    label: { fontSize: 11, weight: 700 as const, letterSpacing: 0.5 },
  }),
});

export type Tokens = typeof tokens;

/** Format a whole-dollar amount as the Aurora UI shows it: `$789`, `$1,838`. */
export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/theme/__tests__/tokens.test.ts
```
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Implement `apps/mobile/lib/theme/index.ts` (provider + hooks)**

Create `apps/mobile/lib/theme/index.ts`:
```tsx
/**
 * Theme provider + hooks. The token set is static (Aurora is a single light
 * theme), so the provider mostly exists to give screens a stable `useTheme()`
 * entry point and a memoised `useThemedStyles` helper. Kept thin on purpose —
 * P3 builds StyleSheets on top of this.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { tokens, type Tokens } from './tokens';

export { tokens, formatUsd, type Tokens } from './tokens';

export interface ThemeValue {
  tokens: Tokens;
}

const ThemeContext = React.createContext<ThemeValue>({ tokens });

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const value = React.useMemo<ThemeValue>(() => ({ tokens }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return React.useContext(ThemeContext);
}

/**
 * Build a memoised StyleSheet from the tokens. Usage:
 *   const styles = useThemedStyles((t) => ({ card: { backgroundColor: t.color.card } }));
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (t: Tokens) => T,
): T {
  return React.useMemo(() => StyleSheet.create(factory(tokens)), [factory]);
}
```

- [ ] **Step 6: Implement `apps/mobile/lib/fonts.ts`**

Create `apps/mobile/lib/fonts.ts`:
```ts
/**
 * Loads the Manrope family (weights 400–800) used across the Aurora UI.
 * Called once during root-layout mount with the splash screen held up until
 * it resolves (see app/_layout.tsx). Re-exports FONT so screens can reference
 * family names without importing tokens twice.
 */
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { tokens } from './theme/tokens';

export const FONT = tokens.font;

export const APP_FONTS = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

/** Hook form — returns true once fonts are ready. Used by the root layout. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts(APP_FONTS);
  return loaded;
}
```

- [ ] **Step 7: Typecheck the module**

Run:
```bash
pnpm --filter mobile typecheck
```
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/theme apps/mobile/lib/fonts.ts
git commit -m "feat(mobile): add Aurora design-token module + Manrope font loader"
```

---

## Task 4: REST/JWT API client

**Files:**
- Create: `apps/mobile/lib/api/types.ts` (regenerated, see Step 2)
- Create: `apps/mobile/lib/env.ts`
- Create: `apps/mobile/lib/api/errors.ts`
- Create: `apps/mobile/lib/api/client.ts`
- Test: `apps/mobile/lib/api/__tests__/client.test.ts`

**Types decision (justify in commit + here):** **Regenerate** the OpenAPI types into `apps/mobile/lib/api/types.ts` rather than sharing `apps/web/src/lib/api/types.ts` via a workspace package. Rationale: (1) the web file lives under `apps/web/src/lib/api/` and is already a pure `openapi-typescript` output with **no React imports**, but importing it across app boundaries would make `mobile` depend on the `web` Nx project (coupling two otherwise-disjoint apps and tripping Nx affected-graph noise); (2) a new shared package would need its own `package.json`/build/test wiring for a single generated file — YAGNI; (3) the web app already owns the generation script (`apps/web/package.json` → `generate:api-types`, which runs `export_openapi.py` then `openapi-typescript`). Mobile reuses the **same generator against the same spec**, writing to its own file, so the two stay in lockstep without a runtime dependency. The generated file is committed (like the web one) so `tsc`/tests don't need a live API.

**Interfaces:**
- Consumes: Task 2 scaffold (`@/*` alias, deps).
- Produces (consumed by Task 5 auth + all of P3's screens):
  - `API_URL: string`, `describeApiMisconfiguration(): string | null` from `lib/env.ts`.
  - `ApiError` (`{ status: number; detail: string }`) and `AuthError` from `lib/api/errors.ts`.
  - `createApiClient(opts: ApiClientOptions): ApiClient` from `lib/api/client.ts`, where:
    ```ts
    interface ApiClientOptions {
      baseUrl: string;
      getToken: () => string | null;            // current access JWT
      refresh: () => Promise<boolean>;           // attempt refresh; true on success
      fetchImpl?: typeof fetch;                  // injectable for tests
    }
    interface ApiClient {
      listTrips(params?: { page?: number; limit?: number; status?: TripStatus }): Promise<TripSummary[]>;
      getTrip(id: string): Promise<TripDetailResponse>;
      createTrip(body: TripCreate, idempotencyKey: string): Promise<TripDetail>;
      sendChatMessage(body: { message: string; thread_id?: string }): Promise<Response>; // raw SSE stream
    }
    ```
  - Exported types `TripSummary` (= generated `TripResponse`), `TripDetail`, `TripDetailResponse`, `TripCreate`, `TripStatus`, `PriceSnapshot` — re-exported from `lib/api/types.ts` so P3 imports them from `@/lib/api/client`.
  - The client unwraps VPT's `APIResponse<T>` envelope (`{ data, meta }`) and returns `data`. Confirmed from `apps/api/app/routers/trips.py`: list/create/detail responses are all `APIResponse[...]`. `createTrip` sends the required `X-Idempotency-Key` header (`apps/api/CLAUDE.md` Idempotency pattern).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/api/__tests__/client.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../client';
import { ApiError, AuthError } from '../errors';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('listTrips unwraps the {data} envelope and attaches the bearer token', async () => {
  let seenAuth: string | null = null;
  let seenUrl = '';
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt-123',
    refresh: async () => true,
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      seenAuth = new Headers(init?.headers).get('authorization');
      return jsonResponse({ data: [{ id: 't1', name: 'Maui' }], meta: { total: 1 } });
    },
  });
  const trips = await client.listTrips();
  assert.equal(seenUrl, 'https://api.test/v1/trips?page=1&limit=20');
  assert.equal(seenAuth, 'Bearer jwt-123');
  assert.equal(trips.length, 1);
  assert.equal(trips[0].id, 't1');
});

test('a 401 triggers refresh then a single retry of the original request', async () => {
  const calls: number[] = [];
  let refreshed = false;
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => (refreshed ? 'jwt-new' : 'jwt-old'),
    refresh: async () => {
      refreshed = true;
      return true;
    },
    fetchImpl: async (_url, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      calls.push(1);
      if (auth === 'Bearer jwt-old') return jsonResponse({ detail: 'expired' }, 401);
      return jsonResponse({ data: [], meta: { total: 0 } });
    },
  });
  const trips = await client.listTrips();
  assert.equal(calls.length, 2); // original 401 + retry
  assert.deepEqual(trips, []);
});

test('a 401 with a failing refresh throws AuthError', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt-old',
    refresh: async () => false,
    fetchImpl: async () => jsonResponse({ detail: 'expired' }, 401),
  });
  await assert.rejects(() => client.listTrips(), (err: unknown) => err instanceof AuthError);
});

test('a non-401 error surfaces as ApiError carrying status + detail', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt',
    refresh: async () => true,
    fetchImpl: async () => jsonResponse({ detail: 'Trip not found', title: 'Not found' }, 404),
  });
  await assert.rejects(
    () => client.getTrip('missing'),
    (err: unknown) => err instanceof ApiError && (err as ApiError).status === 404,
  );
});

test('createTrip sends the X-Idempotency-Key header and POST body', async () => {
  let seenKey: string | null = null;
  let seenMethod = '';
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getToken: () => 'jwt',
    refresh: async () => true,
    fetchImpl: async (_url, init) => {
      seenKey = new Headers(init?.headers).get('x-idempotency-key');
      seenMethod = init?.method ?? 'GET';
      return jsonResponse({ data: { id: 'new-trip', name: 'Tokyo' } }, 201);
    },
  });
  const trip = await client.createTrip(
    { name: 'Tokyo' } as never,
    'idem-key-abc',
  );
  assert.equal(seenMethod, 'POST');
  assert.equal(seenKey, 'idem-key-abc');
  assert.equal((trip as { id: string }).id, 'new-trip');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/api/__tests__/client.test.ts
```
Expected: FAIL — `Cannot find module '../client'`.

- [ ] **Step 3: Generate `apps/mobile/lib/api/types.ts` from the live OpenAPI spec**

Reuse the web app's generator against the same spec (the web app owns it). From the repo root:
```bash
mkdir -p apps/mobile/lib/api
cd apps/api && uv run python scripts/export_openapi.py /tmp/vpt-openapi.json && cd -
npx --yes openapi-typescript@^7.13.0 /tmp/vpt-openapi.json -o apps/mobile/lib/api/types.ts
head -5 apps/mobile/lib/api/types.ts
```
Expected: `apps/mobile/lib/api/types.ts` exists and begins with `/** This file was auto-generated by openapi-typescript. */`.

> If `apps/api` deps aren't synced in this environment, fall back to copying the already-generated web spec, which is the same output:
> ```bash
> npx --yes openapi-typescript@^7.13.0 apps/web/src/lib/api/openapi.json -o apps/mobile/lib/api/types.ts
> ```

- [ ] **Step 4: Implement `apps/mobile/lib/env.ts`**

Create `apps/mobile/lib/env.ts`:
```ts
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
```

- [ ] **Step 5: Implement `apps/mobile/lib/api/errors.ts`**

Create `apps/mobile/lib/api/errors.ts`:
```ts
/** Error classes mirroring apps/web/src/lib/api.ts so call-sites read alike. */

export class AuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail ?? message;
  }
}
```

- [ ] **Step 6: Implement `apps/mobile/lib/api/client.ts`**

Create `apps/mobile/lib/api/client.ts`:
```ts
/**
 * Typed REST client for the VPT FastAPI backend (/v1/*). Bearer-JWT auth with
 * refresh-on-401 + single retry. Mirrors the contract of apps/web/src/lib/api.ts
 * but uses an Authorization header (not cookies) because mobile authenticates
 * with the JWT pair minted by POST /v1/auth/mobile-token (see lib/auth).
 *
 * Responses are wrapped in VPT's APIResponse<T> envelope `{ data, meta }`; the
 * typed methods unwrap and return `data`.
 */
import type { components } from './types';
import { ApiError, AuthError } from './errors';

export type TripStatus = components['schemas']['TripStatus'];
export type TripSummary = components['schemas']['TripResponse'];
export type TripDetail = components['schemas']['TripDetail'];
export type TripDetailResponse = components['schemas']['TripDetailResponse'];
export type TripCreate = components['schemas']['TripCreate'];
export type PriceSnapshot = components['schemas']['PriceSnapshotResponse'];

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  refresh: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  listTrips(params?: { page?: number; limit?: number; status?: TripStatus }): Promise<TripSummary[]>;
  getTrip(id: string): Promise<TripDetailResponse>;
  createTrip(body: TripCreate, idempotencyKey: string): Promise<TripDetail>;
  sendChatMessage(body: { message: string; thread_id?: string }): Promise<Response>;
}

interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown> | null;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');

  function buildHeaders(extra?: Record<string, string>): Headers {
    const headers = new Headers(extra);
    const token = opts.getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  }

  /** Fetch with refresh-on-401 + single retry. Returns the raw Response. */
  async function request(path: string, init: RequestInit): Promise<Response> {
    const url = `${base}${path}`;
    const baseHeaders = init.headers instanceof Headers ? init.headers : new Headers(init.headers);

    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, headers: baseHeaders });
    } catch {
      throw new AuthError('Unable to connect to server');
    }

    if (res.status === 401) {
      const ok = await opts.refresh();
      if (!ok) throw new AuthError('Session expired. Please sign in again.');
      // Rebuild headers so the refreshed bearer token is attached.
      const retryHeaders = buildHeaders();
      for (const [k, v] of baseHeaders.entries()) {
        if (k.toLowerCase() !== 'authorization') retryHeaders.set(k, v);
      }
      try {
        res = await fetchImpl(url, { ...init, headers: retryHeaders });
      } catch {
        throw new AuthError('Unable to connect to server');
      }
      if (res.status === 401) throw new AuthError('Authentication failed after token refresh.');
    }

    return res;
  }

  async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const res = await request(path, init);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { title?: string; detail?: string };
      throw new ApiError(res.status, body.title ?? `Request failed (${res.status})`, body.detail);
    }
    return (await res.json()) as T;
  }

  return {
    async listTrips(params) {
      const q = new URLSearchParams();
      q.set('page', String(params?.page ?? 1));
      q.set('limit', String(params?.limit ?? 20));
      if (params?.status) q.set('status', params.status);
      const env = await requestJson<Envelope<TripSummary[]>>(`/v1/trips?${q.toString()}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      return env.data;
    },

    async getTrip(id) {
      const env = await requestJson<Envelope<TripDetailResponse>>(`/v1/trips/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      return env.data;
    },

    async createTrip(body, idempotencyKey) {
      const env = await requestJson<Envelope<TripDetail>>('/v1/trips', {
        method: 'POST',
        headers: buildHeaders({
          'content-type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        }),
        body: JSON.stringify(body),
      });
      return env.data;
    },

    async sendChatMessage(body) {
      // Returns the raw SSE Response — the chat screen (P3) consumes the
      // text/event-stream chunks. /v1/chat/messages streams, it is not enveloped.
      return request('/v1/chat/messages', {
        method: 'POST',
        headers: buildHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(body),
      });
    },
  };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/api/__tests__/client.test.ts
```
Expected: PASS — all 5 tests pass.

- [ ] **Step 8: Typecheck**

Run:
```bash
pnpm --filter mobile typecheck
```
Expected: exits 0. (If the generated `types.ts` lacks a `schemas` member the client references, regenerate per Step 3 against the current spec.)

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/lib/api apps/mobile/lib/env.ts
git commit -m "feat(mobile): typed REST/JWT API client over VPT /v1/* (regenerated OpenAPI types)"
```

---

## Task 5: Auth (device side)

**Files:**
- Create: `apps/mobile/lib/auth/contract.ts`
- Create: `apps/mobile/lib/auth/exchange.ts`
- Create: `apps/mobile/lib/auth/storage.ts`
- Create: `apps/mobile/lib/auth/index.tsx`
- Test: `apps/mobile/lib/auth/__tests__/exchange.test.ts`
- Test: `apps/mobile/lib/auth/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `API_URL`/`describeGoogleOAuthMisconfiguration` from `lib/env.ts` (Task 4); `createApiClient`'s `refresh`/`getToken` contract (Task 4).
- Produces (consumed by Task 6 layout + P3 sign-in screen):
  - `AuthProvider` and `useAuth(): AuthContextValue` from `lib/auth/index.tsx`, where:
    ```ts
    interface SessionUser { id: string; email: string; email_notifications_enabled: boolean }
    interface AuthContextValue {
      user: SessionUser | null;
      token: string | null;        // current access JWT
      isLoading: boolean;          // restoring cached session on mount
      isSigningIn: boolean;
      error: string | null;
      signIn: () => Promise<void>;
      signOut: () => Promise<void>;
      refresh: () => Promise<boolean>;  // wired into the api client
    }
    ```
  - `exchangeGoogleIdTokenForSession({ idToken, apiUrl, fetchImpl? }): Promise<SessionData>` from `lib/auth/exchange.ts`.
  - `SessionData` / `SessionUser` / `MobileTokenRequest` / `MobileTokenResponse` types from `lib/auth/contract.ts`.
  - `saveSession`, `loadSession`, `clearSession` from `lib/auth/storage.ts`.

**The P5 contract (document verbatim — P5 implements this endpoint):**

```
POST /v1/auth/mobile-token
Content-Type: application/json

Request body:
  { "id_token": "<Google ID token (JWT) from expo-auth-session>" }

Behaviour (P5 must implement in apps/api):
  1. Verify the Google ID token signature + audience against the
     comma-separated allowlist GOOGLE_OAUTH_MOBILE_AUDIENCES (iOS + Android +
     web client IDs).  -> 401 {"detail": "..."} on failure.
  2. Run the same allowlist check as the web OAuth callback
     (should_allow_sign_in in app/core/auth_allowlist.py). -> 403 on rejection.
  3. Upsert the user by google_sub (same as google_auth_callback).
  4. Mint the SAME JWT pair the web callback issues via
     create_access_token / create_refresh_token (app/core/security.py).
  5. Return them in the BODY (not Set-Cookie) so the device can store them:

Success response (200):
  {
    "access_token":  "<JWT>",
    "refresh_token": "<JWT>",
    "user": { "id": "<uuid>", "email": "<str>", "email_notifications_enabled": <bool> }
  }

Errors: 401 invalid_google_token · 403 access_denied · 429 rate_limited ·
        4xx/5xx server_error_<status> · malformed body -> client treats as invalid_response.

ALSO REQUIRED OF P5 (auth dependency change): VPT's get_current_user
(apps/api/app/routers/auth.py) currently reads the JWT only from the
`access_token_cookie` cookie. P5 must extend it (or the shared auth dependency)
to ALSO accept `Authorization: Bearer <access_token>` so the mobile client's
bearer-header requests authenticate. Refresh: the device calls
POST /v1/auth/refresh with the refresh token in the Authorization header (P5
adds bearer support there too) and receives a new pair in the body.
```

This contract mirrors showbook's `/api/auth/mobile-token` (see `apps/mobile/lib/auth-helpers.ts` `exchangeGoogleIdTokenForSession`), adapted to VPT's `access_token`/`refresh_token` field names and the `{user:{id,email,email_notifications_enabled}}` shape from `apps/api/app/routers/auth.py` `UserResponse`.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/lib/auth/__tests__/exchange.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exchangeGoogleIdTokenForSession } from '../exchange';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const okBody = {
  access_token: 'access-jwt',
  refresh_token: 'refresh-jwt',
  user: { id: 'u1', email: 'a@b.com', email_notifications_enabled: true },
};

test('posts the Google id_token and returns the parsed session', async () => {
  let seenUrl = '';
  let seenBody = '';
  const session = await exchangeGoogleIdTokenForSession({
    idToken: 'google-id-token',
    apiUrl: 'https://api.test',
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      seenBody = String(init?.body);
      return jsonResponse(okBody);
    },
  });
  assert.equal(seenUrl, 'https://api.test/v1/auth/mobile-token');
  assert.deepEqual(JSON.parse(seenBody), { id_token: 'google-id-token' });
  assert.equal(session.accessToken, 'access-jwt');
  assert.equal(session.refreshToken, 'refresh-jwt');
  assert.equal(session.user.id, 'u1');
});

test('maps status codes to stable error messages', async () => {
  const cases: Array<[number, string]> = [
    [401, 'invalid_google_token'],
    [403, 'access_denied'],
    [429, 'rate_limited'],
    [500, 'server_error_500'],
  ];
  for (const [status, expected] of cases) {
    await assert.rejects(
      () =>
        exchangeGoogleIdTokenForSession({
          idToken: 'x',
          apiUrl: 'https://api.test',
          fetchImpl: async () => jsonResponse({ detail: 'no' }, status),
        }),
      (err: unknown) => err instanceof Error && err.message === expected,
      `status ${status} should map to ${expected}`,
    );
  }
});

test('a malformed success body throws invalid_response', async () => {
  await assert.rejects(
    () =>
      exchangeGoogleIdTokenForSession({
        idToken: 'x',
        apiUrl: 'https://api.test',
        fetchImpl: async () => jsonResponse({ access_token: 'only-this' }),
      }),
    (err: unknown) => err instanceof Error && err.message === 'invalid_response',
  );
});
```

Create `apps/mobile/lib/auth/__tests__/storage.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/auth/__tests__/exchange.test.ts lib/auth/__tests__/storage.test.ts
```
Expected: FAIL — `Cannot find module '../exchange'` / `'../storage'`.

- [ ] **Step 3: Implement `apps/mobile/lib/auth/contract.ts`**

Create `apps/mobile/lib/auth/contract.ts`:
```ts
/**
 * The exact request/response contract for POST /v1/auth/mobile-token.
 * P2 (this plan) builds the device side against these types; P5 builds the
 * matching FastAPI endpoint. Keep this file and the P5 endpoint in lockstep.
 */

export interface SessionUser {
  id: string;
  email: string;
  email_notifications_enabled: boolean;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** Request body the device POSTs to /v1/auth/mobile-token. */
export interface MobileTokenRequest {
  id_token: string;
}

/** Success (200) body the endpoint must return. */
export interface MobileTokenResponse {
  access_token: string;
  refresh_token: string;
  user: SessionUser;
}

export function isMobileTokenResponse(value: unknown): value is MobileTokenResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.access_token !== 'string' || v.access_token.length === 0) return false;
  if (typeof v.refresh_token !== 'string' || v.refresh_token.length === 0) return false;
  const u = v.user as Record<string, unknown> | undefined;
  if (typeof u !== 'object' || u === null) return false;
  if (typeof u.id !== 'string' || u.id.length === 0) return false;
  if (typeof u.email !== 'string' || u.email.length === 0) return false;
  if (typeof u.email_notifications_enabled !== 'boolean') return false;
  return true;
}
```

- [ ] **Step 4: Implement `apps/mobile/lib/auth/exchange.ts`**

Create `apps/mobile/lib/auth/exchange.ts`:
```ts
/**
 * Pure Google-ID-token → VPT-session exchange. No Expo/RN imports so node:test
 * can run it directly (mirrors showbook's auth-helpers.ts split from auth.ts).
 */
import { isMobileTokenResponse, type SessionData } from './contract';

export async function exchangeGoogleIdTokenForSession(args: {
  idToken: string;
  apiUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<SessionData> {
  const { idToken, apiUrl, fetchImpl = fetch } = args;
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/v1/auth/mobile-token`;

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
  } catch (err) {
    throw new Error('api_unreachable');
  }

  if (res.status === 401) throw new Error('invalid_google_token');
  if (res.status === 403) throw new Error('access_denied');
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(`server_error_${res.status}`);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('invalid_response');
  }
  if (!isMobileTokenResponse(body)) throw new Error('invalid_response');

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    user: body.user,
  };
}

/** Translate an exchange error into an end-user message (used by the provider). */
export function describeSignInError(err: unknown): string {
  if (err instanceof Error) {
    switch (err.message) {
      case 'invalid_google_token':
        return 'Google rejected the sign-in token. Check GOOGLE_OAUTH_MOBILE_AUDIENCES on the API.';
      case 'access_denied':
        return 'Access denied. Contact the admin to be added to the allowlist.';
      case 'rate_limited':
        return 'Too many sign-in attempts. Wait a minute and try again.';
      case 'invalid_response':
        return "The server's response wasn't what we expected. Try again.";
      case 'api_unreachable':
        return 'Price Tracker is not reachable. Check EXPO_PUBLIC_API_URL.';
      case 'oauth_dismissed':
        return 'Sign-in was cancelled.';
      case 'oauth_error':
        return 'Google sign-in failed. Please try again.';
      default:
        if (err.message.startsWith('server_error_')) {
          return "We couldn't reach Price Tracker. Please try again in a moment.";
        }
    }
  }
  return "We couldn't sign you in. Please check your connection and try again.";
}
```

- [ ] **Step 5: Implement `apps/mobile/lib/auth/storage.ts`**

Create `apps/mobile/lib/auth/storage.ts`:
```ts
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
```

- [ ] **Step 6: Run the unit tests to verify they pass**

Run:
```bash
pnpm --filter mobile exec node --import tsx --test lib/auth/__tests__/exchange.test.ts lib/auth/__tests__/storage.test.ts
```
Expected: PASS — exchange (3 tests) + storage (4 tests) all pass.

- [ ] **Step 7: Implement `apps/mobile/lib/auth/index.tsx` (provider + hook)**

Mirrors showbook's `lib/auth.ts` mechanics (useIdTokenAuthRequest + response useEffect, since on native the id_token only lands on the `response` tuple after the hook's internal code exchange), adapted to VPT's two-token session + refresh-against-`/v1/auth/refresh`. SecureStore calls are guarded; the pure exchange/storage helpers (Steps 4–5) carry the unit coverage.

Create `apps/mobile/lib/auth/index.tsx`:
```tsx
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

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
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
```

- [ ] **Step 8: Typecheck**

Run:
```bash
pnpm --filter mobile typecheck
```
Expected: exits 0.

- [ ] **Step 9: Run the full mobile test + coverage suite (lib/** gate)**

Run:
```bash
pnpm --filter mobile test:coverage 2>&1 | tail -20
```
Expected: tokens + client + exchange + storage suites all PASS; `coverage/mobile-unit.info` written. The pure-logic files under `lib/**` (`tokens.ts`, `api/client.ts`, `api/errors.ts`, `auth/exchange.ts`, `auth/storage.ts`, `auth/contract.ts`) carry the coverage; the React-y `index.tsx`/provider files and `env.ts` are thin glue, consistent with showbook's "lib pure helpers covered, provider mechanics exercised in app" split. Confirm the covered lib files clear 80% lines/branches/functions.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/lib/auth
git commit -m "feat(mobile): device-side Google auth + mobile-token exchange against VPT JWT"
```

---

## Task 6: Navigation shell

**Files:**
- Create: `apps/mobile/components/screen-stub.tsx`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/app/(tabs)/alerts.tsx`
- Create: `apps/mobile/app/(tabs)/chat.tsx`
- Create: `apps/mobile/app/trip/[id].tsx`
- Create: `apps/mobile/app/trip/new.tsx`
- Test: boot/navigation verification in the simulator (layout-heavy `app/**` is excluded from the coverage gate, mirroring showbook).

**Interfaces:**
- Consumes: `ThemeProvider`/`useTheme`/`tokens` (Task 3), `useAppFonts` (Task 3), `AuthProvider`/`useAuth` (Task 5), `createApiClient` (Task 4).
- Produces (the navigation map P3 fills in):
  - Route names: `(tabs)` group with `index` (Trips), `alerts` (Alerts), `chat` (Chat); stack routes `trip/[id]` (detail), `trip/new` (create), and `(auth)/sign-in`. Tab order **Trips · Alerts · Chat**, lucide icons `Plane` / `Bell` / `MessageCircle`, active tint `tokens.color.primary`.
  - A `<ScreenStub title=... />` component each stub renders, so the app boots and every route shows its title.
  - The auth gate: unauthenticated users are redirected to `(auth)/sign-in`; authenticated users land on `(tabs)`.
  - An `ApiClientProvider` exposing `useApiClient(): ApiClient`, created once with `getToken`/`refresh` bound to `useAuth()` (so P3 screens call `useApiClient().listTrips()` etc.).

- [ ] **Step 1: Create the shared screen stub**

Create `apps/mobile/components/screen-stub.tsx`:
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

/**
 * Minimal screen placeholder. P3 replaces each route body with the real Aurora
 * screen; until then every route renders its title so the app boots and
 * navigation is verifiable.
 */
export function ScreenStub({ title, subtitle }: { title: string; subtitle?: string }): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]}>
      <View style={styles.center}>
        <Text
          accessibilityRole="header"
          style={{ color: tokens.color.textStrong, fontFamily: tokens.font[800], fontSize: 24 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], marginTop: 6 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
```

- [ ] **Step 2: Create the root layout (`app/_layout.tsx`) with the provider chain + auth gate + api client**

Create `apps/mobile/app/_layout.tsx`:
```tsx
/**
 * Root layout — provider chain for the whole app.
 *   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → AuthProvider
 *   → QueryClientProvider → ApiClientProvider → Stack
 * Fonts are loaded before the first paint (splash held up). The auth gate
 * redirects signed-out users to (auth)/sign-in.
 */
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { ThemeProvider } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useAppFonts } from '@/lib/fonts';
import { ApiClientProvider } from '@/lib/api/provider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout(): React.JSX.Element | null {
  const fontsLoaded = useAppFonts();

  React.useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <Providers>
              <AuthGate />
              <StatusBar style="dark" />
            </Providers>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
}

/**
 * Redirects between the (auth) group and the app shell based on session state.
 * Renders the active route via <Stack>.
 */
function AuthGate(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="trip/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="trip/new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Create the api-client provider (`lib/api/provider.tsx`)**

Create `apps/mobile/lib/api/provider.tsx`:
```tsx
/**
 * Creates the REST client once and binds its getToken/refresh to useAuth(),
 * via refs so the client isn't recreated on every token change. P3 screens
 * call useApiClient().listTrips() etc.
 */
import React from 'react';
import { API_URL } from '@/lib/env';
import { useAuth } from '@/lib/auth';
import { createApiClient, type ApiClient } from './client';

const ApiClientContext = React.createContext<ApiClient | null>(null);

export function ApiClientProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { token, refresh } = useAuth();
  const tokenRef = React.useRef<string | null>(token);
  const refreshRef = React.useRef(refresh);
  React.useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  React.useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const [client] = React.useState<ApiClient>(() =>
    createApiClient({
      baseUrl: API_URL,
      getToken: () => tokenRef.current,
      refresh: () => refreshRef.current(),
    }),
  );

  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = React.useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient must be used within ApiClientProvider');
  return client;
}
```

- [ ] **Step 4: Create the auth group (`(auth)/_layout.tsx` + `(auth)/sign-in.tsx`)**

Create `apps/mobile/app/(auth)/_layout.tsx`:
```tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `apps/mobile/app/(auth)/sign-in.tsx` (placeholder wired to auth — P3 styles the full Aurora hero):
```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';

export default function SignInScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const { signIn, isSigningIn, error } = useAuth();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]}>
      <View style={styles.center}>
        <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[800], fontSize: 26 }}>
          Price Tracker
        </Text>
        <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], marginTop: 8, marginBottom: 24 }}>
          Find your cheapest vacation window.
        </Text>
        <Pressable
          accessibilityRole="button"
          testID="sign-in-google"
          onPress={() => void signIn()}
          disabled={isSigningIn}
          style={[styles.button, { backgroundColor: tokens.color.card, borderColor: tokens.color.hairline }]}
        >
          {isSigningIn ? (
            <ActivityIndicator color={tokens.color.primary} />
          ) : (
            <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[700] }}>
              Sign in with Google
            </Text>
          )}
        </Pressable>
        <Text style={{ color: tokens.color.textFaint, fontFamily: tokens.font[500], fontSize: 11, marginTop: 14 }}>
          We never store passwords
        </Text>
        {error ? (
          <Text style={{ color: tokens.color.warning, fontFamily: tokens.font[500], marginTop: 16, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  button: {
    minWidth: 240,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
```

- [ ] **Step 5: Create the tab bar (`(tabs)/_layout.tsx`) — Trips · Alerts · Chat**

Create `apps/mobile/app/(tabs)/_layout.tsx`:
```tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plane, Bell, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

export default function TabsLayout(): React.JSX.Element {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 4);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.textMuted,
        tabBarStyle: {
          backgroundColor: tokens.color.card,
          borderTopColor: tokens.color.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: bottomPad,
          height: 50 + bottomPad,
        },
        tabBarLabelStyle: { fontFamily: tokens.font[600], fontSize: 11, letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Trips', tabBarIcon: ({ color, size }) => <Plane size={size} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Bell size={size} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} strokeWidth={2} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 6: Create the tab + stack route stubs**

Create `apps/mobile/app/(tabs)/index.tsx`:
```tsx
import React from 'react';
import { ScreenStub } from '@/components/screen-stub';

export default function TripsScreen(): React.JSX.Element {
  return <ScreenStub title="Your Trips" subtitle="Trip list — built in P3" />;
}
```

Create `apps/mobile/app/(tabs)/alerts.tsx`:
```tsx
import React from 'react';
import { ScreenStub } from '@/components/screen-stub';

export default function AlertsScreen(): React.JSX.Element {
  return <ScreenStub title="Alerts" subtitle="Price-drop alerts — built in P3" />;
}
```

Create `apps/mobile/app/(tabs)/chat.tsx`:
```tsx
import React from 'react';
import { ScreenStub } from '@/components/screen-stub';

export default function ChatScreen(): React.JSX.Element {
  return <ScreenStub title="Assistant" subtitle="Groq chat — built in P3" />;
}
```

Create `apps/mobile/app/trip/[id].tsx`:
```tsx
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScreenStub } from '@/components/screen-stub';

export default function TripDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenStub title="Trip detail" subtitle={`trip ${id ?? ''} — built in P3`} />;
}
```

Create `apps/mobile/app/trip/new.tsx`:
```tsx
import React from 'react';
import { ScreenStub } from '@/components/screen-stub';

export default function NewTripScreen(): React.JSX.Element {
  return <ScreenStub title="Create trip" subtitle="New-trip form — built in P3" />;
}
```

- [ ] **Step 7: Typecheck + lint the whole app**

Run:
```bash
pnpm --filter mobile typecheck
```
Expected: exits 0.

Run:
```bash
pnpm --filter mobile lint
```
Expected: exits 0 (no errors).

- [ ] **Step 8: Verify the bundle compiles headlessly (no simulator)**

Run a web export — it forces Metro to resolve every import and compile the route tree without needing a simulator:
```bash
pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web 2>&1 | tail -15
```
Expected: `Exported …` with no module-resolution errors. (This confirms the provider chain, route files, and `@/*` aliases all resolve.)

- [ ] **Step 9: Verify the app boots + navigation works in the iOS simulator (manual gate)**

This is the foundation's acceptance check. With the FastAPI dev stack up (`docker ps` shows `api`) and `EXPO_PUBLIC_API_URL=https://localhost:8000`:
```bash
pnpm mobile:ios
```
Expected, in order:
1. Metro builds + installs the dev client; the app boots past the splash to the **sign-in screen** ("Price Tracker" / "Sign in with Google" / "We never store passwords"). The auth gate redirected here because no session is stored.
2. To verify the **sign-in gate against a mocked token** without a live Google flow, seed a fake session into SecureStore and reload — in a JS console (or a throwaway dev button) call the same keys `lib/auth/storage.ts` writes:
   ```
   vpt.auth.accessToken = "mock.jwt"
   vpt.auth.refreshToken = "mock.refresh"
   vpt.auth.user = {"id":"u1","email":"you@example.com","email_notifications_enabled":true}
   ```
   Reload the app: the gate now routes past sign-in into the **tab shell**.
3. The bottom tab bar shows **Trips · Alerts · Chat** with the plane/bell/message icons and a violet (`#7C3AED`) active tint. Tapping each tab switches screens and each renders its title ("Your Trips", "Alerts", "Assistant").
4. `router.push('/trip/new')` presents the create stub as a modal; `router.push('/trip/abc')` pushes the detail stub showing `trip abc`.
5. Sign out (call `useAuth().signOut()`) → the gate redirects back to sign-in.

Record the result (PASS/observations) in the task checklist.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/app apps/mobile/components apps/mobile/lib/api/provider.tsx
git commit -m "feat(mobile): navigation shell (auth gate, Trips/Alerts/Chat tabs, trip stack stubs)"
```

---

## Task 7: Repo docs — root CLAUDE.md cross-platform parity + apps/mobile/CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (repo root)
- Create: `apps/mobile/CLAUDE.md`
- Test: concrete doc checks (named strings exist / are gone; markdown links resolve to real paths)

**Interfaces:**
- Consumes: the scaffold + module names produced by Tasks 2–6 (so the per-app guide points at real paths: `lib/api/client.ts`, `lib/auth/**`, `lib/theme/tokens.ts`, `app/(tabs)/_layout.tsx`).
- Produces: documentation only — no code interfaces. Edits ONLY root `CLAUDE.md` and creates `apps/mobile/CLAUDE.md`, so it cannot conflict with P1/P3/P4/P5.

> **Rationale:** these doc changes land in P2's PR alongside the `apps/mobile` scaffold so the repo's AI-guidance docs describe mobile from the moment it exists. Since docs have no unit tests, each step's "test" is a concrete grep/link check. The web-only/Next-14 line removal lives here (not Task 1) so all `CLAUDE.md` prose edits sit in one task — no duplication.

- [ ] **Step 1: Write the failing doc checks**

Run (asserts the stale lines are still present and the new ones absent — establishes the starting state):
```bash
grep -q 'This is a \*\*web-only\*\* product' CLAUDE.md && echo "STALE-WEBONLY-PRESENT" || echo "ALREADY-GONE"; \
grep -q 'Next.js 14 (App Router)' CLAUDE.md && echo "STALE-NEXT14-PRESENT" || echo "ALREADY-GONE"; \
grep -q 'Cross-platform parity' CLAUDE.md && echo "PARITY-PRESENT" || echo "PARITY-MISSING"; \
test -f apps/mobile/CLAUDE.md && echo "GUIDE-PRESENT" || echo "GUIDE-MISSING"
```
Expected: `STALE-WEBONLY-PRESENT` / `STALE-NEXT14-PRESENT` / `PARITY-MISSING` / `GUIDE-MISSING`.

- [ ] **Step 2: Edit the Project Overview block in root `CLAUDE.md`**

Replace the Frontend architecture line and drop the web-only line. Change:
```
- **Frontend:** Next.js 14 (App Router), Tailwind, shadcn/ui, assistant-ui (`apps/web`)
```
to:
```
- **Frontend:** Next.js 16 (App Router), Tailwind, shadcn/ui, assistant-ui (`apps/web`)
- **Mobile:** Expo SDK 56 + Expo Router (`apps/mobile`) — iOS + Android.
```

Then delete this line entirely (and the blank line that precedes it):
```
This is a **web-only** product — there is no mobile app.
```

- [ ] **Step 3: Add the mobile entry to the Per-App Guides list**

In the `## Per-App Guides` list (after the `apps/worker/CLAUDE.md` bullet), add:
```
- [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) — Expo app (Expo Router screens,
  REST/JWT auth bridge, Aurora design tokens, Maestro e2e flows, `apps/mobile/lib/**`-scoped
  coverage gate).
```

- [ ] **Step 4: Add `mobile/` to the Directory Structure tree**

In the `## Directory Structure` code block, change the `apps/` subtree so it reads:
```
├── apps/
│   ├── web/        # Next.js frontend
│   ├── api/        # FastAPI backend (owns the database + migrations)
│   ├── worker/     # Temporal workflows
│   └── mobile/     # Expo + Expo Router app (iOS + Android)
```
(Note: `worker/`'s tree-branch glyph changes from `└──` to `├──` because `mobile/` is now the last child.)

- [ ] **Step 5: Add the `## Cross-platform parity` section**

Insert a new section immediately after the `## Project Overview` section (before `## Data Provider Strategy`), with this EXACT text:

```markdown
## Cross-platform parity

Vacation Price Tracker ships on **web** (Next.js, `apps/web`) and **mobile** (Expo, `apps/mobile`). User-visible features reach parity on both surfaces unless a platform constraint genuinely prevents it. **When you change one surface, make the matching change on the other unless the change is explicitly scoped to a single surface.**

Before finalizing a change, ask:
- **Trip screens** — trip list, trip detail (the interactive selection→total→chart), create-trip, and settings have web + mobile twins (`apps/web/src/app/trips/**` ↔ `apps/mobile/app/**`). A change to one needs the mirror on the other.
- **Assistant chat** — the Groq assistant exists on both (`apps/web/src/components/chat/**` ↔ `apps/mobile/app/(tabs)/chat.tsx`).
- **Notification / threshold settings** — both surfaces expose them; new options need rows on both.
- **API / schema change** — a new or changed `/v1/*` endpoint or schema affects both clients; regenerate the OpenAPI types consumed by web (`apps/web/src/lib/api/types.ts`) AND mobile (`apps/mobile/lib/api/types.ts`).
- **Observability event** — keep the web telemetry relay and mobile telemetry consistent.

If you intentionally scope work to one surface (e.g. ship web first, mobile follow-up), **say so explicitly in the PR body** and track the second-surface work durably — don't ship asymmetric features silently.
```

- [ ] **Step 6: Add `mobile` to commit/PR scopes + the mobile-version-bump note**

In `## Commit Message Conventions`, change the Scopes bullet:
```
- **Scopes:** `web`, `api`, `worker`, `mobile`; no scope for repo-wide changes (docs,
  CI, root configs).
```

In `## Commit and PR Hygiene`, after the "PR titles are conventional commits." paragraph that ends with "Append `!` for a breaking change (`feat(api)!: …`).", append this paragraph (mirrors showbook's wording):
```
**PR-title subjects drive the mobile version bump.** Because mobile ships via
EAS, the merged PR subject feeds the `mobile-v*` auto-bump: `feat:` → MINOR and a
breaking `!` → MAJOR (both mapped to MINOR while the app is pre-1.0); everything
else → patch. So a stray `feat:` on a non-feature PR inflates the mobile minor
version, and an unprefixed feature loses its release-log signal — title mobile-
touching PRs deliberately.
```

- [ ] **Step 7: Add the mobile coverage + deployment notes**

In `## Pre-Commit Validation`, change the coverage-gates line:
```
Coverage gates: **95%** for both Python apps (`api`, `worker`); **80%** for mobile,
scoped to `apps/mobile/lib/**` only (screen/layout code under
`apps/mobile/{app,components}` is excluded).
```

In `## Deployment`, after the OAuth-ingress bullet, add a Mobile bullet:
```
- **Mobile:** built and released via **EAS**. `mobile-deploy.yml` (P4) does
  continuous **OTA** (JS-only) updates to the `preview` channel plus an
  approval-gated **native release** (EAS build → submit to TestFlight + Play
  internal) that auto-bumps the `mobile-v*` tag. Maestro e2e runs via
  `mobile-e2e.yml` on the self-hosted runner against the isolated `vpt-e2e`
  stack. Details: [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) and
  `docs/mobile-cicd.md` (added by P4).
```

- [ ] **Step 8: Create `apps/mobile/CLAUDE.md`**

Concise per-app guide mirroring showbook's `apps/mobile/CLAUDE.md` structure, adapted to VPT (REST/JWT, not tRPC; Aurora tokens; Trips/Alerts/Chat nav). Create `apps/mobile/CLAUDE.md`:
```markdown
# Vacation Price Tracker Mobile (`apps/mobile`)

Expo SDK 56 + Expo Router app (iOS + Android). Read the
[repo-root `CLAUDE.md`](../../CLAUDE.md) first for project-wide conventions and
the **Cross-platform parity** rules; this file covers what's specific to the
mobile app.

## Layout

- `app/` — Expo Router routes. `(auth)/sign-in.tsx` is the Google sign-in gate;
  `(tabs)/` is the 3-tab shell **Trips** (`index.tsx`) · **Alerts**
  (`alerts.tsx`) · **Chat** (`chat.tsx`). Stack routes `trip/[id].tsx` (detail)
  and `trip/new.tsx` (create) live alongside the tab group. The root
  `_layout.tsx` mounts the provider chain (theme → auth → query client → api
  client) and the auth gate that redirects signed-out users to `(auth)/sign-in`.
- `components/` — shared RN components (the Aurora screen primitives; P3 fills
  these in).
- `lib/` — non-UI code (this is the coverage-gated scope):
  - `api/client.ts` — typed REST client over VPT's `/v1/*`; bearer-JWT auth with
    refresh-on-401. `api/types.ts` is the **regenerated** OpenAPI types (kept in
    lockstep with `apps/web/src/lib/api/types.ts`). `api/provider.tsx` binds the
    client to the session.
  - `auth/` — Google sign-in (`expo-auth-session`) → `exchange.ts` (pure
    ID-token → session) → `storage.ts` (`expo-secure-store`). `contract.ts` is
    the `POST /v1/auth/mobile-token` request/response contract.
  - `theme/tokens.ts` — the **Aurora design tokens** (single source of truth for
    colors, gradients, the AS/UA/DL monogram gradients, radii, shadows, type
    scale). `theme/index.ts` exposes `useTheme()` / `useThemedStyles()`.
  - `fonts.ts` — Manrope 400–800 loader. `env.ts` — `EXPO_PUBLIC_*` access.
- `e2e/flows/` — Maestro flow YAML (added by P4).

## Auth bridge

Native Google OAuth via `expo-auth-session`. The Google ID token is POSTed to
the API's **`POST /v1/auth/mobile-token`** endpoint, which returns a JWT pair
(`access_token` + `refresh_token`) + the user, stored in `expo-secure-store`.
Every API request attaches the access token as `Authorization: Bearer`; a 401
triggers a refresh against `POST /v1/auth/refresh` and a single retry.

The API side reads the bearer header (mobile) in addition to the
`access_token_cookie` (web); the API env must set `GOOGLE_OAUTH_MOBILE_AUDIENCES`
to the comma-separated iOS + Android + web Google OAuth client IDs allowed to
mint a mobile token.

Google sign-in **cannot** be validated in Expo Go (it produces an `exp://…`
redirect URI Google rejects for the native flow). Use a development build
(`pnpm mobile:ios`, then `pnpm mobile:start` for JS-only reloads).

## Environment variables

`EXPO_PUBLIC_`-prefixed so Expo inlines them at build time.

| Var | Required for |
|---|---|
| `EXPO_PUBLIC_API_URL` | API target. Use `https://localhost:8000` for an iOS simulator against the local API; a LAN/tunnel URL for a physical device. |
| `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_IOS` | iOS sign-in |
| `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_ANDROID` | Android sign-in |
| `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID_WEB` | Sign-in on every platform (used as the ID-token audience even on native). |

## Commands

From the repo root:

\`\`\`bash
pnpm mobile:start      # Metro bundler for the development client
pnpm mobile:ios        # build + install iOS development client
pnpm mobile:android    # build + install Android development client
pnpm mobile:ios:go     # Expo Go only; Google sign-in will NOT work
pnpm mobile:typecheck
pnpm mobile:lint
pnpm mobile:test
pnpm mobile:test:coverage
\`\`\`

Or from \`apps/mobile/\`: \`pnpm start\` / \`pnpm ios\` / \`pnpm typecheck\` /
\`pnpm lint\` / \`pnpm test\`.

## Test coverage

An **80%** line / branch / function gate **scoped to \`apps/mobile/lib/**\` only** —
layout-heavy code under \`app/\` and \`components/\` is intentionally excluded. The
pure helpers (\`api/client.ts\`, \`api/errors.ts\`, \`auth/exchange.ts\`,
\`auth/storage.ts\`, \`auth/contract.ts\`, \`theme/tokens.ts\`) carry the coverage;
unit tests use \`node --test\` + \`@testing-library/react-native\` under
\`lib/**/__tests__/\`. This gate is independent from web's gate.

\`\`\`bash
pnpm --filter mobile test:coverage   # writes coverage/mobile-unit.info
\`\`\`

## Navigation map

3-tab bar **Trips · Alerts · Chat** (\`app/(tabs)/_layout.tsx\`, lucide
\`Plane\`/\`Bell\`/\`MessageCircle\`, active tint Aurora violet \`#7C3AED\`). Stack:
\`trip/[id]\` (detail, card), \`trip/new\` (create, modal), \`(auth)/sign-in\`. New
screens consume the Aurora tokens via \`useTheme()\` — never hard-code colors.

## Maestro E2E flows

E2E flows live under \`e2e/flows/\` (added by P4). Maestro selects elements by
\`testID\`; keep the **E2E testID contract** stable when restyling a screen (e.g.
\`sign-in-google\`, the tab labels). The native runner is **label-gated** — it runs
on the self-hosted runner against the isolated \`vpt-e2e\` stack. See
\`docs/mobile-cicd.md\` (P4) for the full runbook.

## Sandbox verification (Claude on the web)

The sandbox has **no iOS Simulator and no KVM Android emulator**, so the
inner-loop verification target is the Expo **web** compile-check (forces Metro to
resolve every import + compile the route tree without a device):

\`\`\`bash
pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web
\`\`\`

Use this to confirm the provider chain, routes, and \`@/*\` aliases resolve. Real
device e2e is the **label-gated native Maestro runner** (P4) — use the web
compile-check to iterate fast; let Maestro be the gate.
```

- [ ] **Step 9: Run the doc checks to verify they pass**

Run:
```bash
grep -q 'This is a \*\*web-only\*\* product' CLAUDE.md && echo "STALE-WEBONLY-PRESENT" || echo "WEBONLY-GONE"; \
grep -q 'Next.js 14' CLAUDE.md && echo "STALE-NEXT14-PRESENT" || echo "NEXT14-GONE"; \
grep -q 'Next.js 16 (App Router)' CLAUDE.md && echo "NEXT16-PRESENT" || echo "NEXT16-MISSING"; \
grep -q 'Expo SDK 56 + Expo Router (`apps/mobile`)' CLAUDE.md && echo "MOBILE-BULLET-PRESENT" || echo "MOBILE-BULLET-MISSING"; \
grep -q '^## Cross-platform parity' CLAUDE.md && echo "PARITY-PRESENT" || echo "PARITY-MISSING"; \
grep -q '`web`, `api`, `worker`, `mobile`' CLAUDE.md && echo "SCOPE-PRESENT" || echo "SCOPE-MISSING"; \
grep -q 'PR-title subjects drive the mobile version bump' CLAUDE.md && echo "BUMP-NOTE-PRESENT" || echo "BUMP-NOTE-MISSING"; \
grep -q 'mobile/     # Expo + Expo Router app' CLAUDE.md && echo "TREE-PRESENT" || echo "TREE-MISSING"; \
test -f apps/mobile/CLAUDE.md && echo "GUIDE-PRESENT" || echo "GUIDE-MISSING"
```
Expected: `WEBONLY-GONE` / `NEXT14-GONE` / `NEXT16-PRESENT` / `MOBILE-BULLET-PRESENT` / `PARITY-PRESENT` / `SCOPE-PRESENT` / `BUMP-NOTE-PRESENT` / `TREE-PRESENT` / `GUIDE-PRESENT`.

- [ ] **Step 10: Verify every markdown link in both files resolves to a real path**

Run:
```bash
python3 - <<'PY'
import re, os
for src in ['CLAUDE.md', 'apps/mobile/CLAUDE.md']:
    base = os.path.dirname(src)
    text = open(src).read()
    missing = []
    for label, target in re.findall(r'\[([^\]]+)\]\(([^)]+)\)', text):
        if target.startswith('http') or target.startswith('#'):
            continue
        path = target.split('#')[0]
        resolved = os.path.normpath(os.path.join(base, path))
        if path in ('docs/mobile-cicd.md',):  # P4 creates this; allow-listed
            continue
        if not os.path.exists(resolved):
            missing.append((src, target, resolved))
    print('MISSING LINKS in ' + src, missing) if missing else print('OK', src)
PY
```
Expected: `OK CLAUDE.md` and `OK apps/mobile/CLAUDE.md` (the only deliberately-not-yet-existing target, `docs/mobile-cicd.md`, is allow-listed since P4 creates it).

- [ ] **Step 11: Commit**

```bash
git add CLAUDE.md apps/mobile/CLAUDE.md
git commit -m "docs: document mobile app + cross-platform parity (root + apps/mobile guides)"
```

---

## Self-Review

**1. Spec coverage:**
- Task 1 → `.nvmrc`=22, root `engines`, `mobile:*` scripts, `.npmrc` hoist, Nx target, single-lockfile rule. ✓
- Task 2 → Expo SDK 56 scaffold (package.json pinned to showbook versions, app.config.ts name/slug/scheme/bundle ids/plugins/runtimeVersion, metro/tsconfig/eslint/babel). ✓
- Task 3 → `lib/theme/tokens.ts` + `useTheme`/`useThemedStyles` + Manrope 400–800 loader, all Aurora tokens incl. monogram gradients. ✓
- Task 4 → typed REST/JWT client with refresh, `listTrips/getTrip/createTrip/sendChatMessage`, OpenAPI types **regenerated** (decision justified), unit tests. ✓
- Task 5 → `lib/auth/**` Google sign-in → `/v1/auth/mobile-token` → secure-store, provider/hook, sign-out, unit tests, and the exact P5 request/response contract documented. ✓
- Task 6 → `_layout.tsx` providers, `(auth)/sign-in`, `(tabs)/_layout` Trips/Alerts/Chat, route stubs, boot/nav verification against a mocked token. ✓
- Navigation map (tab bar + stack for detail/create/sign-in) and shared style system established for P3 to consume. ✓
- Task 7 → root `CLAUDE.md` edits (drop web-only line, Next 14→16, Mobile bullet, Per-App Guides + directory-tree entry, verbatim `## Cross-platform parity` section, `mobile` commit scope + PR-title→version-bump note, mobile coverage/deployment notes) + new `apps/mobile/CLAUDE.md` per-app guide; docs-only, conflict-free with P1/P3/P4/P5; verified via grep + link-resolution checks. ✓

**2. Placeholder scan:** No "TBD"/"similar to Task N"/"add error handling" — every code step shows complete code; every config step shows full file contents; every verification step shows the exact command + expected output.

**3. Type consistency:** `SessionData`/`SessionUser` defined in `auth/contract.ts` and reused by `exchange.ts`/`storage.ts`/`index.tsx`. `ApiClient`/`ApiClientOptions` defined in `api/client.ts` and consumed by `api/provider.tsx`. `tokens.font[400..800]` family names match the `@expo-google-fonts/manrope` exports loaded in `fonts.ts`. Tab route names (`index`/`alerts`/`chat`) match the `<Tabs.Screen name=...>` entries and the file names.

**Scope boundaries honored:** No screen styling beyond minimal stubs (P3's territory); no `eas.json`/release/version/submit fields in `app.config.ts` (P4's territory — `updates.url`/`extra.eas.projectId` intentionally absent); no edits to `apps/api/**` (P5 builds the endpoint; this plan only documents the contract and the required bearer-header change).
