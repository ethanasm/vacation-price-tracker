"""CSRF protection middleware using double-submit cookie strategy."""

from __future__ import annotations

import secrets

from fastapi import Request
from fastapi.responses import Response

from app.core.constants import CookieNames, HeaderNames
from app.core.errors import ForbiddenError
from app.core.security import get_csrf_cookie_params


SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


class CsrfTokenInvalid(ForbiddenError):
    type = "https://vacation-price-tracker.dev/problems/csrf-invalid"
    detail = "CSRF token missing or invalid."


def _needs_csrf_validation(method: str) -> bool:
    return method.upper() not in SAFE_METHODS


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
    if _needs_csrf_validation(request.method):
        csrf_cookie = request.cookies.get(CookieNames.CSRF_TOKEN)
        csrf_header = request.headers.get(HeaderNames.CSRF_TOKEN)
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            raise CsrfTokenInvalid()

    response = await call_next(request)
    if not _needs_csrf_validation(request.method):
        _ensure_csrf_cookie(response, request.cookies.get(CookieNames.CSRF_TOKEN))
    return response
