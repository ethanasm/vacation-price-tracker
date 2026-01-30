"""Tests for input sanitization service."""

from __future__ import annotations

from app.services.input_sanitizer import (
    InputSanitizer,
    SanitizationResult,
    input_sanitizer,
)

# =============================================================================
# Tests for SanitizationResult
# =============================================================================


def test_sanitization_result_no_modifications():
    """SanitizationResult should indicate no modifications."""
    result = SanitizationResult(
        sanitized_data={"name": "Hawaii"},
        was_modified=False,
        sanitized_fields=[],
        detected_patterns=[],
    )

    assert result.was_modified is False
    assert result.sanitized_fields == []
    assert result.detected_patterns == []


def test_sanitization_result_with_modifications():
    """SanitizationResult should track modifications."""
    result = SanitizationResult(
        sanitized_data={"name": "Hawaii"},
        was_modified=True,
        sanitized_fields=["name"],
        detected_patterns=["sql_keyword"],
    )

    assert result.was_modified is True
    assert "name" in result.sanitized_fields
    assert "sql_keyword" in result.detected_patterns


# =============================================================================
# Tests for SQL injection detection
# =============================================================================


def test_detect_select_statement():
    """SELECT statements should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("SELECT * FROM users")

    assert is_safe is False
    assert "sql_keyword" in patterns


def test_detect_drop_statement():
    """DROP statements should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("DROP TABLE users")

    assert is_safe is False
    assert "sql_keyword" in patterns


def test_detect_union_injection():
    """UNION SELECT injection should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("' UNION SELECT * FROM users--")

    assert is_safe is False
    assert any("sql" in p for p in patterns)


def test_detect_or_true_condition():
    """OR 1=1 conditions should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("' OR '1'='1")

    assert is_safe is False
    assert "sql_or_true" in patterns


def test_detect_and_true_condition():
    """AND 1=1 conditions should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("' AND 1=1--")

    assert is_safe is False
    assert "sql_and_true" in patterns


def test_detect_sql_comments():
    """SQL comments should be detected."""
    sanitizer = InputSanitizer()

    is_safe1, patterns1 = sanitizer.check_string("test -- comment")
    is_safe2, patterns2 = sanitizer.check_string("test /* block */")

    assert is_safe1 is False
    assert is_safe2 is False
    assert "sql_comment" in patterns1
    assert "sql_comment" in patterns2


def test_detect_hex_encoding():
    """Hex-encoded bypass attempts should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("0x53454C454354")

    assert is_safe is False
    assert "sql_hex" in patterns


def test_detect_statement_chaining():
    """Semicolon-based statement chaining should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("test; DROP TABLE users")

    assert is_safe is False
    assert "sql_chain" in patterns


# =============================================================================
# Tests for NoSQL injection detection
# =============================================================================


def test_detect_nosql_where():
    """MongoDB $where operator should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string('{"$where": "this.x == 1"}')

    assert is_safe is False
    assert "nosql_where" in patterns


def test_detect_nosql_operators():
    """MongoDB comparison operators should be detected."""
    sanitizer = InputSanitizer()

    operators = ["$gt", "$gte", "$lt", "$lte", "$ne", "$eq", "$in", "$nin", "$regex", "$exists"]

    for op in operators:
        is_safe, patterns = sanitizer.check_string(f'{{"{op}": 1}}')
        assert is_safe is False, f"Should detect {op}"
        assert "nosql_operator" in patterns, f"Should identify {op} as nosql_operator"


def test_detect_nosql_logic_operators():
    """MongoDB logic operators should be detected."""
    sanitizer = InputSanitizer()

    operators = ["$or", "$and", "$not", "$nor"]

    for op in operators:
        is_safe, patterns = sanitizer.check_string(f'{{"{op}": []}}')
        assert is_safe is False, f"Should detect {op}"
        assert "nosql_logic" in patterns


def test_detect_nosql_function():
    """JavaScript function injection should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("function() { return true; }")

    assert is_safe is False
    assert "nosql_function" in patterns


def test_detect_nosql_eval():
    """eval() injection should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("eval('malicious code')")

    assert is_safe is False
    assert "nosql_eval" in patterns


# =============================================================================
# Tests for command injection detection
# =============================================================================


def test_detect_pipe_metachar():
    """Pipe character should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("cat file | grep pattern")

    assert is_safe is False
    assert "cmd_metachar" in patterns


def test_detect_semicolon_metachar():
    """Semicolon should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("echo hello; rm -rf /")

    assert is_safe is False
    assert "cmd_metachar" in patterns


def test_detect_command_substitution():
    """Command substitution should be detected."""
    sanitizer = InputSanitizer()

    is_safe1, patterns1 = sanitizer.check_string("$(whoami)")
    is_safe2, patterns2 = sanitizer.check_string("`id`")

    assert is_safe1 is False
    assert is_safe2 is False
    assert "cmd_subst" in patterns1
    assert "cmd_backtick" in patterns2


def test_detect_dangerous_commands():
    """Dangerous commands should be detected."""
    sanitizer = InputSanitizer()

    commands = ["rm", "chmod", "chown", "sudo", "su", "wget", "curl", "nc", "netcat"]

    for cmd in commands:
        is_safe, patterns = sanitizer.check_string(f"{cmd} something")
        assert is_safe is False, f"Should detect {cmd}"
        assert "cmd_dangerous" in patterns


def test_detect_redirection():
    """Redirection operators should be detected."""
    sanitizer = InputSanitizer()

    is_safe1, patterns1 = sanitizer.check_string("echo > /etc/passwd")
    is_safe2, patterns2 = sanitizer.check_string("cat < /etc/shadow")

    assert is_safe1 is False
    assert is_safe2 is False
    assert "cmd_redirect" in patterns1
    assert "cmd_redirect" in patterns2


# =============================================================================
# Tests for path traversal detection
# =============================================================================


def test_detect_path_traversal():
    """Path traversal should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("../../../etc/passwd")

    assert is_safe is False
    assert "path_traversal" in patterns


def test_detect_etc_path():
    """Absolute /etc/ paths should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("/etc/shadow")

    assert is_safe is False
    assert "path_etc" in patterns


def test_detect_proc_path():
    """Absolute /proc/ paths should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("/proc/self/environ")

    assert is_safe is False
    assert "path_proc" in patterns


def test_detect_windows_path():
    """Windows system paths should be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("C:\\Windows\\System32")

    assert is_safe is False
    assert "path_windows" in patterns


# =============================================================================
# Tests for safe inputs
# =============================================================================


def test_safe_trip_name():
    """Normal trip names should be safe."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("Hawaii Spring 2026")

    assert is_safe is True
    assert patterns == []


def test_safe_airport_code():
    """Airport codes should be safe."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("SFO")

    assert is_safe is True
    assert patterns == []


def test_safe_date():
    """Dates should be safe."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("2026-03-15")

    assert is_safe is True
    assert patterns == []


def test_safe_number_string():
    """Number strings should be safe."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("1500")

    assert is_safe is True
    assert patterns == []


# =============================================================================
# Tests for sanitize_string
# =============================================================================


def test_sanitize_string_removes_patterns():
    """Dangerous patterns should be removed."""
    sanitizer = InputSanitizer()

    sanitized, patterns = sanitizer.sanitize_string("Hawaii; DROP TABLE users")

    assert "DROP" not in sanitized
    assert ";" not in sanitized
    assert "Hawaii" in sanitized
    assert len(patterns) > 0


def test_sanitize_string_clean_input():
    """Clean inputs should be unchanged."""
    sanitizer = InputSanitizer()

    sanitized, patterns = sanitizer.sanitize_string("Hawaii 2026")

    assert sanitized == "Hawaii 2026"
    assert patterns == []


def test_sanitize_string_strips_whitespace():
    """Sanitized strings should be stripped."""
    sanitizer = InputSanitizer()

    sanitized, patterns = sanitizer.sanitize_string("  Hawaii;  ")

    assert sanitized == "Hawaii"


# =============================================================================
# Tests for sanitize (dict)
# =============================================================================


def test_sanitize_dict_clean():
    """Clean dictionaries should be unchanged."""
    sanitizer = InputSanitizer()

    data = {
        "name": "Hawaii 2026",
        "origin": "SFO",
        "destination": "HNL",
    }

    result = sanitizer.sanitize(data)

    assert result.was_modified is False
    assert result.sanitized_data == data
    assert result.sanitized_fields == []


def test_sanitize_dict_with_injection():
    """Dictionaries with injection should be sanitized."""
    sanitizer = InputSanitizer()

    data = {
        "name": "Hawaii; DROP TABLE trips",
        "origin": "SFO",
    }

    result = sanitizer.sanitize(data)

    assert result.was_modified is True
    assert "name" in result.sanitized_fields
    assert "DROP" not in result.sanitized_data["name"]
    assert result.sanitized_data["origin"] == "SFO"


def test_sanitize_dict_nested():
    """Nested dictionaries should be recursively sanitized."""
    sanitizer = InputSanitizer()

    data = {
        "trip": {
            "name": "Hawaii; DROP TABLE",
            "prefs": {
                "airline": "UA",
            },
        }
    }

    result = sanitizer.sanitize(data)

    assert result.was_modified is True
    assert "trip.name" in result.sanitized_fields
    assert "DROP" not in result.sanitized_data["trip"]["name"]
    assert result.sanitized_data["trip"]["prefs"]["airline"] == "UA"


def test_sanitize_dict_with_list():
    """Lists in dictionaries should be sanitized."""
    sanitizer = InputSanitizer()

    data = {"airlines": ["UA", "AA; DROP TABLE"]}

    result = sanitizer.sanitize(data)

    assert result.was_modified is True
    assert "airlines[1]" in result.sanitized_fields


def test_sanitize_dict_preserves_numbers():
    """Numbers and booleans should be preserved."""
    sanitizer = InputSanitizer()

    data = {
        "adults": 2,
        "is_round_trip": True,
        "price": 1500.50,
        "optional": None,
    }

    result = sanitizer.sanitize(data)

    assert result.was_modified is False
    assert result.sanitized_data["adults"] == 2
    assert result.sanitized_data["is_round_trip"] is True
    assert result.sanitized_data["price"] == 1500.50
    assert result.sanitized_data["optional"] is None


# =============================================================================
# Tests for selective checks
# =============================================================================


def test_sanitizer_without_sql_check():
    """SQL check can be disabled."""
    sanitizer = InputSanitizer(check_sql=False)

    is_safe, patterns = sanitizer.check_string("SELECT * FROM users")

    # Without SQL checks, this should not be detected
    assert "sql_keyword" not in patterns


def test_sanitizer_without_nosql_check():
    """NoSQL check can be disabled."""
    sanitizer = InputSanitizer(check_nosql=False)

    is_safe, patterns = sanitizer.check_string('{"$where": "1==1"}')

    assert "nosql_where" not in patterns


def test_sanitizer_without_command_check():
    """Command check can be disabled."""
    sanitizer = InputSanitizer(check_command=False)

    is_safe, patterns = sanitizer.check_string("rm -rf /")

    assert "cmd_dangerous" not in patterns


def test_sanitizer_without_path_check():
    """Path check can be disabled."""
    sanitizer = InputSanitizer(check_path=False)

    is_safe, patterns = sanitizer.check_string("../../../etc/passwd")

    assert "path_traversal" not in patterns


# =============================================================================
# Tests for detected_patterns
# =============================================================================


def test_multiple_patterns_detected():
    """Multiple patterns should all be detected."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("SELECT * FROM users; rm -rf /")

    assert is_safe is False
    assert "sql_keyword" in patterns
    assert "cmd_metachar" in patterns
    assert "cmd_dangerous" in patterns


# =============================================================================
# Tests for singleton instance
# =============================================================================


def test_singleton_instance_exists():
    """Singleton instance should be available."""
    assert input_sanitizer is not None
    assert isinstance(input_sanitizer, InputSanitizer)


def test_singleton_can_sanitize():
    """Singleton instance should be functional."""
    result = input_sanitizer.sanitize({"name": "Hawaii"})

    assert result.was_modified is False
    assert result.sanitized_data["name"] == "Hawaii"


# =============================================================================
# Edge cases
# =============================================================================


def test_empty_string():
    """Empty strings should be safe."""
    sanitizer = InputSanitizer()

    is_safe, patterns = sanitizer.check_string("")

    assert is_safe is True
    assert patterns == []


def test_empty_dict():
    """Empty dictionaries should be unchanged."""
    sanitizer = InputSanitizer()

    result = sanitizer.sanitize({})

    assert result.was_modified is False
    assert result.sanitized_data == {}


def test_case_insensitivity():
    """Patterns should be case-insensitive."""
    sanitizer = InputSanitizer()

    is_safe1, _ = sanitizer.check_string("SELECT")
    is_safe2, _ = sanitizer.check_string("select")
    is_safe3, _ = sanitizer.check_string("SeLeCt")

    assert is_safe1 is False
    assert is_safe2 is False
    assert is_safe3 is False
