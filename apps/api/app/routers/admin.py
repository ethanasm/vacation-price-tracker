"""Read-only diagnostic SQL endpoint for the operator (and Claude Code).

`POST /v1/admin/sql` lets a holder of `ADMIN_QUERY_TOKEN` run arbitrary
read-only SQL against the prod database over HTTPS, without exposing Postgres
on the LAN or shipping a separate `psql` tunnel. It is the FastAPI counterpart
of showbook's `/api/admin/sql` (showbook's DB is owned by Next.js; VPT's is
owned by this app).

Request:
    Authorization: Bearer <ADMIN_QUERY_TOKEN>
    Content-Type: application/json
    {"query": "SELECT count(*) FROM trips"}

Response 200:
    {"rows": [...], "rowCount": <int>, "truncated": <bool>, "elapsedMs": <int>}

Errors: 401 unauthorized · 400 bad_request · 422 query_rejected ·
429 rate_limited · 500 server_error · 504 timeout.

Defense in depth (deepest-first):
  1. Bearer token, timing-safe compare against `ADMIN_QUERY_TOKEN` (>= 32 chars
     or the endpoint refuses to enable itself).
  2. READ ONLY transaction on Postgres (`SET TRANSACTION READ ONLY`) so the
     engine itself rejects writes (SQLSTATE 25006). Every query is rolled back
     regardless of dialect, so nothing a statement attempts can persist.
  3. Per-statement `statement_timeout` (Postgres) so a runaway query can't pin
     a backend.
  4. Prefix allowlist (`app.core.admin_query`) for friendly early rejection.
  5. Row cap so a `SELECT *` from a huge table can't exhaust memory.
  6. Per-IP rate limit so a leaked token can't be used to hammer the database.
"""

from __future__ import annotations

import hmac
import ipaddress
import json
import logging
import math
import time
from collections.abc import AsyncGenerator
from datetime import date, datetime
from datetime import time as dtime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.admin_query import validate_admin_query
from app.core.app_settings import (
    canonical_setting_name,
    canonical_setting_value,
    list_app_settings,
    set_app_setting,
)
from app.core.config import settings
from app.core.feature_flags import canonical_flag_name, list_feature_flags, set_feature_flag
from app.db.deps import get_db
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/admin", tags=["admin"])

MAX_ROWS = 1000
STATEMENT_TIMEOUT_MS = 3000
RATE_LIMIT_MAX = 30
RATE_LIMIT_WINDOW_SECONDS = 60
MIN_TOKEN_LENGTH = 32


def _json_default(obj: object) -> object:
    """Best-effort JSON coercion for DB-native types the stdlib encoder rejects.

    The endpoint returns arbitrary query results, so a column typed
    date / timestamp / numeric / uuid / bytea comes back as a Python
    ``date``/``datetime``/``Decimal``/``UUID``/``bytes`` that ``json.dumps``
    cannot encode. Because the response is rendered *after* the handler's
    try/except, such a ``TypeError`` would escape as an opaque 500 (forcing
    callers to ``::text``-cast every date/numeric column). Coerce the known
    types, and fall back to ``str()`` for anything else. Non-finite floats
    (``NaN``/``Infinity`` from a real/double column) are *not* routed here —
    they are handled in :meth:`_RowsJSONResponse.render` — but between the two,
    no column type can 500 this debug endpoint.
    """
    if isinstance(obj, (datetime, date, dtime)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return str(obj)  # keep exact precision (prices); float would lose it
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, (bytes, bytearray, memoryview)):
        return bytes(obj).hex()
    return str(obj)


def _replace_non_finite_floats(obj: object) -> object:
    """Recursively replace NaN/Infinity floats with None (valid JSON null).

    A non-finite ``float`` (from a Postgres ``real``/``double precision``
    column) is *not* passed to ``json.dumps``' ``default`` hook, so it can't be
    coerced there; with ``allow_nan=False`` it raises ``ValueError``. We emit
    ``null`` rather than flip ``allow_nan`` on, because ``NaN``/``Infinity`` are
    not valid JSON and would break strict consumers (e.g. ``JSON.parse`` in
    ``scripts/prod-query.mjs``).
    """
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _replace_non_finite_floats(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_replace_non_finite_floats(v) for v in obj]
    return obj


class _RowsJSONResponse(JSONResponse):
    """JSONResponse that tolerates DB-native scalar types in row values."""

    def render(self, content: object) -> bytes:
        try:
            return json.dumps(
                content,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
                default=_json_default,
            ).encode("utf-8")
        except ValueError:
            # Only reachable when a non-finite float slipped in; retry with
            # those replaced by null. Kept as a fallback so the common path
            # pays no traversal cost.
            return json.dumps(
                _replace_non_finite_floats(content),
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
                default=_json_default,
            ).encode("utf-8")


# Lazily-created dedicated engine. Prefer ADMIN_QUERY_DATABASE_URL so prod can
# point this at a dedicated read-only role (`vpt_query`); fall back to the main
# DATABASE_URL. A pool cap of 2 caps the blast radius of a leaked token.
_admin_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _get_admin_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _admin_sessionmaker
    if _admin_sessionmaker is None:
        url = settings.admin_query_database_url or settings.database_url
        engine = create_async_engine(url, pool_size=2, max_overflow=0, pool_pre_ping=True)
        _admin_sessionmaker = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    return _admin_sessionmaker


async def get_admin_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a session from the dedicated admin engine. Overridden in tests."""
    async with _get_admin_sessionmaker()() as session:
        yield session


def _classify_db_error(exc: Exception) -> str:
    """Map a DB exception to 'timeout' | 'read_only' | 'error' via SQLSTATE."""
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "57014":  # query_canceled (statement_timeout fired)
        return "timeout"
    if sqlstate in {"25006", "42501"}:  # read_only_sql_transaction / insufficient_privilege
        return "read_only"
    return "error"


def _client_ip(request: Request) -> str:
    """Best-effort client IP for rate-limit keys and log fields.

    Proxy headers are client-controlled, so a candidate is only used if it
    parses as a real IP address — anything else (e.g. a log-injection payload
    in ``X-Forwarded-For``, CWE-117) falls through to the socket peer.
    """
    for header in ("x-forwarded-for", "x-real-ip"):
        value = request.headers.get(header)
        if not value:
            continue
        candidate = value.split(",")[0].strip()
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            continue
    return request.client.host if request.client else "anonymous"


async def _is_rate_limited(ip: str) -> bool:
    """Fixed-window per-IP counter in Redis. Fails open on Redis errors —
    the bearer token is still required, so an open limiter isn't a bypass."""
    key = f"admin_sql_rl:{ip}"
    try:
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, RATE_LIMIT_WINDOW_SECONDS)
        return count > RATE_LIMIT_MAX
    except Exception as exc:  # noqa: BLE001 - fail open, but log
        logger.warning(
            "admin.sql rate-limit check failed, allowing: %s",
            exc,
            extra={"event": "admin.sql.error", "ip": ip},
        )
        return False


def _unauthorized() -> JSONResponse:
    return JSONResponse({"error": "unauthorized"}, status_code=401)


def _authorized(request: Request) -> bool:
    expected = settings.admin_query_token
    if not expected or len(expected) < MIN_TOKEN_LENGTH:
        logger.error(
            "ADMIN_QUERY_TOKEN unset or too short — /v1/admin/sql disabled",
            extra={"event": "admin.sql.rejected", "reason": "token_unset_or_short"},
        )
        return False
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return False
    provided = header[len("bearer ") :].strip()
    return hmac.compare_digest(provided, expected)


@router.post("/sql")
async def admin_sql(request: Request, session: AsyncSession = Depends(get_admin_session)):
    # 1. Bearer-token gate.
    if not _authorized(request):
        return _unauthorized()

    # 2. Per-IP rate limit (after auth so we don't spend cycles for anon).
    ip = _client_ip(request)
    if await _is_rate_limited(ip):
        logger.warning(
            "admin.sql rate-limited ip=%s", ip, extra={"event": "admin.sql.rate_limited", "ip": ip}
        )
        return JSONResponse({"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})

    # 3. Parse + validate the body.
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse({"error": "bad_request", "details": "invalid JSON body"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse(
            {"error": "bad_request", "details": "body must be a JSON object"}, status_code=400
        )

    ok, result = validate_admin_query(body.get("query"))
    if not ok:
        return JSONResponse({"error": "query_rejected", "details": result}, status_code=422)
    query = result

    # 4. Execute inside a transaction that is READ ONLY on Postgres and always
    #    rolled back, so nothing the query attempts can persist.
    dialect = session.bind.dialect.name if session.bind is not None else ""
    started = time.monotonic()
    try:
        if dialect == "postgresql":  # pragma: no cover - Postgres-only; tests run on SQLite
            await session.execute(text("SET TRANSACTION READ ONLY"))
            await session.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))
        rows = (await session.execute(text(query))).mappings().all()
    except Exception as exc:  # noqa: BLE001
        await session.rollback()
        elapsed = int((time.monotonic() - started) * 1000)
        kind = _classify_db_error(exc)
        if kind == "timeout":
            logger.warning(
                "admin.sql timeout elapsedMs=%s",
                elapsed,
                extra={"event": "admin.sql.timeout", "ip": ip, "elapsed_ms": elapsed},
            )
            return JSONResponse({"error": "timeout"}, status_code=504)
        if kind == "read_only":
            logger.warning(
                "admin.sql blocked a write attempt",
                extra={"event": "admin.sql.rejected", "ip": ip, "reason": "read_only"},
            )
            return JSONResponse(
                {"error": "query_rejected", "details": "write operations are not allowed"},
                status_code=422,
            )
        logger.error(
            "admin.sql query failed: %s",
            exc,
            exc_info=exc,
            extra={"event": "admin.sql.error", "ip": ip, "elapsed_ms": elapsed},
        )
        return JSONResponse({"error": "server_error", "details": str(exc)}, status_code=500)
    finally:
        await session.rollback()

    elapsed = int((time.monotonic() - started) * 1000)
    truncated = len(rows) > MAX_ROWS
    out = [dict(r) for r in rows[:MAX_ROWS]]

    # Log query *length* + timing only — never the SQL itself (it may carry
    # user identifiers in WHERE clauses).
    logger.info(
        "admin.sql ip=%s queryLength=%s rowCount=%s truncated=%s elapsedMs=%s",
        ip,
        len(query),
        len(out),
        truncated,
        elapsed,
        extra={
            "event": "admin.sql.executed",
            "ip": ip,
            "query_length": len(query),
            "row_count": len(out),
            "truncated": truncated,
            "elapsed_ms": elapsed,
        },
    )
    return _RowsJSONResponse(
        {"rows": out, "rowCount": len(out), "truncated": truncated, "elapsedMs": elapsed}
    )


# ---------------------------------------------------------------------------
# Feature-flag admin endpoints (runtime operator toggles, e.g. `kiwi_flights`)
# ---------------------------------------------------------------------------
#
# Same bearer token and per-IP rate limit as /sql, but these WRITE the
# `feature_flags` table, so they use the app's normal engine (`get_db`) rather
# than the admin engine — prod points the admin engine at a read-only role.


@router.get("/flags")
async def admin_list_flags(request: Request, session: AsyncSession = Depends(get_db)):
    """List every known feature flag with its live state."""
    if not _authorized(request):
        return _unauthorized()
    ip = _client_ip(request)
    if await _is_rate_limited(ip):
        return JSONResponse(
            {"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"}
        )
    return JSONResponse({"flags": await list_feature_flags(session)})


@router.put("/flags/{name}")
async def admin_set_flag(
    name: str, request: Request, session: AsyncSession = Depends(get_db)
):
    """Set a known feature flag's enabled state. Body: {"enabled": true|false}."""
    if not _authorized(request):
        return _unauthorized()
    ip = _client_ip(request)
    if await _is_rate_limited(ip):
        return JSONResponse(
            {"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"}
        )

    # Resolve to the registry's own constant so everything logged/echoed below
    # is a code-defined string, never the raw path parameter (CWE-117).
    flag = canonical_flag_name(name)
    if flag is None:
        return JSONResponse(
            {"error": "unknown_flag", "details": "unknown feature flag"},
            status_code=404,
        )

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse(
            {"error": "bad_request", "details": "invalid JSON body"}, status_code=400
        )
    enabled = body.get("enabled") if isinstance(body, dict) else None
    if not isinstance(enabled, bool):
        return JSONResponse(
            {"error": "bad_request", "details": "body must be {\"enabled\": true|false}"},
            status_code=400,
        )

    await set_feature_flag(session, flag, enabled)
    logger.info(
        "admin.flags set %s=%s ip=%s",
        flag,
        enabled,
        ip,
        extra={"event": "admin.flags.set", "flag": flag, "enabled": enabled, "ip": ip},
    )
    return JSONResponse({"name": flag, "enabled": enabled})


# ---------------------------------------------------------------------------
# App-setting admin endpoints (string-valued runtime toggles, e.g.
# `flight_provider`) — same auth/rate-limit/engine notes as the flag endpoints.
# ---------------------------------------------------------------------------


@router.get("/settings")
async def admin_list_settings(request: Request, session: AsyncSession = Depends(get_db)):
    """List every known app setting with its live value and allowed values."""
    if not _authorized(request):
        return _unauthorized()
    ip = _client_ip(request)
    if await _is_rate_limited(ip):
        return JSONResponse(
            {"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"}
        )
    return JSONResponse({"settings": await list_app_settings(session)})


@router.put("/settings/{name}")
async def admin_set_setting(
    name: str, request: Request, session: AsyncSession = Depends(get_db)
):
    """Set a known app setting's value. Body: {"value": "<allowed value>"}."""
    if not _authorized(request):
        return _unauthorized()
    ip = _client_ip(request)
    if await _is_rate_limited(ip):
        return JSONResponse(
            {"error": "rate_limited"}, status_code=429, headers={"Retry-After": "60"}
        )

    # Resolve to the registry's own constants so everything logged/echoed below
    # is a code-defined string, never a raw request value (CWE-117).
    setting = canonical_setting_name(name)
    if setting is None:
        return JSONResponse(
            {"error": "unknown_setting", "details": "unknown app setting"},
            status_code=404,
        )

    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse(
            {"error": "bad_request", "details": "invalid JSON body"}, status_code=400
        )
    raw_value = body.get("value") if isinstance(body, dict) else None
    value = canonical_setting_value(setting, raw_value) if isinstance(raw_value, str) else None
    if value is None:
        return JSONResponse(
            {
                "error": "bad_request",
                "details": 'body must be {"value": "<allowed value>"}',
            },
            status_code=400,
        )

    await set_app_setting(session, setting, value)
    logger.info(
        "admin.settings set %s=%s ip=%s",
        setting,
        value,
        ip,
        extra={"event": "admin.settings.set", "setting": setting, "value": value, "ip": ip},
    )
    return JSONResponse({"name": setting, "value": value})
