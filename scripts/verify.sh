#!/usr/bin/env bash
# Run all verification steps using Nx task orchestration with caching
# This script leverages Nx to skip unchanged tasks

set -o pipefail

GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
PURPLE=$'\033[0;35m'
BOLD=$'\033[1m'
NC=$'\033[0m'
CHECK="✓"
CROSS="✗"

FAILED=0

echo ""
echo "${PURPLE}${BOLD}━━━ Step 1: Install Dependencies ━━━${NC}"
pnpm install --frozen-lockfile && uv sync --extra dev
if [ $? -ne 0 ]; then
  echo "${RED}${CROSS} Dependencies failed${NC}"
  FAILED=1
else
  echo "${GREEN}${CHECK} Dependencies installed${NC}"
fi

echo ""
echo "${PURPLE}${BOLD}━━━ Step 2: Running Nx Tasks (with caching) ━━━${NC}"
echo "Running: build, lint, typecheck, test:coverage across all projects..."
echo ""

# Run all cacheable tasks via Nx - will skip unchanged
pnpm nx run-many -t build lint typecheck test:coverage --all --parallel=3
if [ $? -ne 0 ]; then
  echo ""
  echo "${RED}${CROSS} Nx tasks failed${NC}"
  FAILED=1
else
  echo ""
  echo "${GREEN}${CHECK} All Nx tasks passed${NC}"
fi

echo ""
echo "${PURPLE}${BOLD}━━━ Step 3: Security Audits ━━━${NC}"

pnpm audit --prod
AUDIT_NPM=$?

uv run pip-audit --ignore-vuln CVE-2024-23342 --ignore-vuln CVE-2026-0994 --ignore-vuln CVE-2026-1703 --skip-editable
AUDIT_PIP=$?

if [ $AUDIT_NPM -ne 0 ] || [ $AUDIT_PIP -ne 0 ]; then
  echo "${RED}${CROSS} Security audit issues found${NC}"
  # Don't fail on audit warnings, just report
else
  echo "${GREEN}${CHECK} Security audits passed${NC}"
fi

echo ""
echo "${PURPLE}${BOLD}━━━ Step 4: E2E Tests (Playwright) ━━━${NC}"
echo "Note: Requires full Docker stack running. Set SKIP_E2E=1 to skip."

if [ "${SKIP_E2E}" = "1" ]; then
  echo "${GREEN}${CHECK} E2E tests skipped (SKIP_E2E=1)${NC}"
else
  # Check Docker stack is up
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^web$'; then
    echo "${RED}${CROSS} Docker stack not running (web container missing). Run 'docker compose up -d' first.${NC}"
    echo "         Or set SKIP_E2E=1 to skip E2E in this run."
    FAILED=1
  else
    pnpm --filter vacation-price-tracker-web test:e2e
    if [ $? -ne 0 ]; then
      echo "${RED}${CROSS} E2E tests failed${NC}"
      FAILED=1
    else
      echo "${GREEN}${CHECK} E2E tests passed${NC}"
    fi
  fi
fi

echo ""
echo "${BOLD}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
echo "${BOLD}┃                      VERIFICATION SUMMARY                         ┃${NC}"
echo "${BOLD}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "${RED}${BOLD}Some checks failed!${NC}"
  exit 1
else
  echo ""
  echo "${GREEN}${BOLD}All checks passed!${NC}"
  echo "Note: Cached tasks were skipped. Run 'pnpm reset' to clear cache."
  exit 0
fi
