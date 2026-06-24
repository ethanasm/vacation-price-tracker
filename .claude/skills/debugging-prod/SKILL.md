---
name: debugging-prod
description: Investigate production issues for the self-hosted Vacation Price Tracker stack (project vpt-prod). Use when something is broken or suspicious in prod — 5xx/empty responses, a tracked trip with wrong/stale prices, a stuck or failing price-check workflow, missing notifications, slow/odd LLM chat behaviour, or a deploy that won't come healthy. Covers the read paths: docker logs on the prod host, structured app logs in Axiom (when configured), the /v1/admin/sql endpoint (via `pnpm prod:query`), the Temporal Web UI, Langfuse, and the /ready probe.
---

# Debugging production (vpt-prod)

Production is the self-hosted Docker stack defined in
`infra/docker-compose.prod.yml` (Compose project **`vpt-prod`**), pulling images
from GHCR. This skill is the **read/diagnose** counterpart to the local
`debug-web` skill — use it against the live host.

- **`debug-web`** → render/inspect the *local* UI with Playwright at
  `https://localhost:3000` (you have the dev stack and a browser).
- **`debugging-prod`** (this skill) → diagnose the *live* system from its logs,
  database, workflow history, and LLM traces. You do **not** drive a prod browser
  here; you read prod's signals.

App logging is stdlib `logging` → stdout → Docker's `json-file` driver, **and**
shipped to **Axiom** when `AXIOM_TOKEN`/`AXIOM_DATASET` are set in `.env.prod`
(one dataset, `vpt-prod`, for api + worker + web — distinguished by `service` /
`component`). LLM/MCP calls are traced in **Langfuse**. Query Axiom with a PAT
(Query capability) + `X-AXIOM-ORG-ID` header — the repo's ingest token can't read.
Logs are structured: filter on `event` (dotted namespace), `level`, `service`,
`trip_id`, `workflow_id`; non-core fields are under the `fields` map
(`['fields']['key']`). See `docs/specs/operations/axiom-map-fields.md`. Example:

```bash
ORG=${AXIOM_ORG_ID:-showbook-egap}   # Axiom org slug hosting the vpt-prod dataset
curl -sS -X POST "https://api.axiom.co/v1/datasets/_apl?format=tabular" \
  -H "Authorization: Bearer $AXIOM_QUERY_TOKEN" -H "X-AXIOM-ORG-ID: $ORG" \
  -H "Content-Type: application/json" \
  -d '{"apl":"[\"vpt-prod\"] | where _time > ago(1h) and level in (\"warn\",\"error\") | sort by _time desc"}'
```

When Axiom retention has rolled off (or it's unconfigured), `docker logs` is the
fallback — the stdout copy is JSON in prod.

## The five read paths

### 1. `docker logs` on the prod host

First stop for crashes, stack traces, and startup failures. On the prod host
(repo root, where `.env.prod` lives):

```bash
pnpm prod:ps                                  # what's up / restarting / unhealthy
pnpm prod:logs                                # all services, follow, last 100
# or target one service (compose service names: db redis temporal api worker web):
docker compose --env-file .env.prod -f infra/docker-compose.prod.yml logs --tail=200 api
docker compose --env-file .env.prod -f infra/docker-compose.prod.yml logs --tail=200 worker
```

The API logs RFC 7807 problem details and a one-line `admin.sql …` audit record
per query (length + timing only, never the SQL). Logs rotate at 10 MB × 5 files.

### 2. `/v1/admin/sql` via `pnpm prod:query`

The DB is owned by FastAPI and is **not** exposed on the LAN. Inspect prod data
through the bearer-authenticated, read-only SQL endpoint:

```bash
pnpm prod:query "SELECT count(*) FROM trips"
pnpm prod:query --json "SELECT id, status FROM trips WHERE status='Error'"
echo "SELECT now()" | pnpm prod:query
```

Reads `ADMIN_QUERY_TOKEN` + `PROD_API_URL`/`BACKEND_URL` from `.env.prod`.
Read-only is enforced server-side (Postgres `READ ONLY` txn, always rolled back),
plus a 3 s statement timeout, 1000-row cap, and per-IP rate limit. Only
`SELECT`/`WITH`/`EXPLAIN`/`SHOW`/`TABLE`/`VALUES` are accepted. See the recipe
library below.

### 3. Temporal Web UI — workflow/activity failures

Price tracking runs in Temporal (`PriceCheckWorkflow`, `RefreshAllTripsWorkflow`,
`RunOptimizerWorkflow`). When a refresh "does nothing", a trip is stuck, or the
worker throws, the UI has the full history (inputs, retries, and the failure
stack on the failed activity). In prod the Temporal frontend is on loopback
`127.0.0.1:7235`; the Web UI is not published by the prod compose, so tunnel to
the host (e.g. `ssh -L 8080:127.0.0.1:8080`) or run the UI image against the
frontend. Look for:

- Workflows in `Failed`/`Terminated`, or `Running` far longer than a normal run.
- The failed **activity** (usually `filter_results_activity` or a Skiplagged
  fetch) — its stack trace + whether Temporal is still retrying.
- Skiplagged `429`s: the worker backs off and writes a **partial** snapshot
  rather than failing — expect retries, not a hard failure.

### 4. Langfuse — LLM/MCP traces

For chat misbehaving, bad tool calls, or MCP routing issues, open the Langfuse
project (`LANGFUSE_HOST`, default `https://us.cloud.langfuse.com`). Traces appear
only when `LANGFUSE_PUBLIC_KEY`/`SECRET_KEY` are set; otherwise tracing is a
no-op and you fall back to `docker logs api`. Look at the trace for the request:
the Groq prompt/response, which MCP tools were called, and their arguments/results.

### 5. `/ready` probe

`GET /ready` on the API checks database, Redis, and Temporal and returns 503 if
any dependency is down (this backs the api container healthcheck). Quick triage:

```bash
curl -fsS http://127.0.0.1:8001/ready | jq    # on the prod host (loopback bind)
curl -fsS https://api.your-domain.com/ready | jq   # through the tunnel
```

`{"database":"ok","redis":"ok","temporal":"ok"}` → infra is healthy, look higher
up. Any `"error"` → that dependency is the problem; check its container logs.

## DB recipe library

The API owns these tables: `users`, `trips`, `trip_flight_prefs`,
`trip_hotel_prefs`, `price_snapshots`, `notification_rules`, `conversations`,
`messages`. **Idempotency keys and the admin-SQL rate limiter live in Redis, not
Postgres** — there is no idempotency/outbox table to query; notification
delivery is an at-least-once handoff processed by a worker activity.

```sql
-- Trips currently in an error state (worker marked them non-retriable)
SELECT id, user_id, trip_name, status, updated_at
FROM trips WHERE status = 'Error' ORDER BY updated_at DESC;

-- Is tracking actually running? Newest snapshot per trip (stale = worker stuck)
SELECT trip_id, max(created_at) AS last_snapshot
FROM price_snapshots GROUP BY trip_id ORDER BY last_snapshot ASC LIMIT 20;

-- Inspect a suspicious price: raw_data JSONB is kept for debugging
SELECT id, trip_id, flight_total, hotel_total, trip_total, created_at
FROM price_snapshots WHERE trip_id = '<TRIP_ID>' ORDER BY created_at DESC LIMIT 10;

-- Notification thresholds for a trip (why did/didn't an alert fire?)
SELECT * FROM notification_rules WHERE trip_id = '<TRIP_ID>';

-- A user's trips and prefs (airline / room-type filters drive worker filtering)
SELECT t.id, t.trip_name, t.status, f.airlines, h.preferred_room_types
FROM trips t
LEFT JOIN trip_flight_prefs f ON f.trip_id = t.id
LEFT JOIN trip_hotel_prefs  h ON h.trip_id = t.id
WHERE t.user_id = '<USER_ID>';

-- Per-user trip count vs the MAX_TRIPS_PER_USER cap (create_trip rejections)
SELECT user_id, count(*) FROM trips GROUP BY user_id ORDER BY count DESC;

-- Has migrations applied? (alembic stamps this table)
SELECT version_num FROM alembic_version;
```

## Symptom → action decision tree

| Symptom | Start here | Then |
|---------|-----------|------|
| API 5xx / won't start / unhealthy | `docker logs api`; `/ready` | If a dep is `error`, check that container (db/redis/temporal) |
| `/ready` returns 503 | the `error` field tells you which dep | logs for db/redis/temporal |
| Trip price wrong / stale | `prod:query` newest-snapshot recipe | if stale → Temporal UI for the workflow; inspect `raw_data` |
| Refresh "did nothing" / stuck | Temporal UI (workflow history) | worker logs; expect 429 backoff + partial snapshots, not failure |
| Trip stuck in `Error` | `prod:query` error-trips recipe | Temporal UI for the failed activity's stack |
| No notification fired | `notification_rules` recipe (thresholds) | worker logs for the notify activity |
| Chat / tool calls misbehaving | Langfuse trace | fall back to `docker logs api` if tracing disabled |
| Wrong airline/room filtering | `trip_*_prefs` recipe | `apps/worker/CLAUDE.md` (post-fetch filtering) |
| Deploy won't come healthy | `prod:ps`; `docker logs` of the new image | confirm IMAGE_TAG pulled; rerun `pnpm prod:db:migrate` |
| Auth / OAuth callback failing | `docker logs api`; check `CORS_ALLOWED_ORIGINS` | Cloudflare Tunnel + Google callback URL |

## Safety

Everything here is **read-only**. `prod:query` cannot mutate data (the endpoint
forces a rolled-back READ ONLY transaction). Never paste secrets or full SQL with
user identifiers into chat — the audit log deliberately records query *length*,
not content. Schema changes go through Alembic (`pnpm prod:db:migrate`), never
hand-run DDL.
