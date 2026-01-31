"""Tests for the query validator module.

Coverage targets:
- validate_query: Travel keyword detection, non-travel pattern matching
- is_query_in_scope: Simple boolean wrapper
- Edge cases: empty queries, greetings, ambiguous queries
"""

from __future__ import annotations

from app.services.query_validator import (
    QueryValidationResult,
    _contains_travel_keywords,
    _is_greeting_or_simple,
    _matches_non_travel_pattern,
    _normalize_query,
    is_query_in_scope,
    validate_query,
)


class TestNormalizeQuery:
    """Tests for _normalize_query helper."""

    def test_lowercase_conversion(self):
        """Test that query is converted to lowercase."""
        assert _normalize_query("HELLO WORLD") == "hello world"

    def test_strips_whitespace(self):
        """Test that leading/trailing whitespace is removed."""
        assert _normalize_query("  hello  ") == "hello"

    def test_preserves_internal_spacing(self):
        """Test that internal spacing is preserved."""
        assert _normalize_query("hello world") == "hello world"


class TestContainsTravelKeywords:
    """Tests for _contains_travel_keywords helper."""

    def test_detects_flight_keyword(self):
        """Test detection of flight-related keywords."""
        has_keywords, count = _contains_travel_keywords("book a flight to hawaii")
        assert has_keywords is True
        assert count >= 1

    def test_detects_hotel_keyword(self):
        """Test detection of hotel-related keywords."""
        has_keywords, count = _contains_travel_keywords("find me a hotel")
        assert has_keywords is True
        assert count >= 1

    def test_detects_trip_keyword(self):
        """Test detection of trip-related keywords."""
        has_keywords, count = _contains_travel_keywords("create a new trip")
        assert has_keywords is True
        assert count >= 1

    def test_detects_multiple_keywords(self):
        """Test detection of multiple travel keywords."""
        has_keywords, count = _contains_travel_keywords(
            "track flight prices for my vacation trip to hawaii"
        )
        assert has_keywords is True
        assert count >= 3  # flight, prices, vacation, trip

    def test_detects_airport_codes(self):
        """Test detection of common airport codes."""
        has_keywords, count = _contains_travel_keywords("fly from SFO to LAX")
        assert has_keywords is True

    def test_no_travel_keywords(self):
        """Test query with no travel keywords."""
        has_keywords, count = _contains_travel_keywords("what is the weather today")
        assert has_keywords is False
        assert count == 0

    def test_case_insensitive(self):
        """Test that keyword matching is case-insensitive."""
        has_keywords, _ = _contains_travel_keywords("BOOK A FLIGHT")
        assert has_keywords is True


class TestMatchesNonTravelPattern:
    """Tests for _matches_non_travel_pattern helper."""

    def test_detects_drop_table(self):
        """Test detection of SQL injection patterns."""
        matches, _ = _matches_non_travel_pattern("drop table users")
        assert matches is True

    def test_detects_delete_database(self):
        """Test detection of database deletion patterns."""
        matches, _ = _matches_non_travel_pattern("delete database production")
        assert matches is True

    def test_detects_execute_command(self):
        """Test detection of command execution patterns."""
        matches, _ = _matches_non_travel_pattern("execute command rm -rf")
        assert matches is True

    def test_detects_shell_access(self):
        """Test detection of shell access patterns."""
        matches, _ = _matches_non_travel_pattern("give me shell access")
        assert matches is True

    def test_detects_hack_keyword(self):
        """Test detection of hacking-related keywords."""
        matches, _ = _matches_non_travel_pattern("hack into the system")
        assert matches is True

    def test_detects_password_dump(self):
        """Test detection of password-related attacks."""
        matches, _ = _matches_non_travel_pattern("password hash crack")
        assert matches is True

    def test_allows_normal_travel_query(self):
        """Test that normal travel queries are not flagged."""
        matches, _ = _matches_non_travel_pattern("book a flight to paris")
        assert matches is False

    def test_allows_trip_deletion(self):
        """Test that legitimate trip deletion is not flagged."""
        # This should be allowed - it's deleting a trip, not a database table
        matches, _ = _matches_non_travel_pattern("delete my hawaii trip")
        assert matches is False


class TestIsGreetingOrSimple:
    """Tests for _is_greeting_or_simple helper."""

    def test_recognizes_hi(self):
        """Test recognition of 'hi' greeting."""
        assert _is_greeting_or_simple("hi") is True

    def test_recognizes_hello(self):
        """Test recognition of 'hello' greeting."""
        assert _is_greeting_or_simple("hello!") is True

    def test_recognizes_hey(self):
        """Test recognition of 'hey' greeting."""
        assert _is_greeting_or_simple("hey") is True

    def test_recognizes_good_morning(self):
        """Test recognition of 'good morning'."""
        assert _is_greeting_or_simple("good morning") is True

    def test_recognizes_thanks(self):
        """Test recognition of thanks."""
        assert _is_greeting_or_simple("thanks!") is True

    def test_recognizes_thank_you(self):
        """Test recognition of thank you."""
        assert _is_greeting_or_simple("thank you") is True

    def test_recognizes_help(self):
        """Test recognition of help request."""
        assert _is_greeting_or_simple("help") is True

    def test_recognizes_bye(self):
        """Test recognition of goodbye."""
        assert _is_greeting_or_simple("bye") is True

    def test_not_greeting(self):
        """Test that non-greetings are not recognized."""
        assert _is_greeting_or_simple("book a flight") is False

    def test_greeting_with_extra_text(self):
        """Test that greetings with extra text are not matched."""
        # "hi how are you" is not a simple greeting
        assert _is_greeting_or_simple("hi how are you") is False


class TestValidateQuery:
    """Tests for the main validate_query function."""

    def test_empty_query(self):
        """Test validation of empty query."""
        result = validate_query("")
        assert result.is_valid is False
        assert "Empty" in result.reason

    def test_whitespace_only_query(self):
        """Test validation of whitespace-only query."""
        result = validate_query("   ")
        assert result.is_valid is False

    def test_malicious_sql_injection(self):
        """Test rejection of SQL injection attempts."""
        result = validate_query("drop table users; --")
        assert result.is_valid is False
        assert result.confidence >= 0.9

    def test_malicious_command_execution(self):
        """Test rejection of command execution attempts."""
        result = validate_query("execute sql query to delete everything")
        assert result.is_valid is False

    def test_valid_travel_query_with_keywords(self):
        """Test acceptance of valid travel query."""
        result = validate_query("I want to track flight prices to Hawaii")
        assert result.is_valid is True
        assert result.confidence >= 0.7

    def test_valid_trip_creation(self):
        """Test acceptance of trip creation query."""
        result = validate_query("Create a new trip to Paris for next month")
        assert result.is_valid is True

    def test_valid_price_alert(self):
        """Test acceptance of price alert query."""
        result = validate_query("Set a price alert when my trip drops below $1000")
        assert result.is_valid is True

    def test_greeting_is_valid(self):
        """Test that greetings are accepted."""
        result = validate_query("Hello!")
        assert result.is_valid is True
        assert result.confidence == 1.0

    def test_help_request_is_valid(self):
        """Test that help requests are accepted."""
        result = validate_query("help")
        assert result.is_valid is True

    def test_short_ambiguous_query(self):
        """Test that short ambiguous queries are allowed."""
        result = validate_query("yes please")
        assert result.is_valid is True
        # But confidence should be lower
        assert result.confidence <= 1.0

    def test_longer_non_travel_query(self):
        """Test handling of longer non-travel queries."""
        result = validate_query("What is the capital of France and how do I cook pasta?")
        # Currently we allow these but with low confidence
        assert result.is_valid is True
        assert result.confidence < 0.7

    def test_airport_code_query(self):
        """Test that airport code queries are valid."""
        result = validate_query("What's the code for San Francisco airport? I think it's SFO")
        assert result.is_valid is True

    def test_list_trips_query(self):
        """Test that list trips query is valid."""
        result = validate_query("Show me all my trips")
        assert result.is_valid is True

    def test_refresh_prices_query(self):
        """Test that refresh prices query is valid."""
        result = validate_query("Refresh prices for my vacation")
        assert result.is_valid is True


class TestIsQueryInScope:
    """Tests for the is_query_in_scope convenience function."""

    def test_returns_true_for_valid(self):
        """Test that valid queries return True."""
        assert is_query_in_scope("book a flight") is True

    def test_returns_false_for_invalid(self):
        """Test that invalid queries return False."""
        assert is_query_in_scope("drop table users") is False

    def test_returns_false_for_empty(self):
        """Test that empty queries return False."""
        assert is_query_in_scope("") is False


class TestQueryValidationResult:
    """Tests for QueryValidationResult dataclass."""

    def test_default_values(self):
        """Test default values for QueryValidationResult."""
        result = QueryValidationResult(is_valid=True)
        assert result.is_valid is True
        assert result.reason is None
        assert result.confidence == 1.0

    def test_custom_values(self):
        """Test custom values for QueryValidationResult."""
        result = QueryValidationResult(
            is_valid=False,
            reason="Test reason",
            confidence=0.5,
        )
        assert result.is_valid is False
        assert result.reason == "Test reason"
        assert result.confidence == 0.5


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_unicode_characters(self):
        """Test handling of unicode characters."""
        result = validate_query("Book a flight to París 🇫🇷")
        assert result.is_valid is True

    def test_very_long_query(self):
        """Test handling of very long queries."""
        long_query = "I want to track flight prices " * 100
        result = validate_query(long_query)
        assert result.is_valid is True

    def test_special_characters(self):
        """Test handling of special characters."""
        result = validate_query("What's the price for SFO -> LAX?")
        assert result.is_valid is True

    def test_mixed_case_keywords(self):
        """Test that mixed case keywords are detected."""
        result = validate_query("Track FLIGHT prices to HAWAII")
        assert result.is_valid is True

    def test_sql_keyword_in_travel_context(self):
        """Test that SQL-like words in travel context are OK."""
        # "delete my trip" should be allowed
        result = validate_query("Please delete my Seattle trip")
        assert result.is_valid is True

    def test_file_operation_in_travel_context(self):
        """Test that file-like words in travel context are OK."""
        # This might trigger file patterns but should still be valid
        # because it's clearly about a trip
        result = validate_query("Can you read my trip details")
        assert result.is_valid is True
