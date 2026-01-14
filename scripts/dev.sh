#!/bin/bash
# Development startup script - validates environment and manages services
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="${PROJECT_ROOT}/infra"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Vacation Price Tracker - Development Environment${NC}"
echo "================================================="

# Create .env if missing
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}No .env file found.${NC}"
    if [[ -f "$ENV_EXAMPLE" ]]; then
        read -p "Create from .env.example? [Y/n] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            echo -e "${GREEN}Created .env${NC} - please configure credentials before continuing."
            exit 0
        fi
    fi
    echo -e "${RED}Cannot proceed without .env file.${NC}"
    exit 1
fi

# Validate environment
if ! "${SCRIPT_DIR}/check-env.sh"; then
    exit 1
fi

cd "$INFRA_DIR"

case "${1:-up}" in
    up)
        echo -e "${BLUE}Starting all services...${NC}"
        docker compose up --build "${@:2}"
        ;;
    down)
        echo -e "${BLUE}Stopping all services...${NC}"
        docker compose down "${@:2}"
        ;;
    logs)
        docker compose logs "${@:2}"
        ;;
    ps)
        docker compose ps "${@:2}"
        ;;
    infra)
        echo -e "${BLUE}Starting infrastructure only...${NC}"
        docker compose up -d db redis temporal temporal-ui "${@:2}"
        echo -e "${GREEN}Infrastructure started:${NC}"
        echo "  PostgreSQL:  localhost:5432"
        echo "  Redis:       localhost:6379"
        echo "  Temporal:    localhost:7233"
        echo "  Temporal UI: http://localhost:8080"
        ;;
    *)
        cat <<EOF
Usage: ./scripts/dev.sh [command]

Commands:
  up      Start all services (default)
  down    Stop all services
  logs    View service logs
  ps      List running services
  infra   Start infrastructure only (db, redis, temporal)

Examples:
  ./scripts/dev.sh              # Start all services
  ./scripts/dev.sh up -d        # Start in detached mode
  ./scripts/dev.sh infra        # Start only infrastructure
  ./scripts/dev.sh logs api     # View API logs
EOF
        ;;
esac
