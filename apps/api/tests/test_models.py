"""Tests for database models."""

import uuid
from datetime import UTC, datetime

import pytest
from app.models.notification_outbox import NotificationOutbox
from app.models.user import User
from sqlalchemy import Enum
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
        user = User(google_sub="test_google_sub_123", email="test@example.com")
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
        user = User(google_sub="test_google_sub_456", email="timestamps@example.com")
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


class TestNotificationOutboxColumns:
    """Guard the outbox enum columns' VARCHAR mapping.

    Migration 007_notification_outbox created ``status`` and ``threshold_type``
    as VARCHAR(20) holding the StrEnum *values*. A bare enum annotation makes
    SQLModel emit a native Postgres ENUM type (``notificationstatus``) that was
    never created, so every prod query against these columns failed with
    UndefinedObjectError — invisible on the SQLite test DB, which never casts.
    """

    def test_status_and_threshold_type_render_varchar(self):
        # Since 013_enum_cols_to_varchar these use varchar_enum(): an sa.Enum
        # that renders VARCHAR(20) (native_enum=False) and stores the StrEnum
        # *values* — same DDL as the plain String(20) this replaced, but rows
        # load back as enum members. test_no_native_enum_model_columns guards
        # the same contract metadata-wide; this pins the outbox specifics.
        table = NotificationOutbox.__table__
        for column in (table.c.status, table.c.threshold_type):
            assert isinstance(column.type, Enum), column.name
            assert column.type.native_enum is False, column.name
            assert column.type.length == 20, column.name
            assert column.nullable is False, column.name
        assert sorted(table.c.status.type.enums) == ["failed", "pending", "sent"]
        assert sorted(table.c.threshold_type.type.enums) == [
            "flight_total",
            "hotel_total",
            "trip_total",
        ]

    def test_server_defaults_match_migration(self):
        table = NotificationOutbox.__table__
        assert table.c.status.server_default.arg == "pending"
        assert table.c.threshold_type.server_default.arg == "trip_total"
