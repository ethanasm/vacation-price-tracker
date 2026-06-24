"""Verify Google ID tokens for the mobile auth bridge.

Mobile clients perform Google OAuth natively (Expo AuthSession) and POST the
resulting ID token to ``POST /v1/auth/mobile-token``. This module verifies that
token's signature against Google's published JWKS and checks the standard
claims (issuer, audience, expiry). Uses ``authlib.jose`` (already a project
dependency) so we do not pull in ``google-auth``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx
from authlib.jose import JsonWebKey
from authlib.jose import jwt as jose_jwt
from authlib.jose.errors import JoseError

logger = logging.getLogger(__name__)

# Google publishes its OpenID config and JWKS at well-known URLs. The certs
# rotate roughly daily; we cache for the process lifetime and refetch on a
# verification miss (handled by callers reloading the module-level cache).
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_VALID_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
_FETCH_TIMEOUT_SECONDS = 10.0

_jwks_cache: dict | None = None


class GoogleTokenError(Exception):
    """Raised when a Google ID token fails verification."""


@dataclass(frozen=True)
class GoogleIdentity:
    """The subset of Google ID-token claims the auth bridge needs."""

    sub: str
    email: str
    email_verified: bool


def fetch_google_jwks() -> dict:
    """Fetch (and process-cache) Google's JWKS. Raises GoogleTokenError on failure."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    try:
        resp = httpx.get(GOOGLE_CERTS_URL, timeout=_FETCH_TIMEOUT_SECONDS)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    except httpx.HTTPError as exc:  # pragma: no cover - network error path
        raise GoogleTokenError("Could not fetch Google JWKS") from exc
    return _jwks_cache


def verify_google_id_token(
    id_token: str,
    audiences: list[str],
    *,
    jwks: dict | None = None,
) -> GoogleIdentity:
    """Verify a Google ID token and return its identity claims.

    ``audiences`` is the list of OAuth client IDs (iOS + Android) allowed to mint
    a token. ``jwks`` is injectable for tests; it defaults to Google's live JWKS.
    Raises GoogleTokenError on any failure (bad signature, wrong aud/iss, expired,
    missing claims). Never logs the raw token (CWE-117).
    """
    key_set = jwks if jwks is not None else fetch_google_jwks()
    claims_options = {
        "iss": {"essential": True, "values": list(_VALID_ISSUERS)},
        "aud": {"essential": True, "values": list(audiences)},
        "exp": {"essential": True},
    }
    try:
        keys = JsonWebKey.import_key_set(key_set)
        claims = jose_jwt.decode(id_token, keys, claims_options=claims_options)
        claims.validate()  # checks exp/iss/aud per claims_options
    except (JoseError, ValueError, KeyError) as exc:
        raise GoogleTokenError("Google ID token verification failed") from exc

    sub = claims.get("sub")
    email = claims.get("email")
    if not sub or not email:
        raise GoogleTokenError("Google ID token missing required claims (sub, email)")

    return GoogleIdentity(
        sub=str(sub),
        email=str(email),
        email_verified=claims.get("email_verified") is True,
    )
