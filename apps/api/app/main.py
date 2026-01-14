"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.db.session import async_engine
from app.models.user import User  # noqa: F401 - Import to register model
from app.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield


app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

# Include routers
app.include_router(auth.router, tags=["auth"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
