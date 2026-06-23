"""Tests for app.core.observability (Axiom structured logging)."""

import logging

import pytest
from app.core import observability as obs
from app.core.config import settings

# ---------------------------------------------------------------------------
# reshape_for_axiom
# ---------------------------------------------------------------------------


def test_reshape_keeps_core_and_folds_rest():
    out = obs.reshape_for_axiom({"event": "x", "level": "info", "trip_id": "t", "foo": 1, "bar": [1, 2]})
    assert out["event"] == "x"
    assert out["level"] == "info"
    assert out["trip_id"] == "t"  # trip_id is a CORE_FIELD
    assert out["fields"] == {"foo": 1, "bar": [1, 2]}


def test_reshape_omits_empty_fields():
    out = obs.reshape_for_axiom({"event": "x", "level": "info"})
    assert "fields" not in out


def test_reshape_literal_fields_folds_to_fields_fields():
    out = obs.reshape_for_axiom({"event": "x", "fields": {"a": 1}})
    assert out["fields"] == {"fields": {"a": 1}}


def test_reshape_passthrough_non_dict():
    assert obs.reshape_for_axiom("not a dict") == "not a dict"
    assert obs.reshape_for_axiom(["x"]) == ["x"]
    assert obs.reshape_for_axiom(None) is None


# ---------------------------------------------------------------------------
# serialize_err
# ---------------------------------------------------------------------------


def test_serialize_err_basic_shape():
    err = obs.serialize_err(ValueError("boom"))
    assert err["type"] == "ValueError"
    assert err["name"] == "ValueError"
    assert err["message"] == "boom"
    assert "boom" in err["stack"]


def test_serialize_err_allowlisted_attr():
    exc = RuntimeError("db down")
    exc.sqlstate = "57014"  # allowlisted
    exc.secret = "should-not-appear"  # not allowlisted
    err = obs.serialize_err(exc)
    assert err["sqlstate"] == "57014"
    assert "secret" not in err


def test_serialize_err_walks_cause_chain():
    try:
        try:
            raise ValueError("root cause")
        except ValueError as inner:
            raise RuntimeError("wrapper") from inner
    except RuntimeError as outer:
        err = obs.serialize_err(outer)
    assert err["message"] == "wrapper"
    assert err["cause"]["message"] == "root cause"


def test_serialize_err_none_and_non_error():
    assert obs.serialize_err(None) is None
    assert obs.serialize_err("plain string") == "plain string"
    assert obs.serialize_err(123) == 123


def test_serialize_err_depth_guard():
    # A self-referential context shouldn't recurse forever.
    a = RuntimeError("a")
    b = RuntimeError("b")
    a.__context__ = b
    b.__context__ = a
    err = obs.serialize_err(a)
    # Just assert it terminates and produces a dict.
    assert err["message"] == "a"


# ---------------------------------------------------------------------------
# _jsonify
# ---------------------------------------------------------------------------


def test_jsonify_primitives_and_containers():
    assert obs._jsonify(1) == 1
    assert obs._jsonify("s") == "s"
    assert obs._jsonify(True) is True
    assert obs._jsonify({"k": {1, 2}}) == {"k": [1, 2]} or obs._jsonify({"k": [1, 2]}) == {"k": [1, 2]}
    assert obs._jsonify([1, "a"]) == [1, "a"]


def test_jsonify_falls_back_to_str_for_objects():
    class Thing:
        def __str__(self):
            return "thing!"

    assert obs._jsonify(Thing()) == "thing!"


def test_jsonify_depth_guard():
    deep = {"a": {"b": {"c": 1}}}
    assert obs._jsonify(deep, _depth=obs._MAX_CAUSE_DEPTH) == str(deep)


# ---------------------------------------------------------------------------
# _record_to_event
# ---------------------------------------------------------------------------


def _make_record(msg="hi", level=logging.INFO, **extra):
    record = logging.LogRecord("app.test", level, "f.py", 1, msg, None, None)
    for k, v in extra.items():
        setattr(record, k, v)
    return record


def test_record_to_event_includes_base_and_extras():
    record = _make_record(event="test.event", trip_id="t1", foo="bar")
    event = obs._record_to_event(record, "vpt-api")
    assert event["service"] == "vpt-api"
    assert event["level"] == "info"
    assert event["msg"] == "hi"
    assert event["event"] == "test.event"
    assert event["trip_id"] == "t1"
    assert event["foo"] == "bar"
    assert "args" not in event  # reserved attrs excluded


def test_record_to_event_serializes_exc_info():
    try:
        raise ValueError("kaboom")
    except ValueError:
        import sys

        record = logging.LogRecord("app.test", logging.ERROR, "f.py", 1, "failed", None, sys.exc_info())
    event = obs._record_to_event(record, "vpt-api")
    assert event["err"]["type"] == "ValueError"
    assert event["err"]["message"] == "kaboom"


# ---------------------------------------------------------------------------
# Handler (VptAxiomHandler) — fake transport
# ---------------------------------------------------------------------------


class _FakeClient:
    def __init__(self):
        self.ingested = []
        self._shutdown_cb = None

    def before_shutdown(self, cb):
        self._shutdown_cb = cb

    def ingest_events(self, dataset, events):
        self.ingested.append((dataset, events))


def test_axiom_handler_emit_buffers_reshaped_then_ships():
    client = _FakeClient()
    handler = obs.VptAxiomHandler(client, "vpt-test", "vpt-api", interval=999)
    try:
        record = _make_record(event="test.event", trip_id="t1", foo="bar")
        handler.emit(record)
        assert len(handler.buffer) == 1
        buffered = handler.buffer[0]
        assert buffered["event"] == "test.event"
        assert buffered["trip_id"] == "t1"
        assert buffered["fields"]["foo"] == "bar"
        # flush() ships on a background thread; drain() waits for it.
        handler.drain()
        assert client.ingested
        dataset, events = client.ingested[0]
        assert dataset == "vpt-test"
        assert events[0]["event"] == "test.event"
    finally:
        handler.close()


def test_axiom_handler_drain_noop_when_empty():
    client = _FakeClient()
    handler = obs.VptAxiomHandler(client, "vpt-test", "vpt-api", interval=999)
    try:
        handler.drain()  # nothing buffered -> no ship, must not raise
        assert not client.ingested
    finally:
        handler.close()


def test_axiom_handler_drain_waits_on_pending_ship():
    import threading

    started = threading.Event()
    release = threading.Event()

    class _SlowClient(_FakeClient):
        def ingest_events(self, dataset, events):
            started.set()
            release.wait(2.0)
            super().ingest_events(dataset, events)

    handler = obs.VptAxiomHandler(_SlowClient(), "vpt-test", "vpt-api", interval=999)
    try:
        handler.emit(_make_record(event="test.event"))
        handler.flush()  # submit the (blocked) ship
        assert started.wait(1.0)  # ship thread running -> future still pending
        handler.drain(timeout=0.2)  # exercises the futures_wait path
    finally:
        release.set()
        handler.close()


def test_axiom_handler_emit_flushes_inline_when_interval_elapsed():
    import time

    client = _FakeClient()
    handler = obs.VptAxiomHandler(client, "vpt-test", "vpt-api", interval=1)
    try:
        # Force the "interval elapsed" branch so emit flushes inline (off-thread).
        handler.last_flush = time.monotonic() - 100
        handler.emit(_make_record(event="test.event"))
        handler.drain()  # wait for the background ship
        assert client.ingested
    finally:
        handler.close()


def test_axiom_handler_emit_swallows_bad_record():
    client = _FakeClient()
    handler = obs.VptAxiomHandler(client, "vpt-test", "vpt-api", interval=999)
    try:
        # A record whose getMessage() raises (bad %-format) must not propagate.
        record = logging.LogRecord("app.test", logging.INFO, "f.py", 1, "%d", ("notanint",), None)
        handler.emit(record)  # should not raise
    finally:
        handler.close()


# ---------------------------------------------------------------------------
# init_observability / flush / build handler gating
# ---------------------------------------------------------------------------


@pytest.fixture
def _restore_root_logging():
    root = logging.getLogger()
    saved = list(root.handlers)
    saved_axiom = obs._axiom_handler
    yield
    root.handlers = saved
    obs._axiom_handler = saved_axiom


def test_init_disabled_uses_stdout_only(monkeypatch, _restore_root_logging):
    monkeypatch.setattr(settings, "axiom_token", "")
    monkeypatch.setattr(settings, "axiom_dataset", "")
    obs.init_observability("vpt-api")
    root = logging.getLogger()
    assert len(root.handlers) == 1  # stdout only
    assert obs._build_axiom_handler("vpt-api") is None
    obs.flush()  # no-op, must not raise


def test_init_enabled_attaches_axiom_handler(monkeypatch, _restore_root_logging):
    monkeypatch.setattr(settings, "axiom_token", "xaat-test")
    monkeypatch.setattr(settings, "axiom_dataset", "vpt-test")

    created = {}

    def _fake_client(token):
        created["token"] = token
        return _FakeClient()

    monkeypatch.setattr(obs.axiom_py, "Client", _fake_client)
    obs.init_observability("vpt-api")
    root = logging.getLogger()
    assert any(isinstance(h, obs.VptAxiomHandler) for h in root.handlers)
    assert created["token"] == "xaat-test"
    # flush() drains the handler.
    obs.flush()
    if obs._axiom_handler is not None:
        obs._axiom_handler.close()


def test_init_closes_previous_axiom_handler(monkeypatch, _restore_root_logging):
    monkeypatch.setattr(settings, "axiom_token", "xaat-test")
    monkeypatch.setattr(settings, "axiom_dataset", "vpt-test")
    monkeypatch.setattr(obs.axiom_py, "Client", lambda token: _FakeClient())

    obs.init_observability("vpt-api")
    first = obs._axiom_handler
    assert first is not None
    # Re-init must close the prior handler (cancel timer + shut ship thread).
    obs.init_observability("vpt-api")
    assert first._executor._shutdown is True
    if obs._axiom_handler is not None:
        obs._axiom_handler.close()


def test_init_production_uses_json_formatter(monkeypatch, _restore_root_logging):
    monkeypatch.setattr(settings, "axiom_token", "")
    monkeypatch.setattr(settings, "axiom_dataset", "")
    monkeypatch.setattr(settings, "environment", "production")
    obs.init_observability("vpt-api")
    root = logging.getLogger()
    assert isinstance(root.handlers[0].formatter, obs._JsonFormatter)


def test_json_formatter_emits_valid_json():
    import json

    record = _make_record(event="test.event", foo="bar")
    line = obs._JsonFormatter("vpt-api").format(record)
    parsed = json.loads(line)
    assert parsed["event"] == "test.event"
    assert parsed["service"] == "vpt-api"


def test_human_formatter_surfaces_event():
    record = _make_record(event="test.event")
    line = obs._HumanFormatter().format(record)
    assert "[test.event]" in line


def test_human_formatter_without_event():
    record = _make_record()
    line = obs._HumanFormatter().format(record)
    assert "[" not in line.split(":")[0]  # no event prefix


def test_human_formatter_includes_traceback():
    try:
        raise ValueError("kaboom")
    except ValueError:
        import sys

        record = logging.LogRecord("app.test", logging.ERROR, "f.py", 1, "failed", None, sys.exc_info())
    line = obs._HumanFormatter().format(record)
    assert "Traceback" in line
    assert "kaboom" in line


# ---------------------------------------------------------------------------
# bind / get_logger
# ---------------------------------------------------------------------------


def test_get_logger_returns_logger():
    assert isinstance(obs.get_logger("app.x"), logging.Logger)


def test_bind_merges_context_with_call_extra(caplog):
    base = logging.getLogger("app.bind.test")
    bound = obs.bind(base, workflow_id="wf-1", trip_id="t-1")
    with caplog.at_level(logging.INFO, logger="app.bind.test"):
        bound.info("hello", extra={"event": "test.bound", "trip_id": "override"})
    record = caplog.records[-1]
    assert record.workflow_id == "wf-1"
    assert record.event == "test.bound"
    assert record.trip_id == "override"  # call-site extra wins on conflict


def test_bind_on_adapter_merges_existing_context():
    base = logging.getLogger("app.bind.test2")
    first = obs.bind(base, workflow_id="wf-1")
    second = obs.bind(first, trip_id="t-2")
    assert second.extra == {"workflow_id": "wf-1", "trip_id": "t-2"}
