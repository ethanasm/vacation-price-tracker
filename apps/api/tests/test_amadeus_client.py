"""Tests for the Amadeus API client."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock

import pytest
from app.clients.amadeus import AmadeusAuthError, AmadeusClient, AmadeusRequestError
from app.core import config as config_module


class _DummyResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self) -> dict:
        return self._payload


class _DummyAsyncClient:
    def __init__(self, get_responses: list[_DummyResponse] | None = None, post_responses: list[_DummyResponse] | None = None):
        self.get_responses = list(get_responses or [])
        self.post_responses = list(post_responses or [])
        self.get_calls: list[dict] = []
        self.post_calls: list[dict] = []

    async def __aenter__(self) -> _DummyAsyncClient:
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def get(self, url: str, params: dict | None = None, headers: dict | None = None):
        self.get_calls.append({"url": url, "params": params, "headers": headers})
        return self.get_responses.pop(0)

    async def post(self, url: str, data: dict | None = None, headers: dict | None = None):
        self.post_calls.append({"url": url, "data": data, "headers": headers})
        return self.post_responses.pop(0)


@pytest.mark.asyncio
async def test_fetch_access_token_requires_credentials(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "")

    with pytest.raises(AmadeusAuthError):
        await client._fetch_access_token()


@pytest.mark.asyncio
async def test_fetch_access_token_parses_response(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "key")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "secret")

    dummy_client = _DummyAsyncClient(
        post_responses=[
            _DummyResponse(
                status_code=200,
                payload={"access_token": "token-123", "expires_in": 120},
            )
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    token = await client._fetch_access_token()

    assert token == "token-123"
    assert client._access_token == "token-123"
    assert client._access_token_expiry > time.time()
    assert dummy_client.post_calls[0]["data"]["client_id"] == "key"


@pytest.mark.asyncio
async def test_fetch_access_token_raises_on_http_error(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "key")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "secret")

    dummy_client = _DummyAsyncClient(
        post_responses=[_DummyResponse(status_code=401, payload={}, text="nope")]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusAuthError):
        await client._fetch_access_token()


@pytest.mark.asyncio
async def test_fetch_access_token_requires_token(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "key")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "secret")

    dummy_client = _DummyAsyncClient(post_responses=[_DummyResponse(status_code=200, payload={})])
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusAuthError):
        await client._fetch_access_token()


@pytest.mark.asyncio
async def test_get_access_token_uses_cached_token(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")
    client._access_token = "cached-token"
    client._access_token_expiry = time.time() + 60

    fetch_mock = AsyncMock()
    monkeypatch.setattr(client, "_fetch_access_token", fetch_mock)

    token = await client._get_access_token()

    assert token == "cached-token"
    fetch_mock.assert_not_called()

@pytest.mark.asyncio
async def test_authorized_get_refreshes_on_unauthorized(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token-1"))
    monkeypatch.setattr(client, "_fetch_access_token", AsyncMock(return_value="token-2"))

    dummy_client = _DummyAsyncClient(
        get_responses=[
            _DummyResponse(status_code=401, payload={}),
            _DummyResponse(status_code=200, payload={"data": []}),
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    response = await client._authorized_get("/v1/reference-data/locations", params={"keyword": "SFO"})

    assert response.status_code == 200
    assert dummy_client.get_calls[0]["headers"]["Authorization"] == "Bearer token-1"
    assert dummy_client.get_calls[1]["headers"]["Authorization"] == "Bearer token-2"


@pytest.mark.asyncio
async def test_authorized_get_raises_on_failure(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token-1"))

    dummy_client = _DummyAsyncClient(
        get_responses=[
            _DummyResponse(status_code=500, payload={}, text="boom"),
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusRequestError):
        await client._authorized_get("/v1/reference-data/locations", params={"keyword": "SFO"})


@pytest.mark.asyncio
async def test_search_locations_filters_invalid_entries(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    payload = {
        "data": [
            {"iataCode": "SFO", "name": "San Francisco", "subType": "AIRPORT"},
            {"address": {"cityCode": "NYC"}, "name": "New York", "type": "CITY"},
            {"iataCode": "MCO", "subType": "AIRPORT"},
            {"name": "Missing Code", "type": "CITY"},
        ]
    }

    monkeypatch.setattr(client, "_authorized_get", AsyncMock(return_value=_DummyResponse(200, payload)))

    results = await client.search_locations("San")

    assert results == [
        {"code": "SFO", "name": "San Francisco", "type": "AIRPORT"},
        {"code": "NYC", "name": "New York", "type": "CITY"},
    ]
