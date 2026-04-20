"""Tests for app.core.telemetry no-op fallbacks and flush behavior."""
from __future__ import annotations

import builtins
import importlib
import sys
from unittest.mock import MagicMock, patch


def _reload_without_langfuse():
    """Reimport app.core.telemetry with `langfuse` simulated as missing."""
    real_import = builtins.__import__

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "langfuse" or name.startswith("langfuse."):
            raise ImportError(f"No module named {name!r}")
        return real_import(name, globals, locals, fromlist, level)

    saved = {k: sys.modules.pop(k) for k in list(sys.modules) if k == "langfuse" or k.startswith("langfuse.")}
    sys.modules.pop("app.core.telemetry", None)

    try:
        with patch.object(builtins, "__import__", guarded_import):
            module = importlib.import_module("app.core.telemetry")
        return module
    finally:
        sys.modules.pop("app.core.telemetry", None)
        sys.modules.update(saved)
        importlib.import_module("app.core.telemetry")


def test_importerror_fallback_disables_langfuse():
    """When langfuse is not installed, langfuse client is None and flags disabled."""
    module = _reload_without_langfuse()
    assert module._HAS_LANGFUSE is False
    assert module.langfuse is None


def test_noop_context_methods_return_none():
    """_NoOpContext methods accept kwargs and return None."""
    module = _reload_without_langfuse()
    ctx = module.langfuse_context
    assert ctx.update_current_observation(foo="bar") is None
    assert ctx.update_current_trace(tags=["a"], session_id="x") is None
    assert ctx.get_current_observation_id() is None
    assert ctx.get_current_trace_id() is None


def test_noop_observe_decorator_passes_through():
    """observe() no-op decorator returns the wrapped function unchanged."""
    module = _reload_without_langfuse()

    @module.observe(name="whatever", other="value")
    def add(a, b):
        return a + b

    assert add(2, 3) == 5


def test_flush_no_op_when_langfuse_missing():
    """flush() is a no-op when langfuse is not installed (no crash)."""
    module = _reload_without_langfuse()
    # Should not raise even though module.langfuse is None
    assert module.flush() is None


def test_flush_invokes_langfuse_flush_when_enabled(monkeypatch):
    """flush() forwards to langfuse.flush() when both installed and enabled."""
    from app.core import telemetry

    fake_client = MagicMock()
    monkeypatch.setattr(telemetry, "_HAS_LANGFUSE", True)
    monkeypatch.setattr(telemetry, "langfuse", fake_client)
    monkeypatch.setattr(telemetry, "settings", MagicMock(langfuse_enabled=True))

    telemetry.flush()

    fake_client.flush.assert_called_once()


def test_flush_skipped_when_disabled(monkeypatch):
    """flush() is a no-op when langfuse is installed but disabled via settings."""
    from app.core import telemetry

    fake_client = MagicMock()
    monkeypatch.setattr(telemetry, "_HAS_LANGFUSE", True)
    monkeypatch.setattr(telemetry, "langfuse", fake_client)
    monkeypatch.setattr(telemetry, "settings", MagicMock(langfuse_enabled=False))

    telemetry.flush()

    fake_client.flush.assert_not_called()
