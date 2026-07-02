# AI Assistant Instructions

This file provides guidance to AI coding assistants when working with code in this
repository. It covers **repo-wide conventions only** — app-specific detail lives in
per-app guides (see below).

**Supported AI Assistants** (via a symlink to this single source of truth):
- Claude Code — `CLAUDE.md`
- OpenAI/agentic tools — `AGENTS.md` → `CLAUDE.md`

## Per-App Guides

Each app has its own `CLAUDE.md` with the detail for that surface. **Read the
relevant one before working in an app:**

- [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) — Next.js frontend (file naming, flight
  rendering, lockfile rule, debug-web).
- [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) — FastAPI backend (owns the DB,
  Skiplagged client, LLM/MCP tools, **`POST /v1/admin/sql`**, auth/CORS/CSRF).
- [`apps/worker/CLAUDE.md`](apps/worker/CLAUDE.md) — Temporal workflows
  (PriceCheck/RefreshAll/Optimizer, post-fetch filtering).
- [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) — Expo app (Expo Router screens,
  REST/JWT auth bridge, Aurora design tokens, Maestro e2e flows, `apps/mobile/lib/**`-scoped
  coverage gate).

## Project Overview

Vacation Price Tracker is a full-stack web app that tracks flight and hotel prices
for specific vacations using AI-powered chat and distributed workflows. Users
monitor price fluctuations and get notified when costs drop below custom thresholds.

**Architecture:**
- **Frontend:** Next.js 16 (App Router), Tailwind, shadcn/ui, assistant-ui (`apps/web`)
- **Mobile:** Expo SDK 56 + Expo Router (`apps/mobile`) — iOS + Android.
- **Backend:** FastAPI (Python 3.12), SQLModel/PostgreSQL — owns the DB (`apps/api`)
- **Orchestration:** Temporal SDK for Python (`apps/worker`)
- **Auth:** Google OAuth 2.0 only (no local passwords)
- **LLM:** Groq (GPT OSS 120B) with MCP tool integration

## Cross-platform parity

Vacation Price Tracker ships on **web** (Next.js, `apps/web`) and **mobile** (Expo, `apps/mobile`). User-visible features reach parity on both surfaces unless a platform constraint genuinely prevents it. **When you change one surface, make the matching change on the other unless the change is explicitly scoped to a single surface.**

Before finalizing a change, ask:
- **Trip screens** — trip list, trip detail (the interactive selection→total→chart), create-trip, and settings have web + mobile twins (`apps/web/src/app/trips/**` ↔ `apps/mobile/app/**`). A change to one needs the mirror on the other.
- **Assistant chat** — the Groq assistant exists on both (`apps/web/src/components/chat/**` ↔ `apps/mobile/app/(tabs)/chat.tsx`).
- **Notification / threshold settings** — both surfaces expose them; new options need rows on both.
- **API / schema change** — a new or changed `/v1/*` endpoint or schema affects both clients; regenerate the OpenAPI types consumed by web (`apps/web/src/lib/api/types.ts`) AND mobile (`apps/mobile/lib/api/types.ts`).
- **Observability event** — keep the web telemetry relay and mobile telemetry consistent.

If you intentionally scope work to one surface (e.g. ship web first, mobile follow-up), **say so explicitly in the PR body** and track the second-surface work durably — don't ship asymmetric features silently.

## Data Provider Strategy

**Hotels** come from the **Skiplagged MCP** (`https://mcp.skiplagged.com/mcp`) —
a public endpoint, no API key, no documented rate limit
(`search_hotels`/`search_hotels_all` + `get_hotel_details`).

**Flights** come from one of two MCP providers, selected at runtime by the
`kiwi_flights` feature flag (DB `feature_flags` table, toggled via
`PUT /v1/admin/flags/kiwi_flights` — no redeploy):

- **Skiplagged MCP** (flag off, default): chat tools use single-page
  `search_flights`; the tracking worker uses `search_flights_all` (up to 300
  results across `max_pages=4`). Flight numbers are parsed from the `id` string.
- **Kiwi.com MCP** (flag on): `https://mcp.kiwi.com/` — public, stateless, no
  API key. Returns structured per-segment data (carrier, flight number, times,
  durations, stops, cabin class) but no server-side pagination (~15 itineraries
  per search; stops/sort/limit applied client-side). Added when Skiplagged's
  flight-search backend began returning sustained 429s (July 2026).

Client details: [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md).

A 24-hour Redis cache for identical route/date queries stays in place as a courtesy
and for performance. `MOCK_SKIPLAGGED_API=true` returns mock data in dev (takes
precedence over the provider flag).

## Core Architectural Patterns

- **Saga Pattern (Temporal):** multi-step price fetches either complete or fail
  gracefully with automatic retries.
- **Single Provider:** one `SkiplaggedClient` (`apps/api/app/clients/skiplagged.py`)
  serves both chat tools and worker activities.
- **Outbox Pattern:** notification events are handed off at-least-once via a
  dedicated activity.
- **Idempotency:** `X-Idempotency-Key` required for `POST /v1/trips`, stored in
  Redis (24h TTL).
- **Post-fetch filtering:** airline and room-type/view preferences are filtered
  in-memory by the worker because Skiplagged supports neither natively. Details:
  [`apps/worker/CLAUDE.md`](apps/worker/CLAUDE.md).

## Environment Configuration

Copy `.env.example` to `.env` (dev) and configure. For the self-hosted production
stack, copy `.env.prod.example` to `.env.prod` (see Deployment).

**Required (MVP):** `DATABASE_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`SECRET_KEY`, `GROQ_API_KEY`.

**Optional:** `SKIPLAGGED_MCP_URL` (defaults to the public endpoint),
`MOCK_SKIPLAGGED_API`, `SEARCHAPI_KEY` (Phase 4 optimizer), `SMTP_*` (email),
`ADMIN_QUERY_TOKEN`/`ADMIN_QUERY_DATABASE_URL` (admin SQL endpoint),
`LANGFUSE_*` (LLM/MCP tracing).

**Feature flags:** boolean feature gates (`email_notifications`,
`sms_notifications`, `beta_optimizer`) live in the DB `feature_flags` table
(`app/core/feature_flags.py`), seeded disabled on startup and toggled at runtime
(no redeploy) — not env vars. `MAX_TRIPS_PER_USER` (default 10) stays an env limit.

**Cost / abuse ceilings** are always on (like the per-minute rate limiter):
per-user daily quotas + a global daily Groq/Skiplagged spend circuit-breaker in
Redis, auto-resetting at UTC midnight. Tune via `CHAT_DAILY_QUOTA_PER_USER`,
`DAILY_QUOTA_PER_USER`, `GLOBAL_DAILY_GROQ_TOKEN_BUDGET`,
`GLOBAL_DAILY_SKIPLAGGED_CALL_BUDGET` (details in
[`apps/api/CLAUDE.md`](apps/api/CLAUDE.md)).

## Directory Structure

```
vacation-price-tracker/
├── apps/
│   ├── web/        # Next.js frontend
│   ├── api/        # FastAPI backend (owns the database + migrations)
│   ├── worker/     # Temporal workflows
│   └── mobile/     # Expo + Expo Router app (iOS + Android)
├── infra/          # docker-compose.prod.yml (self-hosted prod stack)
├── scripts/        # dev.sh, verify.sh, prod-query.mjs, …
└── .env.example    # dev configuration template (.env.prod.example for prod)
```

## Local Development (Docker)

All services run in Docker for local dev. **Don't ask whether services are
running — check directly with Docker.**

| Container | Service | Port |
|:----------|:--------|:-----|
| `web` | Next.js frontend | 3000 |
| `api` | FastAPI backend | 8000 |
| `db` | PostgreSQL | 5432 |
| `redis` | Redis cache | 6379 |
| `temporal` | Temporal server | 7233 |
| `temporal-ui` | Temporal dashboard | 8080 |

```bash
docker ps                         # running containers
docker logs api --tail 50         # service logs
docker logs -f api                # follow logs
docker restart api                # restart a service
docker exec db psql -U postgres -d vacation_tracker -c "SELECT 1"
```

Common issues: API errors → `docker logs api`; DB schema →
`docker exec db psql … -c "\d <table>"`; stopped container → `docker ps -a` then
`docker start <name>`.

Production debugging (prod host, `/v1/admin/sql`, Temporal UI, Langfuse, `/ready`):
see `.claude/skills/debugging-prod/SKILL.md`.

## Observability

App logging is **stdlib `logging`** to stdout (captured by Docker's json-file
driver) **and shipped to Axiom** when configured. LLM/MCP calls are traced in
**Langfuse** (LLM traces only — app logs go to Axiom, not Langfuse).

**Structured logging (Axiom).** All logging goes through stdlib `logging`, with
structured fields passed via `extra=` and a dotted `event` name as the primary
query dimension. The module `app/core/observability.py` (a Python port of
showbook's logger) attaches a handler that ships to Axiom when **both**
`AXIOM_TOKEN` and `AXIOM_DATASET` are set; otherwise it's stdout-only (dev, tests,
CI never ship). One shared dataset (`vacation-price-tracker-prod`) serves api + worker + web,
distinguished by a `service` field (`vpt-api` / `vpt-worker`; web-relayed events
carry `component=web.telemetry`).

```python
logger = logging.getLogger(__name__)
logger.info("Trip loaded", extra={"event": "activity.load_trip.ok", "trip_id": tid})
logger.error("Fetch failed", exc_info=exc, extra={"event": "skiplagged.request.failed", "status": 503})
```

- **Levels:** `error` = real/terminal failures (terminal 4xx, unhandled
  exceptions, non-retryable); `warning` = transient/retryable (5xx/429/connection
  blips that are retried, partial results, degraded `/ready`); `info` =
  lifecycle/outcomes; `debug` = dev detail (stdout-only, not shipped).
  Python's `WARNING`/`CRITICAL` ship to Axiom as **`warn`/`fatal`** (pino-style,
  matching showbook's dataset), so `level in ("warn","error")` works on both.
- **What ships:** stdout gets every record; the Axiom handler additionally
  filters (`AxiomShipFilter`): only records carrying an `event` field or at
  ERROR+ ship, and Temporal sandbox restriction chatter never ships — so
  third-party library noise (urllib3/langfuse/temporalio warnings) stays in
  `docker logs` instead of the dataset.
- **Field columns:** Axiom caps a dataset at 256 columns. A small `CORE_FIELDS`
  allowlist stays as real columns; **every other `extra` key folds into one
  `fields` map field** (`reshape_for_axiom`), so the schema is bounded (~40
  columns) no matter what call-sites log. Query folded keys as
  `['fields']['key']`. Errors go through an allowlist `serialize_err` so a wild
  error shape can't blow up `err.*`. See
  `docs/specs/operations/axiom-map-fields.md`.
- Clients never write to Axiom directly — the browser
  (`apps/web/src/lib/telemetry.ts`) and the Expo app
  (`apps/mobile/lib/telemetry.ts`) relay best-effort events to
  `POST /v1/telemetry/client`, which namespaces them `web.<event>` /
  `mobile.<event>` (`component=<platform>.telemetry`).

**Querying Axiom (read).** The repo's ingest `AXIOM_TOKEN` cannot read; use a
Personal Access Token (Query capability) with the `X-AXIOM-ORG-ID` header:

```bash
ORG=showbook-egap   # the Axiom org slug (hosts the vacation-price-tracker-prod dataset)
curl -sS -X POST "https://api.axiom.co/v1/datasets/_apl?format=tabular" \
  -H "Authorization: Bearer $TOKEN" -H "X-AXIOM-ORG-ID: $ORG" \
  -H "Content-Type: application/json" \
  -d '{"apl":"[\"vacation-price-tracker-prod\"] | where _time > ago(1h) and level in (\"warn\",\"error\")"}'
```

## Development Phases

- **Phase 1 (MVP):** Dashboard with manual refresh, Google OAuth, trip CRUD.
- **Phase 2:** Chat interface with Groq LLM and MCP tool integration.
- **Phase 3:** Daily scheduled tracking, email notifications, pause/unpause.
- **Phase 4:** Flexible date optimizer using SearchAPI.

See `docs/PROJECT_PLAN.md` for detailed checklists.

## Important Constraints

- Max 10 trips per user (`MAX_TRIPS_PER_USER`).
- Skiplagged MCP is public — no auth, no documented rate limits.
- Flight numbers are **not** structured fields; they're parsed from the Skiplagged
  `id` field (see `apps/api/CLAUDE.md`).
- Airline and room-type/view filtering require post-fetch processing in the worker.
- **Single root `pnpm-lock.yaml`** — run pnpm from the repo root; never generate
  `apps/web/pnpm-lock.yaml`.

## Pre-Commit Validation

**Always run `pnpm verify` before committing.** It runs the same checks as CI via Nx
(with caching): install deps (`pnpm install --frozen-lockfile` + `uv sync --extra
dev`), then `build`, `lint`, `typecheck`, `test:coverage` across all projects, then
security audits (`pnpm audit --prod`, `pip-audit`). Pass `--e2e` to also run
Playwright (requires the Docker stack up).

Coverage gates: **95%** for both Python apps (`api`, `worker`); **80%** for mobile,
scoped to `apps/mobile/lib/**` only (screen/layout code under
`apps/mobile/{app,components}` is excluded).

### SonarCloud quality gate (run locally before a PR)

CI computes coverage in the Web + Server workflows, then a **separate**
SonarQube workflow downloads those reports and scans (`sonar-project.properties`).
The gate has **several conditions** — Coverage, **Security Rating**, Reliability,
Maintainability, Duplications — and a PR can fail on any of them.

**Two levels of local check** (`scripts/sonar-local.sh`):

- **`pnpm sonar:verify`** (no token) — regenerates the same reports CI feeds Sonar
  and checks the **Coverage dimension** two ways: (1) every report path resolves
  against the repo root (a path that doesn't is silently dropped and shown as **0%
  on new code** — exactly how jest's `SF:src/...` paths, relative to `apps/web`,
  vanished); and (2) **no scanned source file is absent from the reports** — a file
  Sonar scans but that no report mentions is zero-coverage'd to 0% (this is how the
  `apps/api/app/models/**` files, omitted from coverage.py but not from
  `sonar.coverage.exclusions`, tanked new-code coverage). `sonar.coverage.exclusions`
  must stay in sync with coverage.py's `omit` and jest's `collectCoverageFrom`
  negations; this check enforces that. `--no-tests` validates existing reports only.
  **It does NOT evaluate the Security/Reliability/Maintainability ratings** — those
  are computed by Sonar's rule engine, not from the coverage reports.
- **`pnpm sonar:verify --scan`** (needs `SONAR_TOKEN`) — runs the **real scanner**
  with `sonar.qualitygate.wait=true`, which uploads the analysis and blocks until
  SonarCloud returns the gate verdict, failing on **any** condition (security
  included). This is the only faithful local reproduction of the full gate.
- **`pnpm sonar:check`** — just the coverage path validator over existing reports.

The web `test:coverage` target reroots its lcov to repo-root-relative paths via
`scripts/lcov-reroot.mjs`, so the report Sonar consumes always maps onto real
files. **Heads-up:** a green `sonar:verify` only means coverage will map — a
security finding (e.g. CWE-117 log injection: never log un-scrubbed client input)
can still drop the gate. Use `--scan` to be sure.

**CI invariant — both coverage workflows must run together.** The SonarQube
workflow downloads web *and* python coverage **by commit SHA**; if only one of
`web.yml`/`server.yml` ran for a commit, the other language's report is absent
and Sonar zero-coverages it (this is what tanked Coverage on New Code to 16.9%
then 25.7%). The two workflows therefore share an **identical union `paths`
filter** so any code change runs **both** (both-or-neither). When editing either
trigger, keep them in lockstep.

## Verification Preference

- After code changes, automatically run the most relevant tests/checks without
  asking.
- Only ask for confirmation when a command needs elevated permissions or could be
  destructive.

## Pull Requests

- **ALWAYS open a PR for a completed change unless the user explicitly says
  otherwise.** This is the default for *every* change that ships — code, docs,
  config, CI, and `.claude/` skill or settings edits alike. There is **no**
  "this one's too small / it's just docs / it's only a skill tweak" exception;
  if you find yourself reaching for one, that's the failure mode this rule
  exists to stop. When a change is complete and the verify gate is green, **open
  the PR proactively — don't ask first.** Use the **`creating-prs`** skill, which
  merges latest `main`, runs `pnpm verify`, pushes, opens the PR, runs the Opus
  peer-review, and subscribes to CI. This is the intended default and
  **overrides** any generic "only open a PR when explicitly asked" harness
  behavior.
- The only times you skip or defer the PR: the user **explicitly** said not to
  push (or to hold off), the change is genuinely WIP, or a PR already exists for
  the branch (re-push to it instead of opening a second). Absent one of those,
  open the PR.
- After opening, follow the PR through CI to green per the skill; don't leave a red
  PR unattended.

## Commit Message Conventions

**Conventional Commits**, scope = the service modified:

```
<type>(<scope>): <description>
```

- **Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- **Scopes:** `web`, `api`, `worker`, `mobile`; no scope for repo-wide changes (docs,
  CI, root configs).

```bash
feat(api): add trip creation endpoint
fix(worker): handle missing flight data in PriceCheckWorkflow
refactor(web): migrate dashboard to server components
docs: add flexible date optimizer design
chore: update Docker Compose for Redis
```

For multi-service changes, prefer the primary scope or split into per-service
commits.

## Commit and PR Hygiene

Do **not** include `https://claude.ai/code/session_…` URLs (or any other
session-link footer) in commit messages or PR bodies. Strip the line from the
default template before committing. Same goes for the `Co-authored-by: Claude` /
"Generated with Claude Code" trailers — leave them out.

**PR titles are conventional commits.** PRs squash-merge, so the PR title becomes
the commit subject on `main` — that history is the contract, not the individual
branch commits (which are squashed away at merge). Title every PR as
`type(scope)?: imperative summary`, under 70 chars, using the same types and
scopes as commits above (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`;
scope = `web`/`api`/`worker`/`mobile`, omitted for repo-wide changes). Append `!` for a
breaking change (`feat(api)!: …`).

**PR-title subjects drive the mobile version bump.** Because mobile ships via
EAS, the merged PR subject feeds the `mobile-v*` auto-bump: `feat:` → MINOR and a
breaking `!` → MAJOR (both mapped to MINOR while the app is pre-1.0); everything
else → patch. So a stray `feat:` on a non-feature PR inflates the mobile minor
version, and an unprefixed feature loses its release-log signal — title mobile-
touching PRs deliberately.

Opening a PR is the **default** at the end of every change here — when local
`pnpm verify` is green and the work is committed, hand off to the `creating-prs`
skill **without asking for a separate "please open a PR" confirmation.** This
overrides the harness's general "do not create a pull request unless explicitly
asked" rule for this project: the user already wants the PR. Don't drive
`git push` + `mcp__github__*` manually — the skill owns the push / open / review
/ subscribe loop and delegates to the `debug-web` skill whenever the diff touches
the frontend (`apps/web/src/{app,components}`, `apps/web/src/**/*.tsx`).
Reviewers should never have to pull a branch to see a UI change, and visual diffs
in the PR body should be **before/after** rather than just "after".

## Deployment

- **Frontend:** hosted on **Vercel** (preview deploys, global CDN). Set
  `NEXT_PUBLIC_API_URL` to the FastAPI backend.
- **Self-hosted prod stack:** `infra/docker-compose.prod.yml` (project `vpt-prod`)
  runs db/redis/temporal/web/api/worker from GHCR images on loopback binds. Copy
  `.env.prod.example` → `.env.prod`. CI builds & pushes
  `ghcr.io/ethanasm/vpt-{web,api,worker}` on merge to `main`; `deploy.yml` rolls the
  self-hosted host forward. Helper scripts: `pnpm prod:up`, `pnpm prod:db:migrate`,
  `pnpm prod:query` (admin SQL). Prod debugging:
  `.claude/skills/debugging-prod/SKILL.md`.
- **OAuth ingress:** the home server has no port forwarding — a Cloudflare Tunnel
  fronts ingress; the Google callback is `https://<domain>/v1/auth/google/callback`
  (see `apps/api/CLAUDE.md`).
- **Mobile:** built and released via **EAS**. `mobile-deploy.yml` (P4) does
  continuous **OTA** (JS-only) updates to the `preview` channel plus an
  approval-gated **native release** (EAS build → submit to TestFlight + Play
  internal) that auto-bumps the `mobile-v*` tag. Maestro e2e runs via
  `mobile.yml`'s **E2E Test** job on the self-hosted runner against the isolated
  `vpt-e2e` stack. Details: [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) and
  `docs/mobile-cicd.md` (added by P4).
