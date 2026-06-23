#!/usr/bin/env bash
# Reproduce the SonarCloud coverage check locally before opening a PR.
#
# CI computes coverage in the Next.js + Python workflows, then a separate
# SonarQube workflow downloads those reports and scans. The scan can silently
# under-report: if a report's file paths don't resolve against the repo root,
# Sonar drops that coverage and shows 0% on new code (no error). This script
# regenerates the exact reports listed in sonar-project.properties and verifies
# they map onto real files — catching that class of failure locally.
#
# Usage:
#   scripts/sonar-local.sh            # generate coverage + verify paths
#   scripts/sonar-local.sh --no-tests # verify existing reports only (fast)
#   scripts/sonar-local.sh --scan     # also run the real scanner (needs SONAR_TOKEN)
#
# Exit non-zero if any coverage path won't resolve in SonarCloud.

set -o pipefail
cd "$(dirname "$0")/.." || exit 1

RUN_TESTS=1
RUN_SCAN=0
for arg in "$@"; do
  case "$arg" in
    --no-tests) RUN_TESTS=0 ;;
    --scan) RUN_SCAN=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if [ "$RUN_TESTS" -eq 1 ]; then
  echo "━━━ Generating coverage (web + api + worker) ━━━"
  # Mirrors the CI targets that feed Sonar. The web target reroots its lcov so
  # paths are repo-root relative (see scripts/lcov-reroot.mjs).
  pnpm nx run-many -t test:coverage --projects=web,api,worker || exit 1
fi

echo ""
echo "━━━ Verifying coverage report paths resolve (the SonarCloud mapping) ━━━"
node scripts/sonar-coverage-check.mjs || exit 1

if [ "$RUN_SCAN" -eq 1 ]; then
  echo ""
  echo "━━━ Running the real SonarCloud scan ━━━"
  if [ -z "${SONAR_TOKEN:-}" ]; then
    echo "SONAR_TOKEN not set — skipping the live scan." >&2
    echo "Export a token (Sonar > My Account > Security) and re-run with --scan." >&2
    exit 1
  fi
  pnpm sonar -Dsonar.token="$SONAR_TOKEN" || exit 1
fi
