import hmac
import json
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

from app.core.admins import is_admin_email
from app.core.auth_allowlist import parse_allowlist, should_allow_sign_in
from app.core.cache_keys import CacheKeys, CacheTTL
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims, TokenType
from app.core.errors import (
    AccessDenied,
    AppError,
    AuthenticationRequired,
    BadRequestError,
    NotFoundError,
)
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
    is_admin: bool = False


def _user_response(user: "User") -> UserResponse:
    """Build the shared user payload (admin status derived from ADMIN_EMAILS)."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        email_notifications_enabled=user.email_notifications_enabled,
        is_admin=is_admin_email(user.email),
    )


class MobileTokenRequest(BaseModel):
    """Body the native app POSTs: a Google ID token obtained via Expo AuthSession."""

    id_token: str


class MobileTokenResponse(BaseModel):
    """The JWT pair + user, returned in the BODY (never Set-Cookie) for mobile."""

    access_token: str
    refresh_token: str
    user: UserResponse


class RefreshRequest(BaseModel):
    """Optional body for the mobile refresh path (web sends the cookie instead)."""

    refresh_token: str | None = None


router = APIRouter()
logger = logging.getLogger(__name__)

E2E_SECRET_HEADER = "X-E2E-Token"
E2E_SYNTHETIC_GOOGLE_SUB = "e2e-user-000"
E2E_SYNTHETIC_EMAIL = "e2e@vpt.test"

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
        max_age=settings.refresh_token_expire_seconds,
        **cookie_params,
    )


def _refresh_token_key(user_id: uuid.UUID, payload: dict) -> str:
    """Redis key for a refresh token: per-session (jti) when the token carries
    one, else the legacy per-user key (tokens minted before jti existed)."""
    return CacheKeys.refresh_token(str(user_id), payload.get(JWTClaims.JWT_ID))


def _grace_key(user_id: uuid.UUID, payload: dict) -> str:
    return CacheKeys.refresh_token_grace(str(user_id), payload.get(JWTClaims.JWT_ID))


async def _write_rotation_grace(
    user_id: uuid.UUID, payload: dict, presented_token: str, replacement_token: str
) -> None:
    """Remember presented→replacement briefly after a rotation.

    Refresh tokens are single-use: rotation deletes the presented token before
    the response reaches the client. If that response is lost (connection drop
    mid-refresh — observed bricking mobile sessions in prod), the client's only
    credential is a token the server no longer recognizes. The grace record
    lets a retry of the retired token recover the same replacement instead of
    being permanently signed out.
    """
    await redis_client.set(
        _grace_key(user_id, payload),
        json.dumps({"presented": presented_token, "replacement": replacement_token}),
        ex=CacheTTL.REFRESH_TOKEN_GRACE,
    )


async def _grace_replacement(user_id: uuid.UUID, payload: dict, presented_token: str) -> str | None:
    """The replacement refresh token if ``presented_token`` was rotated out
    within the grace window, else None."""
    raw = await redis_client.get(_grace_key(user_id, payload))
    if not raw:
        return None
    try:
        record = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(record, dict) or record.get("presented") != presented_token:
        return None
    replacement = record.get("replacement")
    return replacement if isinstance(replacement, str) and replacement else None


async def _store_refresh_token(user_id: uuid.UUID, refresh_token: str) -> None:
    payload = jwt.decode(
        refresh_token,
        settings.secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    await redis_client.set(
        _refresh_token_key(user_id, payload),
        refresh_token,
        ex=settings.refresh_token_expire_seconds,
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
        user=_user_response(user),
    )


async def _extract_refresh_body_token(request: Request) -> str | None:
    """Pull the refresh token from a mobile JSON body, or return None for the web
    (cookie) path. A present-but-malformed ``refresh_token`` field (non-string or
    empty) raises ``BadRequestError`` so the client gets a 400 instead of a
    confusing 401 from falling through to the cookie path."""
    try:
        raw = await request.json()
    except Exception:  # noqa: BLE001 - no/invalid body is the cookie (web) path
        return None
    if not isinstance(raw, dict) or "refresh_token" not in raw:
        return None
    candidate = raw["refresh_token"]
    if isinstance(candidate, str) and candidate:
        return candidate
    raise BadRequestError("Invalid refresh token in request body.")


@router.post("/v1/auth/refresh")
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Refresh the access token. Web sends the refresh token in the
    ``refresh_token_cookie`` cookie and gets new cookies back; mobile sends it in
    a JSON body (``{"refresh_token": ...}``) and gets the new pair in the body."""
    # Detect the mode: a JSON body with a refresh_token means the mobile path.
    body_token = await _extract_refresh_body_token(request)
    refresh_token_value = body_token or request.cookies.get(CookieNames.REFRESH_TOKEN)
    body_mode = body_token is not None

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

    # An access token presented here would only fail incidentally (its key is
    # never in Redis); reject it explicitly, mirroring get_current_user.
    if payload.get(JWTClaims.TYPE) != TokenType.REFRESH.value:
        raise AuthenticationRequired("Invalid refresh token.")

    presented_key = _refresh_token_key(user_id, payload)
    stored_token = await redis_client.get(presented_key)
    replayed = False
    if stored_token == refresh_token_value:
        jwt_data = _build_jwt_data(user_id)
        new_access_token = create_access_token(data=jwt_data)
        new_refresh_token = create_refresh_token(data=jwt_data)
        # Rotate within this session only: drop the presented token's key, store
        # the replacement under its own jti. Other sessions' tokens are
        # untouched. The grace record is written before the delete so there is
        # no instant where the presented token is neither valid nor replayable.
        await _write_rotation_grace(user_id, payload, refresh_token_value, new_refresh_token)
        await redis_client.delete(presented_key)
        await _store_refresh_token(user_id, new_refresh_token)
    else:
        # The presented token was already rotated out. If that happened within
        # the grace window, the client likely never received the rotation
        # response (connection dropped mid-refresh) — hand back the same
        # replacement idempotently instead of stranding the session.
        new_refresh_token_or_none = await _grace_replacement(user_id, payload, refresh_token_value)
        if new_refresh_token_or_none is None:
            raise AuthenticationRequired("Refresh token has been rotated or invalidated.")
        new_access_token = create_access_token(data=_build_jwt_data(user_id))
        new_refresh_token = new_refresh_token_or_none
        replayed = True

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user:
        logger.info(
            "User token refresh replayed within grace" if replayed else "User token refreshed",
            extra={
                "event": "auth.token.refresh_replayed" if replayed else "auth.token.refresh",
                "user_id": str(user.id),
            },
        )

    if body_mode:
        if user is None:  # pragma: no cover - the refresh token's user must exist
            raise AuthenticationRequired("User not found")
        return MobileTokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                email_notifications_enabled=user.email_notifications_enabled,
            ),
        )

    response = Response("Tokens refreshed.", status_code=200)
    _set_auth_cookies(response, new_access_token, new_refresh_token)
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
            # Revoke only this session's refresh token; other devices stay in.
            await redis_client.delete(_refresh_token_key(user_id, payload))
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


@router.post("/v1/e2e/mint-token", response_model=MobileTokenResponse)
async def e2e_mint_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> MobileTokenResponse:
    """Mint a bearer JWT pair for the synthetic e2e user (P4 mobile-e2e harness).

    Doubly gated: inert (404) unless `E2E_MODE` is on, and requires the shared
    `X-E2E-Token` secret. Returns the pair in the body; the access_token then
    authenticates via the Bearer path in get_current_user (Task 1). Only ever
    enabled on the isolated vpt-e2e backend, never normal prod.
    """
    if not settings.e2e_mode:
        # Endpoint is inert outside e2e — behave as if it does not exist.
        raise NotFoundError("Not found.")

    if not settings.vpt_e2e_backend_token:
        logger.error(
            "e2e mint-token called but VPT_E2E_BACKEND_TOKEN is unset",
            extra={"event": "auth.e2e.config_error"},
        )
        raise AppError("E2E token minting is not configured.")

    provided = request.headers.get(E2E_SECRET_HEADER, "")
    if not provided or not hmac.compare_digest(provided, settings.vpt_e2e_backend_token):
        logger.warning(
            "e2e mint-token rejected: bad or missing secret",
            extra={"event": "auth.e2e.denied"},
        )
        raise AccessDenied("Invalid e2e token.")

    from app.models.trip import Trip

    result = await db.execute(select(User).where(User.google_sub == E2E_SYNTHETIC_GOOGLE_SUB))
    user = result.scalars().first()
    if not user:
        user = User(google_sub=E2E_SYNTHETIC_GOOGLE_SUB, email=E2E_SYNTHETIC_EMAIL)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Reset the synthetic user's trip state so each e2e run starts from zero
    # (mirrors the test-login wipe). Without it the mobile create-trip flow's
    # fixed-name "Maestro Test Trip" collides on re-run (409 DuplicateTripName),
    # and the per-user MAX_TRIPS_PER_USER cap is eventually hit. The mint step
    # runs once per run before any flow, so trip-detail / trips-list still read
    # the trip create-trip seeds within the same run.
    await db.execute(delete(Trip).where(Trip.user_id == user.id))
    await db.commit()

    jwt_data = _build_jwt_data(user.id)
    access_token = create_access_token(data=jwt_data)
    refresh_token = create_refresh_token(data=jwt_data)
    await _store_refresh_token(user.id, refresh_token)

    logger.info(
        "Minted e2e bearer token",
        extra={"event": "auth.e2e.minted", "user_id": str(user.id)},
    )
    return MobileTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_response(user),
    )


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

    return _user_response(user)
