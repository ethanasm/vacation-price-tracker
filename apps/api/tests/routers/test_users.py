"""Tests for the user preferences endpoint + /v1/auth/me exposure."""

import uuid

import pytest
from app.core.constants import CookieNames, JWTClaims
from app.core.security import create_access_token
from app.models.user import User

from tests.test_models import set_test_timestamps


def _authorize(client, user: User) -> None:
    client.cookies.set(CookieNames.ACCESS_TOKEN, create_access_token(data={JWTClaims.SUBJECT: str(user.id)}))


async def _create_user(test_session, *, enabled: bool = True) -> User:
    user = User(
        google_sub=str(uuid.uuid4()),
        email="settings@example.com",
        email_notifications_enabled=enabled,
    )
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_me_exposes_email_notifications_enabled(client_with_csrf, test_session):
    user = await _create_user(test_session, enabled=False)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.get("/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["email_notifications_enabled"] is False


@pytest.mark.asyncio
async def test_update_preferences_disables_emails(client_with_csrf, test_session):
    user = await _create_user(test_session, enabled=True)
    _authorize(client_with_csrf, user)

    response = client_with_csrf.patch(
        "/v1/users/preferences", json={"email_notifications_enabled": False}
    )

    assert response.status_code == 200
    assert response.json()["email_notifications_enabled"] is False
    await test_session.refresh(user)
    assert user.email_notifications_enabled is False


@pytest.mark.asyncio
async def test_update_preferences_requires_auth(client_with_csrf):
    response = client_with_csrf.patch(
        "/v1/users/preferences", json={"email_notifications_enabled": True}
    )
    assert response.status_code == 401
