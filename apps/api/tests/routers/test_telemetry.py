"""Tests for the /v1/telemetry/client browser-log relay endpoint."""

import logging

from app.core.security import create_access_token

URL = "/v1/telemetry/client"


def test_logs_error_event_with_web_prefix(client, caplog):
    with caplog.at_level(logging.ERROR, logger="app.web.telemetry"):
        resp = client.post(URL, json={"event": "trip.load.failed", "message": "boom"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    record = caplog.records[-1]
    assert record.event == "web.trip.load.failed"
    assert record.component == "web.telemetry"
    assert record.levelname == "ERROR"
    assert record.user_id is None


def test_logs_warn_level(client, caplog):
    with caplog.at_level(logging.WARNING, logger="app.web.telemetry"):
        resp = client.post(URL, json={"event": "sse.error", "message": "dropped", "level": "warn"})
    assert resp.status_code == 200
    assert caplog.records[-1].levelname == "WARNING"


def test_context_allowlist_drops_unknown_keys(client, caplog):
    with caplog.at_level(logging.ERROR, logger="app.web.telemetry"):
        resp = client.post(
            URL,
            json={
                "event": "trip.update.failed",
                "message": "bad",
                "context": {"status": 409, "trip_id": "t-1", "evil": "x", "another": "y"},
            },
        )
    assert resp.status_code == 200
    record = caplog.records[-1]
    assert record.status == 409
    assert record.trip_id == "t-1"
    assert not hasattr(record, "evil")
    assert record.dropped_keys == 2


def test_context_cannot_forge_event_or_user_id(client, caplog):
    with caplog.at_level(logging.ERROR, logger="app.web.telemetry"):
        client.post(
            URL,
            json={
                "event": "x.y",
                "message": "m",
                "context": {"event": "admin.spoof", "user_id": "attacker"},
            },
        )
    record = caplog.records[-1]
    assert record.event == "web.x.y"  # server-set, not spoofed
    assert record.user_id is None  # not taken from context
    assert record.dropped_keys == 2


def test_oversized_context_is_clipped(client, caplog):
    big = "a" * (9 * 1024)
    with caplog.at_level(logging.ERROR, logger="app.web.telemetry"):
        client.post(URL, json={"event": "x", "message": "m", "context": {"reason": big}})
    record = caplog.records[-1]
    assert getattr(record, "clipped", False) is True
    assert hasattr(record, "preview_bytes")


def test_user_id_from_cookie(client, caplog):
    token = create_access_token({"sub": "user-123"})
    client.cookies.set("access_token_cookie", token)
    with caplog.at_level(logging.ERROR, logger="app.web.telemetry"):
        resp = client.post(URL, json={"event": "trip.create.failed", "message": "m"})
    assert resp.status_code == 200
    assert caplog.records[-1].user_id == "user-123"
    client.cookies.delete("access_token_cookie")


def test_invalid_cookie_yields_no_user(client, caplog):
    client.cookies.set("access_token_cookie", "not-a-jwt")
    with caplog.at_level(logging.ERROR, logger="app.web.telemetry"):
        client.post(URL, json={"event": "x", "message": "m"})
    assert caplog.records[-1].user_id is None
    client.cookies.delete("access_token_cookie")


def test_validation_rejects_bad_payload(client):
    # Missing message
    assert client.post(URL, json={"event": "x"}).status_code == 422
    # Event too long
    assert client.post(URL, json={"event": "e" * 81, "message": "m"}).status_code == 422
    # Invalid level
    assert client.post(URL, json={"event": "x", "message": "m", "level": "info"}).status_code == 422


def test_no_context_is_fine(client, caplog):
    with caplog.at_level(logging.ERROR, logger="app.web.telemetry"):
        resp = client.post(URL, json={"event": "x", "message": "m", "context": None})
    assert resp.status_code == 200
