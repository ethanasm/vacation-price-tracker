"""Tests for error response helpers."""

import json

from app.core.errors import (
    RateLimitExceeded,
    http_exception_response,
    problem_details_response,
    unhandled_exception_response,
    validation_exception_response,
)
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.requests import Request


def _make_request(path: str = "/test") -> Request:
    return Request({"type": "http", "method": "GET", "path": path, "headers": []})


def test_http_exception_response_handles_non_string_detail():
    request = _make_request()
    exc = HTTPException(status_code=400, detail={"error": "bad"})

    response = http_exception_response(exc, request)

    assert response.status_code == 400
    payload = json.loads(response.body)
    assert payload["detail"] == "{'error': 'bad'}"
    assert payload["instance"] == "/test"


def test_validation_exception_response_contains_errors():
    request = _make_request("/validate")
    exc = RequestValidationError([
        {"loc": ("query", "q"), "msg": "error", "type": "value_error"}
    ])

    response = validation_exception_response(exc, request)

    assert response.status_code == 422
    payload = json.loads(response.body)
    assert payload["detail"] == "Request validation failed."
    assert payload["instance"] == "/validate"
    assert payload["errors"][0]["loc"] == ["query", "q"]


def test_unhandled_exception_response():
    request = _make_request("/boom")

    response = unhandled_exception_response(request)

    assert response.status_code == 500
    payload = json.loads(response.body)
    assert payload["detail"] == "An unexpected error occurred."
    assert payload["instance"] == "/boom"


def test_rate_limit_exceeded_response_includes_retry_after_header():
    request = _make_request("/v1/trips")
    exc = RateLimitExceeded(retry_after=45)

    response = problem_details_response(exc, request)

    assert response.status_code == 429
    assert response.headers.get("Retry-After") == "45"
    payload = json.loads(response.body)
    assert payload["type"] == "https://vacation-price-tracker.dev/problems/rate-limit-exceeded"
    assert payload["retry_after"] == 45
    assert payload["instance"] == "/v1/trips"
