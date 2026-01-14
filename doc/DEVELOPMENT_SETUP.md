# Development Setup Guide

## Quick Start

```bash
# 1. Install dependencies
uv sync --extra dev

# 2. Copy environment template
cp .env.example .env
# Edit .env with your credentials

# 3. Run tests
uv run pytest apps/api/tests/ -v

# 4. Lint code
uv run ruff check apps/api/app/ --fix
uv run ruff format apps/api/app/
```

## Tools & Commands

### Package Management (uv)
```bash
# Install all dependencies
uv sync

# Install with dev dependencies
uv sync --extra dev

# Add a new dependency
uv add <package-name>

# Add a dev dependency
uv add --dev <package-name>

# Update dependencies
uv sync --upgrade
```

### Testing (pytest)
```bash
# Run all tests
uv run pytest apps/api/tests/ -v

# Run specific test file
uv run pytest apps/api/tests/test_auth.py -v

# Run specific test
uv run pytest apps/api/tests/test_auth.py::TestTokenRefresh::test_refresh_token_logic -v

# Run with coverage
uv run pytest apps/api/tests/ --cov=app --cov-report=html
# View coverage report: open htmlcov/index.html

# Run in watch mode (requires pytest-watch)
uv run ptw apps/api/tests/ -- -v
```

### Frontend Testing (Jest)
```bash
# Run web tests
pnpm test

# Watch mode
pnpm watch
```

### Linting & Formatting (Ruff)
```bash
# Check for linting issues
uv run ruff check apps/api/app/

# Auto-fix linting issues
uv run ruff check apps/api/app/ --fix

# Format code (like Black)
uv run ruff format apps/api/app/

# Check + format in one command
uv run ruff check apps/api/app/ --fix && uv run ruff format apps/api/app/

# Check tests too
uv run ruff check apps/api/tests/ --fix
uv run ruff format apps/api/tests/
```

### Code Quality (SonarQube)
```bash
# Run SonarQube scan (configured in sonar-project.properties)
pnpm sonar
```
Connect the SonarQube/SonarCloud project in your IDE via SonarLint to surface warnings before pushing.

### Security (pip-audit)
When updating dependencies or adding new ones, it's important to check for known security vulnerabilities.

```bash
# Run security audit
uv run pip-audit

# Ignore a specific vulnerability (e.g., if risk is accepted)
uv run pip-audit --ignore-vuln <CVE-ID>
```

### Security (pnpm audit)
When updating frontend dependencies, run a pnpm audit.

```bash
# Run security audit
cd apps/web
pnpm audit

# Limit to production dependencies
pnpm audit --prod

# JSON output (CI-friendly)
pnpm audit --json
```

### Running the API Server
```bash
# Development mode (auto-reload)
cd apps/api
uv run uvicorn app.main:app --reload --port 8000

# Production mode
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Database Migrations (Alembic)
```bash
# Create a new migration
cd apps/api
uv run alembic revision --autogenerate -m "Description of changes"

# Apply migrations
uv run alembic upgrade head

# Rollback one migration
uv run alembic downgrade -1

# View migration history
uv run alembic history

# View current version
uv run alembic current
```

### Docker Services
```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d db redis temporal

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

## Pre-Commit Checklist

Before committing code, run:

```bash
# 1. Format code
uv run ruff format apps/api/app/

# 2. Fix linting issues
uv run ruff check apps/api/app/ --fix

# 3. Run tests
uv run pytest apps/api/tests/ -v

# 4. Check git status
git status
```

## IDE Setup

### PyCharm / IntelliJ IDEA
1. Open project at root: `/Users/you/vacation-price-tracker`
2. Set Python interpreter: `.venv/bin/python3.12`
3. Mark `apps/api` as **Sources Root**
4. Configure Ruff:
   - Settings → Tools → Ruff
   - Enable "Run Ruff on save"
5. Configure pytest:
   - Settings → Tools → Python Integrated Tools
   - Default test runner: pytest
   - Working directory: project root

### VS Code
1. Install extensions:
   - Python (Microsoft)
   - Ruff
   - Pylance
2. Configure `.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": ".venv/bin/python",
  "python.testing.pytestEnabled": true,
  "python.testing.pytestArgs": ["apps/api/tests"],
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll": true,
      "source.organizeImports": true
    }
  }
}
```

## Troubleshooting

### Import Errors
If you get `ModuleNotFoundError: No module named 'app'`:
1. Ensure virtual environment is activated
2. Check that `apps/api` is marked as Sources Root in IDE
3. Verify `PYTHONPATH` includes project root

### Test Database Issues
If tests fail with "no such table":
1. Check that `test_engine` fixture is creating tables
2. Verify SQLModel models are imported in conftest.py
3. Try deleting `/tmp/test_vacation_tracker.db` and re-run

### Ruff Not Found
If `ruff: command not found`:
```bash
# Reinstall dev dependencies
uv sync --extra dev

# Or run with full path
.venv/bin/ruff check apps/api/app/
```

## Environment Variables

See `.env.example` for all available configuration options.

**Minimum required for development:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `SECRET_KEY` - JWT signing key (generate with `openssl rand -hex 32`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` - Hotel data API

**Optional:**
- `GROQ_API_KEY` - LLM chat (Phase 2)
- `KIWI_API_KEY` - Flight data (free tier works without)
- `SEARCHAPI_KEY` - Date optimizer (Phase 4)
