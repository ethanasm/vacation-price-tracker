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
import logging
import time
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.admin_query import validate_admin_query
from app.core.config import settings
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/admin", tags=["admin"])

MAX_ROWS = 1000
STATEMENT_TIMEOUT_MS = 3000
RATE_LIMIT_MAX = 30
RATE_LIMIT_WINDOW_SECONDS = 60
MIN_TOKEN_LENGTH = 32

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
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
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
        logger.warning("admin.sql rate-limit check failed, allowing: %s", exc)
        return False


def _unauthorized() -> JSONResponse:
    return JSONResponse({"error": "unauthorized"}, status_code=401)


def _authorized(request: Request) -> bool:
    expected = settings.admin_query_token
    if not expected or len(expected) < MIN_TOKEN_LENGTH:
        logger.error("ADMIN_QUERY_TOKEN unset or too short — /v1/admin/sql disabled")
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
        logger.warning("admin.sql rate-limited ip=%s", ip)
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
        if dialect == "postgresql":
            await session.execute(text("SET TRANSACTION READ ONLY"))
            await session.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))
        rows = (await session.execute(text(query))).mappings().all()
    except Exception as exc:  # noqa: BLE001
        await session.rollback()
        elapsed = int((time.monotonic() - started) * 1000)
        kind = _classify_db_error(exc)
        if kind == "timeout":
            logger.warning("admin.sql timeout elapsedMs=%s", elapsed)
            return JSONResponse({"error": "timeout"}, status_code=504)
        if kind == "read_only":
            logger.warning("admin.sql blocked a write attempt")
            return JSONResponse(
                {"error": "query_rejected", "details": "write operations are not allowed"},
                status_code=422,
            )
        logger.error("admin.sql query failed: %s", exc)
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
    )
    return JSONResponse(
        {"rows": out, "rowCount": len(out), "truncated": truncated, "elapsedMs": elapsed}
    )
