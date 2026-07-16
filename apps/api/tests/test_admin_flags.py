"""Tests for the feature-flag admin endpoints (GET/PUT /v1/admin/flags)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

TOKEN = "b" * 40


@pytest.fixture
def flags_app(app, mock_redis, monkeypatch):
    """The shared `app` fixture with the admin token set (flags endpoints use
    the normal `get_db` dependency, already overridden by the `app` fixture)."""
    import app.routers.admin as admin_module
    from app.core.config import settings

    monkeypatch.setattr(settings, "admin_query_token", TOKEN)
    admin_module.redis_client = mock_redis
    return app


@pytest.fixture
def flags_client(flags_app):
    return TestClient(flags_app)


def _auth(token=TOKEN):
    return {"Authorization": f"Bearer {token}"}


class TestFlagsAuth:
    def test_list_requires_token(self, flags_client):
        assert flags_client.get("/v1/admin/flags").status_code == 401

    def test_set_requires_token(self, flags_client):
        resp = flags_client.put("/v1/admin/flags/beta_optimizer", json={"enabled": True})
        assert resp.status_code == 401

    def test_wrong_token_rejected(self, flags_client):
        resp = flags_client.get("/v1/admin/flags", headers=_auth("c" * 40))
        assert resp.status_code == 401


class TestFlagsEndpoints:
    def test_list_includes_known_flags_with_defaults(self, flags_client):
        resp = flags_client.get("/v1/admin/flags", headers=_auth())
        assert resp.status_code == 200
        flags = {f["name"]: f for f in resp.json()["flags"]}
        assert "beta_optimizer" in flags
        assert flags["beta_optimizer"]["enabled"] is False
        assert "optimizer" in flags["beta_optimizer"]["description"]

    def test_set_flag_toggles_and_persists(self, flags_client):
        resp = flags_client.put(
            "/v1/admin/flags/beta_optimizer", headers=_auth(), json={"enabled": True}
        )
        assert resp.status_code == 200
        assert resp.json() == {"name": "beta_optimizer", "enabled": True}

        listed = flags_client.get("/v1/admin/flags", headers=_auth()).json()["flags"]
        assert {f["name"]: f["enabled"] for f in listed}["beta_optimizer"] is True

        # And back off again
        resp = flags_client.put(
            "/v1/admin/flags/beta_optimizer", headers=_auth(), json={"enabled": False}
        )
        assert resp.status_code == 200
        listed = flags_client.get("/v1/admin/flags", headers=_auth()).json()["flags"]
        assert {f["name"]: f["enabled"] for f in listed}["beta_optimizer"] is False

    def test_unknown_flag_404(self, flags_client):
        resp = flags_client.put(
            "/v1/admin/flags/nonexistent", headers=_auth(), json={"enabled": True}
        )
        assert resp.status_code == 404
        assert resp.json()["error"] == "unknown_flag"
        # The raw path parameter is client-controlled — it must not be echoed.
        assert "nonexistent" not in resp.json()["details"]

    def test_set_flag_logs_canonical_name_not_request_input(self, flags_client, caplog):
        """The set-flag log line must only ever carry registry constants and a
        validated IP — a spoofed proxy header (CWE-117 vector) never lands in
        the log output."""
        import logging

        payload = "1.2.3.4\nERROR forged log entry"
        with caplog.at_level(logging.INFO, logger="app.routers.admin"):
            resp = flags_client.put(
                "/v1/admin/flags/beta_optimizer",
                headers={**_auth(), "X-Forwarded-For": payload},
                json={"enabled": True},
            )
        assert resp.status_code == 200
        set_records = [r for r in caplog.records if getattr(r, "event", "") == "admin.flags.set"]
        assert len(set_records) == 1
        record = set_records[0]
        assert record.flag == "beta_optimizer"
        assert "forged log entry" not in record.getMessage()
        assert "forged log entry" not in record.ip

    def test_invalid_json_body_400(self, flags_client):
        resp = flags_client.put(
            "/v1/admin/flags/beta_optimizer",
            headers={**_auth(), "Content-Type": "application/json"},
            content="not-json",
        )
        assert resp.status_code == 400

    @pytest.mark.parametrize("body", [{"enabled": "yes"}, {"enabled": 1}, {}, ["enabled"]])
    def test_non_boolean_enabled_400(self, flags_client, body):
        resp = flags_client.put("/v1/admin/flags/beta_optimizer", headers=_auth(), json=body)
        assert resp.status_code == 400

    def test_rate_limited(self, flags_app, mock_redis):
        from unittest.mock import AsyncMock

        mock_redis.incr = AsyncMock(return_value=999)
        mock_redis.expire = AsyncMock(return_value=True)
        client = TestClient(flags_app)
        resp = client.get("/v1/admin/flags", headers=_auth())
        assert resp.status_code == 429
        resp = client.put("/v1/admin/flags/beta_optimizer", headers=_auth(), json={"enabled": True})
        assert resp.status_code == 429
