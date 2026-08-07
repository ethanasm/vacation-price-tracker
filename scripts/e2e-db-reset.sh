#!/usr/bin/env bash
# Rebuild the vpt-e2e database from the Alembic migration chain.
#
# The e2e data is throwaway by design (only the Maestro test user's fixtures),
# so when `alembic upgrade head` cannot run — the stack once spent weeks on a
# schema born from SQLModel create_all, with no alembic_version stamp — the
# recovery is a clean rebuild, not archaeology. Called by deploy.yml's
# "Refresh e2e backend" step as the migrate-failure fallback, and manually via
# `pnpm e2e:db:reset`. Prod is never touched by this script.
set -euo pipefail

compose() {
  docker compose --env-file .env.e2e -f infra/docker-compose.e2e.yml "$@"
}

# Resolve the database name the api actually uses: an explicit DATABASE_URL in
# .env.e2e wins (the compose file only *defaults* it), else the compose
# default. Hardcoding the default here would make the reset silently no-op
# forever if an operator ever pointed DATABASE_URL elsewhere.
DB_NAME="vacation_tracker_e2e"
DB_URL="$(grep -E '^DATABASE_URL=' .env.e2e | tail -1 | cut -d= -f2- || true)"
if [ -n "${DB_URL}" ]; then
  DB_NAME="${DB_URL##*/}"
  DB_NAME="${DB_NAME%%\?*}"
fi
echo "Resetting e2e database '${DB_NAME}' from the migration chain"

# Stop the connection holders BEFORE the drop. The api's SSE poll loop keeps a
# request-scoped session idle-in-transaction; its ACCESS SHARE lock would make
# DROP SCHEMA block indefinitely — and deploy-prod runs with
# cancel-in-progress: false, so one hung reset would wedge every later deploy.
# The lock_timeout is a belt-and-braces bound for anything else holding on.
compose stop api worker

# One -c so all statements share a session (SET lock_timeout applies to the
# DROP). ON_ERROR_STOP so a failed drop exits non-zero instead of "succeeding".
# The GRANT restores initdb's default USAGE for non-owner roles, which a
# hand-created schema otherwise lacks (latent breakage if a read-only role is
# ever added). Temporal is unaffected: it lives in its own databases
# (temporal / temporal_visibility) on this Postgres server, not in ${DB_NAME}.
compose exec -T db psql -U postgres -d "${DB_NAME}" -v ON_ERROR_STOP=1 \
  -c "SET lock_timeout = '15s'; DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO public;"

# Rebuild from the chain (fresh one-off container, new connection).
compose run --rm --entrypoint sh api -c 'cd /app && alembic upgrade head'

# Prove the rebuild landed where a bare /ready (SELECT 1) cannot: the stamped
# revision. Fails the script if the version table didn't materialize.
compose exec -T db psql -U postgres -d "${DB_NAME}" -v ON_ERROR_STOP=1 \
  -tAc 'SELECT version_num FROM alembic_version' | sed 's/^/alembic_version: /'

# Bring the stack back; the api's startup seeding (feature flags / app
# settings) re-runs against the freshly migrated schema.
compose start api worker
