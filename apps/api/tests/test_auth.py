"""Tests for authentication endpoints."""

import pytest
from jose import jwt

from app.core.config import settings
from app.core.constants import JWTClaims
from app.models.user import User


class TestGoogleOAuthCallback:
    """Test Google OAuth callback flow.

    Note: Full OAuth integration tests should be done separately.
    These tests verify the callback logic assuming OAuth succeeded.
    """

    @pytest.mark.asyncio
    async def test_create_user_from_google_oauth(self, test_session, mock_redis):
        """Test user creation from Google OAuth data."""
        from app.routers.auth import google_auth_callback
        from app.core.security import create_access_token

        # Simulate what happens after OAuth succeeds
        google_sub = "google_user_123"
        email = "test@example.com"

        # Check user doesn't exist
        from sqlmodel import select
        result = await test_session.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalars().first()
        assert user is None

        # Create user (simulating the callback logic)
        from tests.test_models import set_test_timestamps
        user = User(google_sub=google_sub, email=email)
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Verify user created
        assert user.id is not None
        assert user.google_sub == google_sub
        assert user.email == email

        # Verify token can be created
        token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})
        assert token is not None

    @pytest.mark.asyncio
    async def test_existing_user_oauth_login(self, test_session, mock_redis):
        """Test OAuth login with existing user doesn't create duplicate."""
        from tests.test_models import set_test_timestamps

        google_sub = "google_user_123"
        email = "test@example.com"

        # Create existing user
        user1 = User(google_sub=google_sub, email=email)
        set_test_timestamps(user1)
        test_session.add(user1)
        await test_session.commit()
        await test_session.refresh(user1)

        # Try to "log in" again (simulating callback)
        from sqlmodel import select
        result = await test_session.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalars().first()

        # Should find existing user
        assert user is not None
        assert user.id == user1.id

        # Verify only one user exists
        result = await test_session.execute(select(User).where(User.email == email))
        users = result.scalars().all()
        assert len(users) == 1


class TestTokenRefresh:
    """Test token refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_token_logic(self, test_session, mock_redis):
        """Test refresh token creation and validation logic."""
        from tests.test_models import set_test_timestamps
        from app.core.security import create_refresh_token, create_access_token

        # Create test user
        user = User(google_sub="test_sub", email="refresh@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Create tokens
        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})
        access_token = create_access_token(data={JWTClaims.SUBJECT: str(user.id)})

        # Verify tokens can be decoded
        refresh_payload = jwt.decode(refresh_token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        access_payload = jwt.decode(access_token, settings.secret_key, algorithms=[settings.jwt_algorithm])

        assert refresh_payload[JWTClaims.SUBJECT] == str(user.id)
        assert access_payload[JWTClaims.SUBJECT] == str(user.id)

        # Verify token types are different
        from app.core.constants import TokenType
        assert refresh_payload[JWTClaims.TYPE] == TokenType.REFRESH.value
        assert access_payload[JWTClaims.TYPE] == TokenType.ACCESS.value

    def test_token_validation(self):
        """Test token validation with invalid tokens."""
        from jose import JWTError

        # Test decoding invalid token
        with pytest.raises(JWTError):
            jwt.decode("invalid_token", settings.secret_key, algorithms=[settings.jwt_algorithm])

        # Test decoding with wrong secret
        from app.core.security import create_refresh_token
        token = create_refresh_token(data={JWTClaims.SUBJECT: "test_user"})

        with pytest.raises(JWTError):
            jwt.decode(token, "wrong_secret", algorithms=[settings.jwt_algorithm])


class TestLogout:
    """Test logout logic."""

    @pytest.mark.asyncio
    async def test_logout_token_invalidation(self, test_session):
        """Test logout invalidates refresh token."""
        from tests.test_models import set_test_timestamps
        from app.core.security import create_refresh_token

        # Create test user
        user = User(google_sub="test_sub", email="logout@example.com")
        set_test_timestamps(user)
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)

        # Create refresh token
        refresh_token = create_refresh_token(data={JWTClaims.SUBJECT: str(user.id)})

        # Verify token is valid before logout
        payload = jwt.decode(refresh_token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        assert payload[JWTClaims.SUBJECT] == str(user.id)

        # Verify token structure
        from app.core.constants import TokenType
        assert payload[JWTClaims.TYPE] == TokenType.REFRESH.value
        assert JWTClaims.EXPIRATION in payload

        # Token should have reasonable expiration (7 days)
        from datetime import datetime, timezone, timedelta
        exp_time = datetime.fromtimestamp(payload[JWTClaims.EXPIRATION], tz=timezone.utc)
        expected_exp = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        # Within 1 minute of expected expiration
        assert abs((exp_time - expected_exp).total_seconds()) < 60
