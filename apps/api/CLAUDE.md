# apps/api — FastAPI Backend

FastAPI (Python 3.12) + SQLModel + PostgreSQL. **This app owns the database** —
all schema, migrations (Alembic), and any direct SQL access live here. The
worker and web app never talk to Postgres directly; they go through this API.

See the root `CLAUDE.md` for repo-wide conventions (commit style, `pnpm verify`,
Docker dev stack, env config).

## Layout

```
apps/api/app/
├── main.py            # App factory, middleware wiring, /health + /ready probes
├── core/              # config (settings), admin_query validator, telemetry
├── clients/           # skiplagged.py (MCP client), groq.py (LLM), parsers
├── routers/           # HTTP routes: trips, auth, chat, sse, admin
├── services/          # chat, conversation, mcp_router, smart_defaults, temporal
├── middleware/        # csrf, idempotency
├── models/            # SQLModel tables (owns the schema)
├── schemas/           # Pydantic request/response models
└── tools/             # MCP tool implementations (create_trip, …)
apps/api/migrations/   # Alembic migrations (alembic.ini is at the repo root)
apps/api/tests/        # pytest suite — SQLite via conftest get_db override
```

## Nx targets

| Command | What it does |
|---------|--------------|
| `pnpm nx run api:lint` | `ruff check apps/api/app apps/api/tests` |
| `pnpm nx run api:test` | `pytest apps/api/tests -v` |
| `pnpm nx run api:test:coverage` | `pytest --cov=app --cov-fail-under=95` (gate) |
| `pnpm nx run api:dev` | HTTPS dev server (`run_ssl.py`) |
| `pnpm nx run api:dev:http` | `uvicorn app.main:app --reload --port 8000` |

**95% coverage gate.** `pyproject.toml` sets coverage `concurrency = ["greenlet","thread"]`
so lines after `await session.execute(...)` are traced. Don't lower the gate —
add tests or `# pragma: no cover` Postgres-only branches that can't run under
the SQLite test DB.

## Database ownership

- Tables (`__tablename__`): `users`, `trips`, `trip_flight_prefs`,
  `trip_hotel_prefs`, `price_snapshots`, `notification_rules`, `conversations`,
  `messages`. Composite unique index on `(user_id, trip_name)` blocks duplicate
  trips.
- **Idempotency** keys (`X-Idempotency-Key` on `POST /v1/trips`) live in **Redis**
  with a 24h TTL — not in Postgres. Same for the per-IP admin-SQL rate limiter.
- Migrations: `pnpm db:migrate` (= `alembic upgrade head`), `pnpm db:migrate:new "<msg>"`
  to autogenerate, `pnpm db:migrate:status` for current revision. `env.py` reads
  `DATABASE_URL`.
- Tables also include `feature_flags` (boolean toggles) and `app_settings`
  (string-valued toggles, e.g. `flight_provider`).
- `PriceSnapshot.raw_data` is a JSONB column kept for debugging — query it when a
  tracked price looks wrong. `PriceSnapshot.provider` marks which flight
  provider the snapshot was fetched from (backfilled from
  `raw_data->flights->provider` for older rows).

## Error handling

- A global exception handler returns **RFC 7807 Problem Details** JSON.
- `/health` is a liveness ping; `/ready` checks database, Redis, and Temporal and
  returns 503 if any dependency is down (used by the prod compose healthcheck).

## Auth, CORS, CSRF

- Google OAuth 2.0 only — users keyed by `google_sub`, no local passwords.
- OAuth callbacks need a public URL (home server has no port forwarding) — a
  Cloudflare Tunnel fronts ingress; callback URL is
  `https://<domain>/v1/auth/google/callback`.
- **CORS:** `CORS_ALLOWED_ORIGINS` is a comma-separated allowlist
  (`settings.cors_allowed_origins_list`). In prod set it to the single web origin.
  Methods and headers are pinned to explicit lists (`GET/POST/PATCH/DELETE/OPTIONS`;
  `Content-Type`, `X-CSRF-Token`, `X-Idempotency-Key`, `Authorization`) — wildcards
  are spec-invalid alongside `allow_credentials=True`.
- **CSRF:** state-changing requests require a CSRF token (see `middleware/csrf.py`).
  `/v1/admin/` is exempt because it authenticates with a bearer token instead.
- **Security headers:** `middleware/security_headers.py` is registered as the
  outermost layer and stamps every response with `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`,
  `X-Permitted-Cross-Domain-Policies`, and a locked-down `Content-Security-Policy`
  (`default-src 'none'`; skipped for the dev-only `/docs`, `/redoc`, `/openapi.json`).
  HSTS is emitted in production only.

## Rate limiting & caching

- 24h Redis cache for identical Skiplagged route/date queries.
- Per-user token-bucket throttling so no single user can hammer Skiplagged MCP.
- `rate_limit_per_minute` (default 100) and `chat_rate_limit_per_minute` (default 10).
- **Client identity for limiting** (`middleware/rate_limit.py`): authenticated
  requests key on the user id resolved from the JWT — the access-token **cookie**
  (web) *or* the `Authorization: Bearer` header (mobile). Unauthenticated
  requests key on the client IP, taken as the `TRUSTED_PROXY_COUNT`-th
  `X-Forwarded-For` entry **from the right** (default 1 = the Cloudflare Tunnel
  hop). The leftmost XFF entry is client-appendable and must never be trusted;
  the chosen value is IP-validated before it keys a bucket or hits a log.

### Cost / abuse ceilings (`app/core/quota.py`)

On top of the per-minute limiter, two Redis-backed daily defenses guard against
unbounded spend (a user parked at the per-minute cap for hours, or a leaked
session). All counters carry a `:{YYYYMMDD}` (UTC) suffix and a
seconds-to-midnight TTL, so they **auto-reset at UTC midnight — no cron**. Every
helper **fails open** on a Redis error. Always on (like the per-minute limiter);
there is no on/off flag — set a limit very high to effectively disable it.

- **Per-user daily quota** — day-bucketed counters enforced in
  `rate_limit_middleware`: an overall API cap (`DAILY_QUOTA_PER_USER`, default
  2000) and a stricter cap on message-producing chat (`/v1/chat/messages`,
  `/v1/chat/elicitation`) via `CHAT_DAILY_QUOTA_PER_USER` (default 200). Over
  limit → 429 with `Retry-After` = seconds to midnight. Keys:
  `daily_quota:{identifier}:{resource}:{day}`.
- **Global daily budget guard / circuit breaker** — a per-UTC-day counter per
  metric, incremented at the two shared provider chokepoints so the worker's
  scheduled refreshes are covered too:
  - `groq.chat()` adds `total_tokens` after each completion
    (`GLOBAL_DAILY_GROQ_TOKEN_BUDGET`, default 50,000,000). Requires
    `stream_options={"include_usage": True}` on streaming calls.
  - `skiplagged._call_mcp()` adds 1 per MCP call
    (`GLOBAL_DAILY_SKIPLAGGED_CALL_BUDGET`, default 50,000).
  When a metric's day total crosses its ceiling the breaker trips: the chat
  middleware / manual-refresh trigger reject new work (503 `GlobalBudgetExceeded`)
  and the provider clients raise `GlobalBudgetExceeded` so in-flight chat (SSE
  error chunk) and worker activities (non-retriable Temporal error) fail
  gracefully. Keys: `global_budget:{metric}:{day}`. The trip is logged at WARNING as
  `budget.breaker_tripped` (stdout + Axiom).
- **Residual risk:** all three limiters are Redis-backed and fail open, so a
  Redis outage disables the per-minute limiter, the per-user daily quota, and the
  global breaker simultaneously. Defense-in-depth (process-local fallback, or a
  hard provider-side spend cap) is intentionally out of scope.

The four numeric ceilings are plain env-overridable `Settings` fields, all
surfaced in `.env.example` (they're the only knobs).

## Skiplagged MCP client

`app/clients/skiplagged.py` speaks JSON-RPC 2.0 over Streamable HTTP to
`https://mcp.skiplagged.com/mcp` (no auth): one `initialize` handshake, then
`tools/call` requests carrying the `mcp-session-id` from the response header.

| Method | Use |
|--------|-----|
| `search_flights()` | Single page (chat tools), up to `limit` (default 75) |
| `search_flights_all()` | Full set for tracking, `pagination.hasMoreResults` up to `max_pages=4` (~300) |
| `search_hotels()` / `search_hotels_all()` | Hotels by city + check-in/out |
| `get_hotel_details()` | Room-level data for one hotel |

Set `MOCK_SKIPLAGGED_API=true` to use `skiplagged_mock.py` in development.

## Kiwi MCP client (alternative flight provider)

`app/clients/kiwi.py` speaks the same JSON-RPC 2.0 Streamable HTTP dialect to
`https://mcp.kiwi.com/` (no auth), but the server is **stateless** — no
`initialize` handshake, no session header. One tool: `search-flight`
(dd/mm/yyyy dates, `cabinClass` M/W/C/F). Responses carry **structured
per-segment data** (carrier, flight number, airports, ISO times, durations,
stops, cabin), so no id-string parsing; the full itinerary rides along in
`raw_data` for the worker's airline filter and the trips router's itinerary
builder (`_parse_kiwi_flight_offer`). No server-side pagination/sort/stop
filtering — applied client-side (~15 itineraries per search). Each stateless
call returns a *varying* sample of pairings that can miss whole carriers, so
the tracking path (`search_flights_all`) unions `COVERAGE_QUERIES` queries,
deduped by segment fingerprint (cheapest price per pairing wins). Airline
display names come from the static map in `app/core/airlines.py`.

Which provider serves flights is the `flight_provider` app setting
(`app/services/flight_provider.py` dispatches; hotels always Skiplagged).
Kiwi calls meter into the `kiwi_calls` global daily budget metric, sharing the
`GLOBAL_DAILY_SKIPLAGGED_CALL_BUDGET` ceiling.

## fast-flights client (third flight provider)

`app/clients/fast_flights.py` wraps the `fast-flights` PyPI package's fetcher
(Google Flights scraper — protobuf `tfs` query, Chrome-impersonating `primp`,
no API key) but parses pages with **our extended parser**
(`app/clients/fast_flights_parser.py`): the upstream library reads only the
"best flights" section and drops per-segment airline identity, while the
extended parser reads **both** itinerary sections (`payload[3][0]` best +
`payload[2][0]` other — the cheapest fare regularly hides in the second) and
extracts each segment's **carrier code + flight number** (`segment[22]`,
verified empirically 2026-07), so `FlightSegment.flight_number` is a real
designator on this provider too. Payload indexes are Google's obfuscated
structure — every read is guarded so drift degrades to missing fields, not a
crash.

Interface-compatible with the other clients (`search_flights` /
`search_flights_all`, provider="fast_flights", `fast_flights_calls` budget
metric sharing the same ceiling). Round-trip quirk, normalized at the source:
Google's ranked page lists **outbound** options priced at the round-trip
total, and the query protobuf has no selected-flight token, so the exact
paired return can't be fetched. The tracking path
(`search_flights_all`) therefore runs a second **reverse one-way query**
(2 Google calls per round-trip refresh) and attaches each offer's
**same-airline return options** (`return_segments`/`return_options` in raw
data → a real return itinerary on `FlightOffer`); such offers carry
`FlightOffer.round_trip_total=true` and clients render a "same-airline return
option" qualifier (or "return included in price" when no airline match
exists). The chat path stays single-query. The sync fetcher runs in a worker
thread; transient scrape failures (blocked/unparseable page) retry briefly
then raise `FastFlightsTransientError`. Optional `FAST_FLIGHTS_PROXY` env
routes its requests through a proxy.

**Flight numbers are not structured** — they are encoded in the Skiplagged `id`
field (e.g. `SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741`)
and parsed by `parse_flight_segments()` in `clients/skiplagged_parser.py` (split on
`trip=`, then `,` for outbound/return legs, then `-` per segment, strip the `~`
hidden-city marker, split carrier letters from flight-number digits). Schema models
`FlightSegment` / `FlightItinerary` live in `schemas/trip.py`.

**Normalize provider quirks at the source.** `flight_number` is contractually
the full carrier-prefixed designator (`"AS3361"`) on every provider path:
Skiplagged ids parse into `f"{code}{num}"`, and Kiwi values pass through
`_flight_designator()` in `routers/trips.py`, which prefixes a bare number
with the segment carrier. Any other provider-specific metadata difference
gets the same treatment — normalize (or gate by provider) in the mapping
layer so web/mobile render `/v1/*` fields as-is and never re-derive them
(e.g. never `carrier_code + flight_number`, which double-prefixes).

## LLM (Groq) & MCP tools

- Chat uses Groq (`groq_model` default `openai/gpt-oss-120b`) via `clients/groq.py`.
- MCP tool routing in `services/mcp_router.py`; tool implementations in `tools/`.
- Trip-management tools: `create_trip`, `list_trips`, `get_trip_details`,
  `set_notification`, `pause_trip`/`resume_trip`, `trigger_refresh`. Chat search
  tools: `search_flights`, `search_hotels`.
- LLM/MCP traces go to **Langfuse** when `LANGFUSE_PUBLIC_KEY`/`SECRET_KEY` are set
  (no-op otherwise). App logs ship to **Axiom** via `app/core/observability.py`
  when `AXIOM_TOKEN`/`AXIOM_DATASET` are set — `service=vpt-api`. Log with
  structured fields: `logger.info("msg", extra={"event": "<dotted.name>", ...})`;
  errors with `exc_info=exc`. The `POST /v1/telemetry/client` router relays browser
  events into the same pipeline (`component=web.telemetry`). Non-core `extra` keys
  fold into the Axiom `fields` map field — see the root `CLAUDE.md` Observability
  section and `docs/specs/operations/axiom-map-fields.md`.

## `POST /v1/admin/sql` — read-only SQL debug endpoint

A bearer-authenticated, read-only SQL endpoint over HTTPS so the operator (and
Claude Code, via `pnpm prod:query`) can inspect the prod database without exposing
Postgres on the LAN. FastAPI counterpart of showbook's `/api/admin/sql`.

```
POST /v1/admin/sql
Authorization: Bearer <ADMIN_QUERY_TOKEN>
Content-Type: application/json
{"query": "SELECT count(*) FROM trips"}

200 → {"rows": [...], "rowCount": <int>, "truncated": <bool>, "elapsedMs": <int>}
```

Errors: `401` unauthorized · `400` bad_request · `422` query_rejected ·
`429` rate_limited · `500` server_error · `504` timeout.

**Defense in depth** (`routers/admin.py` + `core/admin_query.py`):

1. Bearer token, timing-safe compare against `ADMIN_QUERY_TOKEN`; the endpoint
   refuses to enable itself unless the token is set and ≥ 32 chars.
2. Postgres `SET TRANSACTION READ ONLY` — the engine rejects writes (SQLSTATE
   25006). Every query is rolled back regardless of dialect.
3. Per-statement `statement_timeout` (3 s) so a runaway query can't pin a backend.
4. Prefix allowlist (`SELECT`/`WITH`/`EXPLAIN`/`SHOW`/`TABLE`/`VALUES`, single
   statement) for friendly early rejection — courtesy, not the boundary.
5. Row cap (1000) so `SELECT *` from a huge table can't exhaust memory.
6. Per-IP Redis rate limit (30/min, fails open — the bearer token is still required).

**Config** (`core/config.py`): `admin_query_token`, and optional
`admin_query_database_url` to point at a dedicated read-only role (`vpt_query`);
falls back to `database_url`. The dedicated engine uses `pool_size=2` to cap the
blast radius of a leaked token.

**Testing notes:** tests run on SQLite via the conftest `get_db` override; the
endpoint depends on `get_admin_session` (override it in tests). Postgres-only
guards (`SET TRANSACTION READ ONLY`, `statement_timeout`) can't run on SQLite —
they're covered via `_classify_db_error` unit tests that map SQLSTATEs
(`57014`→timeout, `25006`/`42501`→read_only).

## `GET`/`PUT /v1/admin/flags` — runtime feature-flag toggles

Same bearer token (`ADMIN_QUERY_TOKEN`) and per-IP rate limit as `/sql`, but
these **write** the `feature_flags` table, so they use the app's normal engine
(`get_db`), not the (possibly read-only) admin engine.

```
GET  /v1/admin/flags                    → {"flags": [{name, description, enabled}, …]}
PUT  /v1/admin/flags/{name}             body {"enabled": true|false}
```

Unknown flag → 404; non-boolean body → 400. The flag registry lives in
`app/core/feature_flags.py` (`KNOWN_FLAGS`); rows are seeded with defaults at
API startup.

**String-valued settings** get the same treatment via `GET /v1/admin/settings`
and `PUT /v1/admin/settings/{name}` (body `{"value": "<allowed value>"}`;
registry in `app/core/app_settings.py`, values validated against each
setting's `allowed_values`). The `flight_provider` setting
(`skiplagged` | `kiwi` | `fast_flights`) selects the flight provider (see the
client sections above). Admin *users* change it from the Settings page via
`GET/PATCH /v1/app-settings` (cookie + CSRF, `ADMIN_EMAILS`-gated — the
string-valued sibling of `/v1/feature-flags`).

## Commit scope

Use `feat(api): …`, `fix(api): …`, etc. (Conventional Commits).
