import logging
import uuid

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims, TokenType
from app.core.errors import AuthenticationRequired, BadRequestError
from app.core.security import create_access_token, create_refresh_token, get_cookie_params
from app.db.deps import get_db
from app.db.redis import redis_client
from app.models.user import User


class UserResponse(BaseModel):
    """Response model for authenticated user info."""

    id: str
    email: str


router = APIRouter()
logger = logging.getLogger(__name__)

oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    client_kwargs={"scope": "openid email profile"},
)


def _build_jwt_data(user_id: uuid.UUID) -> dict:
    return {JWTClaims.SUBJECT: str(user_id)}


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    cookie_params = get_cookie_params()
    response.set_cookie(
        key=CookieNames.ACCESS_TOKEN,
        value=access_token,
        max_age=settings.access_token_expire_minutes * 60,
        **cookie_params,
    )
    response.set_cookie(
        key=CookieNames.REFRESH_TOKEN,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        **cookie_params,
    )


async def _store_refresh_token(user_id: uuid.UUID, refresh_token: str) -> None:
    await redis_client.set(
        CacheKeys.refresh_token(str(user_id)),
        refresh_token,
        ex=CacheTTL.REFRESH_TOKEN,
    )


@router.get("/v1/auth/google/start")
async def start_google_auth(request: Request):
    """Redirects the user to Google for authentication."""
    redirect_uri = request.url_for("google_auth_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/v1/auth/google/callback")
async def google_auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handles the callback from Google and issues JWT tokens."""
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")

    if not user_info:
        raise BadRequestError("Failed to get user info from Google.")

    google_sub = user_info.get("sub")
    email = user_info.get("email")

    if not google_sub or not email:
        raise BadRequestError("Missing required user info from Google.")

    # Find existing user or create a new one
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalars().first()

    if not user:
        user = User(google_sub=google_sub, email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Create access and refresh tokens
    jwt_data = _build_jwt_data(user.id)
    access_token = create_access_token(data=jwt_data)
    refresh_token = create_refresh_token(data=jwt_data)

    # Store refresh token in Redis (or a DB table) for rotation and validation
    await _store_refresh_token(user.id, refresh_token)

    logger.info("User logged in: id=%s email=%s", user.id, user.email)

    response = RedirectResponse(url=f"{settings.frontend_url}/dashboard")

    # Set cookies
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/v1/auth/refresh")
async def refresh_token(request: Request, db: AsyncSession = Depends(get_db)):
    """Refreshes the access token using a valid refresh token."""
    refresh_token_value = request.cookies.get(CookieNames.REFRESH_TOKEN)

    if not refresh_token_value:
        raise AuthenticationRequired("Refresh token not found.")

    try:
        payload = jwt.decode(
            refresh_token_value,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = uuid.UUID(payload.get(JWTClaims.SUBJECT))
    except (JWTError, ValueError) as exc:
        raise AuthenticationRequired("Invalid refresh token.") from exc

    # Verify refresh token is still valid in Redis
    stored_token = await redis_client.get(CacheKeys.refresh_token(str(user_id)))
    if stored_token != refresh_token_value:
        raise AuthenticationRequired("Refresh token has been rotated or invalidated.")

    # Issue new tokens
    jwt_data = _build_jwt_data(user_id)
    new_access_token = create_access_token(data=jwt_data)
    new_refresh_token = create_refresh_token(data=jwt_data)
    await _store_refresh_token(user_id, new_refresh_token)

    response = Response("Tokens refreshed.", status_code=200)
    _set_auth_cookies(response, new_access_token, new_refresh_token)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user:
        logger.info("User token refreshed: id=%s email=%s", user.id, user.email)

    return response


@router.post("/v1/auth/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    """Logs the user out by clearing cookies and invalidating the refresh token."""
    refresh_token_value = request.cookies.get(CookieNames.REFRESH_TOKEN)
    if refresh_token_value:
        try:
            payload = jwt.decode(
                refresh_token_value,
                settings.secret_key,
                algorithms=[settings.jwt_algorithm],
            )
            user_id = uuid.UUID(payload.get(JWTClaims.SUBJECT))
            await redis_client.delete(CacheKeys.refresh_token(str(user_id)))
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalars().first()
            if user:
                logger.info("User logged out: id=%s email=%s", user.id, user.email)
        except (JWTError, ValueError):
            # If token is invalid, we can't do much but clear cookies anyway
            pass

    response = Response("Logged out successfully.", status_code=200)
    response.delete_cookie(CookieNames.ACCESS_TOKEN, path="/")
    response.delete_cookie(CookieNames.REFRESH_TOKEN, path="/")
    return response


@router.get("/v1/auth/me", response_model=UserResponse)
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Returns the current authenticated user's info."""
    access_token = request.cookies.get(CookieNames.ACCESS_TOKEN)

    if not access_token:
        raise AuthenticationRequired("Not authenticated")

    try:
        payload = jwt.decode(
            access_token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        # Verify this is an access token, not a refresh token
        token_type = payload.get(JWTClaims.TYPE)
        if token_type != TokenType.ACCESS.value:
            raise AuthenticationRequired("Invalid token type")

        user_id = uuid.UUID(payload.get(JWTClaims.SUBJECT))

    except ExpiredSignatureError:
        raise AuthenticationRequired("Token has expired") from None
    except (JWTError, ValueError):
        raise AuthenticationRequired("Invalid token") from None

    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise AuthenticationRequired("User not found")

    return UserResponse(id=str(user.id), email=user.email)
