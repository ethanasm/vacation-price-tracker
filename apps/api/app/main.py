"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel
from starlette.middleware.sessions import SessionMiddleware

from app import models  # noqa: F401 - Import to register models
from app.core.config import settings
from app.core.errors import (
    AppError,
    http_exception_response,
    problem_details_response,
    unhandled_exception_response,
    validation_exception_response,
)
from app.db.deps import get_db
from app.db.redis import redis_client
from app.db.session import async_engine
from app.db.temporal import close_temporal_client, get_temporal_client, init_temporal_client
from app.middleware.idempotency import idempotency_middleware
from app.routers import auth, locations, trips


def _configure_logging() -> None:
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    root_logger.setLevel(logging.INFO)
    logging.getLogger("app").setLevel(logging.INFO)


_configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, cleanup on shutdown."""
    # Create database tables
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Initialize Temporal client
    await init_temporal_client()

    yield

    # Cleanup
    await close_temporal_client()


app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

app.middleware("http")(idempotency_middleware)

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
app.include_router(trips.router, tags=["trips"])
app.include_router(locations.router, tags=["locations"])


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return problem_details_response(exc, request)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return validation_exception_response(exc, request)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return http_exception_response(exc, request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception", exc_info=exc)
    return unhandled_exception_response(request)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/ready")
async def readiness_check(session: AsyncSession = Depends(get_db)):
    """Readiness probe endpoint."""
    checks: dict[str, str] = {}
    status_code = 200

    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logger.warning("Readiness check failed for database", exc_info=exc)
        checks["database"] = "error"
        status_code = 503

    try:
        await redis_client.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        logger.warning("Readiness check failed for redis", exc_info=exc)
        checks["redis"] = "error"
        status_code = 503

    try:
        get_temporal_client()
        checks["temporal"] = "ok"
    except Exception as exc:
        logger.warning("Readiness check failed for temporal", exc_info=exc)
        checks["temporal"] = "error"
        status_code = 503

    status_label = "ready" if status_code == 200 else "degraded"
    return JSONResponse({"status": status_label, "checks": checks}, status_code=status_code)
