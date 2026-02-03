"""Pytest fixtures for testing."""

import os
import tempfile
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from app.core.constants import CookieNames, HeaderNames
from app.db.deps import get_db
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel


@pytest.fixture(scope="session")
def anyio_backend():
    """Use asyncio for async tests."""
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Create a test database engine for each test.

    Uses a unique database file per test to avoid race conditions
    when tests run in parallel.
    """
    # Import all models so SQLAlchemy registers them with metadata
    from app.models import (
        Conversation,
        Message,
        NotificationRule,
        PriceSnapshot,
        Trip,
        TripFlightPrefs,
        TripHotelPrefs,
        User,
    )

    # Reference models to avoid unused import warnings
    _ = (User, Trip, TripFlightPrefs, TripHotelPrefs, PriceSnapshot, NotificationRule, Conversation, Message)

    # Use unique file per test to avoid race conditions in parallel execution
    test_db_file = os.path.join(tempfile.gettempdir(), f"test_vacation_tracker_{uuid.uuid4().hex}.db")
    test_database_url = f"sqlite+aiosqlite:///{test_db_file}"

    engine = create_async_engine(
        test_database_url,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    yield engine

    await engine.dispose()

    # Clean up test DB after test
    if os.path.exists(test_db_file):
        try:
            os.remove(test_db_file)
        except OSError:
            pass  # Ignore cleanup errors


@pytest_asyncio.fixture(scope="function")
async def test_session(test_engine):
    """Create a test database session for each test."""
    async_session = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()  # Rollback any uncommitted changes


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    mock = MagicMock()
    mock.set = AsyncMock(return_value=True)
    mock.get = AsyncMock(return_value=None)
    mock.delete = AsyncMock(return_value=1)
    mock.ping = AsyncMock(return_value=True)
    # Rate limiting Lua script returns [allowed, remaining, retry_after]
    mock.eval = AsyncMock(return_value=[1, 99, 0])
    return mock


@pytest.fixture
def mock_temporal_client():
    """Mock Temporal client for testing."""
    mock = MagicMock()
    mock.start_workflow = AsyncMock()
    mock.get_workflow_handle = MagicMock()
    return mock


@pytest.fixture
def app(test_session, mock_redis, mock_temporal_client):
    """Create FastAPI test application."""
    from app.main import app as fastapi_app

    # Override dependencies
    async def override_get_db():
        yield test_session

    fastapi_app.dependency_overrides[get_db] = override_get_db

    # Mock redis_client globally
    import app.main as main_module
    import app.middleware.idempotency as idempotency_module
    import app.middleware.rate_limit as rate_limit_module
    import app.routers.auth as auth_module

    auth_module.redis_client = mock_redis
    idempotency_module.redis_client = mock_redis
    rate_limit_module.redis_client = mock_redis
    main_module.redis_client = mock_redis

    # Mock temporal_client globally
    import app.db.temporal as temporal_module

    temporal_module.temporal_client = mock_temporal_client

    yield fastapi_app

    # Clean up
    fastapi_app.dependency_overrides.clear()
    temporal_module.temporal_client = None


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def csrf_token():
    """Provide a deterministic CSRF token for tests."""
    return "test-csrf-token"


@pytest.fixture
def csrf_headers(csrf_token):
    """Standard CSRF headers for unsafe requests."""
    return {HeaderNames.CSRF_TOKEN: csrf_token}


@pytest.fixture
def client_with_csrf(client, csrf_token):
    """Test client preloaded with a CSRF cookie."""
    client.cookies.set(CookieNames.CSRF_TOKEN, csrf_token)
    client.headers.update({HeaderNames.CSRF_TOKEN: csrf_token})
    return client


@pytest.fixture
def mock_oauth_token():
    """Mock Google OAuth token response."""
    return {
        "access_token": "mock_google_access_token",
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": "openid email profile",
        "userinfo": {
            "sub": "google_user_123",
            "email": "test@example.com",
            "email_verified": True,
            "name": "Test User",
        },
    }
