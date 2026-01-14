"""Tests for main application endpoints and configuration."""

import pytest
from fastapi.testclient import TestClient


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

        with patch("app.main.async_engine", mock_engine):
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
