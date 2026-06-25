# CI Refactor Report

Date: 2026-06-24

## Summary

Renamed the two coverage CI workflows to clearer names, fixed every reference
across the codebase, and added a new `mobile.yml` workflow for mobile CI coverage.

## Changes

### 1. Workflow renames (via `git mv`)
- `nextjs.yml` → `web.yml` (display name `Next.js` → `Web`)
- `python.yml` → `server.yml` (display name `Python` → `Server`)

### 2. `web.yml` and `server.yml` paths lists
Both files updated so the two self-referencing path entries now point to the new
filenames (`web.yml`/`server.yml`). The `paths:` lists remain byte-identical
between the two files (diff: empty).

### 3. `sonarqube.yml` fixes
- Comment updated: "Next.js and Python workflows" → "Web and Server workflows"
- `workflows: ["Next.js", "Python"]` → `["Web", "Server"]`
- Download-artifact `workflow: nextjs.yml` → `workflow: web.yml`
- Download-artifact `workflow: python.yml` → `workflow: server.yml`

### 4. Doc reference fixes
- `CLAUDE.md:226`: "Next.js + Python workflows" → "Web + Server workflows"
- `CLAUDE.md:259`: `` `nextjs.yml`/`python.yml` `` → `` `web.yml`/`server.yml` ``
- `.claude/skills/creating-prs/SKILL.md:161`: workflow list updated to include
  `web.yml`, `server.yml`, `mobile.yml`
- `SECURITY_AUDIT.md:182`: filenames updated to `server.yml` and `web.yml`

### 5. New `.github/workflows/mobile.yml`
Gates mobile PRs with: Nx lint/typecheck/test:coverage for the `mobile` project
(enforcing the 80% lib/** coverage threshold), the version-bump unit test, Maestro
flow YAML dry-run, and actionlint on the three mobile workflows. Intentionally
excluded from the Sonar coverage flow to avoid cross-workflow zero-coverage
fragility.

## Verification Results

### Stale-ref grep (must be empty)
```
$ grep -rn "nextjs\.yml\|python\.yml" . | grep -v node_modules | grep -v "/.git/" | grep -v "docs/superpowers/plans/" | grep -v "\.nx/"
(empty — PASS)
```

### Display-name grep in workflows (must be empty)
```
$ grep -rn '"Next.js"\|"Python"' .github/workflows/
(empty — PASS)
```

### actionlint (all 6 workflows)
```
$ docker run --rm -v "$(git rev-parse --show-toplevel)":/repo --workdir /repo rhysd/actionlint:latest -color \
    .github/workflows/web.yml .github/workflows/server.yml \
    .github/workflows/sonarqube.yml .github/workflows/mobile.yml \
    .github/workflows/mobile-deploy.yml .github/workflows/mobile-e2e.yml
(no output — exit 0 — PASS)
```

### Mobile Nx run
```
$ pnpm nx run-many -t lint typecheck test:coverage --projects=mobile
NX  Successfully ran targets lint, typecheck, test:coverage for project mobile
exit=0 — PASS
```

### Bump-mobile-version unit test
```
$ node --test scripts/__tests__/bump-mobile-version.test.mjs
pass 9 / 9 — PASS
```

### Maestro dry-run
```
$ cd apps/mobile && node e2e/scripts/dry-run.mjs e2e/flows
✓ create-trip.yaml  ✓ sign-in.yaml  ✓ trip-detail.yaml  ✓ trips-list.yaml
4 flow file(s) OK — PASS
```

## Files Changed

- `.github/workflows/nextjs.yml` → `.github/workflows/web.yml` (renamed + edited)
- `.github/workflows/python.yml` → `.github/workflows/server.yml` (renamed + edited)
- `.github/workflows/sonarqube.yml` (3 references updated)
- `.github/workflows/mobile.yml` (new file)
- `CLAUDE.md` (2 references updated)
- `.claude/skills/creating-prs/SKILL.md` (1 reference updated)
- `SECURITY_AUDIT.md` (1 reference updated)
- `.superpowers/sdd/ci-refactor-report.md` (this file)
