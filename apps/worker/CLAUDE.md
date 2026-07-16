# apps/worker — Temporal Workflows

Temporal SDK for Python. Runs the distributed price-tracking workflows. The worker
fetches from Skiplagged MCP, applies post-fetch filters, and writes
`PriceSnapshot` rows **through the API's models** — the API owns the database, the
worker shares its SQLModel models via `PYTHONPATH=/app/apps/api:/app/apps/worker`.

See the root `CLAUDE.md` for repo-wide conventions and `apps/api/CLAUDE.md` for the
Skiplagged client and data model.

## Layout

```
apps/worker/worker/
├── __main__.py          # `python -m worker` entrypoint (registers w/ Temporal)
├── workflows/           # RefreshAllTripsWorkflow, PriceCheckWorkflow, RunOptimizerWorkflow
└── activities/          # price_check.py (search + filter_results_activity), notify, …
apps/worker/tests/       # pytest; integration tests marked `-m integration`
```

## Nx targets

| Command | What it does |
|---------|--------------|
| `pnpm nx run worker:lint` | `ruff check apps/worker/` |
| `pnpm nx run worker:test` | `pytest apps/worker/tests -v` |
| `pnpm nx run worker:test:coverage` | `pytest --cov=worker --cov-fail-under=95` (gate) |
| `pnpm nx run worker:test:integration` | `pytest -m integration` (Temporal dev server) |
| `pnpm nx run worker:dev` / `worker:start` | `python -m worker` |

95% coverage gate, same as the API.

## Scheduled jobs (cron)

Temporal schedules are created/updated idempotently on worker startup by
`schedule_bootstrap.py` (`ensure_daily_refresh_schedule` + `ensure_daily_health_schedule`),
all with `ScheduleOverlapPolicy.SKIP`. Times are UTC.

| Schedule id | Cron (env) | Default | Workflow | What it does |
|:------------|:-----------|:--------|:---------|:-------------|
| `daily-price-refresh` | `DAILY_REFRESH_CRON` | `0 6 * * *` | `ScheduledRefreshAllUsersWorkflow` | Refresh every active trip, then chain the user price-drop digest. |
| `daily-health-check` | `DAILY_HEALTH_CRON` | `0 7 * * *` | `RunHealthCheckWorkflow` | Run system health checks and email an ops summary to `ADMIN_EMAILS`. |

The health check is **chained**: `ScheduledRefreshAllUsersWorkflow` starts
`RunHealthCheckWorkflow` as its final step, passing the run's results (users
ok/failed + digest outcome) so the email reports the run that just finished —
however long it took. The `daily-health-check` cron (an hour later) stays as a
fallback for the day the refresh never fires; it reads the outcome from
Temporal schedule history instead, flags a still-`RUNNING` refresh as **warn**
(a run still open an hour later is stuck — see the Jun 2026 outage), and the
email's per-day idempotency key (`health-summary-{date}`) collapses the
duplicate send.

## Workflows

### RefreshAllTripsWorkflow
Orchestrates updating all active trips for a user. Triggered by the manual refresh
button (`POST /v1/trips/refresh-all`) and the daily cron (`daily_refresh_cron`,
default `0 6 * * *`).

### RunHealthCheckWorkflow
Daily system-health digest (showbook's `runHealthCheck` analog). One activity
(`run_health_check_activity`) runs independent checks in parallel — each catching
its own errors → a `CheckResult{name, status: ok|warn|fail|unknown, summary}` —
rolls them up, and emails a color-coded summary to `ADMIN_EMAILS` via `ResendClient`
(idempotency key `health-summary-{date}`; skips when `ADMIN_EMAILS`/`RESEND_API_KEY`
unset; **never throws**). Checks: DB/Redis/Temporal connectivity, snapshot
freshness, errored trips, notification-outbox failures, Groq/Skiplagged daily-budget
usage, last refresh-run outcome (Temporal history), and Axiom error volume
(`unknown` when `AXIOM_QUERY_TOKEN` unset). Subject: `[VPT health] OK|FAIL|WARN|UNKNOWN`.

### PriceCheckWorkflow
Single trip, saga-style (Temporal handles retries/compensation):
1. `search_flights_all` via the active flight provider — Skiplagged (up to
   `max_pages=4`, ~300 results), Kiwi (union of `COVERAGE_QUERIES` samples
   deduped by segment fingerprint — each stateless call returns a varying
   ~15-pairing sample that can miss whole carriers), or fast-flights (Google
   Flights scraper; one ranked page per query) — selected per-fetch by the
   `flight_provider` app setting (`fetch_flights_activity` reads the DB
   setting, so a change applies to the next refresh with no worker restart).
2. `search_hotels_all(max_pages=4)`, then `get_hotel_details` for the top 20
   cheapest hotels (parallel) for room-level data.
3. `filter_results_activity` applies post-fetch filters (see below).
4. Save `PriceSnapshot` (with `raw_data` JSONB for debugging and a `provider`
   marker naming the flight provider the data came from).
5. Check `NotificationRule` thresholds, queue notification events.
6. Push the update to the UI over SSE.

Auto-expires trips past their travel dates (`expire_past_trips`).

### RunOptimizerWorkflow (Phase 4)
Surveys date ranges via the Skiplagged flexible calendar: generate up to 90 date
combinations, fetch in parallel with rate limiting, rank by total price, verify the
top 5 against live data. Gated behind the `beta_optimizer` feature flag (DB
`feature_flags` table; see `app/core/feature_flags.py`).

## Post-fetch filtering (`activities/price_check.py`)

No provider supports these filters natively, so both are applied in-memory
after fetching:

1. **Airlines** — match `trip.flight_prefs.airlines` against carrier codes:
   Kiwi offers carry structured `outbound`/`inbound` segments (read directly);
   fast-flights offers carry an itinerary-level `carrier_codes` list;
   Skiplagged codes are parsed from the `id` field via `parse_flight_segments()`.
2. **Room types / views** — match `preferred_room_types` and `preferred_views`
   against each room's `title` (from `get_hotel_details`) and the hotel's
   `amenityNames`.

## Resilience

- Temporal retries transient network errors automatically; non-retriable errors
  mark the trip `Error`.
- Survives Skiplagged `429`s with backoff and partial snapshots rather than failing
  the whole run.
- Notification events use an outbox-style at-least-once handoff processed by a
  dedicated activity.

## Debugging

Workflow/activity failures are visible in the **Temporal Web UI** (dev:
`http://localhost:8080`). LLM/MCP traces (if the worker calls them) go to Langfuse.
App logs ship to **Axiom** via `app/core/observability.py` (`init_observability("vpt-worker")`
in `worker/__main__.py`) when `AXIOM_TOKEN`/`AXIOM_DATASET` are set; `service=vpt-worker`.
Log with structured fields: `logger.info("msg", extra={"event": "activity.<name>.ok", "trip_id": tid})`.
See the root `CLAUDE.md` Observability section. See `.claude/skills/debugging-prod/SKILL.md`.

## Commit scope

Use `feat(worker): …`, `fix(worker): …`, etc.
