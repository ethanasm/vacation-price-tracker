"""CSRF protection middleware using double-submit cookie strategy."""

from __future__ import annotations

import secrets

from fastapi import Request
from fastapi.responses import Response

from app.core.constants import CookieNames, HeaderNames
from app.core.errors import ForbiddenError
from app.core.security import get_csrf_cookie_params

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

# Bearer-token machine endpoints don't use cookie auth, so the double-submit
# cookie defense doesn't apply (and can't — there's no browser session).
# The unsubscribe endpoints authenticate via a signed token in the URL (followed
# from an email client / one-click List-Unsubscribe POST), so they're exempt too.
# /v1/telemetry/ is a best-effort, fire-and-forget client-log sink that must work
# pre-auth (no CSRF cookie yet); it only writes logs and is rate-limited.
CSRF_EXEMPT_PREFIXES = (
    "/v1/admin/",
    "/v1/notifications/unsubscribe",
    "/v1/notifications/device-token",
    "/v1/telemetry/",
    "/v1/e2e/",
    # Bearer/token machine endpoints for the mobile app — no browser cookie
    # session, so the double-submit-cookie CSRF defense does not apply.
    "/v1/auth/mobile-token",
    "/v1/auth/refresh",
)


class CsrfTokenInvalid(ForbiddenError):
    type = "https://vacation-price-tracker.dev/problems/csrf-invalid"
    detail = "CSRF token missing or invalid."


def _needs_csrf_validation(method: str) -> bool:
    return method.upper() not in SAFE_METHODS


def _is_csrf_exempt(path: str) -> bool:
    return path.startswith(CSRF_EXEMPT_PREFIXES)


def _is_bearer_authenticated(request: Request) -> bool:
    """True when the request carries an ``Authorization: Bearer <token>`` credential.

    Bearer-token clients (the mobile app) have no browser cookie session, so the
    double-submit-cookie CSRF defense neither applies nor is forgeable. The safety
    of skipping CSRF here rests on the credentialed CORS allowlist
    (``allow_credentials=True`` with an explicit single-origin list, see
    ``app/main.py``): ``Authorization`` is not a CORS-safelisted header, so any
    cross-origin request that sets it triggers a preflight an attacker origin
    fails, and an HTML-form CSRF (the preflight-free vector) cannot set the header
    at all. **If that CORS allowlist is ever loosened, this exemption re-opens CSRF
    across the whole bearer surface.** Exempting by auth mechanism (not just by
    path) keeps every bearer-authed endpoint — POST /v1/trips, the refresh/pause
    routes, etc. — reachable from mobile, while cookie-authed (web) requests stay
    fully CSRF-protected.

    The scheme parse mirrors ``_extract_access_token`` in ``routers/auth.py``
    (case-insensitive scheme, non-empty credential) so the set of CSRF-exempt
    requests is exactly the set the authenticator treats as bearer-authed —
    otherwise a ``bearer <jwt>`` request would authenticate but still be rejected
    by CSRF, reproducing the opaque failure this guard exists to prevent.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return False
    scheme, _, credential = auth_header.partition(" ")
    return scheme.lower() == "bearer" and bool(credential)


def _ensure_csrf_cookie(response: Response, existing_token: str | None) -> None:
    if existing_token:
        return
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=CookieNames.CSRF_TOKEN,
        value=token,
        **get_csrf_cookie_params(),
    )


async def csrf_middleware(request: Request, call_next):
    """Validate CSRF token for unsafe methods and set cookie on safe methods."""
    if (
        _needs_csrf_validation(request.method)
        and not _is_csrf_exempt(request.url.path)
        and not _is_bearer_authenticated(request)
    ):
        csrf_cookie = request.cookies.get(CookieNames.CSRF_TOKEN)
        csrf_header = request.headers.get(HeaderNames.CSRF_TOKEN)
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            raise CsrfTokenInvalid()

    response = await call_next(request)
    if not _needs_csrf_validation(request.method):
        _ensure_csrf_cookie(response, request.cookies.get(CookieNames.CSRF_TOKEN))
    return response
