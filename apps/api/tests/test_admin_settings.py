"""Tests for the app-setting admin endpoints (GET/PUT /v1/admin/settings)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

TOKEN = "b" * 40


@pytest.fixture
def settings_app(app, mock_redis, monkeypatch):
    """The shared `app` fixture with the admin token set (settings endpoints use
    the normal `get_db` dependency, already overridden by the `app` fixture)."""
    import app.routers.admin as admin_module
    from app.core.config import settings

    monkeypatch.setattr(settings, "admin_query_token", TOKEN)
    admin_module.redis_client = mock_redis
    return app


@pytest.fixture
def settings_client(settings_app):
    return TestClient(settings_app)


def _auth(token=TOKEN):
    return {"Authorization": f"Bearer {token}"}


class TestSettingsAuth:
    def test_list_requires_token(self, settings_client):
        assert settings_client.get("/v1/admin/settings").status_code == 401

    def test_set_requires_token(self, settings_client):
        resp = settings_client.put(
            "/v1/admin/settings/flight_provider", json={"value": "kiwi"}
        )
        assert resp.status_code == 401

    def test_wrong_token_rejected(self, settings_client):
        resp = settings_client.get("/v1/admin/settings", headers=_auth("c" * 40))
        assert resp.status_code == 401


class TestSettingsEndpoints:
    def test_list_includes_known_settings_with_defaults(self, settings_client):
        resp = settings_client.get("/v1/admin/settings", headers=_auth())
        assert resp.status_code == 200
        settings_by_name = {s["name"]: s for s in resp.json()["settings"]}
        assert "flight_provider" in settings_by_name
        provider = settings_by_name["flight_provider"]
        assert provider["value"] == "skiplagged"
        assert provider["allowed_values"] == ["skiplagged", "kiwi", "fast_flights"]

    def test_set_setting_switches_and_persists(self, settings_client):
        for value in ("kiwi", "fast_flights", "skiplagged"):
            resp = settings_client.put(
                "/v1/admin/settings/flight_provider", headers=_auth(), json={"value": value}
            )
            assert resp.status_code == 200
            assert resp.json() == {"name": "flight_provider", "value": value}

            listed = settings_client.get("/v1/admin/settings", headers=_auth()).json()["settings"]
            assert {s["name"]: s["value"] for s in listed}["flight_provider"] == value

    def test_unknown_setting_404(self, settings_client):
        resp = settings_client.put(
            "/v1/admin/settings/nonexistent", headers=_auth(), json={"value": "skiplagged"}
        )
        assert resp.status_code == 404
        assert resp.json()["error"] == "unknown_setting"
        # The raw path parameter is client-controlled — it must not be echoed.
        assert "nonexistent" not in resp.json()["details"]

    def test_disallowed_value_400_and_not_echoed(self, settings_client):
        resp = settings_client.put(
            "/v1/admin/settings/flight_provider", headers=_auth(), json={"value": "expedia"}
        )
        assert resp.status_code == 400
        # The raw body value is client-controlled — it must not be echoed.
        assert "expedia" not in resp.json()["details"]

    def test_set_setting_logs_canonical_values_not_request_input(self, settings_client, caplog):
        """The set-setting log line must only ever carry registry constants and
        a validated IP — a spoofed proxy header (CWE-117 vector) never lands in
        the log output."""
        import logging

        payload = "1.2.3.4\nERROR forged log entry"
        with caplog.at_level(logging.INFO, logger="app.routers.admin"):
            resp = settings_client.put(
                "/v1/admin/settings/flight_provider",
                headers={**_auth(), "X-Forwarded-For": payload},
                json={"value": "fast_flights"},
            )
        assert resp.status_code == 200
        set_records = [
            r for r in caplog.records if getattr(r, "event", "") == "admin.settings.set"
        ]
        assert len(set_records) == 1
        record = set_records[0]
        assert record.setting == "flight_provider"
        assert record.value == "fast_flights"
        assert "forged log entry" not in record.getMessage()
        assert "forged log entry" not in record.ip

    def test_invalid_json_body_400(self, settings_client):
        resp = settings_client.put(
            "/v1/admin/settings/flight_provider",
            headers={**_auth(), "Content-Type": "application/json"},
            content="not-json",
        )
        assert resp.status_code == 400

    @pytest.mark.parametrize("body", [{"value": True}, {"value": 1}, {}, ["value"]])
    def test_non_string_value_400(self, settings_client, body):
        resp = settings_client.put(
            "/v1/admin/settings/flight_provider", headers=_auth(), json=body
        )
        assert resp.status_code == 400

    def test_rate_limited(self, settings_app, mock_redis):
        from unittest.mock import AsyncMock

        mock_redis.incr = AsyncMock(return_value=999)
        mock_redis.expire = AsyncMock(return_value=True)
        client = TestClient(settings_app)
        resp = client.get("/v1/admin/settings", headers=_auth())
        assert resp.status_code == 429
        resp = client.put(
            "/v1/admin/settings/flight_provider", headers=_auth(), json={"value": "kiwi"}
        )
        assert resp.status_code == 429
