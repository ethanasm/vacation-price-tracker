"""Tests for the Resend email client."""

import pytest
from app.clients import email as email_module
from app.clients.email import EmailConfigError, ResendClient


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    """Stands in for httpx.AsyncClient; records the POST it receives."""

    last_call: dict = {}

    def __init__(self, *_args, **_kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return None

    async def post(self, url, json, headers):
        _FakeAsyncClient.last_call = {"url": url, "json": json, "headers": headers}
        return _FakeResponse({"id": "email-123"})


@pytest.mark.asyncio
async def test_dry_run_when_no_api_key():
    client = ResendClient(api_key="", from_address="App <a@verified.com>")
    assert client.dry_run is True
    result = await client.send(to="x@example.com", subject="Hi", html="<p>hi</p>")
    assert result == {"dry_run": True}


@pytest.mark.asyncio
async def test_send_posts_to_resend(monkeypatch):
    monkeypatch.setattr(email_module.httpx, "AsyncClient", _FakeAsyncClient)
    client = ResendClient(api_key="re_test", from_address="App <a@verified.com>")

    result = await client.send(
        to="x@example.com",
        subject="Hi",
        html="<p>hi</p>",
        headers={"List-Unsubscribe": "<https://app.test/u>"},
        idempotency_key="key-1",
    )

    assert result == {"id": "email-123"}
    call = _FakeAsyncClient.last_call
    assert call["url"] == email_module.RESEND_API_URL
    assert call["json"]["from"] == "App <a@verified.com>"
    assert call["json"]["to"] == "x@example.com"
    assert call["json"]["headers"] == {"List-Unsubscribe": "<https://app.test/u>"}
    assert call["headers"]["Authorization"] == "Bearer re_test"
    assert call["headers"]["Idempotency-Key"] == "key-1"


@pytest.mark.asyncio
async def test_placeholder_sender_rejected_in_production(monkeypatch):
    monkeypatch.setattr(email_module.settings, "environment", "production")
    client = ResendClient(api_key="re_test", from_address="notifications@yourdomain.com")

    with pytest.raises(EmailConfigError):
        await client.send(to="x@example.com", subject="Hi", html="<p>hi</p>")


@pytest.mark.asyncio
async def test_valid_sender_allowed_in_production_dry_run(monkeypatch):
    monkeypatch.setattr(email_module.settings, "environment", "production")
    client = ResendClient(api_key="", from_address="App <a@verified.com>")
    # Valid sender + no key → dry-run marker, no exception.
    assert await client.send(to="x@example.com", subject="Hi", html="<p>hi</p>") == {
        "dry_run": True
    }
