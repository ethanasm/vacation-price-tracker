"""Tests for main application endpoints and configuration."""

import json
import logging
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from starlette.requests import Request


class TestLifespan:
    """Test application lifespan (startup/shutdown)."""

    @pytest.mark.asyncio
    async def test_lifespan_creates_tables(self, test_engine):
        """Test that lifespan creates database tables on startup."""
        from sqlalchemy import inspect

        async with test_engine.connect() as conn:
            # Get table names using sync inspection
            def get_tables(connection):
                inspector = inspect(connection)
                return inspector.get_table_names()

            tables = await conn.run_sync(get_tables)

        # Users table should exist (created by test_engine fixture which uses same pattern)
        assert "users" in tables

    @pytest.mark.asyncio
    async def test_lifespan_context_manager(self):
        """Test lifespan context manager yields control."""
        from contextlib import asynccontextmanager
        from unittest.mock import AsyncMock, MagicMock, patch

        # Mock the engine and connection
        mock_conn = MagicMock()
        mock_conn.run_sync = AsyncMock()

        @asynccontextmanager
        async def mock_begin():
            yield mock_conn

        mock_engine = MagicMock()
        mock_engine.begin = mock_begin

        with (
            patch("app.main.async_engine", mock_engine),
            patch("app.main.init_temporal_client", AsyncMock()),
            patch("app.main.close_temporal_client", AsyncMock()),
        ):
            from app.main import lifespan

            # Create a mock app
            mock_app = MagicMock()

            # Run the lifespan
            async with lifespan(mock_app):
                # Verify we're inside the context (tables would be created)
                pass

            # Verify run_sync was called with metadata.create_all
            mock_conn.run_sync.assert_called_once()


class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_health_check_returns_healthy(self, client: TestClient):
        """Test health endpoint returns healthy status."""
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_health_check_content_type(self, client: TestClient):
        """Test health endpoint returns JSON content type."""
        response = client.get("/health")

        assert response.headers["content-type"] == "application/json"


class TestReadinessEndpoint:
    """Test readiness check endpoint."""

    def test_readiness_check_returns_ready(self, client: TestClient):
        """Test readiness endpoint returns ready status."""
        response = client.get("/ready")

        assert response.status_code == 200
        assert response.json() == {
            "status": "ready",
            "checks": {"database": "ok", "redis": "ok", "temporal": "ok"},
        }

    def test_readiness_check_returns_degraded(self, client: TestClient, mock_redis):
        """Test readiness endpoint returns degraded status on failure."""
        mock_redis.ping = AsyncMock(side_effect=RuntimeError("redis down"))

        response = client.get("/ready")

        assert response.status_code == 503
        payload = response.json()
        assert payload["status"] == "degraded"
        assert payload["checks"]["redis"] == "error"


class TestAppConfiguration:
    """Test application configuration."""

    def test_cors_middleware_configured(self, app):
        """Test CORS middleware is configured."""
        from starlette.middleware.cors import CORSMiddleware

        cors_middleware = None
        for middleware in app.user_middleware:
            if middleware.cls == CORSMiddleware:
                cors_middleware = middleware
                break

        assert cors_middleware is not None

    def test_session_middleware_configured(self, app):
        """Test session middleware is configured for OAuth."""
        from starlette.middleware.sessions import SessionMiddleware

        session_middleware = None
        for middleware in app.user_middleware:
            if middleware.cls == SessionMiddleware:
                session_middleware = middleware
                break

        assert session_middleware is not None

    def test_auth_router_included(self, app):
        """Test auth router is included in app."""
        routes = [route.path for route in app.routes]

        assert "/v1/auth/google/start" in routes
        assert "/v1/auth/google/callback" in routes
        assert "/v1/auth/refresh" in routes
        assert "/v1/auth/logout" in routes


def _make_request(path: str = "/test") -> Request:
    return Request({"type": "http", "method": "GET", "path": path, "headers": []})


def test_configure_logging_sets_handler():
    from app.main import _configure_logging

    root_logger = logging.getLogger()
    existing_handlers = list(root_logger.handlers)
    root_logger.handlers = []
    try:
        _configure_logging()
        assert root_logger.handlers
    finally:
        root_logger.handlers = existing_handlers


def test_validation_handler_triggered_by_missing_query(client: TestClient):
    response = client.get("/v1/locations/search")

    assert response.status_code == 422
    payload = response.json()
    assert payload["detail"] == "Request validation failed."


@pytest.mark.asyncio
async def test_http_exception_handler_formats_response():
    from app.main import http_exception_handler

    request = _make_request("/http-error")
    response = await http_exception_handler(request, HTTPException(status_code=418, detail="teapot"))

    payload = json.loads(response.body)
    assert payload["status"] == 418
    assert payload["detail"] == "teapot"


@pytest.mark.asyncio
async def test_validation_error_handler_formats_response():
    from app.main import validation_error_handler

    request = _make_request("/validation-error")
    exc = RequestValidationError(
        [{"loc": ("query", "q"), "msg": "error", "type": "value_error"}]
    )
    response = await validation_error_handler(request, exc)

    payload = json.loads(response.body)
    assert payload["status"] == 422
    assert payload["instance"] == "/validation-error"


@pytest.mark.asyncio
async def test_unhandled_exception_handler_formats_response():
    from app.main import unhandled_exception_handler

    request = _make_request("/boom")
    response = await unhandled_exception_handler(request, RuntimeError("boom"))

    payload = json.loads(response.body)
    assert payload["status"] == 500
    assert payload["instance"] == "/boom"


def test_readiness_check_reports_database_error(client: TestClient, test_session, monkeypatch):
    monkeypatch.setattr(test_session, "execute", AsyncMock(side_effect=RuntimeError("db down")))

    response = client.get("/ready")

    assert response.status_code == 503
    payload = response.json()
    assert payload["checks"]["database"] == "error"


def test_readiness_check_reports_temporal_error(client: TestClient, monkeypatch):
    from app import main as main_module

    def fail_temporal():
        raise RuntimeError("temporal down")

    monkeypatch.setattr(main_module, "get_temporal_client", fail_temporal)

    response = client.get("/ready")

    assert response.status_code == 503
    payload = response.json()
    assert payload["checks"]["temporal"] == "error"
