"""Tests for the email notification (unsubscribe) endpoints."""

import uuid

import pytest
from app.core.security import make_unsubscribe_token
from app.models.user import User

from tests.test_models import set_test_timestamps


async def _create_user(test_session, *, enabled: bool = True) -> User:
    user = User(
        google_sub=str(uuid.uuid4()),
        email="traveler@example.com",
        email_notifications_enabled=enabled,
    )
    set_test_timestamps(user)
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_unsubscribe_valid_token_disables_emails(client, test_session):
    user = await _create_user(test_session)
    token = make_unsubscribe_token(str(user.id))

    response = client.get(f"/v1/notifications/unsubscribe?token={token}")

    assert response.status_code == 200
    assert "unsubscribed" in response.text.lower()
    await test_session.refresh(user)
    assert user.email_notifications_enabled is False


@pytest.mark.asyncio
async def test_unsubscribe_one_click_post(client, test_session):
    user = await _create_user(test_session)
    token = make_unsubscribe_token(str(user.id))

    response = client.post(f"/v1/notifications/unsubscribe?token={token}")

    assert response.status_code == 200
    await test_session.refresh(user)
    assert user.email_notifications_enabled is False


@pytest.mark.asyncio
async def test_unsubscribe_invalid_token(client, test_session):
    response = client.get("/v1/notifications/unsubscribe?token=not-a-real-token")
    assert response.status_code == 400
    assert "invalid" in response.text.lower()


@pytest.mark.asyncio
async def test_unsubscribe_unknown_user(client):
    token = make_unsubscribe_token(str(uuid.uuid4()))
    response = client.get(f"/v1/notifications/unsubscribe?token={token}")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_unsubscribe_is_idempotent(client, test_session):
    user = await _create_user(test_session, enabled=False)
    token = make_unsubscribe_token(str(user.id))

    response = client.get(f"/v1/notifications/unsubscribe?token={token}")

    assert response.status_code == 200
    await test_session.refresh(user)
    assert user.email_notifications_enabled is False
