from datetime import UTC, datetime, timedelta

from jose import jwt

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
