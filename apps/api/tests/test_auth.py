"""Tests for authentication endpoints."""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import app.routers.auth as auth_module
import jwt
import pytest
from app.core.cache_keys import CacheKeys
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims, TokenType
from app.core.errors import AuthenticationRequired
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from fastapi import Response
from sqlmodel import select
from starlette.requests import Request

from tests.test_models import set_test_timestamps


def _make_request(path: str, method: str = "GET", cookies: dict[str, str] | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if cookies:
        cookie_header = "; ".join(f"{key}={value}" for key, value in cookies.items())
        headers.append((b"cookie", cookie_header.encode("ascii")))
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": headers,
        "query_string": b"",
    }
    return Request(scope)


class TestGoogleOAuthCallback:
    """Test Google OAuth callback flow.

    Note: Full OAuth integration tests should be done separately.
    These tests verify the callback logic assuming OAuth succeeded.
    """

    @pytest.mark.asyncio
    async def test_create_user_from_google_oauth(self, test_session, mock_redis):
        """Test user creation from Google OAuth data."""
        # Simulate what happens after OAuth succeeds
        google_sub = "google_user_123"
        email = "test@example.com"

        # Check user doesn't exist
        result = await test_session.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalars().first()
        assert user is None

        # Create user (simulating the callback logic)
        user = User(google_sub=google_sub, email=email)
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Verify user created
        assert user.id is not None
        assert user.google_sub == google_sub
        assert user.email == email

        # Verify token can be created
        token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})
        assert token is not None

    @pytest.mark.asyncio
    async def test_existing_user_oauth_login(self, test_session, mock_redis):
        """Test OAuth login with existing user doesn't create duplicate."""
        google_sub = "google_user_123"
        email = "test@example.com"

        # Create existing user
        user1 = User(google_sub=google_sub, email=email)
        set_test_timestamps(user1)
        test_session.add(user1)
        await test_session.commit()
        await test_session.refresh(user1)

        # Try to "log in" again (simulating callback)
        result = await test_session.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalars().first()

        # Should find existing user
        assert user is not None
        assert user.id == user1.id

        # Verify only one user exists
        result = await test_session.execute(select(User).where(User.email == email))
        users = result.scalars().all()
        assert len(users) == 1

    def test_google_start_redirects(self, client, monkeypatch):
        """Test OAuth start delegates to provider redirect."""
        authorize_redirect = AsyncMock(return_value=Response(status_code=307))
        monkeypatch.setattr(
            auth_module.oauth.google,
            "authorize_redirect",
            authorize_redirect,
        )

        response = client.get("/v1/auth/google/start", follow_redirects=False)

        assert response.status_code == 307
        assert authorize_redirect.call_count == 1
        redirect_uri = authorize_redirect.call_args[0][1]
        assert str(redirect_uri).endswith("/v1/auth/google/callback")

    def test_google_start_uses_public_origin_in_production(self, client, monkeypatch):
        """In production the redirect_uri is built from the public BACKEND_URL,
        not the proxied request (avoids redirect_uri_mismatch behind the tunnel)."""
        authorize_redirect = AsyncMock(return_value=Response(status_code=307))
        monkeypatch.setattr(auth_module.oauth.google, "authorize_redirect", authorize_redirect)
        monkeypatch.setattr(settings, "environment", "production")
        monkeypatch.setattr(settings, "backend_url", "https://vacation-price-tracker.ethanasm.me")

        response = client.get("/v1/auth/google/start", follow_redirects=False)

        assert response.status_code == 307
        redirect_uri = authorize_redirect.call_args[0][1]
        assert redirect_uri == "https://vacation-price-tracker.ethanasm.me/v1/auth/google/callback"

    def test_callback_returns_400_without_userinfo(self, client, monkeypatch):
        """Test callback returns 400 when userinfo missing."""
        monkeypatch.setattr(
            auth_module.oauth.google,
            "authorize_access_token",
            AsyncMock(return_value={}),
        )

        response = client.get("/v1/auth/google/callback")

        assert response.status_code == 400
        assert response.json()["detail"] == "Failed to get user info from Google."

    def test_callback_returns_400_with_missing_fields(self, client, monkeypatch):
        """Test callback returns 400 when userinfo missing required fields."""
        monkeypatch.setattr(
            auth_module.oauth.google,
            "authorize_access_token",
            AsyncMock(return_value={"userinfo": {"sub": "google_user_123"}}),
        )

        response = client.get("/v1/auth/google/callback")

        assert response.status_code == 400
        assert response.json()["detail"] == "Missing required user info from Google."

    def test_callback_denied_by_allowlist_redirects(self, client, monkeypatch):
        """A non-allowlisted email is redirected to /access-denied, not logged in."""
        monkeypatch.setattr(settings, "auth_allowed_emails", "allowed@example.com")
        monkeypatch.setattr(settings, "auth_allowed_domains", "")
        monkeypatch.setattr(
            auth_module.oauth.google,
            "authorize_access_token",
            AsyncMock(
                return_value={
                    "userinfo": {
                        "sub": "google_user_denied",
                        "email": "stranger@evil.com",
                        "email_verified": True,
                    }
                }
            ),
        )

        response = client.get("/v1/auth/google/callback", follow_redirects=False)

        assert response.status_code == 307
        assert response.headers["location"].endswith("/access-denied")

    @pytest.mark.asyncio
    async def test_callback_success_creates_user(self, test_session, mock_redis, monkeypatch):
        """Test successful OAuth callback creates user and redirects."""
        google_sub = "google_user_456"
        email = "callback@example.com"
        monkeypatch.setattr(
            auth_module.oauth.google,
            "authorize_access_token",
            AsyncMock(return_value={"userinfo": {"sub": google_sub, "email": email}}),
        )
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        request = _make_request("/v1/auth/google/callback")
        response = await auth_module.google_auth_callback(request, db=test_session)

        assert response.status_code == 307
        assert response.headers["location"].endswith("/trips")
        set_cookie_headers = response.headers.getlist("set-cookie")
        assert any(CookieNames.ACCESS_TOKEN in header for header in set_cookie_headers)
        assert any(CookieNames.REFRESH_TOKEN in header for header in set_cookie_headers)

        result = await test_session.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalars().first()
        assert user is not None
        assert user.email == email
        mock_redis.set.assert_called()


class TestTokenRefresh:
    """Test token refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_token_logic(self, test_session, mock_redis):
        """Test refresh token creation and validation logic."""
        # Create test user
        user = User(google_sub="test_sub", email="refresh@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Create tokens
        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        access_token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})

        # Verify tokens can be decoded
        refresh_payload = jwt.decode(refresh_token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        access_payload = jwt.decode(access_token, settings.secret_key, algorithms=[settings.jwt_algorithm])

        assert refresh_payload[JWTClaims.SUBJECT] == str(user.id)
        assert access_payload[JWTClaims.SUBJECT] == str(user.id)

        # Verify token types are different
        assert refresh_payload[JWTClaims.TYPE] == TokenType.REFRESH.value
        assert access_payload[JWTClaims.TYPE] == TokenType.ACCESS.value

    def test_token_validation(self):
        """Test token validation with invalid tokens."""
        # Test decoding invalid token
        with pytest.raises(jwt.PyJWTError):
            jwt.decode("invalid_token", settings.secret_key, algorithms=[settings.jwt_algorithm])

        # Test decoding with wrong secret
        token = create_refresh_token(data={JWTClaims.SUBJECT: "test_user"})

        with pytest.raises(jwt.PyJWTError):
            jwt.decode(token, "wrong_secret", algorithms=[settings.jwt_algorithm])

    def test_refresh_returns_401_without_cookie(self, client_with_csrf, csrf_headers):
        """Test refresh returns 401 when cookie missing."""
        client_with_csrf.cookies.clear()
        client_with_csrf.cookies.set(CookieNames.CSRF_TOKEN, csrf_headers["X-CSRF-Token"])
        response = client_with_csrf.post("/v1/auth/refresh", headers=csrf_headers)

        assert response.status_code == 401
        assert response.json()["detail"] == "Refresh token not found."

    def test_refresh_returns_401_with_invalid_token(self, client_with_csrf, csrf_headers):
        """Test refresh returns 401 for invalid token."""
        client_with_csrf.cookies.set(CookieNames.REFRESH_TOKEN, "invalid_token_here")
        response = client_with_csrf.post("/v1/auth/refresh", headers=csrf_headers)

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid refresh token."

    def test_refresh_returns_401_for_access_token(self, client_with_csrf, csrf_headers):
        """An access token in the refresh cookie is rejected by type, not by luck."""
        access_token = create_access_token(
            data={JWTClaims.SUBJECT: "00000000-0000-0000-0000-000000000000"}
        )
        client_with_csrf.cookies.set(CookieNames.REFRESH_TOKEN, access_token)
        response = client_with_csrf.post("/v1/auth/refresh", headers=csrf_headers)

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid refresh token."

    def test_refresh_returns_401_when_token_rotated(self, client_with_csrf, mock_redis, csrf_headers):
        """Test refresh returns 401 when token doesn't match Redis."""
        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: "00000000-0000-0000-0000-000000000000"})
        client_with_csrf.cookies.set(CookieNames.REFRESH_TOKEN, refresh_token)
        mock_redis.get.return_value = "different_token"

        response = client_with_csrf.post("/v1/auth/refresh", headers=csrf_headers)

        assert response.status_code == 401
        assert response.json()["detail"] == "Refresh token has been rotated or invalidated."

    @pytest.mark.asyncio
    async def test_refresh_success_sets_cookies(self, test_session, mock_redis, monkeypatch):
        """Test refresh succeeds when token matches Redis."""
        user = User(google_sub="refresh_user", email="refresh-success@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        mock_redis.get.return_value = refresh_token
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        request = _make_request(
            "/v1/auth/refresh",
            method="POST",
            cookies={CookieNames.REFRESH_TOKEN: refresh_token},
        )
        response = await auth_module.refresh_token(request, db=test_session)

        assert response.status_code == 200
        set_cookie_headers = response.headers.getlist("set-cookie")
        assert any(CookieNames.ACCESS_TOKEN in header for header in set_cookie_headers)
        assert any(CookieNames.REFRESH_TOKEN in header for header in set_cookie_headers)

    def test_refresh_tokens_carry_unique_jti(self):
        """Each refresh token gets its own jti so sessions are stored per-device."""
        token_a = create_refresh_token(data={JWTClaims.SUBJECT: "user"})
        token_b = create_refresh_token(data={JWTClaims.SUBJECT: "user"})

        payload_a = jwt.decode(token_a, settings.secret_key, algorithms=[settings.jwt_algorithm])
        payload_b = jwt.decode(token_b, settings.secret_key, algorithms=[settings.jwt_algorithm])

        assert payload_a[JWTClaims.JWT_ID]
        assert payload_b[JWTClaims.JWT_ID]
        assert payload_a[JWTClaims.JWT_ID] != payload_b[JWTClaims.JWT_ID]

    @pytest.mark.asyncio
    async def test_concurrent_sessions_store_under_distinct_keys(self, mock_redis, monkeypatch):
        """Two sessions for one user occupy separate Redis keys (no eviction)."""
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)
        user_id = uuid.uuid4()

        token_a = create_refresh_token(data={JWTClaims.SUBJECT: str(user_id)})
        token_b = create_refresh_token(data={JWTClaims.SUBJECT: str(user_id)})
        await auth_module._store_refresh_token(user_id, token_a)
        await auth_module._store_refresh_token(user_id, token_b)

        keys = [call.args[0] for call in mock_redis.set.call_args_list]
        assert len(set(keys)) == 2
        assert all(key.startswith(f"refresh_token:{user_id}:") for key in keys)

    @pytest.mark.asyncio
    async def test_refresh_rotates_within_session_only(self, test_session, mock_redis, monkeypatch):
        """A successful refresh deletes the presented jti key and stores the new one."""
        user = User(google_sub="rotate_user", email="rotate@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        presented_jti = jwt.decode(
            refresh_token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )[JWTClaims.JWT_ID]
        mock_redis.get.return_value = refresh_token
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        request = _make_request(
            "/v1/auth/refresh",
            method="POST",
            cookies={CookieNames.REFRESH_TOKEN: refresh_token},
        )
        response = await auth_module.refresh_token(request, db=test_session)

        assert response.status_code == 200
        presented_key = CacheKeys.refresh_token(str(user.id), presented_jti)
        mock_redis.get.assert_called_once_with(presented_key)
        mock_redis.delete.assert_called_once_with(presented_key)
        stored_key = mock_redis.set.call_args.args[0]
        assert stored_key.startswith(f"refresh_token:{user.id}:")
        assert stored_key != presented_key

    @pytest.mark.asyncio
    async def test_refresh_writes_rotation_grace_record(self, test_session, mock_redis, monkeypatch):
        """Rotation records presented→replacement so a lost response is recoverable."""
        import json

        user = User(google_sub="grace_writer", email="grace-writer@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        presented_jti = jwt.decode(
            refresh_token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )[JWTClaims.JWT_ID]
        mock_redis.get.return_value = refresh_token
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        request = _make_request(
            "/v1/auth/refresh",
            method="POST",
            cookies={CookieNames.REFRESH_TOKEN: refresh_token},
        )
        response = await auth_module.refresh_token(request, db=test_session)

        assert response.status_code == 200
        grace_key = CacheKeys.refresh_token_grace(str(user.id), presented_jti)
        grace_calls = [c for c in mock_redis.set.call_args_list if c.args[0] == grace_key]
        assert len(grace_calls) == 1
        record = json.loads(grace_calls[0].args[1])
        assert record["presented"] == refresh_token
        # The replacement in the grace record is the token stored as the new session.
        stored_calls = [
            c for c in mock_redis.set.call_args_list if c.args[0].startswith(f"refresh_token:{user.id}:")
        ]
        assert record["replacement"] == stored_calls[0].args[1]

    @pytest.mark.asyncio
    async def test_refresh_replays_rotated_token_within_grace(self, test_session, mock_redis, monkeypatch):
        """A rotated-out token retried within grace gets the same replacement back
        (the lost-response recovery path), without rotating again."""
        import json

        user = User(google_sub="grace_replayer", email="grace-replay@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        retired_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        replacement_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        # First get: the session key no longer holds the retired token.
        # Second get: the grace record maps it to the replacement.
        mock_redis.get.side_effect = [
            None,
            json.dumps({"presented": retired_token, "replacement": replacement_token}),
        ]
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        request = _make_request(
            "/v1/auth/refresh",
            method="POST",
            cookies={CookieNames.REFRESH_TOKEN: retired_token},
        )
        response = await auth_module.refresh_token(request, db=test_session)

        assert response.status_code == 200
        set_cookie_headers = response.headers.getlist("set-cookie")
        assert any(replacement_token in header for header in set_cookie_headers)
        # Replay is idempotent: nothing is rotated, stored, or deleted.
        mock_redis.set.assert_not_called()
        mock_redis.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_refresh_replay_returns_pair_in_body_for_mobile(self, test_session, mock_redis, monkeypatch):
        """The grace replay also serves the mobile (JSON body) mode."""
        import json

        from fastapi import Request as FastAPIRequest

        user = User(google_sub="grace_mobile", email="grace-mobile@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        retired_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        replacement_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        mock_redis.get.side_effect = [
            None,
            json.dumps({"presented": retired_token, "replacement": replacement_token}),
        ]
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        body = json.dumps({"refresh_token": retired_token}).encode()
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/v1/auth/refresh",
            "headers": [(b"content-type", b"application/json")],
            "query_string": b"",
        }

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = FastAPIRequest(scope, receive)
        response = await auth_module.refresh_token(request, db=test_session)

        assert response.refresh_token == replacement_token
        assert response.access_token
        assert response.user.id == str(user.id)

    def test_refresh_returns_401_when_grace_record_mismatches(self, client_with_csrf, mock_redis, csrf_headers):
        """A grace record for a *different* presented token does not unlock a replay."""
        import json

        refresh_token = create_refresh_token(
            data={JWTClaims.SUBJECT: "00000000-0000-0000-0000-000000000000"}
        )
        client_with_csrf.cookies.set(CookieNames.REFRESH_TOKEN, refresh_token)
        mock_redis.get.side_effect = [
            None,
            json.dumps({"presented": "some_other_token", "replacement": "whatever"}),
        ]

        response = client_with_csrf.post("/v1/auth/refresh", headers=csrf_headers)

        assert response.status_code == 401
        assert response.json()["detail"] == "Refresh token has been rotated or invalidated."

    def test_refresh_returns_401_when_grace_record_malformed(self, client_with_csrf, mock_redis, csrf_headers):
        """Garbage in the grace record fails closed."""
        refresh_token = create_refresh_token(
            data={JWTClaims.SUBJECT: "00000000-0000-0000-0000-000000000000"}
        )
        client_with_csrf.cookies.set(CookieNames.REFRESH_TOKEN, refresh_token)
        mock_redis.get.side_effect = [None, "not json"]

        response = client_with_csrf.post("/v1/auth/refresh", headers=csrf_headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_accepts_legacy_token_without_jti(self, test_session, mock_redis, monkeypatch):
        """Tokens minted before jti existed validate against the legacy per-user key."""
        user = User(google_sub="legacy_user", email="legacy@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
        legacy_token = jwt.encode(
            {
                JWTClaims.SUBJECT: str(user.id),
                JWTClaims.EXPIRATION: expire,
                JWTClaims.TYPE: TokenType.REFRESH.value,
            },
            settings.secret_key,
            algorithm=settings.jwt_algorithm,
        )
        mock_redis.get.return_value = legacy_token
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        request = _make_request(
            "/v1/auth/refresh",
            method="POST",
            cookies={CookieNames.REFRESH_TOKEN: legacy_token},
        )
        response = await auth_module.refresh_token(request, db=test_session)

        assert response.status_code == 200
        legacy_key = CacheKeys.refresh_token(str(user.id))
        mock_redis.get.assert_called_once_with(legacy_key)
        mock_redis.delete.assert_called_once_with(legacy_key)
        # The replacement is stored under its own jti key going forward.
        assert mock_redis.set.call_args.args[0].startswith(f"refresh_token:{user.id}:")


class TestLogout:
    """Test logout logic."""

    @pytest.mark.asyncio
    async def test_logout_token_invalidation(self, test_session):
        """Test logout invalidates refresh token."""
        # Create test user
        user = User(google_sub="test_sub", email="logout@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Create refresh token
        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})

        # Verify token is valid before logout
        payload = jwt.decode(refresh_token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        assert payload[JWTClaims.SUBJECT] == str(user.id)

        # Verify token structure
        assert payload[JWTClaims.TYPE] == TokenType.REFRESH.value
        assert JWTClaims.EXPIRATION in payload

        # Token should have reasonable expiration (refresh_token_expire_days)
        exp_time = datetime.fromtimestamp(payload[JWTClaims.EXPIRATION], tz=UTC)
        expected_exp = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
        # Within 1 minute of expected expiration
        assert abs((exp_time - expected_exp).total_seconds()) < 60

    def test_logout_with_invalid_token_still_succeeds(self, client_with_csrf, csrf_headers):
        """Test logout succeeds even with invalid refresh token."""
        client_with_csrf.cookies.set(CookieNames.REFRESH_TOKEN, "invalid_token_here")
        response = client_with_csrf.post("/v1/auth/logout", headers=csrf_headers)

        assert response.status_code == 200
        assert response.text == "Logged out successfully."

    @pytest.mark.asyncio
    async def test_logout_with_valid_token_clears_refresh(self, test_session, mock_redis, monkeypatch):
        """Test logout clears refresh token for valid user."""
        user = User(google_sub="logout_user", email="logout-success@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        token_jti = jwt.decode(
            refresh_token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )[JWTClaims.JWT_ID]
        monkeypatch.setattr(auth_module, "redis_client", mock_redis)

        request = _make_request(
            "/v1/auth/logout",
            method="POST",
            cookies={CookieNames.REFRESH_TOKEN: refresh_token},
        )
        response = await auth_module.logout(request, db=test_session)

        assert response.status_code == 200
        assert response.body.decode() == "Logged out successfully."
        # Only this session's key is revoked — other devices stay signed in.
        mock_redis.delete.assert_called_once_with(CacheKeys.refresh_token(str(user.id), token_jti))


class TestAuthMe:
    """Test /v1/auth/me endpoint."""

    @pytest.mark.asyncio
    async def test_me_returns_user_info(self, test_session):
        """Test authenticated request returns user info."""
        user = User(google_sub="test_sub_me", email="me@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        access_token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})

        request = _make_request(
            "/v1/auth/me",
            cookies={CookieNames.ACCESS_TOKEN: access_token},
        )
        response = await auth_module.get_current_user(request, db=test_session)

        assert response.id == str(user.id)
        assert response.email == "me@example.com"

    def test_me_returns_401_without_token(self, client):
        """Test unauthenticated request returns 401."""
        client.cookies.clear()
        response = client.get("/v1/auth/me")

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_me_returns_401_with_invalid_token(self, client):
        """Test invalid token returns 401."""
        client.cookies.set(CookieNames.ACCESS_TOKEN, "invalid_token_here")
        response = client.get("/v1/auth/me")

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token"

    def test_me_returns_401_with_expired_token(self, client):
        """Test expired token returns 401."""
        expired_payload = {
            JWTClaims.SUBJECT: "some-user-id",
            JWTClaims.EXPIRATION: datetime.now(UTC) - timedelta(hours=1),
            JWTClaims.TYPE: TokenType.ACCESS.value,
        }
        expired_token = jwt.encode(
            expired_payload,
            settings.secret_key,
            algorithm=settings.jwt_algorithm,
        )

        client.cookies.set(CookieNames.ACCESS_TOKEN, expired_token)
        response = client.get("/v1/auth/me")

        assert response.status_code == 401
        assert response.json()["detail"] == "Token has expired"

    def test_me_returns_401_with_refresh_token_type(self, client):
        """Test refresh token used as access token returns 401."""
        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: "some-user-id"})
        client.cookies.set(CookieNames.ACCESS_TOKEN, refresh_token)
        response = client.get("/v1/auth/me")

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid token type"

    @pytest.mark.asyncio
    async def test_me_returns_401_when_user_missing(self, test_session):
        """Test missing user in database returns 401."""
        access_token = create_access_token(data={JWTClaims.SUBJECT: "00000000-0000-0000-0000-000000000000"})
        request = _make_request(
            "/v1/auth/me",
            cookies={CookieNames.ACCESS_TOKEN: access_token},
        )

        with pytest.raises(AuthenticationRequired) as exc_info:
            await auth_module.get_current_user(request, db=test_session)

        assert exc_info.value.detail == "User not found"
