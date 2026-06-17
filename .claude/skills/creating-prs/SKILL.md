---
name: creating-prs
description: Use after committing changes that need to ship. Merges latest main, pushes the branch, opens the PR via the GitHub MCP tools, subscribes to PR activity so CI failures stream back, and (when the diff touches UI) uses the debug-web skill to attach visual review material to the PR description.
---

# Creating PRs

## Overview

The bug-fix, refactor, and feature loops all end the same way: merge latest
main, push, open a PR, watch CI. This skill owns that tail so other work can
delegate instead of re-implementing it. It also decides whether the PR needs
visual review material attached and uses the `debug-web` skill to capture it.

This repo is `ethanasm/vacation-price-tracker`; the default base branch is
`main`. Feature work happens on `claude/*` branches.

## When to use

- A change is committed locally, the verify gate is green, and it's time to ship.
- The user asks "open a PR" or "ship this".

Per the environment rules, **only open a PR when the user explicitly asks.**
Committing/pushing to the feature branch is fine without a PR.

## When NOT to use

- The change is still WIP and the user hasn't asked to push it.
- A PR already exists for this branch — re-push and let the existing
  subscription stream new CI events instead of opening a second PR.

## Loop

### 1. Merge latest `main` into the branch

Fetch and merge current `origin/main` so the PR is reviewed against (and CI
runs against) an up-to-date base, catching interaction conflicts locally:

    git fetch origin main
    git merge origin/main --no-edit

If `git merge` reports conflicts, resolve them, re-stage, and commit the merge
before continuing. If the merge pulls in a non-trivial diff outside the
branch's own files, re-run `pnpm verify` so the local gate still reflects what
ships.

The web-sandbox checkout is a **shallow clone**: `git fetch origin main` brings
in just the commits needed for the merge base. Don't `git fetch --unshallow`,
don't rebase onto main, and don't merge from a non-`origin` remote.

### 2. Run the verify gate, then push

Make sure the change passes before opening the PR:

    pnpm verify

Then push (retry up to 4× with exponential backoff — 2s, 4s, 8s, 16s — on
network errors only; debug non-network failures rather than retrying):

    git push -u origin <branch>

### 3. Open the PR

Use `mcp__github__create_pull_request` with
`owner: "ethanasm", repo: "vacation-price-tracker", base: "main"`.

- **Title** is a Conventional Commit — `type(scope): imperative summary`, under
  70 chars. Types: `feat` `fix` `docs` `refactor` `test` `chore`. Scopes:
  `web` `api` `worker` `mcp-server`, or no scope for repo-wide changes (see
  CLAUDE.md → Commit Message Conventions).
- **Body** has `## Summary` (1–3 bullets) and `## Test plan` (markdown
  checklist). End the PR body with the required harness footer:

      🤖 Generated with [Claude Code](https://claude.com/claude-code)

      https://claude.ai/code/session_01CLU2qzji7MCM2UREz8yaZR

Tell the user the PR URL as soon as it's created.

### 4. Attach visual review material if the diff touches UI

Run `git diff --name-only main...HEAD` and match against the web UI paths:

- `apps/web/src/app/**`
- `apps/web/src/components/**`
- `apps/web/src/context/**`
- `apps/web/src/hooks/**`
- `apps/web/src/lib/**/*.tsx`

If anything matches, map the touched files to the affected routes (e.g.
`src/app/trips/[tripId]/page.tsx` → `/trips/<id>`) and use the **`debug-web`**
skill to capture full-page screenshots in both `--project=light` and
`--project=dark`. Capture **before and after** where layout changed (screenshot
HEAD, then `git checkout HEAD^ -- <changed files>`, re-shoot, restore — never
`git stash` on a clean tree, it silently no-ops and yields two "after" shots).

Host the PNGs on an orphan `pr-screenshots` branch and reference them in the PR
body via `https://github.com/ethanasm/vacation-price-tracker/raw/pr-screenshots/...`
— never commit screenshots to `main` or the PR branch. If nothing matches, skip
this step.

### 5. Subscribe to CI activity

    mcp__github__subscribe_pr_activity { owner: "ethanasm", repo: "vacation-price-tracker", pullNumber: <n> }

Events arrive wrapped in `<github-webhook-activity>` tags. CI for this repo runs
`nextjs.yml` (web build/lint/test), `python.yml` (api + worker), and
`sonarqube.yml`. While CI runs you can move on to other work.

### 6. React to events

When a failure event arrives:

1. Pull the failing job's logs via `mcp__github__get_job_logs` and identify the
   failing check plus its assertion or stack frame.
2. Decide if it's a real regression in the diff, a pre-existing flake, or an
   environment issue.
3. If it's a real failure, fix it locally, re-run the relevant gate
   (`pnpm verify` or the targeted Nx task), and push — CI re-runs
   automatically.
4. Repeat until CI is green. Unsubscribe with
   `mcp__github__unsubscribe_pr_activity` once the PR is merged or the user
   releases you.

For review-comment events: if the suggestion is clear and not architecturally
significant, apply it; if it's ambiguous, ask the user before acting.

## Anti-patterns

- Pushing to `main` directly — always go through a PR.
- Opening a PR the user didn't ask for — the harness forbids it.
- Force-pushing to a PR branch without telling the user.
- Skipping the screenshots section on UI changes — reviewers shouldn't have to
  pull the branch to see what changed visually.
- Committing screenshots to `main` or the PR branch instead of the orphan
  `pr-screenshots` branch.
- Using `--no-verify` to bypass a failing hook — fix the underlying issue.
