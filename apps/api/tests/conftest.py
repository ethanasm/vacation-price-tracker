"""Pytest fixtures for testing."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock

from app.db.deps import get_db

# Test database URL (use file-based SQLite with shared cache for tests)
import tempfile
import os

TEST_DB_FILE = os.path.join(tempfile.gettempdir(), "test_vacation_tracker.db")
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"


@pytest.fixture(scope="session")
def anyio_backend():
    """Use asyncio for async tests."""
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    """Create a test database engine for each test."""
    from app.models.user import User  # Import models to register them

    # Remove old test DB if exists
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    yield engine

    await engine.dispose()

    # Clean up test DB after test
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)


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
    return mock


@pytest.fixture
def app(test_session, mock_redis):
    """Create FastAPI test application."""
    from app.main import app as fastapi_app

    # Override dependencies
    async def override_get_db():
        yield test_session

    fastapi_app.dependency_overrides[get_db] = override_get_db

    # Mock redis_client globally
    import app.routers.auth as auth_module
    auth_module.redis_client = mock_redis

    yield fastapi_app

    # Clean up
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


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
        }
    }
