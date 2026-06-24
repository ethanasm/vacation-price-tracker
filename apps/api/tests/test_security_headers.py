"""Tests for the security response headers middleware."""

from app.core.config import settings
from app.middleware.security_headers import API_CONTENT_SECURITY_POLICY, HSTS_VALUE
from fastapi.testclient import TestClient

BASELINE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
}


class TestSecurityHeaders:
    """Baseline hardening headers are applied to responses."""

    def test_baseline_headers_present(self, client: TestClient):
        response = client.get("/health")

        for name, value in BASELINE_HEADERS.items():
            assert response.headers[name] == value

    def test_csp_present_on_api_response(self, client: TestClient):
        response = client.get("/health")

        assert response.headers["Content-Security-Policy"] == API_CONTENT_SECURITY_POLICY

    def test_csp_exempt_on_docs_paths(self, client: TestClient):
        response = client.get("/openapi.json")

        # Other hardening headers still apply, but CSP is skipped so the
        # CDN-backed docs UI keeps working in development.
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert "Content-Security-Policy" not in response.headers

    def test_headers_present_on_error_response(self, client: TestClient):
        response = client.get("/v1/does-not-exist")

        assert response.status_code == 404
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Content-Security-Policy"] == API_CONTENT_SECURITY_POLICY

    def test_hsts_absent_outside_production(self, client: TestClient, monkeypatch):
        monkeypatch.setattr(settings, "environment", "development")

        response = client.get("/health")

        assert "Strict-Transport-Security" not in response.headers

    def test_hsts_present_in_production(self, client: TestClient, monkeypatch):
        monkeypatch.setattr(settings, "environment", "production")

        response = client.get("/health")

        assert response.headers["Strict-Transport-Security"] == HSTS_VALUE
