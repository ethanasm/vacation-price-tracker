"""Idempotency middleware for state-changing requests."""

from __future__ import annotations

import base64
import hashlib
import json
import logging

from fastapi import Request
from fastapi.responses import JSONResponse, Response

from app.core.cache_keys import CacheKeys, CacheTTL
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

IDEMPOTENCY_HEADER = "X-Idempotency-Key"
IDEMPOTENT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
IDEMPOTENT_ROUTES = {("POST", "/v1/trips")}


def _request_hash(method: str, path: str, query: str, body: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(method.encode("utf-8"))
    digest.update(b"\n")
    digest.update(path.encode("utf-8"))
    digest.update(b"?")
    digest.update(query.encode("utf-8"))
    digest.update(b"\n")
    digest.update(body)
    return digest.hexdigest()


def _decode_cached_response(payload: str) -> dict | None:
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        logger.warning("Failed to decode cached idempotency response")
        return None


def _bad_request_response(detail: str) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": detail})


def _conflict_response(detail: str) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": detail})


def _response_from_cached_payload(payload: dict) -> Response:
    body_bytes = base64.b64decode(payload.get("body", ""))
    return Response(
        content=body_bytes,
        status_code=payload.get("status_code", 200),
        media_type=payload.get("content_type"),
    )


def _cached_payload_response(payload: dict, request_hash: str) -> Response:
    cached_hash = payload.get("hash")
    if cached_hash != request_hash:
        return _conflict_response("Idempotency key conflict")
    if payload.get("status") == "in_progress":
        return _conflict_response("Idempotency key already in use")
    return _response_from_cached_payload(payload)


async def _existing_response(cache_key: str, request_hash: str) -> Response | None:
    cached = await redis_client.get(cache_key)
    if not cached:
        return None
    cached_payload = _decode_cached_response(cached)
    if not cached_payload:
        return None
    return _cached_payload_response(cached_payload, request_hash)


async def idempotency_middleware(request: Request, call_next):
    """Return cached response for duplicate idempotency keys."""
    if request.method not in IDEMPOTENT_METHODS:
        return await call_next(request)

    if (request.method, request.url.path) not in IDEMPOTENT_ROUTES:
        return await call_next(request)

    idempotency_key = request.headers.get(IDEMPOTENCY_HEADER)
    if not idempotency_key:
        return _bad_request_response(f"{IDEMPOTENCY_HEADER} header required")

    body = await request.body()
    request_hash = _request_hash(request.method, request.url.path, request.url.query, body)
    cache_key = CacheKeys.idempotency(idempotency_key)

    existing_response = await _existing_response(cache_key, request_hash)
    if existing_response:
        return existing_response

    placeholder = json.dumps({"hash": request_hash, "status": "in_progress"})
    claimed = await redis_client.set(
        cache_key,
        placeholder,
        ex=CacheTTL.IDEMPOTENCY,
        nx=True,
    )
    if not claimed:
        existing_response = await _existing_response(cache_key, request_hash)
        if existing_response:
            return existing_response
        return _conflict_response("Idempotency key already used")

    response = await call_next(request)
    response_body = b"".join([chunk async for chunk in response.body_iterator])

    payload = {
        "hash": request_hash,
        "status_code": response.status_code,
        "content_type": response.media_type,
        "body": base64.b64encode(response_body).decode("ascii"),
    }
    await redis_client.set(cache_key, json.dumps(payload), ex=CacheTTL.IDEMPOTENCY)

    return Response(
        content=response_body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )
