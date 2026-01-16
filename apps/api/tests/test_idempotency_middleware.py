"""Tests for idempotency middleware helpers."""

import json
import logging

import pytest
from app.middleware import idempotency as idempotency_module
from starlette.requests import Request


def _make_request(method: str = "POST", path: str = "/v1/trips", body: bytes = b"{}"):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [(b"x-idempotency-key", b"key-1")],
        "query_string": b"",
    }
    return Request(scope, receive)


def test_decode_cached_response_invalid_json(caplog):
    with caplog.at_level(logging.WARNING):
        result = idempotency_module._decode_cached_response("not-json")

    assert result is None
    assert "Failed to decode" in caplog.text


def test_cached_payload_response_conflict_on_hash_mismatch():
    payload = {"hash": "abc", "status": "completed", "body": ""}
    response = idempotency_module._cached_payload_response(payload, request_hash="def")

    assert response.status_code == 409


def test_cached_payload_response_conflict_on_in_progress():
    payload = {"hash": "abc", "status": "in_progress", "body": ""}
    response = idempotency_module._cached_payload_response(payload, request_hash="abc")

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_existing_response_returns_none_on_bad_payload(monkeypatch):
    async def fake_get(_key):
        return "not-json"

    monkeypatch.setattr(idempotency_module.redis_client, "get", fake_get)

    response = await idempotency_module._existing_response("key", "hash")

    assert response is None


@pytest.mark.asyncio
async def test_idempotency_middleware_conflict_when_key_used(monkeypatch):
    async def fake_get(_key):
        return None

    async def fake_set(_key, _value, ex=None, nx=False):
        return None

    monkeypatch.setattr(idempotency_module.redis_client, "get", fake_get)
    monkeypatch.setattr(idempotency_module.redis_client, "set", fake_set)

    request = _make_request()

    async def call_next(_request):
        raise AssertionError("call_next should not be reached")

    response = await idempotency_module.idempotency_middleware(request, call_next)

    assert response.status_code == 409
    assert json.loads(response.body)["detail"] == "Idempotency key already used"
