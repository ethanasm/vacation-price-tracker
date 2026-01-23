"""Tests for rate limiting middleware."""

from __future__ import annotations

import json
import logging
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.core.cache_keys import CacheKeys
from app.core.constants import CookieNames
from app.core.security import create_access_token
from app.middleware import rate_limit as rate_limit_module
from app.middleware.rate_limit import (
    EXEMPT_PATHS,
    _check_rate_limit,
    _extract_user_id_from_token,
    _get_client_ip,
    _get_rate_limit_identifier,
    _rate_limit_response,
    rate_limit_middleware,
)
from fastapi import Request
from fastapi.testclient import TestClient


def _make_request(
    method: str = "GET",
    path: str = "/v1/trips",
    headers: dict | None = None,
    cookies: dict | None = None,
    client_host: str = "127.0.0.1",
) -> Request:
    """Create a mock Request object for testing."""
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "query_string": b"",
        "root_path": "",
        "server": ("localhost", 8000),
    }
    if client_host:
        scope["client"] = (client_host, 12345)

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    request = Request(scope, receive)
    # Manually set cookies
    if cookies:
        request._cookies = cookies
    return request


# =============================================================================
# Tests for _get_client_ip
# =============================================================================


def test_get_client_ip_from_x_forwarded_for():
    """X-Forwarded-For header should be used when present."""
    request = _make_request(headers={"X-Forwarded-For": "203.0.113.1, 198.51.100.2"})
    assert _get_client_ip(request) == "203.0.113.1"


def test_get_client_ip_from_x_forwarded_for_single():
    """X-Forwarded-For with single IP should work."""
    request = _make_request(headers={"X-Forwarded-For": "203.0.113.1"})
    assert _get_client_ip(request) == "203.0.113.1"


def test_get_client_ip_from_x_real_ip():
    """X-Real-IP header should be used as fallback."""
    request = _make_request(headers={"X-Real-IP": "198.51.100.5"})
    assert _get_client_ip(request) == "198.51.100.5"


def test_get_client_ip_prefers_forwarded_for_over_real_ip():
    """X-Forwarded-For should take precedence over X-Real-IP."""
    request = _make_request(
        headers={"X-Forwarded-For": "203.0.113.1", "X-Real-IP": "198.51.100.5"}
    )
    assert _get_client_ip(request) == "203.0.113.1"


def test_get_client_ip_from_direct_client():
    """Direct client address should be used when no proxy headers."""
    request = _make_request(client_host="192.168.1.100")
    assert _get_client_ip(request) == "192.168.1.100"


def test_get_client_ip_unknown_when_no_client():
    """Returns 'unknown' when no client information available."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/test",
        "headers": [],
        "query_string": b"",
        "root_path": "",
        "server": ("localhost", 8000),
        # No "client" key
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    request = Request(scope, receive)
    assert _get_client_ip(request) == "unknown"


# =============================================================================
# Tests for _extract_user_id_from_token
# =============================================================================


def test_extract_user_id_from_valid_token():
    """Valid JWT should return user ID."""
    user_id = "test-user-123"
    token = create_access_token(data={"sub": user_id})
    request = _make_request(cookies={CookieNames.ACCESS_TOKEN: token})
    assert _extract_user_id_from_token(request) == user_id


def test_extract_user_id_no_token():
    """No token should return None."""
    request = _make_request()
    assert _extract_user_id_from_token(request) is None


def test_extract_user_id_invalid_token():
    """Invalid token should return None."""
    request = _make_request(cookies={CookieNames.ACCESS_TOKEN: "invalid.token.here"})
    assert _extract_user_id_from_token(request) is None


def test_extract_user_id_expired_token():
    """Expired token should return None (JWT decode fails)."""
    # Create a token with a past expiration (this will fail decode)
    request = _make_request(cookies={CookieNames.ACCESS_TOKEN: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid"})
    assert _extract_user_id_from_token(request) is None


# =============================================================================
# Tests for _get_rate_limit_identifier
# =============================================================================


def test_get_rate_limit_identifier_authenticated_user():
    """Authenticated users should be identified by user ID."""
    user_id = "user-abc-123"
    token = create_access_token(data={"sub": user_id})
    request = _make_request(cookies={CookieNames.ACCESS_TOKEN: token})
    assert _get_rate_limit_identifier(request) == f"user:{user_id}"


def test_get_rate_limit_identifier_unauthenticated_user():
    """Unauthenticated users should be identified by IP."""
    request = _make_request(client_host="10.0.0.5")
    assert _get_rate_limit_identifier(request) == "ip:10.0.0.5"


def test_get_rate_limit_identifier_uses_proxy_ip_for_unauthenticated():
    """Unauthenticated users behind proxy should use forwarded IP."""
    request = _make_request(headers={"X-Forwarded-For": "203.0.113.50"})
    assert _get_rate_limit_identifier(request) == "ip:203.0.113.50"


# =============================================================================
# Tests for _check_rate_limit
# =============================================================================


@pytest.mark.asyncio
async def test_check_rate_limit_allowed(monkeypatch):
    """Request within limit should be allowed."""
    async def mock_eval(*args):
        return [1, 99, 0]  # allowed=True, remaining=99, retry_after=0

    monkeypatch.setattr(rate_limit_module.redis_client, "eval", mock_eval)

    allowed, remaining, retry_after = await _check_rate_limit("user:test")

    assert allowed is True
    assert remaining == 99
    assert retry_after == 0


@pytest.mark.asyncio
async def test_check_rate_limit_exceeded(monkeypatch):
    """Request exceeding limit should be blocked."""
    async def mock_eval(*args):
        return [0, 0, 45]  # allowed=False, remaining=0, retry_after=45

    monkeypatch.setattr(rate_limit_module.redis_client, "eval", mock_eval)

    allowed, remaining, retry_after = await _check_rate_limit("user:test")

    assert allowed is False
    assert remaining == 0
    assert retry_after == 45


@pytest.mark.asyncio
async def test_check_rate_limit_redis_error_fails_open(monkeypatch, caplog):
    """Redis errors should fail open (allow request)."""
    async def mock_eval(*args):
        raise Exception("Redis connection failed")

    monkeypatch.setattr(rate_limit_module.redis_client, "eval", mock_eval)

    with caplog.at_level(logging.WARNING):
        allowed, remaining, retry_after = await _check_rate_limit("user:test")

    assert allowed is True
    assert "Rate limit check failed" in caplog.text


# =============================================================================
# Tests for _rate_limit_response
# =============================================================================


def test_rate_limit_response_format():
    """Rate limit response should follow RFC 9457 Problem Details format."""
    response = _rate_limit_response(retry_after=30, path="/v1/trips")

    assert response.status_code == 429
    assert response.headers.get("Retry-After") == "30"
    assert response.media_type == "application/problem+json"

    body = json.loads(response.body)
    assert body["type"] == "https://vacation-price-tracker.dev/problems/rate-limit-exceeded"
    assert body["title"] == "Too Many Requests"
    assert body["status"] == 429
    assert body["instance"] == "/v1/trips"
    assert body["retry_after"] == 30


# =============================================================================
# Tests for rate_limit_middleware
# =============================================================================


@pytest.mark.asyncio
async def test_rate_limit_middleware_exempt_paths(monkeypatch):
    """Exempt paths should bypass rate limiting."""
    call_next_called = False

    async def call_next(request):
        nonlocal call_next_called
        call_next_called = True
        from fastapi.responses import Response
        return Response(content="OK", status_code=200)

    # Mock _check_rate_limit to track if it's called
    check_called = False

    async def mock_check(identifier):
        nonlocal check_called
        check_called = True
        return True, 100, 0

    monkeypatch.setattr(rate_limit_module, "_check_rate_limit", mock_check)

    for exempt_path in EXEMPT_PATHS:
        call_next_called = False
        check_called = False
        request = _make_request(path=exempt_path)
        response = await rate_limit_middleware(request, call_next)
        assert call_next_called, f"call_next should be called for {exempt_path}"
        assert not check_called, f"Rate limit should not be checked for {exempt_path}"
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_rate_limit_middleware_allows_request_within_limit(monkeypatch):
    """Requests within rate limit should pass through with headers."""
    async def mock_check(identifier):
        return True, 50, 0

    monkeypatch.setattr(rate_limit_module, "_check_rate_limit", mock_check)

    async def call_next(request):
        from fastapi.responses import Response
        return Response(content="OK", status_code=200)

    request = _make_request(path="/v1/trips")
    response = await rate_limit_middleware(request, call_next)

    assert response.status_code == 200
    assert response.headers.get("X-RateLimit-Limit") == "100"
    assert response.headers.get("X-RateLimit-Remaining") == "50"


@pytest.mark.asyncio
async def test_rate_limit_middleware_blocks_when_exceeded(monkeypatch, caplog):
    """Requests exceeding rate limit should be blocked with 429."""
    async def mock_check(identifier):
        return False, 0, 30

    monkeypatch.setattr(rate_limit_module, "_check_rate_limit", mock_check)

    call_next_called = False

    async def call_next(request):
        nonlocal call_next_called
        call_next_called = True
        from fastapi.responses import Response
        return Response(content="OK", status_code=200)

    with caplog.at_level(logging.INFO):
        request = _make_request(path="/v1/trips", client_host="10.0.0.1")
        response = await rate_limit_middleware(request, call_next)

    assert not call_next_called
    assert response.status_code == 429
    assert response.headers.get("Retry-After") == "30"
    assert "Rate limit exceeded" in caplog.text


@pytest.mark.asyncio
async def test_rate_limit_middleware_uses_user_id_when_authenticated(monkeypatch):
    """Authenticated users should be rate limited by user ID."""
    captured_identifier = None

    async def mock_check(identifier):
        nonlocal captured_identifier
        captured_identifier = identifier
        return True, 99, 0

    monkeypatch.setattr(rate_limit_module, "_check_rate_limit", mock_check)

    async def call_next(request):
        from fastapi.responses import Response
        return Response(content="OK", status_code=200)

    user_id = "user-xyz-789"
    token = create_access_token(data={"sub": user_id})
    request = _make_request(
        path="/v1/trips",
        cookies={CookieNames.ACCESS_TOKEN: token},
        client_host="10.0.0.1",
    )
    await rate_limit_middleware(request, call_next)

    assert captured_identifier == f"user:{user_id}"


@pytest.mark.asyncio
async def test_rate_limit_middleware_uses_ip_when_unauthenticated(monkeypatch):
    """Unauthenticated users should be rate limited by IP."""
    captured_identifier = None

    async def mock_check(identifier):
        nonlocal captured_identifier
        captured_identifier = identifier
        return True, 99, 0

    monkeypatch.setattr(rate_limit_module, "_check_rate_limit", mock_check)

    async def call_next(request):
        from fastapi.responses import Response
        return Response(content="OK", status_code=200)

    request = _make_request(path="/v1/trips", client_host="192.168.1.50")
    await rate_limit_middleware(request, call_next)

    assert captured_identifier == "ip:192.168.1.50"


# =============================================================================
# Tests for CacheKeys.rate_limit
# =============================================================================


def test_cache_keys_rate_limit():
    """CacheKeys.rate_limit should generate correct key format."""
    key = CacheKeys.rate_limit("user:abc123", "api")
    assert key == "rate_limit:user:abc123:api"


# =============================================================================
# Tests for RateLimitExceeded error
# =============================================================================


def test_rate_limit_exceeded_error():
    """RateLimitExceeded should include retry_after in problem detail."""
    from app.core.errors import RateLimitExceeded

    exc = RateLimitExceeded(retry_after=60, detail="Custom message")

    assert exc.status_code == 429
    assert exc.retry_after == 60
    assert exc.detail == "Custom message"

    problem = exc.to_problem_detail("/test")
    assert problem["retry_after"] == 60
    assert problem["status"] == 429
    assert problem["instance"] == "/test"


def test_rate_limit_exceeded_default_detail():
    """RateLimitExceeded should use default detail if not provided."""
    from app.core.errors import RateLimitExceeded

    exc = RateLimitExceeded(retry_after=30)
    assert "Rate limit exceeded" in exc.detail


# =============================================================================
# Integration tests with FastAPI TestClient
# =============================================================================


def test_rate_limit_integration_with_test_client(monkeypatch):
    """Integration test with full middleware stack."""
    from app.main import app

    # Mock Redis for rate limiting
    async def mock_eval(*args):
        return [1, 50, 0]  # allowed=True, remaining=50, retry_after=0

    mock_redis = MagicMock()
    mock_redis.eval = AsyncMock(side_effect=mock_eval)
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock(return_value=True)

    monkeypatch.setattr(rate_limit_module, "redis_client", mock_redis)

    # Also mock the main module's redis_client for the readiness check
    import app.main as main_module
    monkeypatch.setattr(main_module, "redis_client", mock_redis)

    client = TestClient(app, raise_server_exceptions=False)

    # Health endpoint should bypass rate limiting
    response = client.get("/health")
    assert response.status_code == 200


def test_rate_limit_integration_blocked(monkeypatch):
    """Integration test when rate limit is exceeded."""
    from app.main import app

    # Mock Redis to return rate limit exceeded
    async def mock_eval(*args):
        return [0, 0, 45]  # allowed=False, remaining=0, retry_after=45

    mock_redis = MagicMock()
    mock_redis.eval = AsyncMock(side_effect=mock_eval)
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock(return_value=True)

    monkeypatch.setattr(rate_limit_module, "redis_client", mock_redis)

    # Also mock the main module's redis_client for the readiness check
    import app.main as main_module
    import app.middleware.idempotency as idempotency_module
    import app.routers.auth as auth_module

    monkeypatch.setattr(main_module, "redis_client", mock_redis)
    monkeypatch.setattr(idempotency_module, "redis_client", mock_redis)
    monkeypatch.setattr(auth_module, "redis_client", mock_redis)

    client = TestClient(app, raise_server_exceptions=False)

    # Non-exempt endpoint should be blocked
    response = client.get("/v1/auth/me")
    assert response.status_code == 429
    assert response.headers.get("Retry-After") == "45"
    body = response.json()
    assert body["type"] == "https://vacation-price-tracker.dev/problems/rate-limit-exceeded"
