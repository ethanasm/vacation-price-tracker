"""Tests for database models."""

import uuid
from datetime import UTC, datetime

import pytest
from app.models.user import User
from sqlalchemy.exc import IntegrityError


def set_test_timestamps(user: User) -> None:
    """Helper to set timestamps for SQLite tests (doesn't support server_default with RETURNING)."""
    now = datetime.now(UTC)
    user.created_at = now
    user.updated_at = now


class TestUserModel:
    """Test User model."""

    @pytest.mark.asyncio
    async def test_create_user(self, test_session):
        """Test basic user creation."""
        user = User(
            google_sub="test_google_sub_123",
            email="test@example.com"
        )
        set_test_timestamps(user)

        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Verify fields
        assert user.id is not None
        assert isinstance(user.id, uuid.UUID)
        assert user.google_sub == "test_google_sub_123"
        assert user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_user_timestamps_auto_populated(self, test_session):
        """Test that created_at and updated_at are set (in production by DB, in tests manually)."""
        user = User(
            google_sub="test_google_sub_456",
            email="timestamps@example.com"
        )
        set_test_timestamps(user)

        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Timestamps should be set
        assert user.created_at is not None
        assert user.updated_at is not None
        assert isinstance(user.created_at, datetime)
        assert isinstance(user.updated_at, datetime)

    @pytest.mark.asyncio
    async def test_user_unique_email(self, test_session):
        """Test that email must be unique."""
        user1 = User(google_sub="sub1", email="unique@example.com")
        set_test_timestamps(user1)
        test_session.add(user1)
        await test_session.commit()

        # Try to create another user with same email
        user2 = User(google_sub="sub2", email="unique@example.com")
        set_test_timestamps(user2)
        test_session.add(user2)

        with pytest.raises(IntegrityError):
            await test_session.commit()

    @pytest.mark.asyncio
    async def test_user_unique_google_sub(self, test_session):
        """Test that google_sub must be unique."""
        user1 = User(google_sub="unique_sub", email="user1@example.com")
        set_test_timestamps(user1)
        test_session.add(user1)
        await test_session.commit()

        # Try to create another user with same google_sub
        user2 = User(google_sub="unique_sub", email="user2@example.com")
        set_test_timestamps(user2)
        test_session.add(user2)

        with pytest.raises(IntegrityError):
            await test_session.commit()

    @pytest.mark.asyncio
    async def test_user_id_auto_generated(self, test_session):
        """Test that user ID is auto-generated as UUID."""
        user = User(google_sub="auto_id_sub", email="autoid@example.com")
        set_test_timestamps(user)

        # ID should be generated even before commit
        assert user.id is not None
        assert isinstance(user.id, uuid.UUID)

        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # ID should persist
        assert user.id is not None
