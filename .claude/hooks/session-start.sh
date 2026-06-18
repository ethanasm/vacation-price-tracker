#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Makes the vacation-price-tracker stack runnable (and Playwright usable) in a
# fresh remote sandbox: boots dockerd, installs JS deps, generates dev TLS
# certs, stubs .env, brings up the docker-compose stack, waits for the web +
# api to answer, and installs Playwright Chromium (with a Chrome-for-Testing
# fallback if the Playwright CDN is blocked).
#
# Idempotent and resilient: safe to re-run; individual steps degrade to
# warnings rather than aborting the whole hook.

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

# -----------------------------------------------------------------------------
# 1. Docker daemon
# -----------------------------------------------------------------------------
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
if docker info >/dev/null 2>&1; then
  log "docker is up."
else
  warn "docker daemon did not come up; stack steps will likely fail. See /var/log/dockerd.log"
fi

# -----------------------------------------------------------------------------
# 2. JS dependencies (frozen lockfile so we don't dirty the single root lock)
# -----------------------------------------------------------------------------
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

# -----------------------------------------------------------------------------
# 3. Self-signed TLS certs for the HTTPS dev server (certs/*.pem are gitignored)
# -----------------------------------------------------------------------------
step "TLS certs"
CERT_DIR="$PROJECT_DIR/certs"
mkdir -p "$CERT_DIR"
if [ -f "$CERT_DIR/localhost-cert.pem" ] && [ -f "$CERT_DIR/localhost-key.pem" ]; then
  log "certs already present."
else
  log "generating self-signed localhost cert..."
  if openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
      -keyout "$CERT_DIR/localhost-key.pem" \
      -out "$CERT_DIR/localhost-cert.pem" \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1; then
    log "certs generated at certs/localhost-{cert,key}.pem"
  else
    warn "openssl cert generation failed; web container will not start over HTTPS."
  fi
fi

# -----------------------------------------------------------------------------
# 4. Stub .env (docker-compose api/worker use `env_file: .env`)
# -----------------------------------------------------------------------------
step ".env"
if [ -f "$PROJECT_DIR/.env" ]; then
  log ".env already present; leaving it untouched."
elif [ -f "$PROJECT_DIR/.env.example" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  # Give SECRET_KEY a real value and use mock Skiplagged data so the stack can
  # boot without third-party credentials.
  SECRET="$(openssl rand -hex 32 2>/dev/null || echo dev-secret-not-for-production)"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET}|" "$PROJECT_DIR/.env" 2>/dev/null || true
  sed -i "s|^MOCK_SKIPLAGGED_API=.*|MOCK_SKIPLAGGED_API=true|" "$PROJECT_DIR/.env" 2>/dev/null || true
  log "stubbed .env from .env.example (mock Skiplagged data, generated SECRET_KEY)."
else
  warn "no .env or .env.example found; api/worker containers may fail to start."
fi

# -----------------------------------------------------------------------------
# 5. Pre-pull base images with rate-limit / mirror fallback
# -----------------------------------------------------------------------------
step "pull base images"
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
if docker info >/dev/null 2>&1; then
  for img in postgres:15-alpine redis:7-alpine; do
    pull_with_fallback "$img"
  done
fi

# -----------------------------------------------------------------------------
# 6. Bring up the stack
# -----------------------------------------------------------------------------
step "docker compose up"
if docker info >/dev/null 2>&1; then
  if docker compose up -d --build; then
    log "compose stack starting."
  else
    warn "docker compose up failed; retrying once in 5s (transient build/network blips)."
    sleep 5
    if docker compose up -d --build; then
      log "compose stack starting (after retry)."
    else
      warn "docker compose up failed again; bringing up backing services only (db/redis/temporal)."
      docker compose up -d db redis temporal temporal-ui \
        && log "backing services started; app images (api/web/worker) may need a manual build." \
        || warn "could not start backing services either."
    fi
  fi
fi

# -----------------------------------------------------------------------------
# 7. Wait for web + api to answer
# -----------------------------------------------------------------------------
wait_for_url() {
  local url="$1" name="$2" max="${3:-150}"
  log "waiting for $name ($url)..."
  for i in $(seq 1 "$max"); do
    if curl -k -sf -o /dev/null "$url"; then
      log "$name is up (after ${i}x2s)."
      return 0
    fi
    sleep 2
  done
  warn "$name did not become ready within $((max * 2))s."
  return 1
}
if docker info >/dev/null 2>&1; then
  step "wait for stack"
  wait_for_url "$API_HEALTH_URL" "api /health" 150
  wait_for_url "$WEB_URL" "web" 150
fi

# -----------------------------------------------------------------------------
# 8. Playwright Chromium (with Chrome-for-Testing CDN fallback)
# -----------------------------------------------------------------------------
step "Playwright Chromium"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
if pnpm --filter "$WEB_FILTER" exec playwright install chromium; then
  log "chromium installed via Playwright."
else
  warn "Playwright CDN install failed; attempting Chrome-for-Testing fallback."
  # Parse `playwright install --dry-run` for the target install dir + download
  # URL, then pull the matching build from Google's public CfT bucket.
  DRY="$(pnpm --filter "$WEB_FILTER" exec playwright install chromium --dry-run 2>/dev/null)"
  INSTALL_DIR="$(printf '%s\n' "$DRY" | grep -iE 'install location' | head -1 | sed -E 's/.*:[[:space:]]*//')"
  DL_URL="$(printf '%s\n' "$DRY" | grep -iE 'download url' | head -1 | sed -E 's/.*:[[:space:]]*//')"
  CFT_URL="$(printf '%s\n' "$DL_URL" | sed -E 's#https?://[^/]+/#https://storage.googleapis.com/chrome-for-testing-public/#')"
  if [ -n "$INSTALL_DIR" ] && [ -n "$CFT_URL" ]; then
    log "fetching Chrome-for-Testing from $CFT_URL"
    TMP_ZIP="$(mktemp /tmp/chromium-XXXXXX.zip)"
    if curl -fsSL "$CFT_URL" -o "$TMP_ZIP" 2>/dev/null || curl -fsSL "$DL_URL" -o "$TMP_ZIP" 2>/dev/null; then
      mkdir -p "$INSTALL_DIR"
      if unzip -q -o "$TMP_ZIP" -d "$INSTALL_DIR" 2>/dev/null; then
        touch "$INSTALL_DIR/INSTALLATION_COMPLETE"
        log "Chrome-for-Testing unpacked into $INSTALL_DIR"
      else
        warn "failed to unzip Chrome-for-Testing archive."
      fi
      rm -f "$TMP_ZIP"
    else
      warn "could not download Chrome-for-Testing zip; Playwright browser unavailable."
    fi
  else
    warn "could not parse Playwright --dry-run plan; Chromium not installed."
  fi
fi

# -----------------------------------------------------------------------------
# 9. Persist env for the agent shell
# -----------------------------------------------------------------------------
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DATABASE_URL=\"postgresql+asyncpg://postgres:postgres@localhost:5432/vacation_tracker\""
    echo "export PLAYWRIGHT_BROWSERS_PATH=\"$PLAYWRIGHT_BROWSERS_PATH\""
  } >> "$CLAUDE_ENV_FILE"
  log "persisted DATABASE_URL + PLAYWRIGHT_BROWSERS_PATH to agent shell env."
fi

step "done"
log "session-start hook complete."
