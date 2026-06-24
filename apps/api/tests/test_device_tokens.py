"""Tests for the device-token model + registration endpoints."""

import uuid

import pytest
from app.core.constants import JWTClaims
from app.core.security import create_access_token
from app.models.device_token import DeviceToken
from app.models.user import User
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from tests.test_models import set_test_timestamps


async def _user(session) -> User:
    u = User(google_sub=f"sub-{uuid.uuid4().hex}", email=f"{uuid.uuid4().hex}@example.com")
    set_test_timestamps(u)
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u


class TestDeviceTokenModel:
    @pytest.mark.asyncio
    async def test_can_persist_a_device_token(self, test_session):
        user = await _user(test_session)
        dt = DeviceToken(user_id=user.id, expo_push_token="ExponentPushToken[abc]", platform="ios")
        set_test_timestamps(dt)
        test_session.add(dt)
        await test_session.commit()

        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert len(rows) == 1
        assert rows[0].expo_push_token == "ExponentPushToken[abc]"
        assert rows[0].platform == "ios"

    @pytest.mark.asyncio
    async def test_token_is_unique(self, test_session):
        user = await _user(test_session)
        for _ in range(1):
            dt = DeviceToken(user_id=user.id, expo_push_token="ExponentPushToken[dup]", platform="ios")
            set_test_timestamps(dt)
            test_session.add(dt)
            await test_session.commit()
        dup = DeviceToken(user_id=user.id, expo_push_token="ExponentPushToken[dup]", platform="android")
        set_test_timestamps(dup)
        test_session.add(dup)
        with pytest.raises(IntegrityError):
            await test_session.commit()


def _auth(user) -> dict:
    token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})
    return {"Authorization": f"Bearer {token}"}


class TestDeviceTokenEndpoints:
    @pytest.mark.asyncio
    async def test_register_creates_token(self, client, test_session):
        user = await _user(test_session)
        resp = client.post(
            "/v1/notifications/device-token",
            headers=_auth(user),
            json={"expo_push_token": "ExponentPushToken[reg1]", "platform": "ios"},
        )
        assert resp.status_code == 200
        assert resp.json()["expo_push_token"] == "ExponentPushToken[reg1]"
        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert len(rows) == 1
        assert rows[0].user_id == user.id

    @pytest.mark.asyncio
    async def test_register_is_idempotent_upsert(self, client, test_session):
        user = await _user(test_session)
        body = {"expo_push_token": "ExponentPushToken[same]", "platform": "ios"}
        client.post("/v1/notifications/device-token", headers=_auth(user), json=body)
        # Re-register the same token (e.g. platform corrected to android).
        body2 = {"expo_push_token": "ExponentPushToken[same]", "platform": "android"}
        resp = client.post("/v1/notifications/device-token", headers=_auth(user), json=body2)
        assert resp.status_code == 200
        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert len(rows) == 1
        assert rows[0].platform == "android"

    @pytest.mark.asyncio
    async def test_delete_removes_token(self, client, test_session):
        user = await _user(test_session)
        body = {"expo_push_token": "ExponentPushToken[del]", "platform": "ios"}
        client.post("/v1/notifications/device-token", headers=_auth(user), json=body)
        resp = client.request(
            "DELETE",
            "/v1/notifications/device-token",
            headers=_auth(user),
            json={"expo_push_token": "ExponentPushToken[del]", "platform": "ios"},
        )
        assert resp.status_code == 204
        rows = (await test_session.execute(select(DeviceToken))).scalars().all()
        assert rows == []

    @pytest.mark.asyncio
    async def test_delete_nonexistent_is_noop_204(self, client, test_session):
        user = await _user(test_session)
        resp = client.request(
            "DELETE",
            "/v1/notifications/device-token",
            headers=_auth(user),
            json={"expo_push_token": "ExponentPushToken[never]", "platform": "ios"},
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_register_requires_auth(self, client, test_session):
        resp = client.post(
            "/v1/notifications/device-token",
            json={"expo_push_token": "ExponentPushToken[x]", "platform": "ios"},
        )
        assert resp.status_code == 401
