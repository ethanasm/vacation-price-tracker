# apps/web — Next.js Frontend

Next.js 14 (App Router) + Tailwind + shadcn/ui + assistant-ui. Talks to the
FastAPI backend over HTTP (`NEXT_PUBLIC_API_URL`); it never touches Postgres
directly. Nx project name: `vacation-price-tracker-web`.

See the root `CLAUDE.md` for repo-wide conventions (commit style, `pnpm verify`,
Docker dev stack).

## File naming

**Use kebab-case for all new files** in `apps/web/` (`trip-form.tsx`, not
`TripForm.tsx`).

## Layout

```
apps/web/src/
├── app/                 # App Router routes (/, /chat, /trips/[tripId])
├── components/          # ui/ (shadcn), chat/, dashboard/, trip-form/
├── hooks/  lib/         # hooks, api client (lib/api), fixtures
├── context/  data/
└── __tests__/           # Jest tests (components, hooks, lib, integration)
```

## Nx targets

| Command | What it does |
|---------|--------------|
| `pnpm nx run web:build` | Production build |
| `pnpm nx run web:lint` | Biome lint |
| `pnpm nx run web:typecheck` | `tsc --noEmit` |
| `pnpm nx run web:test` | Jest |
| `pnpm nx run web:test:coverage` | Jest with coverage (feeds SonarQube) |
| `pnpm nx run web:dev` | HTTPS dev server (uses `./certs` if present) |
| `pnpm nx run web:dev:http` | Plain HTTP dev server |

## Lockfile rule

**Single root `pnpm-lock.yaml`.** Run pnpm from the repo root, or use
`pnpm --filter vacation-price-tracker-web …`. Never run bare `pnpm install` inside
`apps/web/` — it generates a stray `apps/web/pnpm-lock.yaml` that breaks the
frozen-lockfile CI step.

## Flight offer rendering

Each flight offer card must show **all segments** of the complete itinerary,
rendered by `ItinerarySection` and `SegmentRow` in
`src/app/trips/[tripId]/page.tsx`:

- **Outbound:** every segment origin → destination (including connections).
- **Return:** every segment back to origin (round trips).
- **Per segment:** flight number (e.g. `AC744`, parsed server-side from the
  Skiplagged `id`), route (`SFO → DEN`), departure/arrival times, duration.
- **Layovers:** time + airport between connecting segments
  (`1h 30m layover in DEN`).
- **Price:** total for the entire itinerary (all segments combined).

Flight numbers arrive already parsed from the API (`FlightSegment` /
`FlightItinerary` schemas) — the web app does not parse Skiplagged `id` strings.

## Error UX

Transient errors → toasts (error boundaries). Load failures → empty states. Live
price updates stream in over SSE from the API.

## Client telemetry (Axiom)

The browser never ships to Axiom directly. Report genuine client errors with
`logClientEvent(event, { message, level, context })` from `src/lib/telemetry.ts`
(best-effort `fetch(keepalive)` to `POST /v1/telemetry/client`, swallows network
errors). The API prefixes the event with `web.` and ships it to the shared dataset
under `component=web.telemetry`. `context` keys are server-allowlisted (status,
http_status, code, path, route, trip_id, conversation_id, stage, type, elapsed_ms,
reason). Keep existing `console.error` for local dev visibility; add the
`logClientEvent` call alongside it.

## Deployment

The web app is hosted on **Vercel** (preview deploys, global CDN). Set
`NEXT_PUBLIC_API_URL` in Vercel to the FastAPI backend URL. The self-hosted prod
stack (`infra/docker-compose.prod.yml`) also builds a `web` image for parity.

## Debugging the running UI

Use the **debug-web** skill (`.claude/skills/debug-web/`) to screenshot a route and
read console/pageerror output via Playwright against `https://localhost:3000`.

## Commit scope

Use `feat(web): …`, `fix(web): …`, etc.
