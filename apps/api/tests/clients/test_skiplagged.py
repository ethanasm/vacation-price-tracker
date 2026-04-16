"""Tests for Skiplagged MCP client."""

from __future__ import annotations

import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from app.clients.skiplagged import (
    SkiplaggedClient,
    SkiplaggedConnectionError,
    SkiplaggedRequestError,
)


def _make_sse_response(data: dict, status_code: int = 200, session_id: str = "test-session") -> httpx.Response:
    """Create a mock SSE response."""
    body = f"event: message\ndata: {json.dumps(data)}\n\n"
    headers = {
        "content-type": "text/event-stream",
        "mcp-session-id": session_id,
    }
    return httpx.Response(status_code=status_code, text=body, headers=headers)


def _init_response() -> httpx.Response:
    """Create a successful initialize response."""
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "@skiplagged/mcp", "version": "0.0.4"},
        },
    })


def _flights_response(num_flights: int = 3, has_more: bool = False) -> httpx.Response:
    """Create a mock flights search response."""
    flights = []
    for i in range(num_flights):
        flights.append({
            "type": "FlightCard",
            "id": f"SFO-CDG-2026-06-15-trip=AF{80 + i}",
            "airlines": "Air France",
            "departure": {"airport": "SFO", "dateTime": "2026-06-15T20:10:00-07:00"},
            "arrival": {"airport": "CDG", "dateTime": "2026-06-16T15:50:00+02:00"},
            "duration": "10h 40m",
            "layovers": 0,
            "price": {"amount": 1200 + i * 50, "currency": "USD"},
            "deepLink": f"https://skiplagged.com/flights/test#{i}",
            "attributes": ["standard", "nonstop"],
        })
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 2,
        "result": {
            "content": [{"type": "text", "text": "flights found"}],
            "structuredContent": {
                "flights": flights,
                "pagination": {
                    "totalAvailable": 100 if has_more else num_flights,
                    "currentlyShowing": num_flights,
                    "offset": 0,
                    "limit": 75,
                    "hasMoreResults": has_more,
                },
            },
        },
    })


def _hotels_response(num_hotels: int = 2, has_more: bool = False) -> httpx.Response:
    """Create a mock hotels search response."""
    hotels = []
    for i in range(num_hotels):
        hotels.append({
            "type": "HotelCard",
            "id": f"hotel_{1000 + i}",
            "name": f"Test Hotel {i}",
            "imageUrl": f"https://example.com/hotel{i}.jpg",
            "rating": {"stars": 4, "text": "4 stars"},
            "price": {"amount": 100.0 + i * 20, "currency": "USD", "text": f"${100 + i * 20}/night"},
            "chain": "Test Chain",
            "location": f"{i} Test Street",
            "amenities": ["Free internet", "Pool"],
            "deepLink": f"https://skiplagged.com/hotel/{1000 + i}",
        })
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 2,
        "result": {
            "content": [{"type": "text", "text": "hotels found"}],
            "structuredContent": {
                "results": hotels,
                "pagination": {
                    "totalAvailable": 50 if has_more else num_hotels,
                    "currentlyShowing": num_hotels,
                    "offset": 0,
                    "limit": 75,
                    "hasMoreResults": has_more,
                },
            },
        },
    })


class TestSkiplaggedClientInit:
    @pytest.mark.anyio
    async def test_initialize_captures_session_id(self):
        client = SkiplaggedClient()
        mock_post = AsyncMock(return_value=_init_response())
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            await client._ensure_initialized()
        assert client._session_id == "test-session"
        assert client._initialized is True

    @pytest.mark.anyio
    async def test_connection_error_on_timeout(self):
        client = SkiplaggedClient()
        mock_post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedConnectionError):
                await client._ensure_initialized()


class TestSkiplaggedFlightSearch:
    @pytest.mark.anyio
    async def test_search_flights_success(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(3))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        assert result.success is True
        assert len(result.flights) == 3
        assert result.provider == "skiplagged"
        assert result.flights[0].airline_name == "Air France"
        assert result.flights[0].price_amount == Decimal("1200")

    @pytest.mark.anyio
    async def test_search_flights_parses_flight_numbers(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(1))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        flight = result.flights[0]
        assert flight.carrier_code == "AF"
        # Flight number parsed from id "SFO-CDG-2026-06-15-trip=AF80"

    @pytest.mark.anyio
    async def test_search_flights_empty_results(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(0))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        assert result.success is True
        assert result.flights == []
        assert result.total_results == 0


class TestSkiplaggedHotelSearch:
    @pytest.mark.anyio
    async def test_search_hotels_success(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_hotels_response(2))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_hotels("Paris", "2026-06-15", "2026-06-18")
        assert result.success is True
        assert len(result.hotels) == 2
        assert result.hotels[0].name == "Test Hotel 0"
        assert result.hotels[0].price_per_night == Decimal("100.0")


class TestSkiplaggedPagination:
    @pytest.mark.anyio
    async def test_search_flights_all_follows_pages(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        # Page 1: has more. Page 2: no more.
        responses = [_flights_response(3, has_more=True), _flights_response(2, has_more=False)]
        mock_post = AsyncMock(side_effect=responses)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights_all("SFO", "CDG", "2026-06-15", max_pages=4)
        assert result.success is True
        assert len(result.flights) == 5  # 3 + 2

    @pytest.mark.anyio
    async def test_search_flights_all_respects_max_pages(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        # All pages have more, but we cap at 2
        responses = [_flights_response(3, has_more=True), _flights_response(3, has_more=True)]
        mock_post = AsyncMock(side_effect=responses)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights_all("SFO", "CDG", "2026-06-15", max_pages=2)
        assert len(result.flights) == 6  # 3 + 3, stopped at max_pages


class TestSkiplaggedErrorHandling:
    @pytest.mark.anyio
    async def test_session_reset_on_400(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "old-session"
        error_response = httpx.Response(400, text="Bad Request", headers={"content-type": "text/plain"})
        mock_post = AsyncMock(return_value=error_response)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRequestError):
                await client.search_flights("SFO", "CDG", "2026-06-15")
        assert client._initialized is False
        assert client._session_id is None

    @pytest.mark.anyio
    async def test_connection_error_on_network_failure(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedConnectionError):
                await client.search_flights("SFO", "CDG", "2026-06-15")


def _hotel_details_response() -> httpx.Response:
    """Create a mock hotel details response."""
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 3,
        "result": {
            "content": [{"type": "text", "text": "hotel details"}],
            "structuredContent": {
                "hotelId": "1001",
                "hotelName": "Test Hotel",
                "starRating": 4,
                "reviewRating": 8.5,
                "reviewCount": 250,
                "totalPriceInDollars": 500.0,
                "chainName": "Test Chain",
                "amenityNames": ["Pool", "Gym"],
                "address": "123 Main St",
                "cityName": "Paris",
                "countryName": "France",
                "description": "A lovely hotel",
                "checkinDate": "2026-06-15",
                "checkoutDate": "2026-06-18",
                "location": {"lat": 48.85, "lng": 2.35},
                "rooms": [
                    {
                        "id": "room-1",
                        "title": "Deluxe King",
                        "occupancyLimit": 2,
                        "pricePerNightInDollars": 150.0,
                        "totalPriceInDollars": 450.0,
                        "taxesAndFeesInDollars": 50.0,
                        "currency": "USD",
                        "refundable": True,
                        "freeCancellation": True,
                        "bedTypes": ["King"],
                        "bookingLink": "https://skiplagged.com/book",
                        "source": "test",
                    }
                ],
            },
        },
    })


class TestSkiplaggedHotelPagination:
    @pytest.mark.anyio
    async def test_search_hotels_all_follows_pages(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        responses = [_hotels_response(2, has_more=True), _hotels_response(1, has_more=False)]
        mock_post = AsyncMock(side_effect=responses)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_hotels_all(
                "Paris", "2026-06-15", "2026-06-18", max_pages=4,
            )
        assert result.success is True
        assert len(result.hotels) == 3

    @pytest.mark.anyio
    async def test_search_hotels_all_respects_max_pages(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        responses = [_hotels_response(2, has_more=True), _hotels_response(2, has_more=True)]
        mock_post = AsyncMock(side_effect=responses)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_hotels_all(
                "Paris", "2026-06-15", "2026-06-18", max_pages=2,
            )
        assert len(result.hotels) == 4


class TestSkiplaggedHotelDetails:
    @pytest.mark.anyio
    async def test_get_hotel_details_success(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_hotel_details_response())
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            detail = await client.get_hotel_details(
                "hotel_1001", "2026-06-15", "2026-06-18",
            )
        assert detail.hotelId == "1001"
        assert detail.hotelName == "Test Hotel"
        assert len(detail.rooms) == 1
        assert detail.rooms[0].title == "Deluxe King"

    @pytest.mark.anyio
    async def test_get_hotel_details_handles_string_id(self):
        """Hotel IDs from search results may be 'hotel_123' format."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_hotel_details_response())
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            # Pass with prefix
            detail = await client.get_hotel_details(
                "hotel_1001", "2026-06-15", "2026-06-18",
            )
        assert detail.hotelId == "1001"


class TestSkiplaggedSseParsing:
    @pytest.mark.anyio
    async def test_sse_with_json_rpc_error_raises(self):
        """JSON-RPC errors in SSE response should raise SkiplaggedRequestError."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        error_response = _make_sse_response({
            "jsonrpc": "2.0",
            "id": 2,
            "error": {"code": -32603, "message": "Internal error"},
        })
        mock_post = AsyncMock(return_value=error_response)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRequestError, match="Internal error"):
                await client.search_flights("SFO", "CDG", "2026-06-15")

    @pytest.mark.anyio
    async def test_plain_json_response_is_parsed(self):
        """Non-SSE JSON responses should be parsed directly."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        data = {
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                "content": [{"type": "text", "text": "ok"}],
                "structuredContent": {"flights": [], "pagination": {
                    "totalAvailable": 0, "currentlyShowing": 0,
                    "offset": 0, "limit": 75, "hasMoreResults": False,
                }},
            },
        }
        json_response = httpx.Response(
            status_code=200,
            text=json.dumps(data),
            headers={"content-type": "application/json", "mcp-session-id": "test-session"},
        )
        mock_post = AsyncMock(return_value=json_response)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        assert result.success is True
        assert result.flights == []

    @pytest.mark.anyio
    async def test_invalid_json_response_raises(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        bad_response = httpx.Response(
            status_code=200,
            text="not json at all",
            headers={"content-type": "application/json", "mcp-session-id": "test-session"},
        )
        mock_post = AsyncMock(return_value=bad_response)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRequestError):
                await client.search_flights("SFO", "CDG", "2026-06-15")

    @pytest.mark.anyio
    async def test_http_error_raises_connection_error(self):
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(side_effect=httpx.HTTPError("generic http error"))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedConnectionError):
                await client.search_flights("SFO", "CDG", "2026-06-15")
