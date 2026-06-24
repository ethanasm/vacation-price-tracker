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

## Workflows

### RefreshAllTripsWorkflow
Orchestrates updating all active trips for a user. Triggered by the manual refresh
button (`POST /v1/trips/refresh-all`) and the daily cron (`daily_refresh_cron`,
default `0 6 * * *`).

### PriceCheckWorkflow
Single trip, saga-style (Temporal handles retries/compensation):
1. `search_flights_all` (up to `max_pages=4`, ~300 results).
2. `search_hotels_all(max_pages=4)`, then `get_hotel_details` for the top 20
   cheapest hotels (parallel) for room-level data.
3. `filter_results_activity` applies post-fetch filters (see below).
4. Save `PriceSnapshot` (with `raw_data` JSONB for debugging).
5. Check `NotificationRule` thresholds, queue notification events.
6. Push the update to the UI over SSE.

Auto-expires trips past their travel dates (`expire_past_trips`).

### RunOptimizerWorkflow (Phase 4)
Surveys date ranges via the Skiplagged flexible calendar: generate up to 90 date
combinations, fetch in parallel with rate limiting, rank by total price, verify the
top 5 against live data. Gated behind the `beta_optimizer` feature flag (DB
`feature_flags` table; see `app/core/feature_flags.py`).

## Post-fetch filtering (`activities/price_check.py`)

Skiplagged supports neither filter natively, so both are applied in-memory after
fetching:

1. **Airlines** — match `trip.flight_prefs.airlines` against carrier codes parsed
   from the Skiplagged `id` field via `parse_flight_segments()`.
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
