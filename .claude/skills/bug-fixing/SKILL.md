---
name: bug-fixing
description: Use when fixing a bug in the vacation-price-tracker codebase. Verifies locally without running Playwright E2E (slow/flaky in the sandbox), then opens a PR and subscribes to CI activity so failures from GitHub Actions can be triaged and patched in-loop.
---

# Bug fixing

## Overview

Playwright E2E is expensive in the local/web sandbox and flakes on environment
differences (browser binaries, ports, the Docker stack). The faster, more
reliable loop is:

1. Reproduce + fix locally.
2. Verify with the **non-E2E** gate (`pnpm verify`, targeted tests).
3. Push the branch, open a PR, let GitHub Actions run the full suite.
4. Subscribe to PR activity and react to CI failures as they arrive.

Do **not** run `pnpm verify --e2e` or `RUN_E2E=1` in the sandbox unless the user
explicitly asks.

## When to use

- The user reports a bug or regression and wants it fixed.
- A failing test (unit, integration, or E2E) needs investigation and repair.
- A PR has CI failures that need to be patched.

## When NOT to use

- Pure refactors with no bug attached.
- Production-only investigations with no code change yet — start with
  `debugging-prod`.

## Loop

### 1. Reproduce and fix

- Read the root `CLAUDE.md` and the relevant per-app guide (`apps/web/CLAUDE.md`,
  `apps/api/CLAUDE.md`, `apps/worker/CLAUDE.md`) before editing.
- Write or extend a test that fails because of the bug, then make it pass.
- Keep the fix minimal — no surrounding cleanup, no speculative refactors.

### 2. Verify locally (no E2E)

Run only what's relevant to the change:

```bash
# Python (api/worker) — note the 95% coverage gate
pnpm nx run api:test:coverage
pnpm nx run worker:test:coverage
# Web
pnpm nx run web:test
# Full local gate (build + lint + typecheck + test:coverage + audits, no E2E)
pnpm verify
```

Skip `pnpm verify --e2e` and any Playwright invocation in the sandbox — CI runs
the full suite, that's the point of step 3.

> Gotcha: a local `.env` with `MOCK_SKIPLAGGED_API=true` makes Nx-run worker
> tests fail (Nx auto-loads `.env`, flipping the worker into mock mode). CI has
> no `.env`, so it's green there. Run with `MOCK_SKIPLAGGED_API=false` locally.

### 3. Hand off to creating-prs

Commit on the assigned development branch, then invoke the `creating-prs` skill —
it owns merge-main, push, PR creation, PR-activity subscription, the CI-failure →
fix → re-push loop, and the `debug-web` hand-off when the diff touches UI.

## Anti-patterns

- Running `pnpm verify --e2e` "just to be sure" before pushing — don't.
- Skipping the PR and asking the user to run E2E themselves — open the PR; CI is
  the loop.
- Pushing speculative fixes without first reading the CI failure log.
- Using `--no-verify` to bypass a failing hook — fix the underlying issue.
