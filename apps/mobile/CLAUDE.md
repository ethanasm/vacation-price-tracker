# Vacation Price Tracker Mobile (`apps/mobile`)

Expo SDK 57 + Expo Router app (iOS + Android). Read the
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
    scale). `theme/index.tsx` exposes `useTheme()` / `useThemedStyles()`.
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

```bash
pnpm mobile:start      # Metro bundler for the development client
pnpm mobile:ios        # build + install iOS development client
pnpm mobile:android    # build + install Android development client
pnpm mobile:ios:go     # Expo Go only; Google sign-in will NOT work
pnpm mobile:typecheck
pnpm mobile:lint
pnpm mobile:test
pnpm mobile:test:coverage
```

Or from `apps/mobile/`: `pnpm start` / `pnpm ios` / `pnpm typecheck` /
`pnpm lint` / `pnpm test`.

## Test coverage

An **80%** line / branch / function gate **scoped to `apps/mobile/lib/**` only** —
layout-heavy code under `app/` and `components/` is intentionally excluded. The
pure helpers (`api/client.ts`, `api/errors.ts`, `auth/exchange.ts`,
`auth/storage.ts`, `auth/contract.ts`, `theme/tokens.ts`) carry the coverage;
unit tests use `node --test` + `@testing-library/react-native` under
`lib/**/__tests__/`. This gate is independent from web's gate.

```bash
pnpm --filter mobile test:coverage   # writes coverage/mobile-unit.info
```

## Navigation map

3-tab bar **Trips · Alerts · Chat** (`app/(tabs)/_layout.tsx`, lucide
`Plane`/`Bell`/`MessageCircle`, active tint Aurora violet `#7C3AED`). Stack:
`trip/[id]` (detail, card), `trip/new` (create, modal), `settings` (card),
`(auth)/sign-in`. Every signed-in screen renders a `SettingsCog`
(`components/aurora/settings-cog.tsx`, imported directly — not via the barrel)
in its top-right header that pushes `/settings`. New screens consume the Aurora
tokens via `useTheme()` — never hard-code colors.

## Maestro E2E flows

E2E flows live under `e2e/flows/` (added by P4). Maestro selects elements by
`testID`; keep the **E2E testID contract** stable when restyling a screen (e.g.
`sign-in-google`, the tab labels). The native runner is **label-gated** — it runs
on the self-hosted runner against the isolated `vpt-e2e` stack. See
`docs/mobile-cicd.md` (P4) for the full runbook.

## Sandbox verification (Claude on the web)

The sandbox has **no iOS Simulator and no KVM Android emulator**, so the
inner-loop verification target is the Expo **web** compile-check (forces Metro to
resolve every import + compile the route tree without a device):

```bash
pnpm --filter mobile exec expo export --platform web --output-dir /tmp/vpt-mobile-web
```

Use this to confirm the provider chain, routes, and `@/*` aliases resolve. Real
device e2e is the **label-gated native Maestro runner** (P4) — use the web
compile-check to iterate fast; let Maestro be the gate.
