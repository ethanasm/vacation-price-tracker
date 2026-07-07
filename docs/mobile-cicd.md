# Mobile CI/CD — one-time setup

This is the operator runbook for the mobile pipeline added in plan P4
(`docs/superpowers/plans/2026-06-23-mobile-cicd.md`). The two workflows are
`mobile-deploy.yml` (EAS OTA + gated store release) and `mobile.yml`
(lint / typecheck / test + audit, plus the self-hosted Android Maestro **E2E
Test** job). None of this runs until the prerequisites below are provisioned.

## 1. One-time EAS project setup

The EAS project is already linked — `extra.eas.projectId` and `updates.url` are
set to the real project UUID (`6ab19d8f-51fd-4bce-b47f-4b2828209c04`) in
`apps/mobile/app.config.ts`. **Do not run `eas init`** — doing so would
overwrite the existing project link.

The only one-time steps remaining are:

**a) Generate an EAS access token for CI:**

```bash
eas-cli token:create   # or expo.dev → Account Settings → Access Tokens
```

Save it as the `EXPO_TOKEN` GitHub repo secret.

**b) Validate the build profiles resolve (no build is queued):**

```bash
EXPO_TOKEN=… pnpm dlx eas-cli config --profile preview-store --platform android
EXPO_TOKEN=… pnpm dlx eas-cli config --profile preview-store --platform ios
```

**c) iOS credentials (one-time, interactive — CI can't answer the prompts):**

```bash
pnpm dlx eas-cli build --profile preview-store --platform ios
```

Let EAS generate the App Store distribution cert + provisioning profile. With
`appVersionSource: "remote"`, this first interactive build also prompts once to
initialize the remote iOS build number — accept the default. The prompt is a
property of interactive runs, not of iOS: non-interactive CI builds
auto-initialize the remote build number / `versionCode` on either platform, so
Android (built only in CI) needs no equivalent step. To seed either explicitly,
use `pnpm dlx eas-cli build:version:set`.

## 2. Confirm bundle ids match store records

The prod domain and all three Google OAuth client IDs are already configured in
`apps/mobile/eas.json` (real values, not placeholders). These same values appear
in the OTA step of `.github/workflows/mobile-deploy.yml`; if the prod API domain
or OAuth client IDs are ever rotated, update both files in sync.

The only remaining confirmation before the first store submit is that the bundle
ids in `apps/mobile/eas.json` and `apps/mobile/app.config.ts` match the app
records in App Store Connect and Play Console:

- **iOS:** `me.ethanasm.vacation-price-tracker`
- **Android:** `me.ethanasm.vacation_price_tracker`

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

## 5. Versioning — branch-ruleset bypass for the version-bump push

The bump commit (`chore(release): mobile vX.Y.Z [skip ci]`) is pushed back to
`main`, which has a required-PR ruleset. The built-in `github-actions` app
cannot be bypass-listed, so either:

- (recommended) add a write-access **deploy key** to the repo, check **Deploy
  keys** in the ruleset's bypass list, and save the private half as
  `RELEASE_DEPLOY_KEY`; or
- save a bypass-listed actor's fine-grained PAT as `RELEASE_PUSH_TOKEN`.

`[skip ci]` in the bump message prevents the push from re-triggering CI.

## 6. Self-hosted Android runner (mobile-e2e)

`mobile.yml` runs on the existing self-hosted `vpt-prod` runner (the one
`deploy.yml` uses). Add Android tooling once:

```bash
# On the prod box:
bash scripts/setup-runner-android.sh   # Android SDK + AVD (vpt_e2e) + Maestro
```

Optionally set repo variables `ANDROID_SDK_ROOT` (default `/opt/android-sdk`)
and `ANDROID_AVD_HOME`.

## 7. VPT e2e backend stack (one-time bring-up)

`mobile.yml` mints its bearer session from an **isolated** VPT e2e backend,
NOT prod. The compose file `infra/docker-compose.e2e.yml` is authored by P4
(Task 5) — it defines the `vpt-e2e` stack (own database `vacation_tracker_e2e`,
own `SECRET_KEY`, `E2E_MODE=1` on the api, a sign-in allowlist pinned to
`e2e@vpt.test`, the api on loopback `127.0.0.1:8010` which the emulator reaches
at `http://10.0.2.2:8010`).

**One-time operator bring-up on the prod box** (this is the human/ops step; the
compose file itself is already in the repo):

Create `.env.e2e` directly (no example template exists; mirror the structure of
`.env.prod`). It must define at minimum:

```
POSTGRES_PASSWORD=<strong-random-password>
SECRET_KEY=<strong-random-secret>
VPT_E2E_BACKEND_TOKEN=<shared-secret-matching-the-GitHub-repo-secret>
AUTH_ALLOWED_EMAILS=e2e@vpt.test
```

`.env.e2e` is gitignored — do not commit it.

Then bring up the stack (helper scripts wrap the compose invocations):

```bash
pnpm e2e:up          # docker compose --env-file .env.e2e -f infra/docker-compose.e2e.yml up -d
pnpm e2e:db:migrate  # alembic upgrade head inside the api image
```

**Refreshes after that are automatic:** `deploy.yml` re-pulls the e2e stack on
every prod deploy, pinned via `IMAGE_TAG` to the same commit SHA prod just
rolled to, then migrates and checks `/ready`. The deploy job fails loudly if
the stack exists but `.env.e2e` has gone missing (a silent skip is how a stale
e2e backend goes unnoticed for weeks), and warns — without failing the prod
deploy — if the refresh itself errors or `/ready` doesn't come back.

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
