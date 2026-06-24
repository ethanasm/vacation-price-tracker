# Axiom: bound the schema with a `fields` map field (`vacation-price-tracker-prod`)

## Why

Axiom datasets have a hard per-dataset field cap (256 on our plan). Each unique
top-level or dotted field name across all logged events becomes a permanent
column, and once a dataset is at the cap **every write that introduces a
never-before-seen field is rejected wholesale** — and the rejection appears only
in `docker logs vpt-prod-api`, never in Axiom.

A naive logger (one column per `extra` key, plus a permissive error serializer
that enumerates every attribute on an exception) fills the cap quickly and then
silently drops new events. We avoid that failure mode structurally with a **map
field**.

## The design

Reshape every Axiom-bound log record so only a small fixed allowlist of "core"
fields stay top-level columns and **everything else folds into one map field
named `fields`**. Nested keys inside a map field are stored as key-value pairs in
a **single** column that does **not** count against the per-dataset cap. The
schema is then structurally bounded forever — the cap can't be hit no matter what
keys call-sites log — with no call-site changes. stdout / `docker logs` stay flat
(the reshape runs on the Axiom stream only).

One dataset, `vacation-price-tracker-prod`, serves all three surfaces (api + worker + web),
distinguished by the `service` field (`vpt-api` / `vpt-worker`) and, for browser
events relayed through `POST /v1/telemetry/client`, `component=web.telemetry`.

### Code — `apps/api/app/core/observability.py`

- **`CORE_FIELDS`** — the allowlist of keys that stay top-level columns:
  `_time`, `time`, `level`, `msg`, `event`, `component`, `service`, `env`, `pid`,
  `hostname`, `err`, `reason`, `status`, `duration_ms`, `user_id`, `trip_id`,
  `workflow_id`, `activity`. These are the fields filtered / grouped / aggregated
  in APL. `err` is kept flat and bounded by `serialize_err` /
  `ALLOWED_ERROR_FIELDS` because `err.type` / `err.sqlstate` are hot triage paths.
  Only add a key here when it's genuinely queried as a real column — each entry is
  a permanent column.
- **`reshape_for_axiom(record)`** — pure dict→dict: keep `CORE_FIELDS` at the top
  level, fold every other key under `fields` (omitting `fields` entirely when
  there's nothing to fold). A non-dict input passes through untouched so a line is
  never dropped. A literal top-level `fields` key folds to `fields.fields` —
  `fields` is deliberately NOT in `CORE_FIELDS`.
- **`serialize_err`** — allowlist (`ALLOWED_ERROR_FIELDS`) error serializer:
  standard `type/name/message/stack` plus the asyncpg/SQLAlchemy and httpx shapes
  we actually see, recursing the `__cause__` / `__context__` chain. Never reach
  for a permissive `for attr in dir(exc)` enumeration — that's how the column cap
  gets blown.
- **`VptAxiomHandler`** subclasses `axiom_py.logging.AxiomHandler` and runs the
  reshape in `emit` before buffering. The SDK handler owns batching (flush at 1000
  records or every `interval=1s` via a background `Timer`) and a shutdown flush;
  `init_observability` attaches it only when `AXIOM_TOKEN` + `AXIOM_DATASET` are set.

Result: `CORE_FIELDS` (~18) + bounded `err.*` + `fields` (1) ≈ **~40 columns,
permanently**. Web telemetry adds nothing new — its context keys fold into `fields`.

### Querying folded fields

Core fields query directly; folded fields use map syntax:

```
['vacation-price-tracker-prod']
| where event == "skiplagged.request.retry"
| extend tool = ['fields']['tool_name']
| project _time, service, event, tool, status
```

The dataset and its `fields` map field must be provisioned on the Axiom side
**before the first event ingests** (otherwise `fields` becomes an ordinary
nested column and the bounded-schema design silently fails). Those provisioning
steps are an operator task tracked out-of-band, not in this repo.

## Keeping the schema healthy

- **Ad-hoc keys are not fatal** — `logger.info("…", extra={"new_key": …})` lands
  `new_key` in the `fields` map at zero column cost. Prefer reusing stable keys
  for query ergonomics (a folded field is `['fields']['k']`, costs more
  query-hours, and is stored as a string).
- **Promote into `CORE_FIELDS` deliberately** — only when a key is genuinely
  filtered/grouped/aggregated in APL. Each promotion is a permanent real column.
- **`err` stays flat and allowlisted** — add new error shapes to
  `ALLOWED_ERROR_FIELDS`, never a permissive enumeration shortcut.
