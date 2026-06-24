"""Tests for the mobile auth surface: Bearer-header auth, the mobile-token
bridge endpoint, and body/Bearer refresh."""

import uuid
from unittest.mock import AsyncMock

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
