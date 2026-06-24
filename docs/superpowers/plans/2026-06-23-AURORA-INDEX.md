# Aurora Redesign + Mobile App — Orchestration Index

> **For agentic workers:** This is the **orchestration index** for the "Aurora" effort. It is NOT itself an implementation plan — it defines the set of plans, their file-ownership boundaries, the dependency order, and the global constraints every plan inherits. Each referenced plan is implemented with `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Read this index first, then open the specific plan you were assigned.

**Source spec:** `Vacation Price Tracker Redesign.zip` → `design_handoff_price_tracker/README.md` ("Aurora" hi-fi handoff). Extracted copy lives at the repo-relative path the assigning human provides; the canonical design tokens live in `apps/web/src/app/globals.css`.

**Mirror reference for all mobile CI/CD/devops:** the `showbook` repo (`apps/mobile`, `.github/workflows/mobile-*.yml`, `eas.json`, `app.config.ts`, `scripts/bump-mobile-version.mjs`). When a mobile-infra question is unanswered here, copy showbook's answer and adapt names.

---

## Goal

Ship two independent bodies of work against the existing `vacation-price-tracker` Nx + pnpm monorepo:

1. **Web "Aurora" redesign** — a sleeker, more modern reskin of the existing Next.js web app (updated Manrope type scale, violet/pink/cyan token system, new card/chip/chart styling) across all five routes. Visual + interaction refresh only; no data-model or API changes.
2. **Mobile app** — a brand-new Expo (SDK 56) + Expo Router app at `apps/mobile`, implementing the Aurora phone screens against the live VPT REST API, plus the full EAS → TestFlight/Play Store CI/CD and Maestro e2e pipeline mirrored from showbook.

These two bodies of work touch **disjoint directories** and run **concurrently**.

---

## Plan Inventory

| ID | Plan file | Status | Owns (file boundary) | Depends on |
|----|-----------|--------|----------------------|-----------|
| **P1** | `2026-06-23-web-aurora.md` | **written (now)** | `apps/web/**` only | — |
| **P2** | `2026-06-23-mobile-foundation.md` | **written (now)** | `apps/mobile/**` scaffold + root workspace wiring (`pnpm-workspace.yaml`, `nx.json`, root `package.json`, `.nvmrc`) + `apps/mobile/{app,lib,components}` shell, design tokens, REST/JWT API client, auth | — |
| **P3** | `2026-06-23-mobile-screens.md` | after approval | `apps/mobile/app/**`, `apps/mobile/components/**` (the Aurora screens + their tests) | P2 |
| **P4** | `2026-06-23-mobile-cicd.md` | after approval | `apps/mobile/eas.json`, `apps/mobile/app.config.ts` (release/version/submit fields), `.github/workflows/mobile-deploy.yml`, `.github/workflows/mobile-e2e.yml`, `scripts/bump-mobile-version.mjs`, `apps/mobile/e2e/**`, **`infra/docker-compose.e2e.yml`** | P2 |
| **P5** | `2026-06-23-mobile-backend.md` | after approval | `apps/api/**` (mobile auth-token bridge + **Bearer-header support in `get_current_user` and `POST /v1/auth/refresh`** + device-token endpoints + **`POST /v1/e2e/mint-token`** for P4's e2e) + `apps/worker/**` (push-notification send activity) | — (independent files) |

> **Why "one web agent total":** the web work is a single sequential plan (P1). It is large but its tasks are internally ordered (tokens → shared primitives → pages), so a single owner avoids races on `globals.css` and the shared `components/ui/**` primitives. It runs concurrently with all mobile plans because it never leaves `apps/web/**`.

---

## Concurrency Map (how to run without overlap)

```
WAVE 1 (start immediately, fully parallel — disjoint directories):
  ┌─ P1  web-aurora        → apps/web/**
  ├─ P2  mobile-foundation → apps/mobile/** + root workspace files
  └─ P5  mobile-backend    → apps/api/** + apps/worker/**   (no file overlap with P1)

WAVE 2 (after P2 merges — both parallel, disjoint files):
  ┌─ P3  mobile-screens    → apps/mobile/app/**, components/**
  └─ P4  mobile-cicd       → eas.json, app.config.ts(release), workflows, scripts, e2e/**
```

**Overlap-avoidance rules (enforced by ownership table above):**
- Only **P1** edits `apps/web/**`. Only **P2/P3** edit `apps/mobile/{app,components,lib}/**`.
- **`apps/mobile/app.config.ts`** is created by **P2** and the *only later editor* is **P4** (release/version/submit fields). P3 must **not** touch it.
- **`apps/mobile/package.json`** dependency additions: **P2** adds the foundation deps (Expo core, router, secure-store, tRPC-equivalent REST client, react-query). **P3** appends UI/runtime deps (svg, charts, gesture-handler, etc.). **P4** appends only devtooling that belongs in `eas.json`/scripts, not package deps where avoidable. If P3 and P4 run truly simultaneously, **P4 does not edit `package.json`** — it confines itself to `eas.json`, workflows, and `scripts/`. This guarantees no merge conflict.
- Root `package.json` / `pnpm-workspace.yaml` / `nx.json` are edited **only by P2**. P1 and P5 never touch them.
- **P5** lives entirely in `apps/api/**` and `apps/worker/**`; the web redesign (P1) never edits those, so they are conflict-free even though both are Wave 1.

---

## Global Constraints

*Every task in every plan implicitly includes this section. Values copied verbatim from the repo and the Aurora handoff.*

### PR operator docs (required, all plans)
Every PR opened under this effort MUST include an **"Operator / Deployment Steps"** section in its
description listing: new **environment variables** (name · where set — web `.env` / api `.env`·`.env.prod` /
`eas.json` / GitHub secret / GitHub variable · required-vs-optional · example or placeholder value);
**DB migrations**; **new GitHub secrets/variables**; and any **one-time infra / runner / credential
provisioning** the change introduces. If it introduces none, state **"No operator steps"** explicitly.

### Monorepo / toolchain
- **Package manager:** `pnpm@9.12.1` (pinned in root `package.json`). **Single `pnpm-lock.yaml` at the repo root** — never generate a nested lockfile in `apps/*`.
- **Workspace:** Nx monorepo, `pnpm-workspace.yaml` globs `apps/*`. P2 adds `apps/mobile` under that existing glob (no glob change needed) and registers Nx targets.
- **Node:** repo currently ships no `.nvmrc`. P2 **adds `.nvmrc` = `22`** (matches showbook + Expo SDK 56 minimum) and root `engines.node >= 22`. All CI uses `actions/setup-node@v6` with `node-version: 22`.
- **Verify gate:** `pnpm verify` must stay green (install --frozen-lockfile → build → lint → typecheck → test:coverage → audit).

### Web (P1) stack — do not change versions
- Next.js **16.2.6** (App Router) · React **19.2.0** · TypeScript **5.5.4** · Tailwind CSS **v4.1.18** (`@theme` block in `globals.css`, **not** a JS config color map) · shadcn/Radix primitives in `apps/web/src/components/ui/**` · **Biome 1.8.3** (lint/format) · **Jest 30** + React Testing Library · Playwright (e2e) · Recharts **2.15.4** (price chart) · `lucide-react` **0.562.0** (icons) · `@assistant-ui/react` **0.12.3** (chat).
- **Coverage gate (web):** branches **85**, functions **95**, lines **95**, statements **95**. `apps/web/src/components/ui/**` is excluded from coverage; new non-ui logic must be tested.
- **Fonts:** `next/font/google` — `Manrope` is the body font (`--font-body`). Aurora needs Manrope weights **400, 500, 600, 700, 800**; extend the existing `Manrope({...})` call in `apps/web/src/app/layout.tsx`. Do **not** add a `<link>` tag or a second font loader.

### Mobile (P2–P5) stack — mirror showbook
- **Expo SDK 56** (`expo ~56.0.x`) · **React Native 0.85.3** · React **19.2.3** · **Expo Router ~56.2.10** · **expo-secure-store** (JWT storage) · `@tanstack/react-query` · **expo-notifications** (price-drop push) · `lucide-react-native` (icons) · `react-native-svg` + a charting approach for the price-history chart.
- **API access:** the VPT backend is **REST + JWT** (FastAPI, `/v1/*`), **not tRPC**. Mobile uses a typed `fetch` client (P2) that reads the generated OpenAPI types from `apps/web/src/lib/api/types.ts` *concept* — P2 decides whether to share or regenerate; it must not depend on web React code.
- **Auth bridge (mirror showbook):** Google ID token on device → `POST /v1/auth/mobile-token` (new, P5) → API returns the same JWT pair the web OAuth callback issues → store in `expo-secure-store`. P2 builds the device side against this contract; P5 builds the endpoint.
- **Bundle identifiers:** iOS `me.ethanasm.vpt`, Android `me.ethanasm.vpt` (mirror showbook's `me.ethanasm.showbook` scheme). Confirm with the human before first store submit.
- **EXPO_PUBLIC_API_URL:** production VPT API base URL (mirror showbook's `https://showbook.ethanasm.me`). The repo uses `FRONTEND_URL` / `BACKEND_URL` env vars set per-deploy; **the exact prod domain must be confirmed with the human** before P4 hard-codes it into `eas.json`. Until confirmed, use the placeholder `https://CONFIRM-VPT-PROD-DOMAIN` and flag it.
- **Mobile coverage scope:** mirror showbook — gate only `apps/mobile/lib/**` (layout/screen shells excluded), threshold 80% lines/branches/functions. Unit tests use `node --test` + `@testing-library/react-native` (showbook pattern), run via Nx target.
- **EAS secrets (P4, GitHub repo secrets):** `EXPO_TOKEN`, `PLAY_SERVICE_ACCOUNT_JSON`, `ASC_API_KEY_P8`, `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `ASC_APP_ID`, and a push token (`RELEASE_DEPLOY_KEY` or `RELEASE_PUSH_TOKEN`) for the version-bump pushback. These are provisioned by the human; plans reference them by name only.

### Aurora design tokens (shared source of truth)
The full token table lives in the handoff README and in `apps/web/src/app/globals.css`. Key values every plan must use verbatim:
- **Primary violet** `#7C3AED` (≈ existing `--color-primary: hsl(262 83% 58%)` — already aligned) · hover/deep `#6D28D9` · **primary gradient** `linear-gradient(135deg,#A78BFA,#7C3AED)` · **total-card gradient** `linear-gradient(135deg,#7C3AED,#9333EA)`.
- **Accents:** pink `#EC4899`, cyan `#22D3EE` (hotel chart line). **Backgrounds:** page `#FAF8FF`, surfaces `#F4F1FC`/`#F8F5FE`, chip `#EDE9FE`, card `#FFFFFF`, hairline `#F1EEF8`/`#ECE8F5`, selected border `#C9B8F5`.
- **Text:** strong `#1A1A2E`, body `#4A4660`/`#6B6680`, muted `#8B86A0`, faint `#BDB6D4`.
- **Status:** success `#059669` on `#ECFDF5`; warning/stops `#9A7B18` on `#FEF6DD`; layover amber `#C98A3A` on `#FDF6E9` (border `#F6E7C8`); star gold `#F5A623`.
- **Radius:** cards 14–16px · inner 12–13px · pills/chips 8–10px · status badges 999px. **Shadows:** card-on-canvas `0 16px 50px rgba(60,40,120,.13)`; primary button `0 4–6px 12–16px rgba(124,58,237,.32)`; total card `0 8px 22px rgba(124,58,237,.30)`.
- **Airline monogram chips (original marks, not real trademarks):** Alaska `AS` `linear-gradient(135deg,#10617F,#093247)`; United `UA` `linear-gradient(135deg,#2456C9,#13357F)`; Delta `DL` `linear-gradient(135deg,#C8102E,#7A0A1C)`; white text weight 800, radius 8px.

### Verified behavioral checks (Trip detail — both web P1 and mobile P3)
The selection→total→chart recompute MUST reproduce these exact totals (`total = flightPrice + hotelTotal`):
- Alaska (non-stop) + Riverhouse = **$789**
- United (1-stop) + Riverhouse = **$754**
- Delta + Eviva = **$680**

### Product guardrails
- **No "Trip members"/sharing UI** anywhere (intentionally removed). Settings = Notifications only (Email + SMS toggles).
- Sign-in is **Google-OAuth only**; "We never store passwords" caption.
- Airline logos are **original CSS monogram chips**, never real airline trademarks.

---

## Discovered During Foundation Drafting (feeds the after-approval plans)

These were surfaced while writing P1/P2 and MUST be carried into the relevant later plan.

### Auth-bridge contract (P2 device side ↔ P5 backend) — exact contract
```
POST /v1/auth/mobile-token   body: { "id_token": "<Google ID token>" }
200 → { "access_token": "<JWT>", "refresh_token": "<JWT>",
        "user": { "id": "<uuid>", "email": "<str>", "email_notifications_enabled": <bool> } }
401 invalid_google_token · 403 access_denied · 429 rate_limited · other → server_error_<status>
```
P5 must: verify `id_token` against `GOOGLE_OAUTH_MOBILE_AUDIENCES`, run the existing `should_allow_sign_in`
allow-list, upsert the user by `google_sub`, mint the SAME pair via `create_access_token` /
`create_refresh_token`, and return them **in the response body (not `Set-Cookie`)**.

### Critical P5 scope expansion (beyond the new endpoint)
VPT's `get_current_user` today reads the JWT **only** from the `access_token_cookie` cookie, and
`POST /v1/auth/refresh` is likewise cookie-in / `Set-Cookie`-out. The mobile client sends
`Authorization: Bearer <jwt>` and expects refresh tokens **in the body**. Therefore **P5 must add
Bearer-header support to both `get_current_user` and `/v1/auth/refresh`** (cookie path stays for web —
additive, backwards-compatible). This is real backend work; do not scope P5 as "just add one endpoint."

### Device-token registration + push (P5)
Mobile price-drop alerts use `expo-notifications`. P5 adds a device-token registration endpoint
(`apps/api`) and a push-send path in the Temporal notification activity (`apps/worker`) so the daily
price-check fires OS notifications when a trip total crosses its threshold (parallels the existing
email/SMS outbox).

### Repo-doc updates (owned by P2 — lands with `apps/mobile`)
The root `CLAUDE.md` updates land in P2's PR (so they never reference an `apps/mobile` that doesn't exist yet).
P2 must:
- Drop *"This is a web-only product — there is no mobile app"*; correct *"Next.js 14"* → 16; add Mobile (Expo
  SDK 56 + Expo Router, `apps/mobile`) to the architecture line + the Directory Structure tree.
- Add a Per-App Guide entry and **create `apps/mobile/CLAUDE.md`** (mirror showbook's: Expo app, REST/JWT auth
  bridge, Aurora token module, Maestro flows, the `apps/mobile/lib/**`-scoped 80% coverage gate, mobile
  commands, and the "sandbox can't run iOS Simulator / KVM Android emulator" note).
- Add a **`## Cross-platform parity`** section (adapted from showbook): VPT ships web (`apps/web`) + mobile
  (`apps/mobile`); **a change to one surface gets the matching change on the other unless explicitly scoped to
  one** — with the VPT-specific checklist (trip list/detail/create/settings twins, the Groq assistant on both,
  notification/threshold settings on both, regenerate OpenAPI types for *both* clients on any `/v1/*` change,
  consistent telemetry). Asymmetric work must be called out in the PR body.
- Extend Commit/PR conventions: add the `mobile` scope, and note that **PR-title subjects now drive the mobile
  version bump** (`feat:` → MINOR, `!` → MAJOR, both mapped to MINOR pre-1.0; else patch) since mobile ships via
  EAS — so a stray `feat:` on a non-feature inflates the mobile minor version.
- Extend the Coverage and Deployment sections: mobile gate = `apps/mobile/lib/**` @ 80%; mobile releases via
  EAS (continuous OTA to `preview` + approval-gated native build → TestFlight/Play internal), Maestro e2e on
  the self-hosted runner against the isolated `vpt-e2e` stack (cross-ref `docs/mobile-cicd.md` from P4).

### Mobile E2E (Maestro) ownership + cross-plan testID contract
**Owner: P4.** Maestro is the mobile e2e tool, configured like showbook: flows in `apps/mobile/e2e/flows/*.yaml`,
a `e2e/scripts/dry-run.mjs` validator, `mobile:e2e:*` scripts, and `.github/workflows/mobile-e2e.yml`
(self-hosted Android emulator → `expo prebuild` + Gradle APK → mint e2e session from the isolated VPT e2e
backend → run flows → publish screenshots to a `pr-screenshots` branch). This is a faithful adaptation of
showbook's `mobile-e2e.yml` + `e2e/flows`.

**Cross-plan contract (P4 flows ↔ P3 screens):** Maestro taps real UI, so **P3 MUST add stable `testID`
(and matching `accessibilityLabel`) props** to the elements P4's flows target. Canonical minimum set P3 owns
and P4's flows reference (P3 may add more; names are the contract):
`sign-in-google-button` · `trips-list` · `trip-card` (+ `trip-card-total`) · `new-trip-fab` ·
`trip-detail-flight-stat` · `trip-detail-hotel-stat` · `trip-detail-total-stat` ·
`flight-option` · `hotel-option` · `create-trip-name-input` · `create-trip-origin-input` ·
`create-trip-destination-input` · `create-trip-submit` · `chat-input` · `chat-send` ·
`assistant-message` · `alerts-list`.
Per-item rows that Maestro must disambiguate use an id suffix (`flight-option-${id}`, `hotel-option-${id}`);
list-level taps use the bare name (Maestro taps the first match). **Post-create assertion:** the create-trip
flow asserts success by the new trip's name becoming visible inside `trips-list` (navigate back) — no one-off
`trip-saved-confirmation` testID. Both P3 (applies the testIDs) and P4 (flows reference them) use these exact
names; they are the contract.

### E2E backend stack + token mint ownership (resolved)
- **`POST /v1/e2e/mint-token`** (issues a JWT for the synthetic e2e user, guarded by the `VPT_E2E_BACKEND_TOKEN`
  shared secret, e2e-build only) → **owned by P5** (`apps/api`). It reuses P5's Bearer/JWT machinery. P4's
  `mobile-e2e.yml` calls it; until P5 merges, the authenticated flows 401 (expected, label-gated).
  **Canonical wire contract — P4 caller ↔ P5 endpoint MUST match verbatim:**
  - **Gating:** endpoint active ONLY when **`E2E_MODE=1`** (404 otherwise). P4's `infra/docker-compose.e2e.yml`
    MUST set both `E2E_MODE=1` and `VPT_E2E_BACKEND_TOKEN=<value>` on the `api` service.
  - **Auth:** header **`X-E2E-Token: <VPT_E2E_BACKEND_TOKEN>`** (NOT `Authorization: Bearer`); missing/wrong → 403.
  - **Body:** none — P5 mints a fixed configured synthetic user; P4 sends no request body.
  - **Synthetic user:** **`e2e@vpt.test`** (P5 upserts it; P4's e2e sign-in allowlist uses the same value).
  - **200 →** `{ access_token, refresh_token, user }`; the minted `access_token` authenticates via P5's Bearer
    `get_current_user` path.
- **`infra/docker-compose.e2e.yml`** (isolated `vpt-e2e` API+DB stack on the prod box, loopback port the
  emulator reaches at `http://10.0.2.2:8010`) → **owned by P4** (its only file outside `apps/mobile`/CI;
  mirrors the existing `infra/docker-compose.prod.yml`). Authoring the compose file is P4's; *bringing the
  stack up* on the prod box stays a one-time human/ops step documented in `docs/mobile-cicd.md`.

**E2E sequencing:** P4 is *authored* in Wave 2 (parallel with P3, depends only on P2 for the eas.json/deploy
pieces), but the **`mobile-e2e.yml` job only goes green after P3 (screens + testIDs) AND P5 (bearer/token mint
against the e2e backend) merge.** Until then the workflow exists but is expected to be red/skipped — gate it
behind a label (mirror showbook's `mobile-visual` label trigger) so it doesn't block unrelated PRs.

### Open confirmations for the human (do not block drafting; needed before P4 ships)
- **Prod API domain** for `EXPO_PUBLIC_API_URL` (showbook uses `showbook.ethanasm.me`) — placeholder
  `https://CONFIRM-VPT-PROD-DOMAIN` until confirmed.
- **Bundle ids** `me.ethanasm.vpt` (iOS + Android) — confirm before first store submit.
- **Trip-detail sample prices** (P1 Task 5 fixture derived Alaska $177 / United $142 / Delta $142 /
  Riverhouse $612 / Eviva $538 to satisfy the documented 789/754/680 totals; swap for canonical numbers
  if they exist).

---

## Execution Handoff

Each plan below is implemented independently. Recommended order:

1. **Now:** dispatch **P1**, **P2**, and **P5** in parallel (Wave 1). Each is a fresh subagent-driven run reviewing task-by-task.
2. **After P2 merges:** dispatch **P3** and **P4** in parallel (Wave 2).
3. Web (P1) and mobile (P2→P3/P4) never block each other.

Per plan, use `superpowers:subagent-driven-development` (fresh subagent per task + two-stage review) or `superpowers:executing-plans` (batch with checkpoints).
