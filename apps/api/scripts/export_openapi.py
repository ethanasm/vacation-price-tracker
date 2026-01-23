#!/usr/bin/env python3
"""Export OpenAPI schema from FastAPI routers without running the full app.

This script builds a minimal FastAPI app with only the route definitions
to generate the OpenAPI schema, avoiding database and external service initialization.
"""

import json
import os
import sys
from pathlib import Path

# Set dummy environment variables for config loading
_DUMMY_ENV = {
    "SECRET_KEY": "dummy-secret-for-schema-generation",
    "GOOGLE_CLIENT_ID": "dummy-client-id",
    "GOOGLE_CLIENT_SECRET": "dummy-client-secret",
    "DATABASE_URL": "sqlite+aiosqlite:///./dummy.db",  # Use SQLite to avoid psycopg2
    "GROQ_API_KEY": "dummy-groq-key",
    "AMADEUS_API_KEY": "dummy-amadeus-key",
    "AMADEUS_API_SECRET": "dummy-amadeus-secret",
    "REDIS_URL": "redis://localhost:6379",
}

for key, value in _DUMMY_ENV.items():
    if key not in os.environ:
        os.environ[key] = value

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import FastAPI to create a minimal app
from fastapi import FastAPI

# Import the routers (these import the schemas)
from app.routers import auth, locations, trips
from app.core.config import settings


def create_schema_app() -> FastAPI:
    """Create a minimal FastAPI app for schema generation."""
    app = FastAPI(
        title=settings.project_name,
        version="0.1.0",
    )

    # Include all routers
    app.include_router(auth.router, tags=["auth"])
    app.include_router(trips.router, tags=["trips"])
    app.include_router(locations.router, tags=["locations"])

    return app


def main():
    """Export OpenAPI schema to stdout or file."""
    app = create_schema_app()
    schema = app.openapi()

    if len(sys.argv) > 1:
        output_path = Path(sys.argv[1])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(schema, f, indent=2)
        print(f"OpenAPI schema exported to {output_path}", file=sys.stderr)
    else:
        print(json.dumps(schema, indent=2))


if __name__ == "__main__":
    main()
