"""Rate limiting middleware using Redis sliding window counter."""

from __future__ import annotations

import ipaddress
import logging
import time

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse, Response

from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims, TokenType
from app.core.errors import PROBLEM_JSON_MEDIA_TYPE, GlobalBudgetExceeded, RateLimitExceeded
from app.core.quota import (
    _seconds_to_utc_midnight,
    check_and_incr_daily_quota,
    is_global_budget_tripped,
)
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

# Paths exempt from rate limiting (health checks, SSE streams, etc.)
EXEMPT_PATHS = {"/health", "/ready", "/docs", "/redoc", "/openapi.json", "/v1/sse/updates"}

# Chat endpoints have stricter rate limits (10/min per user)
CHAT_PATHS = {"/v1/chat/messages", "/v1/chat"}

# Message-producing chat endpoints that actually drive Groq calls. The daily chat
# quota counts only these (not conversation list/read/delete under /v1/chat),
# unlike the per-minute limiter which gates the whole /v1/chat prefix.
CHAT_MESSAGE_PATHS = {"/v1/chat/messages", "/v1/chat/elicitation"}


def _valid_ip(value: str) -> str | None:
    """Return the value if it parses as an IPv4/IPv6 address, else None.

    Guards the rate-limit key against a client-forged `X-Forwarded-For` value:
    an unparseable entry is rejected rather than trusted, mirroring the IP
    validation the admin-SQL endpoint already does in `core/admin_query.py`.
    Also stops a crafted value (newlines, control chars) from reaching the
    structured log field on a rejection (CWE-117).
    """
    candidate = value.strip()
    try:
        ipaddress.ip_address(candidate)
    except ValueError:
        return None
    return candidate


def _get_client_ip(request: Request) -> str:
    """Extract the client IP, trusting only `settings.trusted_proxy_count` proxy
    hops from the right of `X-Forwarded-For`.

    `X-Forwarded-For` is client-appendable, so the *leftmost* entry is fully
    attacker-controlled — keying the rate limiter on it (the previous behaviour)
    let a client mint a fresh bucket per request by rotating the header. With N
    trusted hops, the real client is the (N+1)th entry from the right; anything
    further left was supplied by the client and is ignored. Falls back to the
    socket peer when the header is absent, malformed, or trust is disabled.
    """
    hops = settings.trusted_proxy_count
    if hops > 0:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            parts = [p.strip() for p in forwarded_for.split(",") if p.strip()]
            # The entry appended by the outermost trusted proxy is at index -hops.
            if len(parts) >= hops:
                validated = _valid_ip(parts[-hops])
                if validated:
                    return validated

    # Fall back to the direct socket peer (trustworthy: set by the ASGI server).
    if request.client:
        peer = _valid_ip(request.client.host)
        if peer:
            return peer

    return "unknown"


def _extract_user_id_from_token(request: Request) -> str | None:
    """Extract user ID from the JWT access token — cookie (web) or, failing that,
    the `Authorization: Bearer` header (mobile).

    The bearer path is essential: mobile clients authenticate with the header,
    not the cookie, so reading the cookie alone dropped every authenticated
    mobile request to IP-based limiting — letting mobile users escape the
    per-user daily quota entirely. Mirrors `auth._extract_access_token`.
    """
    access_token = request.cookies.get(CookieNames.ACCESS_TOKEN)
    if not access_token:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            scheme, _, credential = auth_header.partition(" ")
            if scheme.lower() == "bearer" and credential:
                access_token = credential
    if not access_token:
        return None

    try:
        payload = jwt.decode(
            access_token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        # Only an access token identifies a user here; a refresh token in the
        # bearer slot must not key the quota (it can't call these endpoints).
        if payload.get(JWTClaims.TYPE) != TokenType.ACCESS.value:
            return None
        return payload.get(JWTClaims.SUBJECT)
    except jwt.PyJWTError:
        # Invalid or expired token - fall back to IP-based rate limiting
        return None


def _get_rate_limit_identifier(request: Request) -> str:
    """Get identifier for rate limiting: user ID if authenticated, else IP."""
    user_id = _extract_user_id_from_token(request)
    if user_id:
        return f"user:{user_id}"
    return f"ip:{_get_client_ip(request)}"


def _is_chat_path(path: str) -> bool:
    """Check if the request path is a chat endpoint."""
    return any(path.startswith(chat_path) for chat_path in CHAT_PATHS)


def _is_chat_message_path(path: str) -> bool:
    """Check if the path is a message-producing chat endpoint (drives Groq)."""
    return path in CHAT_MESSAGE_PATHS


def _is_refresh_trigger(request: Request) -> bool:
    """Check if the request triggers a (Skiplagged-backed) price refresh.

    Matches POST /v1/trips/refresh-all and POST /v1/trips/{trip_id}/refresh
    without catching GET /v1/trips/refresh-status.
    """
    if request.method != "POST":
        return False
    path = request.url.path
    return path == "/v1/trips/refresh-all" or (
        path.startswith("/v1/trips/") and path.endswith("/refresh")
    )


async def _check_rate_limit(
    identifier: str,
    *,
    is_chat: bool = False,
) -> tuple[bool, int, int]:
    """
    Check if request is within rate limit using sliding window counter.

    Args:
        identifier: User or IP identifier for rate limiting.
        is_chat: If True, use stricter chat rate limits.

    Returns:
        tuple: (allowed, remaining_requests, retry_after_seconds)
    """
    resource = "chat" if is_chat else "api"
    cache_key = CacheKeys.rate_limit(identifier, resource)
    window_seconds = CacheTTL.RATE_LIMIT
    max_requests = settings.chat_rate_limit_per_minute if is_chat else settings.rate_limit_per_minute

    # Get current window timestamp (floor to window boundary)
    now = time.time()
    window_start = int(now // window_seconds) * window_seconds

    # Use a Lua script for atomic increment and TTL management
    # This ensures race-condition-free counting
    lua_script = """
    local key = KEYS[1]
    local window = ARGV[1]
    local max_requests = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])

    -- Get current count
    local current = redis.call('GET', key)
    if current == false then
        current = 0
    else
        current = tonumber(current)
    end

    -- Check if over limit
    if current >= max_requests then
        local remaining_ttl = redis.call('TTL', key)
        if remaining_ttl < 0 then
            remaining_ttl = ttl
        end
        return {0, 0, remaining_ttl}
    end

    -- Increment and set expiry
    local new_count = redis.call('INCR', key)
    if new_count == 1 then
        redis.call('EXPIRE', key, ttl)
    end

    local remaining = max_requests - new_count
    if remaining < 0 then
        remaining = 0
    end

    return {1, remaining, 0}
    """

    try:
        result = await redis_client.eval(
            lua_script,
            1,  # Number of keys
            cache_key,
            str(window_start),
            str(max_requests),
            str(window_seconds),
        )
        allowed, remaining, retry_after = result
        return bool(allowed), int(remaining), int(retry_after)
    except Exception as exc:
        # On Redis errors, allow the request (fail open) but log the error
        logger.warning(
            "Rate limit check failed, allowing request: %s",
            exc,
            extra={"event": "ratelimit.check.failed", "error": str(exc)},
            exc_info=exc,
        )
        return True, max_requests, 0


def _rate_limit_response(retry_after: int, path: str) -> Response:
    """Create a rate limit exceeded response with proper headers."""
    exc = RateLimitExceeded(retry_after=retry_after)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_problem_detail(path),
        media_type=PROBLEM_JSON_MEDIA_TYPE,
        headers={"Retry-After": str(retry_after)},
    )


def _budget_response(retry_after: int, path: str) -> Response:
    """Create a 503 response when the global daily budget breaker is tripped."""
    exc = GlobalBudgetExceeded(retry_after=retry_after)
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_problem_detail(path),
        media_type=PROBLEM_JSON_MEDIA_TYPE,
        headers={"Retry-After": str(retry_after)},
    )


async def _check_daily_ceilings(request: Request, identifier: str) -> Response | None:
    """Enforce per-user daily quotas + the global budget breaker at the edge.

    Returns a rejection Response when a ceiling is hit, or None to proceed.
    Always on (like the per-minute limiter); fails open (returns None) on Redis
    errors via the underlying quota helpers.
    """
    path = request.url.path
    is_chat_message = _is_chat_message_path(path)
    is_refresh = _is_refresh_trigger(request)

    # Per-user daily quota: an overall API cap plus a stricter chat-message cap.
    allowed, _, retry_after = await check_and_incr_daily_quota(
        identifier, "api", settings.daily_quota_per_user
    )
    if not allowed:
        logger.info(
            "Daily API quota exceeded for %s on path %s",
            identifier,
            path,
            extra={"event": "quota.daily_exceeded", "resource": "api", "path": path},
        )
        return _rate_limit_response(retry_after, path)

    if is_chat_message:
        allowed, _, retry_after = await check_and_incr_daily_quota(
            identifier, "chat", settings.chat_daily_quota_per_user
        )
        if not allowed:
            logger.info(
                "Daily chat quota exceeded for %s on path %s",
                identifier,
                path,
                extra={"event": "quota.daily_exceeded", "resource": "chat", "path": path},
            )
            return _rate_limit_response(retry_after, path)

    # Global budget breaker (read-only gate): reject new expensive work cheaply.
    if is_chat_message and await is_global_budget_tripped(
        "groq_tokens", settings.global_daily_groq_token_budget
    ):
        logger.warning(
            "Global Groq budget tripped; rejecting chat on %s",
            path,
            extra={"event": "budget.breaker_rejected", "metric": "groq_tokens", "path": path},
        )
        return _budget_response(_seconds_to_utc_midnight(), path)

    if is_refresh and await is_global_budget_tripped(
        "skiplagged_calls", settings.global_daily_skiplagged_call_budget
    ):
        logger.warning(
            "Global Skiplagged budget tripped; rejecting refresh on %s",
            path,
            extra={
                "event": "budget.breaker_rejected",
                "metric": "skiplagged_calls",
                "path": path,
            },
        )
        return _budget_response(_seconds_to_utc_midnight(), path)

    return None


async def rate_limit_middleware(request: Request, call_next) -> Response:
    """Rate limiting middleware using sliding window counter."""
    # Skip rate limiting for exempt paths
    if request.url.path in EXEMPT_PATHS:
        return await call_next(request)

    # Get identifier for rate limiting
    identifier = _get_rate_limit_identifier(request)

    # Check if this is a chat endpoint for stricter limits
    is_chat = _is_chat_path(request.url.path)

    # Check rate limit
    allowed, remaining, retry_after = await _check_rate_limit(identifier, is_chat=is_chat)

    if not allowed:
        logger.info(
            "Rate limit exceeded for %s on path %s (chat=%s)",
            identifier,
            request.url.path,
            is_chat,
            extra={
                "event": "ratelimit.exceeded",
                "identifier": identifier,
                "route": request.url.path,
                "is_chat": is_chat,
            },
        )
        return _rate_limit_response(retry_after, request.url.path)

    # Daily quotas + global budget breaker (no-op when ceilings are disabled).
    ceiling_response = await _check_daily_ceilings(request, identifier)
    if ceiling_response is not None:
        return ceiling_response

    # Process request
    response = await call_next(request)

    # Add rate limit headers to response
    rate_limit = settings.chat_rate_limit_per_minute if is_chat else settings.rate_limit_per_minute
    response.headers["X-RateLimit-Limit"] = str(rate_limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    return response
