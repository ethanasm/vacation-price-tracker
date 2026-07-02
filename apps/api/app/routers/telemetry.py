"""Client-side telemetry sink — browser and mobile logs relayed to Axiom.

Clients have no direct path to Axiom (showbook's rule: clients never write to
Axiom directly). The browser (``apps/web/src/lib/telemetry.ts``) and the Expo app
(``apps/mobile/lib/telemetry.ts``) fire best-effort events here; this endpoint
validates + bounds them and logs through ``app.core.observability`` so they land
in the shared dataset under the ``web.<event>`` / ``mobile.<event>`` namespace
(per the validated ``platform`` field), tagged ``component=<platform>.telemetry``
(mirrors showbook's ``mobile.telemetry`` relay).

Unauthenticated by design — pre-sign-in failures (expired tokens, the 401s we'd
most want to see) must still reach Axiom. We attach the caller's ``user_id`` from
the auth cookie (web) or bearer header (mobile) when present, but never trust the
client for ``event``/``user_id``. The general rate-limit middleware already
throttles this path per IP/user.
"""

from __future__ import annotations

import json
import logging
import re

import jwt
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.constants import CookieNames, JWTClaims

router = APIRouter(prefix="/v1/telemetry", tags=["telemetry"])
logger = logging.getLogger("app.web.telemetry")

MAX_CONTEXT_BYTES = 8 * 1024

# Control characters (CR/LF, tabs, terminal escapes, …). Client-supplied strings
# are scrubbed of these before they reach the logger so a crafted value can't
# forge extra log records or smuggle escape sequences into the log/Axiom pipeline
# (CWE-117, log injection).
_LOG_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f-\x9f]")


def _scrub_for_log(value: str) -> str:
    """Neutralize untrusted text for logging by stripping line breaks and other
    control characters. Newlines are removed explicitly (the injection vector);
    the regex catches the remaining control range."""
    return _LOG_CONTROL_CHARS.sub(" ", value.replace("\r", " ").replace("\n", " "))

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
    # Which client relayed the event: the browser (web.<event>, default) or the
    # Expo app (mobile.<event>). Constrained so a caller can't invent a namespace.
    platform: str = Field(default="web", pattern="^(web|mobile)$")
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


def _user_id_from_request(request: Request) -> str | None:
    """Best-effort user id from the access-token cookie (web) or the bearer
    Authorization header (mobile). None if absent/invalid — events still land."""
    token = request.cookies.get(CookieNames.ACCESS_TOKEN)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
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
    # Scrub the client-controlled strings of control characters before they reach
    # the logger (CWE-117). `message` is the log message; `event` is interpolated
    # into a structured field — both originate from the untrusted request body.
    safe_message = _scrub_for_log(payload.message)
    # Server-controlled fields win — a client must not forge event/user_id.
    # `platform` is validated against ^(web|mobile)$ so the namespace is bounded.
    extra = {
        **safe,
        "event": f"{payload.platform}.{_scrub_for_log(payload.event)}",
        "component": f"{payload.platform}.telemetry",
        "user_id": _user_id_from_request(request),
    }
    if payload.level == "warn":
        logger.warning(safe_message, extra=extra)
    else:
        logger.error(safe_message, extra=extra)
    return {"ok": True}
