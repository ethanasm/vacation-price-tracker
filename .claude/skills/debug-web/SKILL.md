---
name: debug-web
description: Screenshot and inspect a web-app route with Playwright while debugging the UI. Use when you need to see what a page actually renders, capture a full-page screenshot of a route (e.g. /trips/<id>, /, /chat), or read browser console / pageerror output for the Next.js frontend at https://localhost:3000.
---

# Debug the web UI with Playwright

A self-serve loop for inspecting the running web app: navigate to any route,
capture a full-page screenshot, and dump console + pageerror output. Backed by
`apps/web/e2e/debug-route.spec.ts`, driven entirely by the `DEBUG_ROUTE` env var.

## When to use this

- You changed a page/component and want to *see* the rendered result.
- A route is misbehaving and you want the browser console / JS errors.
- You need a quick full-page screenshot of a route to reason about layout.

This reuses the e2e auth state, so authenticated routes (e.g. `/trips`,
`/trips/<id>`, `/chat`) render as a logged-in user.

## Prerequisites

The stack must be running and Chromium installed. The SessionStart hook
(`.claude/hooks/session-start.sh`) handles both in Claude Code on the web. If
you're doing this manually:

```bash
# Stack up (web on https://localhost:3000, api on https://localhost:8000)
docker compose up -d
# Chromium for Playwright
pnpm --filter vacation-price-tracker-web exec playwright install chromium
```

Verify the web app responds: `curl -k https://localhost:3000` should return HTML.

## Auth state

The `light` and `dark` Playwright projects load stored auth from
`apps/web/playwright/.auth/user.json` and **depend on the `setup` project**, so
a normal `playwright test` invocation runs `e2e/auth.setup.ts` first and
refreshes the auth state automatically.

If you ever need to (re)generate auth state explicitly:

```bash
pnpm --filter vacation-price-tracker-web exec playwright test e2e/auth.setup.ts --project=setup
```

`auth.setup.ts` primes the CSRF cookie via `GET /health` then calls
`POST /v1/auth/test-login`, so the API must be up.

## Usage

Screenshot a route (light theme):

```bash
DEBUG_ROUTE=/trips/<id> pnpm --filter vacation-price-tracker-web \
  exec playwright test e2e/debug-route.spec.ts --project=light
```

Same route in dark theme:

```bash
DEBUG_ROUTE=/trips/<id> pnpm --filter vacation-price-tracker-web \
  exec playwright test e2e/debug-route.spec.ts --project=dark
```

`DEBUG_ROUTE` defaults to `/` if unset. Pass any path: `/`, `/trips`,
`/trips/new`, `/chat`, etc.

## Where artifacts land

All output goes to `apps/web/e2e/screenshots/` (git-ignored):

- `<route-slug>-<project>.png` — full-page screenshot
  (e.g. `trips-abc-123-light.png`, `root-dark.png`).
- The captured console + pageerror log is attached to the test result and
  printed to the terminal; it's also viewable in the HTML report
  (`apps/web/playwright-report/index.html`).

(Screenshots are written here rather than `playwright-report/` because the HTML
reporter wipes its own directory at the end of each run.)

## Common flows

**Screenshot a route and look at it**

```bash
DEBUG_ROUTE=/trips pnpm --filter vacation-price-tracker-web \
  exec playwright test e2e/debug-route.spec.ts --project=light
# -> open apps/web/e2e/screenshots/trips-light.png
```

**Read console errors for a page** — the spec prints every `[console:*]` and
`[pageerror]` line to stdout as it runs, so the test output is the log. Re-run
against the suspect route and read the terminal.

**Compare light vs dark** — run both `--project=light` and `--project=dark` for
the same `DEBUG_ROUTE`; the two PNGs are suffixed by project name.

## Capturing review-quality screenshots for a PR

When the capture is **review material for a PR** (the `creating-prs` hand-off),
the frame is a quality gate, not decoration. Get the *preferred, fully-rendered*
state — these are the ways it goes wrong:

- **Capture the rendered state, not a loading skeleton (the #1 failure).** The
  debug spec waits for `networkidle`, but VPT routes fetch client-side (trips load
  via the api client, `/trips/<id>` price history, `/chat` SSE) — a slow query can
  still freeze a skeleton. For those, block on the actual content before the shot,
  e.g. `await expect(page.locator('[data-trip-card]').first()).toBeVisible({ timeout: 30_000 })`
  then a short settle, rather than trusting `networkidle` alone.
- **Seed the data the surface needs.** A render-wait still captures an *empty
  state* if the fixture user has no rows. The `e2e` auth state is a logged-in
  user — make sure that user actually has trips / price snapshots / the section
  your change touches. If you can't seed a section, say so in the PR body instead
  of shipping a partial capture.
- **Save each capture the instant it's taken.** Playwright wipes its output
  (`apps/web/e2e/screenshots/`, `test-results/`) at the start of every run, so copy
  the "after" PNG to a scratch dir (the session scratchpad) *before* you run the
  "before" pass — otherwise the before-run silently deletes your after and a later
  step recovers a stale/wrong PNG.
- **Before/after whenever the change is visual** (spacing, sizing, color, copy,
  layout). Screenshot HEAD, copy it aside, then `git checkout HEAD^ -- <changed
  files>`, re-shoot, and restore — never `git stash` on a clean tree (it no-ops
  and yields two "after" shots).
- **Actually open every PNG before posting.** A green Playwright run only proves
  the spec passed — it does **not** prove the frame is the one you want. `Read`
  each capture and confirm it shows the rendered preferred state (right route,
  real data, not a skeleton / spinner / empty state / error / blank page). If it
  doesn't, fix the wait/seed/selector and re-capture before posting. Posting a
  capture you never opened is the most common way this ships misleading material.

## Debugging prod instead?

This skill is for the **local** UI (you have the dev stack and a browser). For a
**production** issue — live 5xx, wrong/stale tracked prices, a stuck price-check
workflow, missing notifications — use the **debugging-prod** skill
(`.claude/skills/debugging-prod/SKILL.md`), which reads prod's logs, database
(`pnpm prod:query`), Temporal UI, Langfuse, and `/ready` probe instead.

## Notes

- The spec waits for `networkidle` before screenshotting, so client-side data
  fetches have a chance to settle.
- `playwright.config.ts` uses `webServer.reuseExistingServer: true` against
  `https://localhost:3000`, so it drives the already-running Docker stack rather
  than booting its own server.
- This spec is excluded from CI/Jest (Jest only matches `*.test.{ts,tsx}`).
