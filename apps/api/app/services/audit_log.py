"""Audit logging service for tool calls and security events.

This module provides:
- AuditLogger: Service for logging tool calls with user context
- Structured logging with user_id, tool_name, arguments, and results
- Async database persistence for audit trail
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class AuditEventType(str, Enum):
    """Types of audit events."""

    TOOL_CALL = "tool_call"
    TOOL_CALL_SUCCESS = "tool_call_success"
    TOOL_CALL_FAILURE = "tool_call_failure"
    SECURITY_VIOLATION = "security_violation"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INPUT_SANITIZED = "input_sanitized"


class AuditLogEntry(BaseModel):
    """Structured audit log entry."""

    timestamp: datetime
    event_type: AuditEventType
    user_id: str
    tool_name: str
    arguments: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    sanitized_fields: list[str] | None = None
    metadata: dict[str, Any] | None = None

    model_config = {"frozen": True}


class AuditLogger:
    """Service for audit logging of tool calls and security events.

    Logs all tool calls with user context, arguments, and results.
    Supports both structured logging and database persistence.
    """

    def __init__(self, log_to_db: bool = True) -> None:
        """Initialize the audit logger.

        Args:
            log_to_db: Whether to persist logs to database.
        """
        self._log_to_db = log_to_db

    def log_tool_call(
        self,
        user_id: str | UUID,
        tool_name: str,
        arguments: dict[str, Any],
        *,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLogEntry:
        """Log a tool call before execution.

        Args:
            user_id: UUID of the authenticated user.
            tool_name: Name of the tool being called.
            arguments: Tool arguments (will be redacted if sensitive).
            metadata: Optional additional context.

        Returns:
            The created audit log entry.
        """
        entry = AuditLogEntry(
            timestamp=datetime.now(UTC),
            event_type=AuditEventType.TOOL_CALL,
            user_id=str(user_id),
            tool_name=tool_name,
            arguments=self._redact_sensitive(arguments),
            metadata=metadata,
        )
        self._emit_log(entry)
        return entry

    def log_tool_success(
        self,
        user_id: str | UUID,
        tool_name: str,
        arguments: dict[str, Any],
        result: dict[str, Any],
        *,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLogEntry:
        """Log a successful tool execution.

        Args:
            user_id: UUID of the authenticated user.
            tool_name: Name of the tool.
            arguments: Tool arguments.
            result: Tool result data.
            metadata: Optional additional context.

        Returns:
            The created audit log entry.
        """
        entry = AuditLogEntry(
            timestamp=datetime.now(UTC),
            event_type=AuditEventType.TOOL_CALL_SUCCESS,
            user_id=str(user_id),
            tool_name=tool_name,
            arguments=self._redact_sensitive(arguments),
            result=self._truncate_result(result),
            metadata=metadata,
        )
        self._emit_log(entry)
        return entry

    def log_tool_failure(
        self,
        user_id: str | UUID,
        tool_name: str,
        arguments: dict[str, Any],
        error: str,
        *,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLogEntry:
        """Log a failed tool execution.

        Args:
            user_id: UUID of the authenticated user.
            tool_name: Name of the tool.
            arguments: Tool arguments.
            error: Error message or description.
            metadata: Optional additional context.

        Returns:
            The created audit log entry.
        """
        entry = AuditLogEntry(
            timestamp=datetime.now(UTC),
            event_type=AuditEventType.TOOL_CALL_FAILURE,
            user_id=str(user_id),
            tool_name=tool_name,
            arguments=self._redact_sensitive(arguments),
            error=error,
            metadata=metadata,
        )
        self._emit_log(entry, level=logging.WARNING)
        return entry

    def log_security_violation(
        self,
        user_id: str | UUID,
        tool_name: str,
        violation_type: str,
        details: str,
        *,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLogEntry:
        """Log a security violation.

        Args:
            user_id: UUID of the user (or "anonymous" for unauthenticated).
            tool_name: Name of the tool or resource involved.
            violation_type: Type of violation (e.g., "unauthorized_access").
            details: Description of the violation.
            metadata: Optional additional context.

        Returns:
            The created audit log entry.
        """
        entry = AuditLogEntry(
            timestamp=datetime.now(UTC),
            event_type=AuditEventType.SECURITY_VIOLATION,
            user_id=str(user_id),
            tool_name=tool_name,
            error=f"{violation_type}: {details}",
            metadata=metadata,
        )
        self._emit_log(entry, level=logging.ERROR)
        return entry

    def log_input_sanitized(
        self,
        user_id: str | UUID,
        tool_name: str,
        sanitized_fields: list[str],
        *,
        original_patterns: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLogEntry:
        """Log when input was sanitized.

        Args:
            user_id: UUID of the authenticated user.
            tool_name: Name of the tool.
            sanitized_fields: List of field names that were sanitized.
            original_patterns: Patterns that were detected and removed.
            metadata: Optional additional context.

        Returns:
            The created audit log entry.
        """
        entry = AuditLogEntry(
            timestamp=datetime.now(UTC),
            event_type=AuditEventType.INPUT_SANITIZED,
            user_id=str(user_id),
            tool_name=tool_name,
            sanitized_fields=sanitized_fields,
            metadata={
                **(metadata or {}),
                "original_patterns": original_patterns or [],
            },
        )
        self._emit_log(entry, level=logging.WARNING)
        return entry

    def _emit_log(self, entry: AuditLogEntry, level: int = logging.INFO) -> None:
        """Emit the log entry to the logging system."""
        log_data = entry.model_dump(exclude_none=True, mode="json")
        logger.log(
            level,
            "AUDIT: %s | user=%s | tool=%s",
            entry.event_type.value,
            entry.user_id[:8] + "..." if len(entry.user_id) > 8 else entry.user_id,
            entry.tool_name,
            extra={"audit": log_data},
        )

    def _redact_sensitive(self, data: dict[str, Any]) -> dict[str, Any]:
        """Redact sensitive fields from arguments.

        Redacts fields that might contain sensitive information like
        passwords, tokens, or API keys.
        """
        sensitive_patterns = {
            "password",
            "secret",
            "token",
            "api_key",
            "apikey",
            "credential",
            "auth",
        }

        redacted = {}
        for key, value in data.items():
            key_lower = key.lower()
            if any(pattern in key_lower for pattern in sensitive_patterns):
                redacted[key] = "[REDACTED]"
            elif isinstance(value, dict):
                redacted[key] = self._redact_sensitive(value)
            else:
                redacted[key] = value
        return redacted

    def _truncate_result(
        self,
        result: dict[str, Any],
        max_length: int = 1000,
    ) -> dict[str, Any]:
        """Truncate large result data for logging."""
        try:
            result_json = json.dumps(result)
            if len(result_json) <= max_length:
                return result
            return {
                "_truncated": True,
                "_original_length": len(result_json),
                "preview": result_json[:max_length] + "...",
            }
        except (TypeError, ValueError):
            return {"_error": "Result not JSON serializable"}


# Singleton instance for shared use
audit_logger = AuditLogger()
