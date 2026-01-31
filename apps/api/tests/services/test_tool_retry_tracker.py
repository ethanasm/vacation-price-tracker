"""Tests for the ToolRetryTracker class.

Coverage targets:
- record_call: Recording tool calls
- is_exceeded: Checking if tool exceeded limit
- get_count: Getting current call count
- get_exceeded_tools: Getting list of exceeded tools
- reset: Resetting counters
"""

from __future__ import annotations

from app.services.chat import MAX_TOOL_RETRIES, ToolRetryTracker


class TestToolRetryTrackerInit:
    """Tests for ToolRetryTracker initialization."""

    def test_default_max_retries(self):
        """Test that default max_retries uses module constant."""
        tracker = ToolRetryTracker()
        assert tracker._max_retries == MAX_TOOL_RETRIES

    def test_custom_max_retries(self):
        """Test custom max_retries parameter."""
        tracker = ToolRetryTracker(max_retries=5)
        assert tracker._max_retries == 5

    def test_initial_counts_empty(self):
        """Test that initial counts are empty."""
        tracker = ToolRetryTracker()
        assert len(tracker._counts) == 0


class TestRecordCall:
    """Tests for ToolRetryTracker.record_call method."""

    def test_record_single_call(self):
        """Test recording a single tool call."""
        tracker = ToolRetryTracker()
        tracker.record_call("list_trips")
        assert tracker.get_count("list_trips") == 1

    def test_record_multiple_calls_same_tool(self):
        """Test recording multiple calls to the same tool."""
        tracker = ToolRetryTracker()
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        assert tracker.get_count("list_trips") == 3

    def test_record_calls_different_tools(self):
        """Test recording calls to different tools."""
        tracker = ToolRetryTracker()
        tracker.record_call("list_trips")
        tracker.record_call("get_trip_details")
        tracker.record_call("list_trips")
        assert tracker.get_count("list_trips") == 2
        assert tracker.get_count("get_trip_details") == 1


class TestIsExceeded:
    """Tests for ToolRetryTracker.is_exceeded method."""

    def test_not_exceeded_initially(self):
        """Test that tool is not exceeded initially."""
        tracker = ToolRetryTracker(max_retries=3)
        assert tracker.is_exceeded("list_trips") is False

    def test_not_exceeded_below_limit(self):
        """Test that tool is not exceeded below limit."""
        tracker = ToolRetryTracker(max_retries=3)
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        assert tracker.is_exceeded("list_trips") is False

    def test_exceeded_at_limit(self):
        """Test that tool is exceeded at limit."""
        tracker = ToolRetryTracker(max_retries=3)
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        assert tracker.is_exceeded("list_trips") is True

    def test_exceeded_above_limit(self):
        """Test that tool remains exceeded above limit."""
        tracker = ToolRetryTracker(max_retries=3)
        for _ in range(5):
            tracker.record_call("list_trips")
        assert tracker.is_exceeded("list_trips") is True

    def test_one_tool_exceeded_others_not(self):
        """Test that exceeding one tool doesn't affect others."""
        tracker = ToolRetryTracker(max_retries=2)
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        tracker.record_call("get_trip_details")
        assert tracker.is_exceeded("list_trips") is True
        assert tracker.is_exceeded("get_trip_details") is False


class TestGetCount:
    """Tests for ToolRetryTracker.get_count method."""

    def test_get_count_unknown_tool(self):
        """Test getting count for unknown tool returns 0."""
        tracker = ToolRetryTracker()
        assert tracker.get_count("unknown_tool") == 0

    def test_get_count_tracked_tool(self):
        """Test getting count for tracked tool."""
        tracker = ToolRetryTracker()
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        assert tracker.get_count("list_trips") == 2


class TestGetExceededTools:
    """Tests for ToolRetryTracker.get_exceeded_tools method."""

    def test_no_exceeded_tools_initially(self):
        """Test that no tools are exceeded initially."""
        tracker = ToolRetryTracker()
        assert tracker.get_exceeded_tools() == []

    def test_no_exceeded_tools_below_limit(self):
        """Test that no tools are exceeded below limit."""
        tracker = ToolRetryTracker(max_retries=3)
        tracker.record_call("list_trips")
        tracker.record_call("get_trip_details")
        assert tracker.get_exceeded_tools() == []

    def test_single_exceeded_tool(self):
        """Test single exceeded tool is returned."""
        tracker = ToolRetryTracker(max_retries=2)
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        assert tracker.get_exceeded_tools() == ["list_trips"]

    def test_multiple_exceeded_tools(self):
        """Test multiple exceeded tools are returned."""
        tracker = ToolRetryTracker(max_retries=2)
        tracker.record_call("list_trips")
        tracker.record_call("list_trips")
        tracker.record_call("get_trip_details")
        tracker.record_call("get_trip_details")
        exceeded = tracker.get_exceeded_tools()
        assert len(exceeded) == 2
        assert "list_trips" in exceeded
        assert "get_trip_details" in exceeded


class TestReset:
    """Tests for ToolRetryTracker.reset method."""

    def test_reset_clears_counts(self):
        """Test that reset clears all counts."""
        tracker = ToolRetryTracker()
        tracker.record_call("list_trips")
        tracker.record_call("get_trip_details")
        tracker.reset()
        assert tracker.get_count("list_trips") == 0
        assert tracker.get_count("get_trip_details") == 0

    def test_reset_clears_exceeded_tools(self):
        """Test that reset clears exceeded tools."""
        tracker = ToolRetryTracker(max_retries=1)
        tracker.record_call("list_trips")
        assert tracker.is_exceeded("list_trips") is True
        tracker.reset()
        assert tracker.is_exceeded("list_trips") is False
        assert tracker.get_exceeded_tools() == []


class TestIntegration:
    """Integration tests for ToolRetryTracker."""

    def test_typical_usage_pattern(self):
        """Test typical usage pattern with multiple tools."""
        tracker = ToolRetryTracker(max_retries=3)

        # First round - call list_trips
        tracker.record_call("list_trips")
        assert tracker.is_exceeded("list_trips") is False

        # Second round - call list_trips again and get_trip_details
        tracker.record_call("list_trips")
        tracker.record_call("get_trip_details")
        assert tracker.is_exceeded("list_trips") is False
        assert tracker.is_exceeded("get_trip_details") is False

        # Third round - list_trips hits limit
        tracker.record_call("list_trips")
        assert tracker.is_exceeded("list_trips") is True
        assert tracker.is_exceeded("get_trip_details") is False

        # Verify exceeded tools
        assert tracker.get_exceeded_tools() == ["list_trips"]

    def test_max_retries_of_one(self):
        """Test with max_retries of 1 (tool blocked after first call)."""
        tracker = ToolRetryTracker(max_retries=1)
        tracker.record_call("list_trips")
        assert tracker.is_exceeded("list_trips") is True

    def test_max_retries_of_zero(self):
        """Test with max_retries of 0 (tool always blocked)."""
        tracker = ToolRetryTracker(max_retries=0)
        # Tool is exceeded even before first call
        assert tracker.is_exceeded("list_trips") is True
