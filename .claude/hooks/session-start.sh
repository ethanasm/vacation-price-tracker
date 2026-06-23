#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Makes the vacation-price-tracker stack runnable (and Playwright usable) in a
# fresh remote sandbox. The platform BLOCKS session readiness until this hook
# returns, so the hook must finish fast: only the quick, agent-essential setup
# runs synchronously (dockerd, JS deps, certs, .env). The slow parts — building
# the app images, `docker compose up`, waiting for web/api, and installing
# Playwright Chromium — are detached into a background "warm" pass so the
# session becomes usable immediately and the stack finishes coming up behind it.
#
# Progress for the background pass: /var/log/session-start-stack.log
#
# Idempotent and resilient: safe to re-run; individual steps degrade to
# warnings rather than aborting.

set -uo pipefail

# --- only run in the remote (Claude Code on the web) sandbox -----------------
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "[session-start] not a remote sandbox (CLAUDE_CODE_REMOTE != true); skipping."
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR" || exit 0

WEB_FILTER="vacation-price-tracker-web"
WEB_URL="https://localhost:3000"
API_HEALTH_URL="https://localhost:8000/health"

log()  { echo "[session-start] $*"; }
warn() { echo "[session-start][warn] $*" >&2; }
step() { echo ""; echo "[session-start] === $* ==="; }

# =============================================================================
# Background "warm" pass — invoked as `session-start.sh --warm`, fully detached
# from the hook so it can take minutes without blocking session readiness.
# =============================================================================
if [ "${1:-}" = "--warm" ]; then
  pull_with_fallback() {
    local image="$1"
    docker image inspect "$image" >/dev/null 2>&1 && return 0
    docker pull "$image" >/dev/null 2>&1 && return 0
    warn "direct pull of $image failed; trying mirrors..."
    local short="${image#docker.io/}"
    short="${short#library/}"
    for mirror in "mirror.gcr.io/library/$short" "public.ecr.aws/docker/library/$short"; do
      if docker pull "$mirror" >/dev/null 2>&1; then
        docker tag "$mirror" "$image" && { log "pulled $image via $mirror"; return 0; }
      fi
    done
    warn "could not pull $image from any source."
    return 1
  }

  wait_for_url() {
    local url="$1" name="$2" max="${3:-60}"
    log "waiting for $name ($url)..."
    for i in $(seq 1 "$max"); do
      curl -k -sf -o /dev/null "$url" && { log "$name is up (after ${i}x2s)."; return 0; }
      sleep 2
    done
    warn "$name did not become ready within $((max * 2))s."
    return 1
  }

  docker info >/dev/null 2>&1 || { warn "docker not available; warm pass aborting."; exit 0; }

  step "pull base images"
  for img in postgres:15-alpine redis:7-alpine; do
    pull_with_fallback "$img"
  done

  step "docker compose up"
  if ! docker compose up -d --build; then
    warn "docker compose up failed; bringing up backing services only (db/redis/temporal)."
    docker compose up -d db redis temporal temporal-ui \
      && log "backing services started; app images may need a manual build." \
      || warn "could not start backing services either."
  fi

  step "wait for stack"
  wait_for_url "$API_HEALTH_URL" "api /health" 60
  wait_for_url "$WEB_URL" "web" 60

  step "Playwright Chromium"
  export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
  mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
  if pnpm --filter "$WEB_FILTER" exec playwright install chromium; then
    log "chromium installed via Playwright."
  else
    warn "Playwright CDN install failed; attempting Chrome-for-Testing fallback."
    DRY="$(pnpm --filter "$WEB_FILTER" exec playwright install chromium --dry-run 2>/dev/null)"
    INSTALL_DIR="$(printf '%s\n' "$DRY" | grep -iE 'install location' | head -1 | sed -E 's/.*:[[:space:]]*//')"
    DL_URL="$(printf '%s\n' "$DRY" | grep -iE 'download url' | head -1 | sed -E 's/.*:[[:space:]]*//')"
    CFT_URL="$(printf '%s\n' "$DL_URL" | sed -E 's#https?://[^/]+/#https://storage.googleapis.com/chrome-for-testing-public/#')"
    if [ -n "$INSTALL_DIR" ] && [ -n "$CFT_URL" ]; then
      TMP_ZIP="$(mktemp /tmp/chromium-XXXXXX.zip)"
      if curl -fsSL "$CFT_URL" -o "$TMP_ZIP" 2>/dev/null || curl -fsSL "$DL_URL" -o "$TMP_ZIP" 2>/dev/null; then
        mkdir -p "$INSTALL_DIR"
        unzip -q -o "$TMP_ZIP" -d "$INSTALL_DIR" 2>/dev/null \
          && touch "$INSTALL_DIR/INSTALLATION_COMPLETE" \
          && log "Chrome-for-Testing unpacked into $INSTALL_DIR"
        rm -f "$TMP_ZIP"
      else
        warn "could not download Chrome-for-Testing zip; Playwright browser unavailable."
      fi
    else
      warn "could not parse Playwright --dry-run plan; Chromium not installed."
    fi
  fi

  step "warm pass done"
  log "background stack warmup complete."
  exit 0
fi

# =============================================================================
# Synchronous (fast) setup — must keep the hook short so the session is usable.
# =============================================================================

# 1. Docker daemon (bounded ~30s).
step "Docker daemon"
if ! docker info >/dev/null 2>&1; then
  log "dockerd not responding; starting it..."
  rm -f /var/run/docker.pid 2>/dev/null || true
  nohup dockerd >/var/log/dockerd.log 2>&1 &
  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
docker info >/dev/null 2>&1 && log "docker is up." \
  || warn "docker daemon did not come up; see /var/log/dockerd.log"

# 2. JS dependencies (frozen lockfile so we don't dirty the single root lock).
step "pnpm install"
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@9.12.1 --activate >/dev/null 2>&1 || true
fi
if pnpm install --frozen-lockfile --prefer-offline; then
  log "dependencies installed."
else
  warn "pnpm install --frozen-lockfile failed; retrying without --prefer-offline."
  pnpm install --frozen-lockfile || warn "pnpm install still failing."
fi

# 3. Self-signed TLS certs for the HTTPS dev server (certs/*.pem are gitignored).
step "TLS certs"
CERT_DIR="$PROJECT_DIR/certs"
mkdir -p "$CERT_DIR"
if [ -f "$CERT_DIR/localhost-cert.pem" ] && [ -f "$CERT_DIR/localhost-key.pem" ]; then
  log "certs already present."
else
  log "generating self-signed localhost cert..."
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "$CERT_DIR/localhost-key.pem" \
    -out "$CERT_DIR/localhost-cert.pem" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1 \
    && log "certs generated." \
    || warn "openssl cert generation failed; web container won't start over HTTPS."
fi

# 4. Stub .env (docker-compose api/worker use `env_file: .env`).
step ".env"
if [ -f "$PROJECT_DIR/.env" ]; then
  log ".env already present; leaving it untouched."
elif [ -f "$PROJECT_DIR/.env.example" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  SECRET="$(openssl rand -hex 32 2>/dev/null || echo dev-secret-not-for-production)"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET}|" "$PROJECT_DIR/.env" 2>/dev/null || true
  sed -i "s|^MOCK_SKIPLAGGED_API=.*|MOCK_SKIPLAGGED_API=true|" "$PROJECT_DIR/.env" 2>/dev/null || true
  log "stubbed .env from .env.example (mock Skiplagged data, generated SECRET_KEY)."
else
  warn "no .env or .env.example found; api/worker containers may fail to start."
fi

# 5. Launch the slow stack warmup DETACHED so it can't block session readiness.
step "background stack warmup"
if docker info >/dev/null 2>&1; then
  setsid bash "${BASH_SOURCE[0]}" --warm >/var/log/session-start-stack.log 2>&1 </dev/null &
  log "stack warmup detached (progress: tail -f /var/log/session-start-stack.log)."
else
  warn "docker not available; skipping stack warmup."
fi

# 6. Persist env for the agent shell.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DATABASE_URL=\"postgresql+asyncpg://postgres:postgres@localhost:5432/vacation_tracker\""
    echo "export PLAYWRIGHT_BROWSERS_PATH=\"${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}\""
  } >> "$CLAUDE_ENV_FILE"
  log "persisted DATABASE_URL + PLAYWRIGHT_BROWSERS_PATH to agent shell env."
fi

step "done"
log "session-start hook complete (stack warming in background)."
exit 0
