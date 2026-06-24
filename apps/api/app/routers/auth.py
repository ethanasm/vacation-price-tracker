import logging
import uuid

import jwt
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.auth_allowlist import parse_allowlist, should_allow_sign_in
from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims, TokenType
from app.core.errors import AccessDenied, AppError, AuthenticationRequired, BadRequestError
from app.core.google_verify import GoogleIdentity, GoogleTokenError, verify_google_id_token
from app.core.security import create_access_token, create_refresh_token, get_cookie_params
from app.db.deps import get_db
from app.db.redis import redis_client
from app.models.user import User


class UserResponse(BaseModel):
    """Response model for authenticated user info."""

    id: str
    email: str
    email_notifications_enabled: bool = True


class MobileTokenRequest(BaseModel):
    """Body the native app POSTs: a Google ID token obtained via Expo AuthSession."""

    id_token: str


class MobileTokenResponse(BaseModel):
    """The JWT pair + user, returned in the BODY (never Set-Cookie) for mobile."""

    access_token: str
    refresh_token: str
    user: UserResponse


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
    # Behind the prod reverse proxy (Cloudflare Tunnel), the request reaching
    # uvicorn is plain http on loopback, so request.url_for() would build an
    # http/internal callback that fails Google's redirect_uri_mismatch. Use the
    # configured public origin in production; keep request-derived in dev.
    if settings.is_production:
        redirect_uri = f"{settings.backend_url.rstrip('/')}/v1/auth/google/callback"
    else:
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

    # Gate sign-in against the configured allowlist (open sign-up if unset).
    if not should_allow_sign_in(
        email=email,
        email_verified=user_info.get("email_verified"),
        emails=parse_allowlist(settings.auth_allowed_emails),
        domains=parse_allowlist(settings.auth_allowed_domains),
    ):
        logger.warning(
            "Sign-in denied by allowlist: email=%s", email, extra={"event": "auth.google.denied"}
        )
        return RedirectResponse(url=f"{settings.frontend_url}/access-denied")

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

    logger.info(
        "User logged in: id=%s email=%s",
        user.id,
        user.email,
        extra={"event": "auth.google.success", "user_id": str(user.id)},
    )

    response = RedirectResponse(url=f"{settings.frontend_url}/trips")

    # Set cookies
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/v1/auth/mobile-token", response_model=MobileTokenResponse)
async def mobile_token(
    payload: MobileTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> MobileTokenResponse:
    """Exchange a Google ID token (from the native app) for the same JWT pair the
    web OAuth callback issues. Returns the pair in the body — the mobile client
    stores it in expo-secure-store and sends `Authorization: Bearer`."""
    audiences = settings.google_oauth_mobile_audiences_list
    if not audiences:
        # Missing config is an operator error, not a client error → 500. AppError
        # is the 500-status base in app/core/errors.py.
        logger.error(
            "mobile-token called but GOOGLE_OAUTH_MOBILE_AUDIENCES is unset",
            extra={"event": "auth.mobile.config_error"},
        )
        raise AppError("Mobile auth is not configured.")

    try:
        identity: GoogleIdentity = verify_google_id_token(payload.id_token, audiences)
    except GoogleTokenError:
        # Never log the raw token (CWE-117); the event name is enough to triage.
        logger.warning(
            "Mobile Google ID token verification failed",
            extra={"event": "auth.mobile.token_invalid"},
        )
        raise AuthenticationRequired("invalid_google_token") from None

    if not should_allow_sign_in(
        email=identity.email,
        email_verified=identity.email_verified,
        emails=parse_allowlist(settings.auth_allowed_emails),
        domains=parse_allowlist(settings.auth_allowed_domains),
    ):
        logger.info(
            "Mobile sign-in denied by allowlist",
            extra={"event": "auth.mobile.denied"},
        )
        raise AccessDenied("access_denied")

    result = await db.execute(select(User).where(User.google_sub == identity.sub))
    user = result.scalars().first()
    if not user:
        user = User(google_sub=identity.sub, email=identity.email)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    jwt_data = _build_jwt_data(user.id)
    access_token = create_access_token(data=jwt_data)
    refresh_token = create_refresh_token(data=jwt_data)
    await _store_refresh_token(user.id, refresh_token)

    logger.info(
        "Mobile sign-in successful",
        extra={"event": "auth.mobile.success", "user_id": str(user.id)},
    )

    return MobileTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            email_notifications_enabled=user.email_notifications_enabled,
        ),
    )


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
    except (jwt.PyJWTError, ValueError) as exc:
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
        logger.info(
            "User token refreshed: id=%s email=%s",
            user.id,
            user.email,
            extra={"event": "auth.token.refresh", "user_id": str(user.id)},
        )

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
                logger.info(
                    "User logged out: id=%s email=%s",
                    user.id,
                    user.email,
                    extra={"event": "auth.token.revoke", "user_id": str(user.id)},
                )
        except (jwt.PyJWTError, ValueError):
            # If token is invalid, we can't do much but clear cookies anyway
            pass

    response = Response("Logged out successfully.", status_code=200)
    response.delete_cookie(CookieNames.ACCESS_TOKEN, path="/")
    response.delete_cookie(CookieNames.REFRESH_TOKEN, path="/")
    return response


@router.post("/v1/auth/test-login")
async def test_login(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Test-only login. Creates a test user, wipes their existing trips, and
    sets JWT cookies. Only available when ENVIRONMENT=test.

    The trip wipe keeps E2E runs idempotent — without it, the per-user
    `MAX_TRIPS_PER_USER` cap (10) is hit after a few runs of any test that
    creates a trip, and subsequent POST /v1/trips calls fail with 400
    `TripLimitExceeded` even though the request itself is valid.
    """
    from fastapi import HTTPException

    from app.models.trip import Trip

    if settings.environment != "test":
        raise HTTPException(status_code=403, detail="Test login only available in test environment")

    # Find or create test user
    test_google_sub = "test-user-000"
    result = await db.execute(select(User).where(User.google_sub == test_google_sub))
    user = result.scalars().first()
    if not user:
        user = User(
            google_sub=test_google_sub,
            email="test@example.com",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Reset trip state so each test run starts from zero
    await db.execute(delete(Trip).where(Trip.user_id == user.id))
    await db.commit()

    # Create access and refresh tokens
    jwt_data = _build_jwt_data(user.id)
    access_token = create_access_token(data=jwt_data)
    refresh_token = create_refresh_token(data=jwt_data)

    # Store refresh token
    await _store_refresh_token(user.id, refresh_token)

    _set_auth_cookies(response, access_token, refresh_token)
    return {"id": str(user.id), "email": user.email}


def _extract_access_token(request: Request) -> str | None:
    """Resolve the access-token JWT from the cookie (web) or, failing that, an
    ``Authorization: Bearer <jwt>`` header (mobile). The cookie wins so the web
    flow is unchanged; the bearer path is additive and backwards-compatible."""
    cookie_token = request.cookies.get(CookieNames.ACCESS_TOKEN)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header:
        scheme, _, credential = auth_header.partition(" ")
        if scheme.lower() == "bearer" and credential:
            return credential
    return None


@router.get("/v1/auth/me", response_model=UserResponse)
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Returns the current authenticated user's info."""
    access_token = _extract_access_token(request)

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

    except jwt.ExpiredSignatureError:
        raise AuthenticationRequired("Token has expired") from None
    except (jwt.PyJWTError, ValueError):
        raise AuthenticationRequired("Invalid token") from None

    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise AuthenticationRequired("User not found")

    return UserResponse(
        id=str(user.id),
        email=user.email,
        email_notifications_enabled=user.email_notifications_enabled,
    )
