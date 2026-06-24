"""Tests for the mobile auth surface: Bearer-header auth, the mobile-token
bridge endpoint, and body/Bearer refresh."""

import uuid
from unittest.mock import AsyncMock, patch

import app.routers.auth as auth_module
import pytest
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims
from app.core.security import create_access_token
from app.models.user import User
from sqlmodel import select

from tests.test_models import set_test_timestamps


async def _make_user(session) -> User:
    user = User(google_sub=f"sub-{uuid.uuid4().hex}", email=f"{uuid.uuid4().hex}@example.com")
    set_test_timestamps(user)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


class TestBearerAuth:
    @pytest.mark.asyncio
    async def test_cookie_and_bearer_resolve_same_user(self, client, test_session):
        user = await _make_user(test_session)
        token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})

        cookie_resp = client.get("/v1/auth/me", cookies={CookieNames.ACCESS_TOKEN: token})
        bearer_resp = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert cookie_resp.status_code == 200
        assert bearer_resp.status_code == 200
        assert cookie_resp.json()["id"] == bearer_resp.json()["id"] == str(user.id)

    @pytest.mark.asyncio
    async def test_bad_bearer_token_401s(self, client, test_session):
        resp = client.get("/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_missing_both_401s(self, client, test_session):
        resp = client.get("/v1/auth/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_non_bearer_authorization_scheme_ignored(self, client, test_session):
        # A `Basic ...` header is not a bearer token → treated as no token → 401.
        resp = client.get("/v1/auth/me", headers={"Authorization": "Basic abc123"})
        assert resp.status_code == 401


class TestSettingsAndCsrf:
    def test_audiences_list_parses_and_trims(self, monkeypatch):
        from app.core.config import Settings

        s = Settings(google_oauth_mobile_audiences=" a.apps.googleusercontent.com , b.apps.googleusercontent.com ,")
        assert s.google_oauth_mobile_audiences_list == [
            "a.apps.googleusercontent.com",
            "b.apps.googleusercontent.com",
        ]

    def test_audiences_list_empty_when_unset(self):
        from app.core.config import Settings

        assert Settings(google_oauth_mobile_audiences="").google_oauth_mobile_audiences_list == []

    def test_mobile_endpoints_are_csrf_exempt(self):
        from app.middleware.csrf import _is_csrf_exempt

        assert _is_csrf_exempt("/v1/auth/mobile-token")
        assert _is_csrf_exempt("/v1/auth/refresh")
        assert _is_csrf_exempt("/v1/notifications/device-token")
        # The web cookie endpoints are NOT exempt.
        assert not _is_csrf_exempt("/v1/auth/logout")


class TestMobileToken:
    @pytest.mark.asyncio
    async def test_new_user_minted_and_returned_in_body(self, client, test_session, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        identity = auth_module.GoogleIdentity(
            sub="new-google-sub", email="new@example.com", email_verified=True
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})

        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["user"]["email"] == "new@example.com"
        assert body["user"]["email_notifications_enabled"] is True
        assert uuid.UUID(body["user"]["id"])  # valid uuid
        # The pair is in the BODY, never Set-Cookie.
        assert "set-cookie" not in {k.lower() for k in resp.headers}
        # User row was created.
        created = (
            await test_session.execute(select(User).where(User.google_sub == "new-google-sub"))
        ).scalars().first()
        assert created is not None

    @pytest.mark.asyncio
    async def test_existing_user_reused_no_duplicate(self, client, test_session, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        user = User(google_sub="existing-sub", email="existing@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        identity = auth_module.GoogleIdentity(
            sub="existing-sub", email="existing@example.com", email_verified=True
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})

        assert resp.status_code == 200
        assert resp.json()["user"]["id"] == str(user.id)
        rows = (
            await test_session.execute(select(User).where(User.google_sub == "existing-sub"))
        ).scalars().all()
        assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_invalid_google_token_401(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        with patch.object(
            auth_module, "verify_google_id_token", side_effect=auth_module.GoogleTokenError("bad")
        ):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_allowlist_denial_403(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        monkeypatch.setattr(settings, "auth_allowed_domains", "allowed.com")
        identity = auth_module.GoogleIdentity(
            sub="denied-sub", email="denied@notallowed.com", email_verified=True
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unverified_email_denied_403(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "aud-1")
        identity = auth_module.GoogleIdentity(
            sub="unv-sub", email="unverified@example.com", email_verified=False
        )
        with patch.object(auth_module, "verify_google_id_token", return_value=identity):
            resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_audiences_config_500(self, client, monkeypatch):
        monkeypatch.setattr(settings, "google_oauth_mobile_audiences", "")
        resp = client.post("/v1/auth/mobile-token", json={"id_token": "x" * 30})
        assert resp.status_code == 500


class TestRefresh:
    @pytest.mark.asyncio
    async def test_body_refresh_returns_new_pair_in_body(self, client, test_session, mock_redis):
        from app.core.security import create_refresh_token

        user = await _make_user(test_session)
        rt = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        # The endpoint checks Redis for the stored refresh token.
        mock_redis.get = AsyncMock(return_value=rt)

        resp = client.post("/v1/auth/refresh", json={"refresh_token": rt})

        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["user"]["id"] == str(user.id)
        assert "set-cookie" not in {k.lower() for k in resp.headers}

    @pytest.mark.asyncio
    async def test_cookie_refresh_still_sets_cookies(self, client, test_session, mock_redis):
        from app.core.constants import CookieNames as CN
        from app.core.security import create_refresh_token

        user = await _make_user(test_session)
        rt = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        mock_redis.get = AsyncMock(return_value=rt)

        resp = client.post("/v1/auth/refresh", cookies={CN.REFRESH_TOKEN: rt})

        assert resp.status_code == 200
        assert "set-cookie" in {k.lower() for k in resp.headers}

    @pytest.mark.asyncio
    async def test_body_refresh_rotated_token_401(self, client, test_session, mock_redis):
        from app.core.security import create_refresh_token

        user = await _make_user(test_session)
        rt = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        mock_redis.get = AsyncMock(return_value="a-different-stored-token")

        resp = client.post("/v1/auth/refresh", json={"refresh_token": rt})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_no_token_anywhere_401(self, client, mock_redis):
        resp = client.post("/v1/auth/refresh")
        assert resp.status_code == 401
