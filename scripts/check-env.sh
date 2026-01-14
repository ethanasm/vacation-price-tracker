#!/bin/bash
# Validates required environment variables for Phase 1
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"

echo "Checking environment configuration..."

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}ERROR: .env file not found${NC}" >&2
    echo "Create one with: cp .env.example .env"
    exit 1
fi

set -a && source "$ENV_FILE" && set +a

REQUIRED_VARS=(
    "DATABASE_URL"
    "REDIS_URL"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "SECRET_KEY"
    "AMADEUS_API_KEY"
    "AMADEUS_API_SECRET"
)

MISSING_VARS=()
PLACEHOLDER_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    value="${!var}"
    if [[ -z "$value" ]]; then
        MISSING_VARS+=("$var")
    elif [[ "$value" =~ (your|generate|placeholder) ]]; then
        PLACEHOLDER_VARS+=("$var")
    fi
done

if [[ ${#MISSING_VARS[@]} -eq 0 ]] && [[ ${#PLACEHOLDER_VARS[@]} -eq 0 ]]; then
    echo -e "${GREEN}All required environment variables are configured.${NC}"
    exit 0
fi

[[ ${#MISSING_VARS[@]} -gt 0 ]] && {
    echo -e "${RED}Missing required variables:${NC}"
    printf '  - %s\n' "${MISSING_VARS[@]}"
}

[[ ${#PLACEHOLDER_VARS[@]} -gt 0 ]] && {
    echo -e "${YELLOW}Variables with placeholder values:${NC}"
    printf '  - %s\n' "${PLACEHOLDER_VARS[@]}"
}

echo ""
echo "Reference:"
echo "  - Google OAuth: https://console.cloud.google.com/apis/credentials"
echo "  - Amadeus API:  https://developers.amadeus.com"
echo "  - SECRET_KEY:   openssl rand -hex 32"

exit 1
