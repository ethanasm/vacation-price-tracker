"""Tests for create_trip tool elicitation detection.

Tests the MCP-based elicitation feature where the create_trip tool
detects missing required fields and returns an elicitation request
instead of failing. This enables conversational trip creation.
"""

from datetime import date, timedelta

import pytest
from app.tools import CreateTripTool

from tests.tools.test_trip_tools import create_test_user

# =============================================================================
# Elicitation Constants Tests
# =============================================================================


def test_create_trip_required_fields_constant():
    """Test that CreateTripTool has required fields constant."""
    assert hasattr(CreateTripTool, "REQUIRED_FIELDS")
    required = CreateTripTool.REQUIRED_FIELDS
    assert "name" in required
    assert "origin_airport" in required
    assert "destination_code" in required
    assert "depart_date" in required
    assert "return_date" in required


def test_create_trip_elicitation_component_constant():
    """Test that CreateTripTool has elicitation component constant."""
    assert hasattr(CreateTripTool, "ELICITATION_COMPONENT")
    assert CreateTripTool.ELICITATION_COMPONENT == "create-trip-form"


# =============================================================================
# Elicitation Detection Tests
# =============================================================================


@pytest.mark.asyncio
async def test_elicitation_missing_all_required_fields(test_session):
    """Test elicitation when all required fields are missing."""
    user = await create_test_user(test_session, "elicit-all@example.com")
    tool = CreateTripTool()

    result = await tool.execute({}, str(user.id), test_session)

    assert result.success is True
    assert result.data is not None
    assert result.data.get("needs_elicitation") is True
    assert result.data.get("component") == "create-trip-form"
    assert result.data.get("prefilled") == {}
    assert set(result.data.get("missing_fields", [])) == {
        "name",
        "origin_airport",
        "destination_code",
        "depart_date",
        "return_date",
    }


@pytest.mark.asyncio
async def test_elicitation_missing_name(test_session):
    """Test elicitation when only name is missing."""
    user = await create_test_user(test_session, "elicit-name@example.com")
    tool = CreateTripTool()

    args = {
        "origin_airport": "SFO",
        "destination_code": "SEA",
        "depart_date": (date.today() + timedelta(days=30)).isoformat(),
        "return_date": (date.today() + timedelta(days=37)).isoformat(),
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True
    assert result.data.get("missing_fields") == ["name"]
    # Prefilled should contain provided values
    prefilled = result.data.get("prefilled", {})
    assert prefilled.get("origin_airport") == "SFO"
    assert prefilled.get("destination_code") == "SEA"


@pytest.mark.asyncio
async def test_elicitation_missing_dates(test_session):
    """Test elicitation when dates are missing."""
    user = await create_test_user(test_session, "elicit-dates@example.com")
    tool = CreateTripTool()

    args = {
        "name": "Seattle Trip",
        "origin_airport": "SFO",
        "destination_code": "SEA",
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True
    assert "depart_date" in result.data.get("missing_fields", [])
    assert "return_date" in result.data.get("missing_fields", [])


@pytest.mark.asyncio
async def test_elicitation_with_destination_only(test_session):
    """Test elicitation when only destination is provided (typical chat scenario)."""
    user = await create_test_user(test_session, "elicit-dest@example.com")
    tool = CreateTripTool()

    # User says "create a trip to Seattle"
    args = {"destination_code": "SEA"}
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True
    assert result.data.get("component") == "create-trip-form"

    prefilled = result.data.get("prefilled", {})
    assert prefilled.get("destination_code") == "SEA"

    missing = result.data.get("missing_fields", [])
    assert "name" in missing
    assert "origin_airport" in missing
    assert "depart_date" in missing
    assert "return_date" in missing
    assert "destination_code" not in missing


@pytest.mark.asyncio
async def test_elicitation_preserves_optional_prefs(test_session):
    """Test that elicitation preserves optional preferences in prefilled data."""
    user = await create_test_user(test_session, "elicit-prefs@example.com")
    tool = CreateTripTool()

    args = {
        "destination_code": "HNL",
        "adults": 2,
        "airlines": ["UA", "AA"],
        "cabin": "business",
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True

    prefilled = result.data.get("prefilled", {})
    assert prefilled.get("destination_code") == "HNL"
    assert prefilled.get("adults") == 2
    assert prefilled.get("airlines") == ["UA", "AA"]
    assert prefilled.get("cabin") == "business"


@pytest.mark.asyncio
async def test_no_elicitation_when_all_required_present(test_session):
    """Test that no elicitation is returned when all required fields are present."""
    user = await create_test_user(test_session, "no-elicit@example.com")
    tool = CreateTripTool()

    args = {
        "name": "Complete Trip",
        "origin_airport": "SFO",
        "destination_code": "SEA",
        "depart_date": (date.today() + timedelta(days=30)).isoformat(),
        "return_date": (date.today() + timedelta(days=37)).isoformat(),
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is not True
    assert "trip_id" in result.data  # Actually created the trip


@pytest.mark.asyncio
async def test_elicitation_empty_string_treated_as_missing(test_session):
    """Test that empty string values are treated as missing."""
    user = await create_test_user(test_session, "elicit-empty@example.com")
    tool = CreateTripTool()

    args = {
        "name": "",  # Empty string
        "origin_airport": "SFO",
        "destination_code": "SEA",
        "depart_date": (date.today() + timedelta(days=30)).isoformat(),
        "return_date": (date.today() + timedelta(days=37)).isoformat(),
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True
    assert "name" in result.data.get("missing_fields", [])


@pytest.mark.asyncio
async def test_elicitation_whitespace_string_treated_as_missing(test_session):
    """Test that whitespace-only values are treated as missing."""
    user = await create_test_user(test_session, "elicit-whitespace@example.com")
    tool = CreateTripTool()

    args = {
        "name": "   ",  # Whitespace only
        "origin_airport": "SFO",
        "destination_code": "SEA",
        "depart_date": (date.today() + timedelta(days=30)).isoformat(),
        "return_date": (date.today() + timedelta(days=37)).isoformat(),
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True
    assert "name" in result.data.get("missing_fields", [])


@pytest.mark.asyncio
async def test_elicitation_none_value_treated_as_missing(test_session):
    """Test that None values are treated as missing."""
    user = await create_test_user(test_session, "elicit-none@example.com")
    tool = CreateTripTool()

    args = {
        "name": None,
        "origin_airport": "SFO",
        "destination_code": "SEA",
        "depart_date": (date.today() + timedelta(days=30)).isoformat(),
        "return_date": (date.today() + timedelta(days=37)).isoformat(),
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True
    assert "name" in result.data.get("missing_fields", [])


@pytest.mark.asyncio
async def test_elicitation_excludes_none_from_prefilled(test_session):
    """Test that None values are not included in prefilled data."""
    user = await create_test_user(test_session, "elicit-prefill@example.com")
    tool = CreateTripTool()

    args = {
        "destination_code": "SEA",
        "adults": None,  # Explicitly None
        "airlines": None,
    }
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True

    prefilled = result.data.get("prefilled", {})
    assert prefilled.get("destination_code") == "SEA"
    assert "adults" not in prefilled
    assert "airlines" not in prefilled


# =============================================================================
# Edge Cases
# =============================================================================


@pytest.mark.asyncio
async def test_elicitation_does_not_check_database(test_session, monkeypatch):
    """Test that elicitation check happens before database validation."""
    user = await create_test_user(test_session, "elicit-early@example.com")
    tool = CreateTripTool()

    # Mock database validation to fail if called
    async def fail_validation(*args, **kwargs):
        raise AssertionError("Database validation should not be called during elicitation")

    monkeypatch.setattr(tool, "_validate_trip_creation", fail_validation)

    # Should return elicitation without calling _validate_trip_creation
    args = {"destination_code": "SEA"}
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    assert result.data.get("needs_elicitation") is True


@pytest.mark.asyncio
async def test_elicitation_check_method_returns_none_when_complete(test_session):
    """Test _check_elicitation_needed returns None when all fields present."""
    tool = CreateTripTool()

    args = {
        "name": "Test",
        "origin_airport": "SFO",
        "destination_code": "SEA",
        "depart_date": "2026-03-01",
        "return_date": "2026-03-08",
    }
    result = tool._check_elicitation_needed(args)

    assert result is None


def test_elicitation_check_method_returns_result_when_incomplete():
    """Test _check_elicitation_needed returns ToolResult when fields missing."""
    tool = CreateTripTool()

    args = {"destination_code": "SEA"}
    result = tool._check_elicitation_needed(args)

    assert result is not None
    assert result.success is True
    assert result.data.get("needs_elicitation") is True


# =============================================================================
# Integration with Chat Service
# =============================================================================


@pytest.mark.asyncio
async def test_elicitation_result_format_for_chat_service(test_session):
    """Test that elicitation result format is compatible with chat service expectations."""
    user = await create_test_user(test_session, "elicit-format@example.com")
    tool = CreateTripTool()

    args = {"destination_code": "SEA", "name": "Seattle Trip"}
    result = await tool.execute(args, str(user.id), test_session)

    assert result.success is True
    data = result.data

    # Required fields for chat service elicitation handling
    assert "needs_elicitation" in data
    assert data["needs_elicitation"] is True
    assert "component" in data
    assert isinstance(data["component"], str)
    assert "prefilled" in data
    assert isinstance(data["prefilled"], dict)
    assert "missing_fields" in data
    assert isinstance(data["missing_fields"], list)
