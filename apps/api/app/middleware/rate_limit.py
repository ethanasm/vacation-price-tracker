"""Rate limiting middleware using Redis sliding window counter."""

from __future__ import annotations

import logging
import time

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from jose import JWTError, jwt

from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims
from app.core.errors import PROBLEM_JSON_MEDIA_TYPE, RateLimitExceeded
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

# Paths exempt from rate limiting (health checks, etc.)
EXEMPT_PATHS = {"/health", "/ready", "/docs", "/redoc", "/openapi.json"}

# Chat endpoints have stricter rate limits (10/min per user)
CHAT_PATHS = {"/v1/chat/messages", "/v1/chat"}


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request, considering proxy headers."""
    # Check X-Forwarded-For header (set by proxies/load balancers)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # Take the first IP (original client)
        return forwarded_for.split(",")[0].strip()

    # Check X-Real-IP header (common in nginx setups)
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    # Fall back to direct client address
    if request.client:
        return request.client.host

    return "unknown"


def _extract_user_id_from_token(request: Request) -> str | None:
    """Extract user ID from JWT access token cookie if present."""
    access_token = request.cookies.get(CookieNames.ACCESS_TOKEN)
    if not access_token:
        return None

    try:
        payload = jwt.decode(
            access_token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload.get(JWTClaims.SUBJECT)
    except JWTError:
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
        logger.warning("Rate limit check failed, allowing request: %s", exc)
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
        )
        return _rate_limit_response(retry_after, request.url.path)

    # Process request
    response = await call_next(request)

    # Add rate limit headers to response
    rate_limit = settings.chat_rate_limit_per_minute if is_chat else settings.rate_limit_per_minute
    response.headers["X-RateLimit-Limit"] = str(rate_limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    return response
