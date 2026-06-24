#!/usr/bin/env bash
# Reproduce the SonarCloud checks locally before opening a PR.
#
# CI computes coverage in the Next.js + Python workflows, then a separate
# SonarQube workflow downloads those reports and runs the scan that evaluates the
# quality gate. The gate has SEVERAL conditions — Coverage, Security, Reliability,
# Maintainability, Duplications. This script can reproduce them at two levels:
#
#   1. Coverage mapping (default, no token): regenerate the exact reports listed
#      in sonar-project.properties and verify their paths resolve against the repo
#      root, so Sonar maps coverage onto real files (a path mismatch silently
#      shows 0% on new code). This is necessary but NOT the whole gate.
#   2. Full gate (--scan, needs SONAR_TOKEN): run the real scanner with
#      `sonar.qualitygate.wait=true`, which uploads the analysis and BLOCKS until
#      SonarCloud returns the gate verdict — failing the command if ANY condition
#      fails, including Security (e.g. a CWE-117 log-injection finding). This is
#      the only faithful local reproduction of "did the gate pass".
#
# Usage:
#   scripts/sonar-local.sh            # generate coverage + verify path mapping
#   scripts/sonar-local.sh --no-tests # verify existing reports only (fast)
#   scripts/sonar-local.sh --scan     # also run the real scanner + wait on the gate
#
# Exit non-zero if a coverage path won't resolve, a test target failed, or (with
# --scan) the quality gate fails.

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

tests_status=0
if [ "$RUN_TESTS" -eq 1 ]; then
  echo "━━━ Generating coverage (web + api + worker) ━━━"
  # Mirrors the CI targets that feed Sonar. The web target reroots its lcov so
  # paths are repo-root relative (see scripts/lcov-reroot.mjs).
  #
  # We do NOT abort on a non-zero exit here: a failing/flaky test target still
  # writes its coverage report, and the report-path validation below is the
  # unique job of this script — it must run regardless so a single red suite
  # doesn't mask a Sonar path-resolution regression. The failure is surfaced in
  # the final summary and folded into the exit code.
  pnpm nx run-many -t test:coverage --projects=web,api,worker || tests_status=$?
  [ "$tests_status" -ne 0 ] && echo "⚠ coverage generation reported failures (see above) — continuing to the path check"
fi

echo ""
echo "━━━ Verifying coverage report paths resolve (the SonarCloud mapping) ━━━"
check_status=0
node scripts/sonar-coverage-check.mjs || check_status=$?

scan_status=0
if [ "$RUN_SCAN" -eq 1 ]; then
  echo ""
  echo "━━━ Running the real SonarCloud scan + waiting on the quality gate ━━━"
  if [ -z "${SONAR_TOKEN:-}" ]; then
    echo "SONAR_TOKEN not set — cannot run the live scan." >&2
    echo "Export a token (Sonar > My Account > Security) and re-run with --scan." >&2
    exit 1
  fi
  # qualitygate.wait makes the scanner poll SonarCloud and exit non-zero if the
  # gate fails on ANY condition — coverage AND security/reliability/maintainability.
  pnpm sonar -Dsonar.token="$SONAR_TOKEN" -Dsonar.qualitygate.wait=true || scan_status=$?
fi

echo ""
echo "━━━ Summary ━━━"
if [ "$check_status" -eq 0 ]; then
  echo "✓ Coverage path check passed — coverage will map onto real files."
else
  echo "✗ Coverage path check FAILED — some coverage would report as 0% (see above)."
fi
if [ "$tests_status" -ne 0 ]; then
  echo "✗ Coverage generation had test failures — reports may be stale; fix the suite for trustworthy numbers."
fi
if [ "$RUN_SCAN" -eq 1 ]; then
  if [ "$scan_status" -eq 0 ]; then
    echo "✓ SonarCloud quality gate PASSED (all conditions, security included)."
  else
    echo "✗ SonarCloud quality gate FAILED — see the project dashboard for the failing condition(s)."
  fi
else
  echo "ℹ Coverage dimension only. The Security / Reliability / Maintainability ratings"
  echo "  were NOT evaluated — re-run with --scan (and a SONAR_TOKEN) for the full gate."
fi

# Fail if the path check failed, a test target failed, or the gate failed.
[ "$check_status" -eq 0 ] && [ "$tests_status" -eq 0 ] && [ "$scan_status" -eq 0 ]
