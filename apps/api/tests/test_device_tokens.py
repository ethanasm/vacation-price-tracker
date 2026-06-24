"""Tests for the device-token model + registration endpoints."""

import uuid

import pytest
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
