"""Tests for the admin-user app-setting endpoints (/v1/app-settings)."""

import uuid

import pytest
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


@pytest.mark.asyncio
async def test_settings_require_auth(client_with_csrf):
    assert client_with_csrf.get("/v1/app-settings").status_code == 401


@pytest.mark.asyncio
async def test_settings_non_admin_forbidden(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session, email="pleb@example.com")
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    assert client_with_csrf.get("/v1/app-settings").status_code == 403
    response = client_with_csrf.patch("/v1/app-settings/flight_provider", json={"value": "kiwi"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_settings_admin_lists(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.get("/v1/app-settings")
    assert response.status_code == 200
    by_name = {s["name"]: s for s in response.json()["settings"]}
    assert "flight_provider" in by_name
    provider = by_name["flight_provider"]
    assert provider["value"] == "skiplagged"
    assert provider["description"]
    assert provider["allowed_values"] == ["skiplagged", "kiwi", "fast_flights"]


@pytest.mark.asyncio
async def test_settings_admin_switches_between_providers(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    for value in ("kiwi", "fast_flights", "skiplagged"):
        response = client_with_csrf.patch(
            "/v1/app-settings/flight_provider", json={"value": value}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "flight_provider"
        assert body["value"] == value

        listed = {
            s["name"]: s["value"]
            for s in client_with_csrf.get("/v1/app-settings").json()["settings"]
        }
        assert listed["flight_provider"] == value


@pytest.mark.asyncio
async def test_settings_unknown_404(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.patch("/v1/app-settings/bogus", json={"value": "skiplagged"})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_settings_disallowed_value_400(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.patch(
        "/v1/app-settings/flight_provider", json={"value": "expedia"}
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_settings_non_string_value_422(client_with_csrf, test_session, monkeypatch):
    user = await _create_user(test_session)
    monkeypatch.setattr(settings, "admin_emails", ADMIN_EMAIL)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.patch("/v1/app-settings/flight_provider", json={"value": True})
    assert response.status_code == 422
