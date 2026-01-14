"""Tests for main application endpoints and configuration."""

import pytest
from fastapi.testclient import TestClient


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
