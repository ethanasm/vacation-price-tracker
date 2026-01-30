"""Tests for audit logging service."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

import pytest
from app.services.audit_log import (
    AuditEventType,
    AuditLogEntry,
    AuditLogger,
    audit_logger,
)

# =============================================================================
# Tests for AuditLogEntry
# =============================================================================


def test_audit_log_entry_creation():
    """AuditLogEntry should be created with required fields."""
    entry = AuditLogEntry(
        timestamp=datetime.now(UTC),
        event_type=AuditEventType.TOOL_CALL,
        user_id="user-123",
        tool_name="list_trips",
    )

    assert entry.event_type == AuditEventType.TOOL_CALL
    assert entry.user_id == "user-123"
    assert entry.tool_name == "list_trips"
    assert entry.arguments is None
    assert entry.result is None
    assert entry.error is None


def test_audit_log_entry_with_all_fields():
    """AuditLogEntry should support all optional fields."""
    timestamp = datetime.now(UTC)
    entry = AuditLogEntry(
        timestamp=timestamp,
        event_type=AuditEventType.TOOL_CALL_SUCCESS,
        user_id="user-456",
        tool_name="create_trip",
        arguments={"name": "Hawaii"},
        result={"trip_id": "abc"},
        metadata={"source": "chat"},
    )

    assert entry.timestamp == timestamp
    assert entry.arguments == {"name": "Hawaii"}
    assert entry.result == {"trip_id": "abc"}
    assert entry.metadata == {"source": "chat"}


def test_audit_log_entry_is_frozen():
    """AuditLogEntry should be immutable (frozen)."""
    entry = AuditLogEntry(
        timestamp=datetime.now(UTC),
        event_type=AuditEventType.TOOL_CALL,
        user_id="user-123",
        tool_name="test",
    )

    with pytest.raises(Exception):  # noqa: B017 - Frozen model rejects mutation with ValidationError
        entry.user_id = "different-user"


# =============================================================================
# Tests for AuditEventType
# =============================================================================


def test_audit_event_type_values():
    """All expected event types should be defined."""
    assert AuditEventType.TOOL_CALL.value == "tool_call"
    assert AuditEventType.TOOL_CALL_SUCCESS.value == "tool_call_success"
    assert AuditEventType.TOOL_CALL_FAILURE.value == "tool_call_failure"
    assert AuditEventType.SECURITY_VIOLATION.value == "security_violation"
    assert AuditEventType.RATE_LIMIT_EXCEEDED.value == "rate_limit_exceeded"
    assert AuditEventType.INPUT_SANITIZED.value == "input_sanitized"


# =============================================================================
# Tests for AuditLogger.log_tool_call
# =============================================================================


def test_log_tool_call_creates_entry():
    """log_tool_call should create a TOOL_CALL entry."""
    logger = AuditLogger()
    user_id = str(uuid.uuid4())

    entry = logger.log_tool_call(
        user_id=user_id,
        tool_name="list_trips",
        arguments={"status": "active"},
    )

    assert entry.event_type == AuditEventType.TOOL_CALL
    assert entry.user_id == user_id
    assert entry.tool_name == "list_trips"
    assert entry.arguments == {"status": "active"}


def test_log_tool_call_accepts_uuid():
    """log_tool_call should accept UUID objects."""
    logger = AuditLogger()
    user_uuid = uuid.uuid4()

    entry = logger.log_tool_call(
        user_id=user_uuid,
        tool_name="test",
        arguments={},
    )

    assert entry.user_id == str(user_uuid)


def test_log_tool_call_with_metadata():
    """log_tool_call should include metadata."""
    logger = AuditLogger()

    entry = logger.log_tool_call(
        user_id="user-123",
        tool_name="test",
        arguments={},
        metadata={"conversation_id": "conv-abc"},
    )

    assert entry.metadata == {"conversation_id": "conv-abc"}


# =============================================================================
# Tests for AuditLogger.log_tool_success
# =============================================================================


def test_log_tool_success_creates_entry():
    """log_tool_success should create a TOOL_CALL_SUCCESS entry."""
    logger = AuditLogger()

    entry = logger.log_tool_success(
        user_id="user-123",
        tool_name="create_trip",
        arguments={"name": "Hawaii"},
        result={"trip_id": "trip-456"},
    )

    assert entry.event_type == AuditEventType.TOOL_CALL_SUCCESS
    assert entry.tool_name == "create_trip"
    assert entry.result["trip_id"] == "trip-456"


def test_log_tool_success_truncates_large_results():
    """log_tool_success should truncate large results."""
    logger = AuditLogger()

    # Create a large result
    large_result = {"data": "x" * 2000}

    entry = logger.log_tool_success(
        user_id="user-123",
        tool_name="test",
        arguments={},
        result=large_result,
    )

    assert entry.result.get("_truncated") is True
    assert "preview" in entry.result


# =============================================================================
# Tests for AuditLogger.log_tool_failure
# =============================================================================


def test_log_tool_failure_creates_entry():
    """log_tool_failure should create a TOOL_CALL_FAILURE entry."""
    logger = AuditLogger()

    entry = logger.log_tool_failure(
        user_id="user-123",
        tool_name="create_trip",
        arguments={"name": "Hawaii"},
        error="Trip limit exceeded",
    )

    assert entry.event_type == AuditEventType.TOOL_CALL_FAILURE
    assert entry.error == "Trip limit exceeded"


def test_log_tool_failure_logs_warning(caplog):
    """log_tool_failure should log at WARNING level."""
    logger = AuditLogger()

    with caplog.at_level(logging.WARNING):
        logger.log_tool_failure(
            user_id="user-123",
            tool_name="test",
            arguments={},
            error="Test error",
        )

    assert "AUDIT" in caplog.text
    assert "tool_call_failure" in caplog.text


# =============================================================================
# Tests for AuditLogger.log_security_violation
# =============================================================================


def test_log_security_violation_creates_entry():
    """log_security_violation should create a SECURITY_VIOLATION entry."""
    logger = AuditLogger()

    entry = logger.log_security_violation(
        user_id="user-123",
        tool_name="get_trip_details",
        violation_type="unauthorized_access",
        details="Attempted to access trip owned by another user",
    )

    assert entry.event_type == AuditEventType.SECURITY_VIOLATION
    assert "unauthorized_access" in entry.error
    assert "another user" in entry.error


def test_log_security_violation_logs_error(caplog):
    """log_security_violation should log at ERROR level."""
    logger = AuditLogger()

    with caplog.at_level(logging.ERROR):
        logger.log_security_violation(
            user_id="user-123",
            tool_name="test",
            violation_type="test",
            details="test details",
        )

    assert "AUDIT" in caplog.text
    assert "security_violation" in caplog.text


# =============================================================================
# Tests for AuditLogger.log_input_sanitized
# =============================================================================


def test_log_input_sanitized_creates_entry():
    """log_input_sanitized should create an INPUT_SANITIZED entry."""
    logger = AuditLogger()

    entry = logger.log_input_sanitized(
        user_id="user-123",
        tool_name="create_trip",
        sanitized_fields=["name", "description"],
        original_patterns=["sql_keyword", "cmd_metachar"],
    )

    assert entry.event_type == AuditEventType.INPUT_SANITIZED
    assert entry.sanitized_fields == ["name", "description"]
    assert entry.metadata["original_patterns"] == ["sql_keyword", "cmd_metachar"]


def test_log_input_sanitized_logs_warning(caplog):
    """log_input_sanitized should log at WARNING level."""
    logger = AuditLogger()

    with caplog.at_level(logging.WARNING):
        logger.log_input_sanitized(
            user_id="user-123",
            tool_name="test",
            sanitized_fields=["field1"],
        )

    assert "AUDIT" in caplog.text
    assert "input_sanitized" in caplog.text


# =============================================================================
# Tests for _redact_sensitive
# =============================================================================


def test_redact_sensitive_redacts_password():
    """Sensitive fields should be redacted."""
    logger = AuditLogger()

    data = {"username": "john", "password": "secret123"}
    redacted = logger._redact_sensitive(data)

    assert redacted["username"] == "john"
    assert redacted["password"] == "[REDACTED]"


def test_redact_sensitive_redacts_various_patterns():
    """Various sensitive patterns should be redacted."""
    logger = AuditLogger()

    data = {
        "api_key": "key123",
        "apiKey": "key456",
        "secret_token": "token789",
        "auth_header": "Bearer xxx",
        "credential": "cred",
        "normal_field": "value",
    }
    redacted = logger._redact_sensitive(data)

    assert redacted["api_key"] == "[REDACTED]"
    assert redacted["apiKey"] == "[REDACTED]"
    assert redacted["secret_token"] == "[REDACTED]"
    assert redacted["auth_header"] == "[REDACTED]"
    assert redacted["credential"] == "[REDACTED]"
    assert redacted["normal_field"] == "value"


def test_redact_sensitive_handles_nested_dicts():
    """Nested dictionaries should be recursively redacted."""
    logger = AuditLogger()

    data = {
        "config": {
            "database": {
                "password": "dbpass",
                "host": "localhost",
            }
        }
    }
    redacted = logger._redact_sensitive(data)

    assert redacted["config"]["database"]["password"] == "[REDACTED]"
    assert redacted["config"]["database"]["host"] == "localhost"


def test_redact_sensitive_preserves_non_sensitive_fields():
    """Non-sensitive fields should not be modified."""
    logger = AuditLogger()

    data = {"name": "Hawaii", "destination": "HNL", "adults": 2}
    redacted = logger._redact_sensitive(data)

    assert redacted == data


# =============================================================================
# Tests for _truncate_result
# =============================================================================


def test_truncate_result_small_result():
    """Small results should not be truncated."""
    logger = AuditLogger()

    result = {"trip_id": "abc", "name": "Hawaii"}
    truncated = logger._truncate_result(result)

    assert truncated == result


def test_truncate_result_large_result():
    """Large results should be truncated."""
    logger = AuditLogger()

    result = {"data": "x" * 2000}
    truncated = logger._truncate_result(result, max_length=100)

    assert truncated["_truncated"] is True
    assert truncated["_original_length"] > 100
    assert len(truncated["preview"]) <= 103  # 100 + "..."


def test_truncate_result_non_serializable():
    """Non-JSON-serializable results should return error indicator."""
    logger = AuditLogger()

    # Create an object that can't be JSON serialized
    class NotSerializable:
        pass

    result = {"obj": NotSerializable()}
    truncated = logger._truncate_result(result)

    assert truncated["_error"] == "Result not JSON serializable"


# =============================================================================
# Tests for _emit_log
# =============================================================================


def test_emit_log_at_info_level(caplog):
    """Default emit should log at INFO level."""
    logger = AuditLogger()

    entry = AuditLogEntry(
        timestamp=datetime.now(UTC),
        event_type=AuditEventType.TOOL_CALL,
        user_id="user-12345678",
        tool_name="test",
    )

    with caplog.at_level(logging.INFO):
        logger._emit_log(entry)

    assert "AUDIT" in caplog.text
    assert "tool_call" in caplog.text
    assert "user-123..." in caplog.text  # Truncated user ID


def test_emit_log_at_warning_level(caplog):
    """Warning level should be used when specified."""
    logger = AuditLogger()

    entry = AuditLogEntry(
        timestamp=datetime.now(UTC),
        event_type=AuditEventType.TOOL_CALL_FAILURE,
        user_id="user-123",
        tool_name="test",
    )

    with caplog.at_level(logging.WARNING):
        logger._emit_log(entry, level=logging.WARNING)

    assert "AUDIT" in caplog.text


def test_emit_log_short_user_id(caplog):
    """Short user IDs should not be truncated."""
    logger = AuditLogger()

    entry = AuditLogEntry(
        timestamp=datetime.now(UTC),
        event_type=AuditEventType.TOOL_CALL,
        user_id="short",
        tool_name="test",
    )

    with caplog.at_level(logging.INFO):
        logger._emit_log(entry)

    assert "short" in caplog.text
    assert "..." not in caplog.text.split("short")[1].split("|")[0]


# =============================================================================
# Tests for singleton instance
# =============================================================================


def test_singleton_instance_exists():
    """Singleton instance should be available."""
    assert audit_logger is not None
    assert isinstance(audit_logger, AuditLogger)


def test_singleton_can_log():
    """Singleton instance should be functional."""
    entry = audit_logger.log_tool_call(
        user_id="user-123",
        tool_name="test",
        arguments={},
    )

    assert entry.event_type == AuditEventType.TOOL_CALL
