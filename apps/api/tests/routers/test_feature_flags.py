"""Tests for the admin-user feature-flag endpoints (/v1/feature-flags)."""

import uuid

import pytest
from app.core.admins import admin_email_set, is_admin_email
from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims
from app.core.security import create_access_token
from app.models.user import User

from tests.test_models import set_test_timestamps

ADMIN_EMAIL = "admin@example.com"


def _authorize(client, user: User) -> None:
    client.cookies.set(
        CookieNames.ACCESS_TOKEN, create_access_token(data={JWTClaims.SUBJECT: str(user.id)})
    )


async def _create_user(test_session, email: str = ADMIN_EMAIL) -> User:
    user = User(google_sub=str(uuid.uuid4()), email=email)
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


class TestAdminsHelper:
    def test_parses_and_normalizes(self, monkeypatch):
        monkeypatch.setattr(settings, "admin_emails", " Alice@Example.com ,bob@example.com,, ")
        assert admin_email_set() == frozenset({"alice@example.com", "bob@example.com"})
        assert is_admin_email("ALICE@example.COM") is True
        assert is_admin_email("mallory@example.com") is False

    def test_empty_and_none(self, monkeypatch):
        monkeypatch.setattr(settings, "admin_emails", "")
        assert admin_email_set() == frozenset()
        assert is_admin_email("anyone@example.com") is False
        assert is_admin_email(None) is False
        assert is_admin_email("") is False


@pytest.mark.asyncio
async def test_me_reports_admin_status(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    # Case-insensitive match against the env list
    monkeypatch.setattr(settings, "admin_emails", f"other@example.com, {ADMIN_EMAIL.upper()} ")
    _authorize(client_with_csrf, user)

    response = client_with_csrf.get("/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["is_admin"] is True


@pytest.mark.asyncio
async def test_me_non_admin(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session, email="pleb@example.com")
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.get("/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["is_admin"] is False


@pytest.mark.asyncio
async def test_flags_require_auth(client_with_csrf):
    assert client_with_csrf.get("/v1/feature-flags").status_code == 401


@pytest.mark.asyncio
async def test_flags_non_admin_forbidden(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session, email="pleb@example.com")
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    assert client_with_csrf.get("/v1/feature-flags").status_code == 403
    response = client_with_csrf.patch("/v1/feature-flags/beta_optimizer", json={"enabled": True})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_flags_admin_lists(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.get("/v1/feature-flags")
    assert response.status_code == 200
    flags = {f["name"]: f for f in response.json()["flags"]}
    assert "beta_optimizer" in flags
    assert flags["beta_optimizer"]["enabled"] is False
    assert flags["beta_optimizer"]["description"]


@pytest.mark.asyncio
async def test_flags_admin_toggles(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.patch("/v1/feature-flags/beta_optimizer", json={"enabled": True})
    assert response.status_code == 200
    assert response.json() == {
        "name": "beta_optimizer",
        "description": response.json()["description"],
        "enabled": True,
    }

    flags = {
        f["name"]: f["enabled"]
        for f in client_with_csrf.get("/v1/feature-flags").json()["flags"]
    }
    assert flags["beta_optimizer"] is True

    response = client_with_csrf.patch("/v1/feature-flags/beta_optimizer", json={"enabled": False})
    assert response.status_code == 200
    assert response.json()["enabled"] is False


@pytest.mark.asyncio
async def test_flags_unknown_404(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.patch("/v1/feature-flags/bogus", json={"enabled": True})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_flags_invalid_body_422(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.patch("/v1/feature-flags/beta_optimizer", json={"enabled": "yes"})
    assert response.status_code == 422
