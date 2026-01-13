# Test Structure

## Current: Unit Tests

```
apps/api/tests/
├── __init__.py
├── conftest.py              # Shared fixtures
├── test_auth.py             # Auth logic unit tests
├── test_models.py           # Database model tests
└── test_security.py         # JWT/security utils tests
```

**What they test:**
- Business logic in isolation
- Database models with SQLite
- JWT token creation/validation
- Security utilities

**What they DON'T test:**
- Real HTTP requests/responses
- Full OAuth flow with Google
- Redis integration
- Database migrations
- CORS/middleware

## Future: Integration Tests

```
apps/api/tests/
├── unit/                    # Current tests move here
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_models.py
│   └── test_security.py
│
├── integration/             # Add these later (Phase 1 complete)
│   ├── __init__.py
│   ├── conftest.py          # Real DB, real Redis fixtures
│   ├── test_auth_api.py     # Full auth flow with TestClient
│   ├── test_oauth_flow.py   # Mock Google OAuth but test full callback
│   └── test_redis.py        # Test actual Redis operations
│
└── e2e/                     # End-to-end tests (Phase 2+)
    ├── __init__.py
    ├── conftest.py          # Playwright/Selenium setup
    ├── test_user_journey.py # Login → Create trip → View dashboard
    └── test_oauth_google.py # Real browser OAuth flow (optional)
```

## Running Tests

```bash
# Unit tests (fast, no external dependencies)
uv run pytest apps/api/tests/unit/ -v

# Integration tests (requires Docker Compose)
docker-compose up -d db redis
uv run pytest apps/api/tests/integration/ -v

# E2E tests (requires full stack running)
./scripts/dev.sh &
uv run pytest apps/api/tests/e2e/ -v --headed

# All tests
uv run pytest apps/api/tests/ -v
```

## Integration Test Example

```python
# tests/integration/test_auth_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_full_auth_flow(real_app, real_db):
    """Test complete auth flow with real database."""
    async with AsyncClient(app=real_app, base_url="http://test") as client:
        # Mock OAuth callback
        response = await client.get("/v1/auth/google/callback")

        # Should redirect to frontend
        assert response.status_code == 200

        # Should set cookies
        assert "access_token_cookie" in response.cookies

        # Should create user in real DB
        user = await real_db.get(User, ...)
        assert user is not None
```

## When to Add Integration Tests

**Phase 1 Complete:**
- Add `integration/` for API endpoint testing
- Test with real PostgreSQL + Redis (Docker)

**Phase 2 (Chat Feature):**
- Add integration tests for LLM/MCP interactions
- Mock Groq API responses

**Phase 3 (Scheduled Jobs):**
- Add integration tests for Temporal workflows
- Test actual workflow execution

**Phase 4 (Optimizer):**
- Add E2E tests for multi-step user flows
- Playwright for browser testing (optional)
