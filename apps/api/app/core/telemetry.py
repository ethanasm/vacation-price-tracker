"""Langfuse telemetry client for LLM and MCP call tracing.

Provides a single `langfuse` client and re-exports the `observe` decorator
plus `langfuse_context` for use across the API and worker. When credentials
are not configured, the client is created with `enabled=False` and all
decorators/context calls become no-ops. When the `langfuse` package itself
is not installed, fall back to no-op stand-ins so the app still boots.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from langfuse import Langfuse
    from langfuse.decorators import langfuse_context, observe

    _HAS_LANGFUSE = True
except ImportError:
    _HAS_LANGFUSE = False
    logger.warning("langfuse package not installed; tracing disabled")

if _HAS_LANGFUSE:
    _PLACEHOLDER_PUBLIC = "pk-disabled"
    _PLACEHOLDER_SECRET = "sk-disabled"
    langfuse = Langfuse(
        public_key=settings.langfuse_public_key or _PLACEHOLDER_PUBLIC,
        secret_key=settings.langfuse_secret_key or _PLACEHOLDER_SECRET,
        host=settings.langfuse_host,
        enabled=settings.langfuse_enabled,
        environment=settings.langfuse_environment or settings.environment,
    )
    if settings.langfuse_enabled:
        logger.info("Langfuse tracing enabled host=%s", settings.langfuse_host)
else:
    langfuse = None

    class _NoOpContext:
        """Stand-in for langfuse_context when the SDK is not installed."""

        def update_current_observation(self, **_: Any) -> None:
            return None

        def update_current_trace(self, **_: Any) -> None:
            return None

        def get_current_observation_id(self) -> None:
            return None

        def get_current_trace_id(self) -> None:
            return None

    langfuse_context = _NoOpContext()

    def observe(*_dargs: Any, **_dkwargs: Any):
        """No-op decorator when langfuse is not installed."""

        def decorator(func):
            return func

        return decorator


def flush() -> None:
    """Flush queued events before shutdown."""
    if _HAS_LANGFUSE and settings.langfuse_enabled:
        langfuse.flush()


__all__ = ["flush", "langfuse", "langfuse_context", "observe"]
