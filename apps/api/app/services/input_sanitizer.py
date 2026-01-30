"""Input sanitization for LLM-generated tool arguments.

This module provides:
- InputSanitizer: Service for detecting and removing injection patterns
- SQL injection detection and prevention
- NoSQL injection detection and prevention
- Command injection detection and prevention
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class SanitizationResult:
    """Result of input sanitization."""

    sanitized_data: dict[str, Any]
    was_modified: bool
    sanitized_fields: list[str] = field(default_factory=list)
    detected_patterns: list[str] = field(default_factory=list)


class InputSanitizer:
    """Sanitizer for LLM-generated tool arguments.

    Detects and removes potential injection patterns from tool arguments
    before they are passed to database queries or system commands.

    Patterns detected:
    - SQL injection (SELECT, INSERT, DROP, UNION, etc.)
    - NoSQL injection (MongoDB operators like $where, $gt, etc.)
    - Command injection (shell metacharacters, pipes, etc.)
    - Path traversal (../, /etc/, etc.)
    """

    # SQL injection patterns
    SQL_PATTERNS: list[tuple[re.Pattern[str], str]] = [
        # Common SQL keywords with word boundaries
        (re.compile(r"\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b", re.IGNORECASE), "sql_keyword"),
        # UNION-based injection
        (re.compile(r"\bUNION\s+(ALL\s+)?SELECT\b", re.IGNORECASE), "sql_union"),
        # SQL comments
        (re.compile(r"(--|#|/\*.*?\*/)", re.DOTALL), "sql_comment"),
        # OR/AND true conditions
        (re.compile(r"\bOR\s+['\"]?1['\"]?\s*=\s*['\"]?1['\"]?", re.IGNORECASE), "sql_or_true"),
        (re.compile(r"\bAND\s+['\"]?1['\"]?\s*=\s*['\"]?1['\"]?", re.IGNORECASE), "sql_and_true"),
        # Single quote followed by SQL
        (re.compile(r"'\s*(OR|AND|UNION|SELECT)\b", re.IGNORECASE), "sql_quote_escape"),
        # Hex encoding bypass attempts
        (re.compile(r"0x[0-9a-fA-F]+"), "sql_hex"),
        # EXEC/EXECUTE statements
        (re.compile(r"\b(EXEC|EXECUTE)\s*\(", re.IGNORECASE), "sql_exec"),
        # Semicolon-based statement chaining
        (re.compile(r";\s*(SELECT|INSERT|UPDATE|DELETE|DROP)\b", re.IGNORECASE), "sql_chain"),
    ]

    # NoSQL injection patterns (MongoDB-style)
    NOSQL_PATTERNS: list[tuple[re.Pattern[str], str]] = [
        # MongoDB operators
        (re.compile(r"\$where\b", re.IGNORECASE), "nosql_where"),
        (re.compile(r"\$(gt|gte|lt|lte|ne|eq|in|nin|regex|exists)\b", re.IGNORECASE), "nosql_operator"),
        (re.compile(r"\$(or|and|not|nor)\b", re.IGNORECASE), "nosql_logic"),
        # JavaScript injection in MongoDB
        (re.compile(r"\bfunction\s*\(", re.IGNORECASE), "nosql_function"),
        (re.compile(r"\beval\s*\(", re.IGNORECASE), "nosql_eval"),
    ]

    # Command injection patterns
    COMMAND_PATTERNS: list[tuple[re.Pattern[str], str]] = [
        # Shell metacharacters
        (re.compile(r"[|;&`$]"), "cmd_metachar"),
        # Command substitution
        (re.compile(r"\$\([^)]+\)"), "cmd_subst"),
        (re.compile(r"`[^`]+`"), "cmd_backtick"),
        # Common dangerous commands
        (re.compile(r"\b(rm|chmod|chown|sudo|su|wget|curl|nc|netcat)\b", re.IGNORECASE), "cmd_dangerous"),
        # Redirection
        (re.compile(r"[<>]{1,2}"), "cmd_redirect"),
    ]

    # Path traversal patterns
    PATH_PATTERNS: list[tuple[re.Pattern[str], str]] = [
        # Directory traversal
        (re.compile(r"\.\.(/|\\)"), "path_traversal"),
        # Absolute paths to sensitive directories
        (re.compile(r"^/etc/", re.IGNORECASE), "path_etc"),
        (re.compile(r"^/proc/", re.IGNORECASE), "path_proc"),
        (re.compile(r"^/sys/", re.IGNORECASE), "path_sys"),
        (re.compile(r"^/root/", re.IGNORECASE), "path_root"),
        # Windows sensitive paths
        (re.compile(r"^[A-Za-z]:\\Windows\\", re.IGNORECASE), "path_windows"),
    ]

    def __init__(
        self,
        check_sql: bool = True,
        check_nosql: bool = True,
        check_command: bool = True,
        check_path: bool = True,
    ) -> None:
        """Initialize the sanitizer with enabled checks.

        Args:
            check_sql: Enable SQL injection detection.
            check_nosql: Enable NoSQL injection detection.
            check_command: Enable command injection detection.
            check_path: Enable path traversal detection.
        """
        self._patterns: list[tuple[re.Pattern[str], str]] = []

        if check_sql:
            self._patterns.extend(self.SQL_PATTERNS)
        if check_nosql:
            self._patterns.extend(self.NOSQL_PATTERNS)
        if check_command:
            self._patterns.extend(self.COMMAND_PATTERNS)
        if check_path:
            self._patterns.extend(self.PATH_PATTERNS)

    def sanitize(self, data: dict[str, Any]) -> SanitizationResult:
        """Sanitize a dictionary of tool arguments.

        Args:
            data: Dictionary of arguments to sanitize.

        Returns:
            SanitizationResult with sanitized data and modification info.
        """
        sanitized_fields: list[str] = []
        detected_patterns: list[str] = []

        sanitized_data = self._sanitize_dict(
            data,
            "",
            sanitized_fields,
            detected_patterns,
        )

        return SanitizationResult(
            sanitized_data=sanitized_data,
            was_modified=len(sanitized_fields) > 0,
            sanitized_fields=sanitized_fields,
            detected_patterns=detected_patterns,
        )

    def check_string(self, value: str) -> tuple[bool, list[str]]:
        """Check if a string contains any dangerous patterns.

        Args:
            value: String to check.

        Returns:
            Tuple of (is_safe, list of detected pattern names).
        """
        detected = []
        for pattern, name in self._patterns:
            if pattern.search(value):
                detected.append(name)
        return len(detected) == 0, detected

    def sanitize_string(self, value: str) -> tuple[str, list[str]]:
        """Sanitize a single string value.

        Args:
            value: String to sanitize.

        Returns:
            Tuple of (sanitized_string, list of detected pattern names).
        """
        detected = []
        sanitized = value

        for pattern, name in self._patterns:
            if pattern.search(sanitized):
                detected.append(name)
                sanitized = pattern.sub("", sanitized)

        return sanitized.strip(), detected

    def _sanitize_dict(
        self,
        data: dict[str, Any],
        path: str,
        sanitized_fields: list[str],
        detected_patterns: list[str],
    ) -> dict[str, Any]:
        """Recursively sanitize a dictionary."""
        result: dict[str, Any] = {}

        for key, value in data.items():
            field_path = f"{path}.{key}" if path else key
            result[key] = self._sanitize_value(
                value,
                field_path,
                sanitized_fields,
                detected_patterns,
            )

        return result

    def _sanitize_value(
        self,
        value: Any,
        path: str,
        sanitized_fields: list[str],
        detected_patterns: list[str],
    ) -> Any:
        """Sanitize a single value based on its type."""
        if isinstance(value, str):
            sanitized, patterns = self.sanitize_string(value)
            if patterns:
                sanitized_fields.append(path)
                detected_patterns.extend(patterns)
                logger.warning(
                    "Sanitized field %s: detected patterns %s",
                    path,
                    patterns,
                )
            return sanitized

        if isinstance(value, dict):
            return self._sanitize_dict(
                value,
                path,
                sanitized_fields,
                detected_patterns,
            )

        if isinstance(value, list):
            return [
                self._sanitize_value(
                    item,
                    f"{path}[{i}]",
                    sanitized_fields,
                    detected_patterns,
                )
                for i, item in enumerate(value)
            ]

        # Non-string primitives (int, float, bool, None) are safe
        return value


# Singleton instance for shared use
input_sanitizer = InputSanitizer()
