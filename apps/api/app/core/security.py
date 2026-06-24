from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.core.constants import JWTClaims, TokenType


def get_cookie_params() -> dict:
    """Returns standard cookie parameters for auth cookies."""
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.is_production,
        "path": "/",
    }


def get_csrf_cookie_params() -> dict:
    """Returns standard cookie parameters for CSRF cookies."""
    return {
        "httponly": False,
        "samesite": "lax",
        "secure": settings.is_production,
        "path": "/",
    }


def create_access_token(data: dict) -> str:
    """Creates a new access token."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({JWTClaims.EXPIRATION: expire, JWTClaims.TYPE: TokenType.ACCESS.value})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Creates a new refresh token."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({JWTClaims.EXPIRATION: expire, JWTClaims.TYPE: TokenType.REFRESH.value})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


# Purpose claim that scopes an unsubscribe token so it can't be used as an
# access/refresh token (and vice versa). Unsubscribe links don't expire — a
# stale link should still let a recipient opt out.
UNSUBSCRIBE_PURPOSE = "unsubscribe"


def make_unsubscribe_token(user_id: str) -> str:
    """Mint a signed, non-expiring token identifying a user for email opt-out.

    Shared by the API (to verify the link) and the worker (to embed it in the
    digest's List-Unsubscribe header); both load the same ``secret_key``.
    """
    return jwt.encode(
        {JWTClaims.SUBJECT: user_id, "purpose": UNSUBSCRIBE_PURPOSE},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )


def read_unsubscribe_token(token: str) -> str | None:
    """Return the user id from a valid unsubscribe token, or None if invalid."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != UNSUBSCRIBE_PURPOSE:
        return None
    user_id = payload.get(JWTClaims.SUBJECT)
    return user_id if isinstance(user_id, str) else None
