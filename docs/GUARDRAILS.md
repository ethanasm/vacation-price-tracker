# Guardrails

The canonical list of safety / cost / abuse limits enforced by Vacation Price
Tracker itself — the things that protect a deployment from accidental or hostile
cost-runaway, abuse, or data exposure. Repository-level controls (branch
protection, secret scanning, Dependabot) live in the GitHub Settings UI, outside
this file.

Most state for rate limiting and idempotency lives in **Redis** (24h TTLs),
shared across the api processes. Limits are per-user (by authenticated user id)
or per-IP where noted.

---

## Auth and session gates

| Gate | Where | Behaviour |
|------|-------|-----------|
| Google OAuth only | `apps/api/app/routers/auth.py` | No local passwords. Users are keyed by `google_sub`; the callback is `<BACKEND_URL>/v1/auth/google/callback`. |
| JWT session | `apps/api/app/core/config.py` | Access token 15 min (`access_token_expire_minutes`), refresh 7 days (`refresh_token_expire_days`), HS256 signed with `SECRET_KEY`. |
| CORS allowlist | `core/config.py` (`cors_allowed_origins_list`) | Empty by default; in prod set `CORS_ALLOWED_ORIGINS` to the single web origin. |
| CSRF | `apps/api/app/middleware/csrf.py` | State-changing requests require a CSRF token. `/v1/admin/` is exempt (it uses a bearer token instead). |

---

## `POST /v1/admin/sql` — read-only SQL endpoint

Defense-in-depth (`apps/api/app/routers/admin.py`, `core/admin_query.py`):

| Layer | Limit |
|-------|-------|
| Bearer token | Timing-safe compare against `ADMIN_QUERY_TOKEN`; endpoint **disabled** unless the token is set and ≥ 32 chars. |
| Read-only txn | Postgres `SET TRANSACTION READ ONLY`; every query is rolled back regardless of dialect. |
| Statement timeout | `SET LOCAL statement_timeout = 3000` (3 s) per query. |
| Prefix allowlist | Only `SELECT`/`WITH`/`EXPLAIN`/`SHOW`/`TABLE`/`VALUES`, single statement. |
| Row cap | 1000 rows max returned. |
| Per-IP rate limit | 30 requests / 60 s (Redis, fails open — token still required). |
| Connection cap | Dedicated engine `pool_size=2`, caps blast radius of a leaked token. Prefer a read-only role via `ADMIN_QUERY_DATABASE_URL`. |

---

## Per-user / per-IP rate limits

| Limit | Default | Source |
|-------|---------|--------|
| API requests / minute | 100 | `rate_limit_per_minute` |
| Chat (LLM) messages / minute | 10 | `chat_rate_limit_per_minute` — Groq calls are expensive |
| Trips per user | 10 | `MAX_TRIPS_PER_USER` (`create_trip` rejects beyond this) |

---

## Idempotency and provider cost control

| Gate | Where | Behaviour |
|------|-------|-----------|
| Trip creation idempotency | `apps/api/app/middleware/idempotency.py` | `X-Idempotency-Key` required for `POST /v1/trips`; stored in Redis with a 24h TTL (at-least-once safe). |
| Skiplagged response cache | `apps/api/app/clients/skiplagged.py` | 24h Redis cache for identical route/date queries — courtesy + cost. `MOCK_SKIPLAGGED_API=true` returns mock data in dev. |
| Skiplagged 429 handling | `apps/worker/worker/activities/price_check.py` | The tracking worker backs off on 429 and writes a **partial** snapshot rather than failing the run. |
| Post-fetch filtering | worker | Airline / room-type / view filters are applied in-memory (Skiplagged supports neither), bounded by `max_pages=4` (~300 results). |

---

## Operational guards

- **Prod DB is owned by the FastAPI app + Alembic.** Migrations run in-container
  (`pnpm prod:db:migrate`); the app no longer auto-creates tables in production
  (Alembic is the source of truth).
- **Pre-migration backup.** `deploy.yml` runs `pnpm prod:db:backup` (pg_dump,
  custom format) into `backups/pre-migrate-<sha>.dump` before every migration.
- **Post-deploy health gate.** `pnpm prod:health:ready` curls `/ready` (DB +
  Redis + Temporal) with retries; a deploy isn't "done" until it passes.
- **Loopback-only binds.** The prod stack publishes every port on `127.0.0.1`;
  ingress is fronted by a Cloudflare Tunnel that terminates TLS.
