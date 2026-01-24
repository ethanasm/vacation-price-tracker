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
COVERAGE=()
FAILED=0

# Function to extract Jest coverage from output
extract_jest_coverage() {
  local output="$1"
  # Jest coverage summary line format: "All files | xx.xx | xx.xx | xx.xx | xx.xx |"
  local coverage_line
  coverage_line=$(echo "$output" | grep "All files" | tail -1)
  if [ -n "$coverage_line" ]; then
    # Extract percentages: statements, branches, functions, lines
    local stmts branch funcs lines
    stmts=$(echo "$coverage_line" | awk -F'|' '{gsub(/[ ]+/, "", $2); print $2}')
    branch=$(echo "$coverage_line" | awk -F'|' '{gsub(/[ ]+/, "", $3); print $3}')
    funcs=$(echo "$coverage_line" | awk -F'|' '{gsub(/[ ]+/, "", $4); print $4}')
    lines=$(echo "$coverage_line" | awk -F'|' '{gsub(/[ ]+/, "", $5); print $5}')
    # Format: B: branch%, L: lines%, F: funcs%, O: stmts% (overall/statements)
    echo "(B: ${branch}%, L: ${lines}%, F: ${funcs}%, O: ${stmts}%)"
  fi
}

# Function to extract pytest coverage from output
extract_pytest_coverage() {
  local output="$1"
  # Pytest coverage line format: "TOTAL    xxx    xx    xx%"
  local coverage_line
  coverage_line=$(echo "$output" | grep "^TOTAL" | tail -1)
  if [ -n "$coverage_line" ]; then
    local pct
    pct=$(echo "$coverage_line" | awk '{print $NF}' | tr -d '%')
    echo "(${pct}%)"
  fi
}

for step in "${STEPS[@]}"; do
  NAME="${step%%|*}"
  CMD="${step#*|}"

  echo ""
  echo "${PURPLE}${BOLD}━━━ Running: $NAME ━━━${NC}"

  # Capture output for coverage extraction
  OUTPUT=$(eval "$CMD" 2>&1)
  EXIT_CODE=$?
  echo "$OUTPUT"

  if [ $EXIT_CODE -eq 0 ]; then
    RESULTS+=("pass|$NAME")
  else
    RESULTS+=("fail|$NAME")
    FAILED=1
  fi

  # Extract coverage for test steps
  case "$NAME" in
    web:test)
      COV=$(extract_jest_coverage "$OUTPUT")
      COVERAGE+=("$NAME|$COV")
      ;;
    py:test:api|py:test:worker)
      COV=$(extract_pytest_coverage "$OUTPUT")
      COVERAGE+=("$NAME|$COV")
      ;;
    *)
      COVERAGE+=("$NAME|")
      ;;
  esac
done

echo ""
echo "${BOLD}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
echo "${BOLD}┃                      VERIFICATION SUMMARY                         ┃${NC}"
echo "${BOLD}┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫${NC}"

for i in "${!RESULTS[@]}"; do
  result="${RESULTS[$i]}"
  STATUS="${result%%|*}"
  NAME="${result#*|}"

  # Get coverage for this step
  COV=""
  for cov_entry in "${COVERAGE[@]}"; do
    COV_NAME="${cov_entry%%|*}"
    COV_VAL="${cov_entry#*|}"
    if [ "$COV_NAME" = "$NAME" ] && [ -n "$COV_VAL" ]; then
      COV=" $COV_VAL"
      break
    fi
  done

  DISPLAY_NAME="${NAME}${COV}"

  if [ "$STATUS" = "pass" ]; then
    printf "┃ ${GREEN}${CHECK}${NC} %-65s┃\n" "$DISPLAY_NAME"
  else
    printf "┃ ${RED}${CROSS}${NC} %-65s┃\n" "$DISPLAY_NAME"
  fi
done

echo "${BOLD}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "${RED}${BOLD}Some checks failed!${NC}"
  exit 1
else
  echo ""
  echo "${GREEN}${BOLD}All checks passed!${NC}"
  exit 0
fi
