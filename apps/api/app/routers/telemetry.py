"""Client-side telemetry sink — browser logs relayed to Axiom.

The web app has no direct path to Axiom (showbook's rule: clients never write to
Axiom directly). The browser fires best-effort ``fetch(keepalive)`` events here;
this endpoint validates + bounds them and logs through ``app.core.observability``
so they land in the shared dataset under the ``web.<event>`` namespace, tagged
``component=web.telemetry`` (mirrors showbook's ``mobile.telemetry`` relay).

Unauthenticated by design — pre-sign-in failures (expired tokens, the 401s we'd
most want to see) must still reach Axiom. We attach the caller's ``user_id`` from
the auth cookie when present, but never trust the client for ``event``/``user_id``.
The general rate-limit middleware already throttles this path per IP/user.
"""

from __future__ import annotations

import json
import logging

import jwt
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims

router = APIRouter(prefix="/v1/telemetry", tags=["telemetry"])
logger = logging.getLogger("app.web.telemetry")

MAX_CONTEXT_BYTES = 8 * 1024

# Allowlist of context keys promoted to structured log fields. Unknown keys are
# dropped (and counted) so an unauthenticated caller can't bloat the log surface.
# NEVER add `event` or `user_id` — those are set server-side and must not be
# spoofable from the client.
ALLOWED_CONTEXT_KEYS: frozenset[str] = frozenset(
    {
        "status",
        "http_status",
        "code",
        "path",
        "route",
        "trip_id",
        "conversation_id",
        "stage",
        "type",
        "elapsed_ms",
        "reason",
    }
)


class ClientEvent(BaseModel):
    event: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=2000)
    level: str = Field(default="error", pattern="^(warn|error)$")
    context: dict | None = None


def _sanitize_context(context: dict | None) -> dict:
    """Drop unknown keys and byte-cap the surviving payload."""
    if not context:
        return {}

    picked: dict = {}
    dropped = 0
    for key, value in context.items():
        if key in ALLOWED_CONTEXT_KEYS:
            picked[key] = value
        else:
            dropped += 1
    if dropped:
        picked["dropped_keys"] = dropped

    serialized = json.dumps(picked, default=str)
    if len(serialized) > MAX_CONTEXT_BYTES:
        return {"clipped": True, "preview_bytes": len(serialized), "preview": serialized[:MAX_CONTEXT_BYTES]}
    return picked


def _user_id_from_cookie(request: Request) -> str | None:
    """Best-effort user id from the access-token cookie (None if absent/invalid)."""
    token = request.cookies.get(CookieNames.ACCESS_TOKEN)
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return payload.get(JWTClaims.SUBJECT)
    except jwt.PyJWTError:
        return None


@router.post("/client")
async def log_client_event(payload: ClientEvent, request: Request) -> dict:
    """Relay a browser telemetry event into the shared Axiom pipeline."""
    safe = _sanitize_context(payload.context)
    # Server-controlled fields win — a client must not forge event/user_id.
    extra = {
        **safe,
        "event": f"web.{payload.event}",
        "component": "web.telemetry",
        "user_id": _user_id_from_cookie(request),
    }
    if payload.level == "warn":
        logger.warning(payload.message, extra=extra)
    else:
        logger.error(payload.message, extra=extra)
    return {"ok": True}
