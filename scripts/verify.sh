#!/usr/bin/env bash
# Run all verification steps and show summary table

set -o pipefail

STEPS=(
  "deps|pnpm verify:deps"
  "web:build|pnpm web:build"
  "web:lint|pnpm web:lint"
  "web:typecheck|pnpm web:typecheck"
  "web:test|pnpm web:test:coverage"
  "web:audit|pnpm verify:audit"
  "py:lint|pnpm verify:py:lint"
  "py:test:api|pnpm verify:py:test:api"
  "py:test:worker|pnpm verify:py:test:worker"
  "py:audit|pnpm verify:py:audit"
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
echo "${BOLD}┃           VERIFICATION SUMMARY               ┃${NC}"
echo "${BOLD}┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"

for result in "${RESULTS[@]}"; do
  STATUS="${result%%|*}"
  NAME="${result#*|}"
  if [ "$STATUS" = "pass" ]; then
    printf "┃ ${GREEN}${CHECK}${NC} %-43s┃\n" "$NAME"
  else
    printf "┃ ${RED}${CROSS}${NC} %-43s┃\n" "$NAME"
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
