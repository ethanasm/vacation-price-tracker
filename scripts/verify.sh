#!/usr/bin/env bash
# Run all verification steps and show summary table

set -o pipefail

STEPS=(
  "deps|pnpm install --frozen-lockfile && uv sync --extra dev"
  "web:build|pnpm --filter vacation-price-tracker-web build"
  "web:lint|pnpm --filter vacation-price-tracker-web lint"
  "web:typecheck|pnpm --filter vacation-price-tracker-web typecheck"
  "web:test|pnpm --filter vacation-price-tracker-web test:coverage"
  "npm:audit|pnpm audit --prod"
  "py:lint|uv run ruff check apps/api apps/worker"
  "py:test:api|uv run pytest apps/api/tests -v --cov=app --cov-fail-under=95 --cov-report=xml:apps/api/coverage.xml"
  "py:test:worker|uv run pytest apps/worker/tests -v --cov=worker --cov-fail-under=95 --cov-report=xml:apps/worker/coverage.xml"
  "py:audit|uv run pip-audit --ignore-vuln CVE-2024-23342"
)

GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
PURPLE=$'\033[0;35m'
BOLD=$'\033[1m'
NC=$'\033[0m'
CHECK="✓"
CROSS="✗"

RESULTS=()
FAILED=0

for step in "${STEPS[@]}"; do
  NAME="${step%%|*}"
  CMD="${step#*|}"

  echo ""
  echo "${PURPLE}${BOLD}━━━ Running: $NAME ━━━${NC}"

  if eval "$CMD"; then
    RESULTS+=("pass|$NAME")
  else
    RESULTS+=("fail|$NAME")
    FAILED=1
  fi
done

echo ""
echo "${BOLD}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
echo "${BOLD}┃           VERIFICATION SUMMARY              ┃${NC}"
echo "${BOLD}┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"

for result in "${RESULTS[@]}"; do
  STATUS="${result%%|*}"
  NAME="${result#*|}"
  if [ "$STATUS" = "pass" ]; then
    printf "┃ ${GREEN}${CHECK}${NC}  %-40s ┃\n" "$NAME"
  else
    printf "┃ ${RED}${CROSS}${NC}  %-40s ┃\n" "$NAME"
  fi
done

echo "${BOLD}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "${RED}${BOLD}Some checks failed!${NC}"
  exit 1
else
  echo ""
  echo "${GREEN}${BOLD}All checks passed!${NC}"
  exit 0
fi
