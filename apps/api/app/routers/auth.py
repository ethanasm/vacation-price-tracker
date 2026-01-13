import uuid

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims
from app.core.security import create_access_token, create_refresh_token, get_cookie_params
from app.db.deps import get_db
from app.db.redis import redis_client
from app.models.user import User

router = APIRouter()

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
        return Response("Failed to get user info from Google.", status_code=400)

    google_sub = user_info.get("sub")
    email = user_info.get("email")

    if not google_sub or not email:
        return Response("Missing required user info from Google.", status_code=400)

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

    response = RedirectResponse(url=settings.frontend_url)

    # Set cookies
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/v1/auth/refresh")
async def refresh_token(request: Request):
    """Refreshes the access token using a valid refresh token."""
    refresh_token_value = request.cookies.get(CookieNames.REFRESH_TOKEN)

    if not refresh_token_value:
        return Response("Refresh token not found.", status_code=401)

    try:
        payload = jwt.decode(
            refresh_token_value,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = uuid.UUID(payload.get(JWTClaims.SUBJECT))
    except (JWTError, ValueError):
        return Response("Invalid refresh token.", status_code=401)

    # Verify refresh token is still valid in Redis
    stored_token = await redis_client.get(CacheKeys.refresh_token(str(user_id)))
    if stored_token != refresh_token_value:
        return Response("Refresh token has been rotated or invalidated.", status_code=401)

    # Issue new tokens
    jwt_data = _build_jwt_data(user_id)
    new_access_token = create_access_token(data=jwt_data)
    new_refresh_token = create_refresh_token(data=jwt_data)
    await _store_refresh_token(user_id, new_refresh_token)

    response = Response("Tokens refreshed.", status_code=200)
    _set_auth_cookies(response, new_access_token, new_refresh_token)
    return response


@router.post("/v1/auth/logout")
async def logout(request: Request):
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
        except (JWTError, ValueError):
            # If token is invalid, we can't do much but clear cookies anyway
            pass

    response = Response("Logged out successfully.", status_code=200)
    response.delete_cookie(CookieNames.ACCESS_TOKEN, path="/")
    response.delete_cookie(CookieNames.REFRESH_TOKEN, path="/")
    return response
