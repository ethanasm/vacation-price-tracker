"""Axiom structured logging for application logs (stdout + Axiom).

This is the Python port of showbook's ``packages/observability/src/logger.ts``.
Langfuse (``app.core.telemetry``) is unchanged and keeps owning LLM/MCP traces —
app logs go to Axiom, LLM traces go to Langfuse.

Design (the "field columns" model):
    Axiom promotes every unique top-level/dotted field name to a permanent
    dataset column, capped per dataset. To bound the schema forever we keep a
    small ``CORE_FIELDS`` allowlist as real columns and fold every other key
    into a single ``fields`` **map field** (whose nested keys do not count
    against the cap). ``reshape_for_axiom`` does the fold; it runs only on the
    Axiom path, so stdout / ``docker logs`` stay flat.

Usage (stdlib logging, structured via ``extra``):
    logger = logging.getLogger(__name__)
    logger.info("Trip loaded", extra={"event": "activity.load_trip.ok", "trip_id": tid})
    logger.error("Fetch failed", exc_info=exc, extra={"event": "...", "trip_id": tid})

Everything degrades to stdout-only when ``AXIOM_TOKEN`` / ``AXIOM_DATASET`` are
unset (dev, tests, CI never ship), mirroring ``telemetry.py``.
"""

from __future__ import annotations

import json
import logging
import socket
import sys
import traceback
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import wait as futures_wait
from datetime import UTC, datetime
from threading import Timer
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import axiom_py
    from axiom_py.logging import AxiomHandler

    _HAS_AXIOM = True
except ImportError:  # pragma: no cover - exercised only when the dep is absent
    _HAS_AXIOM = False
    logger.warning("axiom-py not installed; Axiom log shipping disabled")

_HOSTNAME = socket.gethostname()
_DEFAULT_SERVICE = "vpt-api"
_MAX_CAUSE_DEPTH = 5

# ---------------------------------------------------------------------------
# Field schema (port of CORE_FIELDS / ALLOWED_ERROR_FIELDS from logger.ts)
# ---------------------------------------------------------------------------

# Keys that stay top-level columns in the Axiom dataset. Everything else a
# call-site logs folds into the single ``fields`` map field. Keep this list
# small — each entry is a permanent column. Only add a key here when it is
# genuinely filtered/grouped/aggregated in APL. NEVER add ``fields``.
CORE_FIELDS: frozenset[str] = frozenset(
    {
        "_time",
        "time",
        "level",
        "msg",
        "event",
        "component",
        "service",
        "env",
        "pid",
        "hostname",
        "err",
        "reason",
        "status",
        "duration_ms",
        "user_id",
        "trip_id",
        "workflow_id",
        "activity",
    }
)

# Allowlist of error attributes serialized into ``err`` — bounds the ``err.*``
# columns so a wild error shape (e.g. a driver error carrying dozens of attrs)
# can't blow up the dataset schema. Standard Error tuple is always included;
# these are the extra shapes our stack surfaces (asyncpg/SQLAlchemy, httpx).
ALLOWED_ERROR_FIELDS: tuple[str, ...] = (
    # asyncpg / SQLAlchemy / Postgres
    "sqlstate",
    "pgcode",
    "pgerror",
    "detail",
    "hint",
    "constraint_name",
    "table_name",
    "schema_name",
    "column_name",
    # httpx / HTTP clients
    "status",
    "status_code",
)

# Standard LogRecord attributes — anything NOT here on a record was attached via
# ``extra=`` at the call-site and is treated as a structured field.
_RESERVED_LOGRECORD_ATTRS: frozenset[str] = frozenset(
    {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "taskName",
        "message",
        "asctime",
    }
)


def _jsonify(value: Any, _depth: int = 0) -> Any:
    """Coerce a value into something the Axiom client (ujson) can serialize."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if _depth >= _MAX_CAUSE_DEPTH:
        return str(value)
    if isinstance(value, dict):
        return {str(k): _jsonify(v, _depth + 1) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonify(v, _depth + 1) for v in value]
    return str(value)


def serialize_err(exc: Any, _depth: int = 0) -> Any:
    """Allowlist error serializer (port of ``serializeErr``).

    Emits the standard ``type/name/message/stack`` plus any ``ALLOWED_ERROR_FIELDS``
    present, and recurses the ``__cause__`` / ``__context__`` chain so wrapped
    errors keep their underlying code.
    """
    if exc is None:
        return None
    if not isinstance(exc, BaseException):
        return _jsonify(exc)

    out: dict[str, Any] = {
        "type": type(exc).__name__,
        "name": type(exc).__name__,
        "message": str(exc),
        "stack": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
    }
    for key in ALLOWED_ERROR_FIELDS:
        val = getattr(exc, key, None)
        if val is not None and key not in out:
            out[key] = _jsonify(val)

    if _depth < _MAX_CAUSE_DEPTH:
        cause = exc.__cause__ or exc.__context__
        if cause is not None and cause is not exc:
            out["cause"] = serialize_err(cause, _depth + 1)
    return out


def reshape_for_axiom(record: Any) -> Any:
    """Keep ``CORE_FIELDS`` top-level and fold every other key into ``fields``.

    Pure function. A non-dict input is returned untouched so we never drop an
    event. A literal top-level ``fields`` key folds to ``fields.fields`` because
    ``fields`` is deliberately not in ``CORE_FIELDS``.
    """
    if not isinstance(record, dict):
        return record

    out: dict[str, Any] = {}
    fields: dict[str, Any] = {}
    for key, value in record.items():
        if key in CORE_FIELDS:
            out[key] = value
        else:
            fields[key] = value
    if fields:
        out["fields"] = fields
    return out


def _record_to_event(record: logging.LogRecord, service: str) -> dict[str, Any]:
    """Build a flat, JSON-safe event dict from a LogRecord (pre-reshape)."""
    event: dict[str, Any] = {
        "_time": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
        "level": record.levelname.lower(),
        "msg": record.getMessage(),
        "logger": record.name,
        "service": service,
        "env": settings.environment,
        "pid": record.process,
        "hostname": _HOSTNAME,
    }
    # Structured fields attached via ``extra=`` at the call-site.
    for key, value in record.__dict__.items():
        if key in _RESERVED_LOGRECORD_ATTRS or key in event:
            continue
        event[key] = _jsonify(value)

    if record.exc_info:
        exc = record.exc_info[1] if isinstance(record.exc_info, tuple) else None
        if exc is not None:
            event["err"] = serialize_err(exc)
    return event


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


class _JsonFormatter(logging.Formatter):
    """Flat JSON to stdout (prod) — captured by Docker's json-file driver."""

    def __init__(self, service: str) -> None:
        super().__init__()
        self._service = service

    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(_record_to_event(record, self._service), default=str)


class _HumanFormatter(logging.Formatter):
    """Human-readable stdout (dev), surfacing the structured ``event`` if set."""

    def format(self, record: logging.LogRecord) -> str:
        event = getattr(record, "event", None)
        prefix = f"[{event}] " if event else ""
        line = f"{record.levelname} {record.name}: {prefix}{record.getMessage()}"
        if record.exc_info:
            line = f"{line}\n{self.formatException(record.exc_info)}"
        return line


if _HAS_AXIOM:

    class VptAxiomHandler(AxiomHandler):
        """``axiom_py.logging.AxiomHandler`` + showbook's reshape Transform.

        Reuses the SDK handler's buffer + interval/size flush trigger, but ships
        the batch on a background thread so the synchronous SDK ``ingest_events``
        (``requests.post`` with retry/backoff) never blocks the asyncio event
        loop — most call-sites log from inside async request/activity handlers.
        ``emit`` also reshapes each record (CORE_FIELDS kept, everything else
        folded into ``fields``) before buffering, instead of the raw
        ``record.__dict__`` that would leak LogRecord internals as columns.
        """

        def __init__(self, client: Any, dataset: str, service: str, *, interval: int = 1) -> None:
            super().__init__(client, dataset, interval=interval)
            self._service = service
            self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="axiom-ship")
            self._pending: set[Future] = set()

        def emit(self, record: logging.LogRecord) -> None:  # noqa: D102
            try:
                event = reshape_for_axiom(_record_to_event(record, self._service))
            except Exception:  # never let logging raise
                return
            with self.lock:
                self.buffer.append(event)
                should_flush = len(self.buffer) >= 1000 or _monotonic() - self.last_flush > self.interval
            if should_flush:
                self.flush()
            # Re-arm the periodic flush (mirrors the SDK's emit tail).
            self.timer.cancel()
            self.timer = Timer(self.interval, self.flush)
            self.timer.start()

        def flush(self) -> None:
            """Swap the buffer and ship it on the background thread (non-blocking)."""
            with self.lock:
                self.last_flush = _monotonic()
                if not self.buffer:
                    return
                local_buffer, self.buffer = self.buffer, []
            future = self._executor.submit(self._ship, local_buffer)
            self._pending.add(future)
            future.add_done_callback(self._pending.discard)

        def _ship(self, events: list) -> None:
            try:
                self.client.ingest_events(self.dataset, events)
            except Exception:  # pragma: no cover - best-effort; never crash the ship thread
                pass

        def drain(self, timeout: float = 5.0) -> None:
            """Flush and wait for in-flight ships (used on shutdown)."""
            self.flush()
            pending = list(self._pending)
            if pending:
                futures_wait(pending, timeout=timeout)

        def close(self) -> None:
            try:
                self.timer.cancel()
            finally:
                self._executor.shutdown(wait=False)
                super().close()


def _monotonic() -> float:
    import time

    return time.monotonic()


_axiom_handler: Any = None


def _build_axiom_handler(service: str) -> Any:
    if not (_HAS_AXIOM and settings.axiom_enabled):
        return None
    try:
        client = axiom_py.Client(
            token=settings.axiom_token,
            org_id=settings.axiom_org_id or None,
            url=settings.axiom_url or None,
        )
        handler = VptAxiomHandler(client, settings.axiom_dataset, service)
        # Ship INFO+ to Axiom; DEBUG stays stdout-only (volume/cost).
        handler.setLevel(logging.INFO)
        return handler
    except Exception as exc:  # pragma: no cover - defensive init guard
        logger.warning("Axiom handler init failed; shipping disabled: %s", exc)
        return None


def init_observability(service: str = _DEFAULT_SERVICE) -> None:
    """Configure root logging: stdout always, Axiom when configured. Idempotent."""
    global _axiom_handler

    # Close the previous Axiom handler (cancel its Timer, stop its ship thread)
    # so re-init doesn't leak background threads.
    if _axiom_handler is not None:
        _axiom_handler.close()
        _axiom_handler = None

    root = logging.getLogger()
    for handler in list(root.handlers):
        root.removeHandler(handler)

    stdout = logging.StreamHandler(sys.stdout)
    stdout.setFormatter(_JsonFormatter(service) if settings.is_production else _HumanFormatter())
    root.addHandler(stdout)

    _axiom_handler = _build_axiom_handler(service)
    if _axiom_handler is not None:
        root.addHandler(_axiom_handler)
        logger.info("Axiom log shipping enabled dataset=%s", settings.axiom_dataset)

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    root.setLevel(level)
    logging.getLogger("app").setLevel(level)


def flush() -> None:
    """Drain the Axiom handler buffer and wait for in-flight ships (shutdown)."""
    if _axiom_handler is not None:
        try:
            _axiom_handler.drain()
        except Exception:  # pragma: no cover - best-effort drain
            pass


def get_logger(name: str) -> logging.Logger:
    """Return a stdlib logger (thin wrapper for a single import surface)."""
    return logging.getLogger(name)


class _BoundLogger(logging.LoggerAdapter):
    """LoggerAdapter that MERGES bound context with call-site ``extra``.

    The stdlib 3.12 LoggerAdapter overwrites call-site ``extra`` with the
    adapter's; merging keeps both the bound context (e.g. workflow_id) and the
    per-call ``event``.
    """

    def process(self, msg: str, kwargs: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        extra = {**(self.extra or {}), **(kwargs.get("extra") or {})}
        kwargs["extra"] = extra
        return msg, kwargs


def bind(base: logging.Logger | logging.LoggerAdapter, **context: Any) -> _BoundLogger:
    """Python analogue of pino's ``child({...})`` — bind context onto a logger."""
    if isinstance(base, logging.LoggerAdapter):
        merged = {**(base.extra or {}), **context}
        return _BoundLogger(base.logger, merged)
    return _BoundLogger(base, context)


__all__ = [
    "ALLOWED_ERROR_FIELDS",
    "CORE_FIELDS",
    "bind",
    "flush",
    "get_logger",
    "init_observability",
    "reshape_for_axiom",
    "serialize_err",
]
