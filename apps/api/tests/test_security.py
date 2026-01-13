"""Tests for security utilities (JWT token creation/validation)."""

from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.core.constants import JWTClaims, TokenType
from app.core.security import create_access_token, create_refresh_token, get_cookie_params
from jose import jwt


class TestTokenCreation:
    """Test JWT token creation."""

    def test_create_access_token(self):
        """Test access token creation with correct claims."""
        user_id = "123e4567-e89b-12d3-a456-426614174000"
        token = create_access_token(data={JWTClaims.SUBJECT: user_id})

        # Decode and verify
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])

        assert payload[JWTClaims.SUBJECT] == user_id
        assert payload[JWTClaims.TYPE] == TokenType.ACCESS.value
        assert JWTClaims.EXPIRATION in payload

        # Verify expiration is approximately correct (within 1 minute)
        exp_time = datetime.fromtimestamp(payload[JWTClaims.EXPIRATION], tz=UTC)
        expected_exp = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
        assert abs((exp_time - expected_exp).total_seconds()) < 60

    def test_create_refresh_token(self):
        """Test refresh token creation with correct claims."""
        user_id = "123e4567-e89b-12d3-a456-426614174000"
        token = create_refresh_token(data={JWTClaims.SUBJECT: user_id})

        # Decode and verify
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])

        assert payload[JWTClaims.SUBJECT] == user_id
        assert payload[JWTClaims.TYPE] == TokenType.REFRESH.value
        assert JWTClaims.EXPIRATION in payload

        # Verify expiration is approximately correct (within 1 minute)
        exp_time = datetime.fromtimestamp(payload[JWTClaims.EXPIRATION], tz=UTC)
        expected_exp = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
        assert abs((exp_time - expected_exp).total_seconds()) < 60

    def test_token_immutability(self):
        """Test that original data dict is not modified."""
        original_data = {JWTClaims.SUBJECT: "test_user"}
        original_keys = set(original_data.keys())

        create_access_token(data=original_data)

        # Original dict should be unchanged
        assert set(original_data.keys()) == original_keys
        assert JWTClaims.EXPIRATION not in original_data


class TestCookieParams:
    """Test cookie parameter generation."""

    def test_get_cookie_params_development(self):
        """Test cookie params in development mode."""
        # Force development mode
        original_env = settings.environment
        settings.environment = "development"

        params = get_cookie_params()

        assert params["httponly"] is True
        assert params["samesite"] == "lax"
        assert params["secure"] is False  # Not production
        assert params["path"] == "/"

        # Restore
        settings.environment = original_env

    def test_get_cookie_params_production(self):
        """Test cookie params in production mode."""
        # Force production mode
        original_env = settings.environment
        settings.environment = "production"

        params = get_cookie_params()

        assert params["httponly"] is True
        assert params["samesite"] == "lax"
        assert params["secure"] is True  # Production
        assert params["path"] == "/"

        # Restore
        settings.environment = original_env
