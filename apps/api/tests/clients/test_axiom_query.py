"""Tests for the read-only Axiom query client."""

import pytest
from app.clients import axiom_query as aq
from app.clients.axiom_query import query_count


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    payload: dict = {"tables": [{"columns": [[7]]}]}

    def __init__(self, *_args, **_kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return None

    async def post(self, _url, json, headers):
        return _FakeResponse(_FakeAsyncClient.payload)


@pytest.mark.asyncio
async def test_query_count_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(aq.settings, "axiom_query_token", "")
    assert await query_count("['ds'] | count") is None


@pytest.mark.asyncio
async def test_query_count_parses_tabular(monkeypatch):
    monkeypatch.setattr(aq.settings, "axiom_query_token", "tok")
    monkeypatch.setattr(aq.settings, "axiom_org_id", "org")
    monkeypatch.setattr(aq.settings, "axiom_dataset", "ds")
    monkeypatch.setattr(aq.httpx, "AsyncClient", _FakeAsyncClient)

    assert await query_count("['ds'] | count") == 7


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"tables": []},  # no tables
        {"tables": [{"columns": [["not-a-number"]]}]},  # non-numeric cell
    ],
)
async def test_query_count_unexpected_shape_returns_none(monkeypatch, payload):
    monkeypatch.setattr(aq.settings, "axiom_query_token", "tok")
    monkeypatch.setattr(aq.settings, "axiom_org_id", "org")
    monkeypatch.setattr(aq.settings, "axiom_dataset", "ds")
    monkeypatch.setattr(_FakeAsyncClient, "payload", payload)
    monkeypatch.setattr(aq.httpx, "AsyncClient", _FakeAsyncClient)

    assert await query_count("['ds'] | count") is None
