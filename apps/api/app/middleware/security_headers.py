"""Security response headers middleware.

Adds a baseline set of hardening headers to every response so the API is safe to
expose publicly. The API serves JSON (not HTML) for everything except the
dev-only Swagger/ReDoc docs, so the default Content-Security-Policy is locked all
the way down (``default-src 'none'``); the docs paths are exempted from CSP so
their CDN-hosted assets keep loading in development.
"""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import Response

from app.core.config import settings

# Locked-down CSP for a JSON API: nothing should ever be loaded or framed.
API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

# Swagger UI / ReDoc are HTML pages that pull assets from a CDN. They are only
# mounted outside production, so we skip the strict CSP rather than maintain an
# allowlist of CDN origins.
CSP_EXEMPT_PATHS = frozenset({"/docs", "/redoc", "/openapi.json"})

# Two years, matching the common HSTS preload threshold. Only emitted in
# production to avoid pinning HTTPS on developer machines.
HSTS_VALUE = "max-age=63072000; includeSubDomains"


async def security_headers_middleware(request: Request, call_next) -> Response:
    """Attach baseline security headers to every response."""
    response = await call_next(request)

    headers = response.headers
    headers.setdefault("X-Content-Type-Options", "nosniff")
    headers.setdefault("X-Frame-Options", "DENY")
    headers.setdefault("Referrer-Policy", "no-referrer")
    headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")

    if request.url.path not in CSP_EXEMPT_PATHS:
        headers.setdefault("Content-Security-Policy", API_CONTENT_SECURITY_POLICY)

    if settings.is_production:
        headers.setdefault("Strict-Transport-Security", HSTS_VALUE)

    return response
