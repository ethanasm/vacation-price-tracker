"""Tests for SearchHotelsSkiplaggedTool.

Tests follow the same pattern as test_search_flights_skiplagged.py.
Target: 95%+ code coverage.
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.clients.skiplagged import SkiplaggedConnectionError, SkiplaggedMCPError
from app.schemas.hotel_search import HotelSearchHotel, HotelSearchResult
from app.tools.search_hotels_skiplagged import SearchHotelsSkiplaggedTool

# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_skiplagged_client():
    """Create a mock SkiplaggedClient."""
    return MagicMock()


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    return AsyncMock()


def _make_hotel(
    hotel_id: str = "hotel_1001",
    name: str = "Test Hotel",
    star_rating: int = 4,
    review_rating: float = 8.5,
    price_per_night: str = "150.00",
    amenities: list[str] | None = None,
    booking_link: str = "https://skiplagged.com/hotel/1001",
) -> HotelSearchHotel:
    return HotelSearchHotel(
        id=hotel_id,
        name=name,
        image_url=None,
        star_rating=star_rating,
        review_rating=review_rating,
        review_count=200,
        price_per_night=Decimal(price_per_night),
        price_total=None,
        price_currency="USD",
        chain="Test Chain",
        address="1 Test Street, Paris",
        amenities=amenities or ["Free WiFi", "Pool"],
        booking_link=booking_link,
        rooms=[],
        provider="skiplagged",
        raw_data=None,
    )


def _make_hotel_result(hotels=None, success=True, error=None) -> HotelSearchResult:
    return HotelSearchResult(
        hotels=hotels or [],
        city="Paris",
        checkin="2026-06-15",
        checkout="2026-06-18",
        provider="skiplagged",
        total_results=len(hotels) if hotels else 0,
        currency="USD",
        success=success,
        error=error,
    )


# =============================================================================
# SearchHotelsSkiplaggedTool Tests
# =============================================================================


class TestSearchHotelsSkiplaggedTool:
    """Tests for SearchHotelsSkiplaggedTool."""

    def test_tool_attributes(self):
        """Test tool has correct name and description."""
        tool = SearchHotelsSkiplaggedTool()
        assert tool.name == "search_hotels"
        assert len(tool.description) > 0

    @pytest.mark.asyncio
    async def test_execute_success(self, mock_skiplagged_client, mock_db):
        """Test successful hotel search with formatted output."""
        hotel = _make_hotel(
            name="Hotel Lumière",
            star_rating=4,
            review_rating=9.0,
            price_per_night="200.00",
            amenities=["Free WiFi", "Restaurant", "Spa"],
            booking_link="https://skiplagged.com/hotel/lumiere",
        )
        mock_skiplagged_client.search_hotels = AsyncMock(
            return_value=_make_hotel_result(hotels=[hotel])
        )

        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "city": "Paris",
                "checkin": "2026-06-15",
                "checkout": "2026-06-18",
            },
            user_id="test-user-123",
            db=mock_db,
        )

        assert result.success is True
        assert result.data is not None
        assert result.data["count"] == 1
        assert result.data["provider"] == "skiplagged"
        assert result.data["city"] == "Paris"
        assert result.data["checkin"] == "2026-06-15"
        assert result.data["checkout"] == "2026-06-18"

        h = result.data["hotels"][0]
        assert h["name"] == "Hotel Lumière"
        assert h["star_rating"] == 4
        assert h["review_rating"] == 9.0
        assert h["price_per_night"] == "200.00"
        assert h["booking_link"] == "https://skiplagged.com/hotel/lumiere"
        assert "Free WiFi" in h["amenities"]

    @pytest.mark.asyncio
    async def test_execute_missing_required_params(self, mock_skiplagged_client, mock_db):
        """Test error when required parameters are missing."""
        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)

        # Missing city
        result = await tool.execute(
            args={"checkin": "2026-06-15", "checkout": "2026-06-18"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "city" in result.error

        # Missing checkin
        result = await tool.execute(
            args={"city": "Paris", "checkout": "2026-06-18"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "checkin" in result.error

        # Missing checkout
        result = await tool.execute(
            args={"city": "Paris", "checkin": "2026-06-15"},
            user_id="test-user",
            db=mock_db,
        )
        assert result.success is False
        assert "checkout" in result.error

    @pytest.mark.asyncio
    async def test_execute_client_error(self, mock_skiplagged_client, mock_db):
        """Test handling of SkiplaggedConnectionError."""
        mock_skiplagged_client.search_hotels = AsyncMock(
            side_effect=SkiplaggedConnectionError("Server unavailable")
        )

        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "city": "Paris",
                "checkin": "2026-06-15",
                "checkout": "2026-06-18",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Hotel search failed" in result.error

    @pytest.mark.asyncio
    async def test_execute_empty_results(self, mock_skiplagged_client, mock_db):
        """Test handling of zero results returns success with empty list."""
        mock_skiplagged_client.search_hotels = AsyncMock(
            return_value=_make_hotel_result(hotels=[])
        )

        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "city": "NowhereCity",
                "checkin": "2026-06-15",
                "checkout": "2026-06-18",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is True
        assert result.data["count"] == 0
        assert result.data["hotels"] == []

    @pytest.mark.asyncio
    async def test_execute_with_optional_params(self, mock_skiplagged_client, mock_db):
        """Test optional params are forwarded to the client."""
        mock_skiplagged_client.search_hotels = AsyncMock(
            return_value=_make_hotel_result()
        )

        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)
        await tool.execute(
            args={
                "city": "Paris",
                "checkin": "2026-06-15",
                "checkout": "2026-06-18",
                "adults": 2,
                "rooms": 2,
                "sort": "price",
                "limit": 50,
                "offset": 75,
            },
            user_id="test-user",
            db=mock_db,
        )

        mock_skiplagged_client.search_hotels.assert_called_once_with(
            city="Paris",
            checkin="2026-06-15",
            checkout="2026-06-18",
            adults=2,
            rooms=2,
            sort="price",
            limit=50,
            offset=75,
        )

    @pytest.mark.asyncio
    async def test_execute_client_returns_failure(self, mock_skiplagged_client, mock_db):
        """Test handling when client returns a failed HotelSearchResult."""
        mock_skiplagged_client.search_hotels = AsyncMock(
            return_value=_make_hotel_result(success=False, error="City not found")
        )

        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "city": "Paris",
                "checkin": "2026-06-15",
                "checkout": "2026-06-18",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "City not found" in result.error

    @pytest.mark.asyncio
    async def test_execute_unexpected_error(self, mock_skiplagged_client, mock_db):
        """Test handling of unexpected exceptions."""
        mock_skiplagged_client.search_hotels = AsyncMock(
            side_effect=RuntimeError("Unexpected failure")
        )

        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "city": "Paris",
                "checkin": "2026-06-15",
                "checkout": "2026-06-18",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "unexpected error" in result.error.lower()

    def test_format_includes_hotel_details(self, mock_skiplagged_client):
        """Test _format_results includes stars, review score, amenities."""
        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)

        result = tool._format_results(
            _make_hotel_result(
                hotels=[
                    _make_hotel(
                        name="Grand Palace",
                        star_rating=5,
                        review_rating=9.5,
                        price_per_night="450.00",
                        amenities=["Pool", "Spa", "Free WiFi"],
                    )
                ]
            )
        )

        h = result["hotels"][0]
        assert h["name"] == "Grand Palace"
        assert h["star_rating"] == 5
        assert h["review_rating"] == 9.5
        assert h["price_per_night"] == "450.00"
        assert "Pool" in h["amenities"]
        assert "Spa" in h["amenities"]

    @pytest.mark.asyncio
    async def test_execute_mcp_base_error(self, mock_skiplagged_client, mock_db):
        """Test handling of base SkiplaggedMCPError."""
        mock_skiplagged_client.search_hotels = AsyncMock(
            side_effect=SkiplaggedMCPError("Generic MCP error")
        )

        tool = SearchHotelsSkiplaggedTool(client=mock_skiplagged_client)
        result = await tool.execute(
            args={
                "city": "Paris",
                "checkin": "2026-06-15",
                "checkout": "2026-06-18",
            },
            user_id="test-user",
            db=mock_db,
        )

        assert result.success is False
        assert "Hotel search failed" in result.error
