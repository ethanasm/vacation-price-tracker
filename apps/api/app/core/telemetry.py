"""Langfuse telemetry client for LLM and MCP call tracing.

Provides a single `langfuse` client and re-exports the `observe` decorator
plus `langfuse_context` for use across the API and worker. When credentials
are not configured, the client is created with `enabled=False` and all
decorators/context calls become no-ops.
"""

from __future__ import annotations

import logging

from langfuse import Langfuse
from langfuse.decorators import langfuse_context, observe

from app.core.config import settings

logger = logging.getLogger(__name__)

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


def flush() -> None:
    """Flush queued events before shutdown."""
    if settings.langfuse_enabled:
        langfuse.flush()


__all__ = ["flush", "langfuse", "langfuse_context", "observe"]
