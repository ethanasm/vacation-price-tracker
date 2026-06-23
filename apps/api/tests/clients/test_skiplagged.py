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
    SkiplaggedRateLimitError,
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

    @pytest.mark.anyio
    async def test_search_flights_always_excludes_hidden_city(self):
        """includeHiddenCity must be False on every flight search call."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        with patch.object(client, "_call_mcp", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {
                "flights": [],
                "pagination": {
                    "totalAvailable": 0,
                    "currentlyShowing": 0,
                    "offset": 0,
                    "limit": 75,
                    "hasMoreResults": False,
                },
            }
            await client.search_flights("SFO", "ORD", "2026-06-20")
        _tool, params = mock_call.call_args.args
        assert params.get("includeHiddenCity") is False

    @pytest.mark.anyio
    async def test_search_flights_all_always_excludes_hidden_city(self):
        """includeHiddenCity must be False on every paginated call too."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        with patch.object(client, "_call_mcp", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {
                "flights": [],
                "pagination": {
                    "totalAvailable": 0,
                    "currentlyShowing": 0,
                    "offset": 0,
                    "limit": 75,
                    "hasMoreResults": False,
                },
            }
            await client.search_flights_all("SFO", "ORD", "2026-06-20")
        for call in mock_call.call_args_list:
            _tool, params = call.args
            assert params.get("includeHiddenCity") is False

    @pytest.mark.anyio
    async def test_search_flights_unexpected_exception_returns_error_result(self):
        """Non-MCP exceptions in _search_flights_page produce a failed result."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        with patch.object(
            client, "_call_mcp", side_effect=RuntimeError("network gone")
        ):
            result = await client.search_flights(
                "SFO", "CDG", "2026-06-15", return_date="2026-06-22"
            )
        assert result.success is False
        assert result.flights == []
        assert result.origin == "SFO"
        assert result.destination == "CDG"
        assert result.departure_date == "2026-06-15"
        assert result.return_date == "2026-06-22"
        assert result.is_round_trip is True
        assert result.provider == "skiplagged"
        assert result.total_results == 0
        assert "network gone" in (result.error or "")


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

    @pytest.mark.anyio
    async def test_search_hotels_unexpected_exception_returns_error_result(self):
        """Non-MCP exceptions in _search_hotels_page produce a failed result."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        with patch.object(
            client, "_call_mcp", side_effect=RuntimeError("boom")
        ):
            result = await client.search_hotels("Paris", "2026-06-15", "2026-06-18")
        assert result.success is False
        assert result.hotels == []
        assert result.city == "Paris"
        assert result.checkin == "2026-06-15"
        assert result.checkout == "2026-06-18"
        assert result.provider == "skiplagged"
        assert result.total_results == 0
        assert "boom" in (result.error or "")


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


def _http_429(retry_after: str | None = None) -> httpx.Response:
    """Create an HTTP 429 response, optionally with a Retry-After header."""
    headers = {"content-type": "text/plain"}
    if retry_after is not None:
        headers["retry-after"] = retry_after
    return httpx.Response(status_code=429, text="Too Many Requests", headers=headers)


def _payload_rate_limit_error() -> httpx.Response:
    """A 200 response whose JSON-RPC error message encodes an upstream 429.

    This mirrors how the hosted Skiplagged MCP surfaces a throttled fare backend:
    "Failed to fetch from search: Request failed with status code 429".
    """
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 2,
        "error": {
            "code": -32603,
            "message": "Failed to fetch from search: Request failed with status code 429",
        },
    })


def _tool_rate_limit_error() -> httpx.Response:
    """A 200 tools/call result flagged isError with a 429 message in its content."""
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 2,
        "result": {
            "isError": True,
            "content": [
                {"type": "text", "text": "Failed to fetch from search: Request failed with status code 429"},
            ],
        },
    })


class TestSkiplaggedRateLimit:
    @pytest.mark.anyio
    async def test_http_429_raises_rate_limit_after_retries(self):
        """A persistent HTTP 429 retries the bounded number of times, then raises."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_http_429())
        with (
            patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient,
            patch("app.clients.skiplagged.asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRateLimitError):
                await client.search_flights("SFO", "CDG", "2026-06-15")
        # 1 initial attempt + MAX_TRANSIENT_RETRIES (2) = 3 posts, 2 backoff sleeps.
        assert mock_post.await_count == 3
        assert mock_sleep.await_count == 2

    @pytest.mark.anyio
    async def test_in_payload_429_message_classified_as_rate_limit(self):
        """An upstream 429 surfaced inside the JSON-RPC error message is a rate limit."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_payload_rate_limit_error())
        with (
            patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient,
            patch("app.clients.skiplagged.asyncio.sleep", new_callable=AsyncMock),
        ):
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRateLimitError):
                await client.search_flights("SFO", "CDG", "2026-06-15")

    @pytest.mark.anyio
    async def test_tool_iserror_429_classified_as_rate_limit(self):
        """An upstream 429 surfaced as an isError tool result is a rate limit."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_tool_rate_limit_error())
        with (
            patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient,
            patch("app.clients.skiplagged.asyncio.sleep", new_callable=AsyncMock),
        ):
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRateLimitError):
                await client.search_flights("SFO", "CDG", "2026-06-15")

    @pytest.mark.anyio
    async def test_recovers_after_transient_429(self):
        """A 429 followed by a good response should retry and succeed."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(side_effect=[_http_429(), _flights_response(2)])
        with (
            patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient,
            patch("app.clients.skiplagged.asyncio.sleep", new_callable=AsyncMock),
        ):
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        assert result.success is True
        assert len(result.flights) == 2
        assert mock_post.await_count == 2

    @pytest.mark.anyio
    async def test_long_retry_after_fails_fast_without_retrying(self):
        """A Retry-After longer than the local cap should not block; fail immediately."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_http_429(retry_after="60"))
        with (
            patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient,
            patch("app.clients.skiplagged.asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
        ):
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            with pytest.raises(SkiplaggedRateLimitError) as exc_info:
                await client.search_flights("SFO", "CDG", "2026-06-15")
        assert exc_info.value.retry_after == 60.0
        assert mock_post.await_count == 1  # no retry
        assert mock_sleep.await_count == 0


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

    @pytest.mark.anyio
    async def test_sse_skips_invalid_json_lines(self):
        """Malformed `data:` lines in SSE are skipped; later valid ones win."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        valid_payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                "structuredContent": {
                    "flights": [],
                    "pagination": {
                        "totalAvailable": 0,
                        "currentlyShowing": 0,
                        "offset": 0,
                        "limit": 75,
                        "hasMoreResults": False,
                    },
                },
            },
        }
        sse_text = (
            "data: {not valid json\n\n"
            f"data: {json.dumps(valid_payload)}\n\n"
        )
        sse_response = httpx.Response(
            status_code=200,
            text=sse_text,
            headers={"content-type": "text/event-stream", "mcp-session-id": "test-session"},
        )
        mock_post = AsyncMock(return_value=sse_response)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        assert result.success is True
        assert result.flights == []

    @pytest.mark.anyio
    async def test_extract_result_falls_back_to_text_content(self):
        """When `structuredContent` is absent, parse JSON from `content[].text`."""
        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        embedded = {
            "flights": [],
            "pagination": {
                "totalAvailable": 0,
                "currentlyShowing": 0,
                "offset": 0,
                "limit": 75,
                "hasMoreResults": False,
            },
        }
        payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "result": {
                # No structuredContent — forces the content[] text fallback.
                "content": [
                    {"type": "image", "data": "ignored"},
                    {"type": "text", "text": "{ not valid json"},
                    {"type": "text", "text": json.dumps(embedded)},
                ],
            },
        }
        json_response = httpx.Response(
            status_code=200,
            text=json.dumps(payload),
            headers={"content-type": "application/json", "mcp-session-id": "test-session"},
        )
        mock_post = AsyncMock(return_value=json_response)
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")
        # The valid JSON in content[1].text was returned, so we get an empty (but successful) result
        assert result.success is True
        assert result.flights == []


class TestSkiplaggedGlobalBudget:
    @pytest.mark.anyio
    async def test_call_mcp_increments_budget_and_proceeds(self, monkeypatch):
        import app.clients.skiplagged as sk_module

        monkeypatch.setattr(sk_module.settings, "enable_cost_ceilings", True)

        recorded = {}

        async def fake_incr(metric, amount, limit, **kwargs):
            recorded["metric"] = metric
            recorded["amount"] = amount
            return True, amount

        monkeypatch.setattr(sk_module, "incr_and_check_global_budget", fake_incr)

        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(1))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await client.search_flights("SFO", "CDG", "2026-06-15")

        assert result.success is True
        assert recorded == {"metric": "skiplagged_calls", "amount": 1}

    @pytest.mark.anyio
    async def test_call_mcp_raises_when_over_budget_before_sending(self, monkeypatch):
        import app.clients.skiplagged as sk_module
        from app.core.errors import GlobalBudgetExceeded

        monkeypatch.setattr(sk_module.settings, "enable_cost_ceilings", True)

        async def over_budget(metric, amount, limit, **kwargs):
            return False, limit + amount

        monkeypatch.setattr(sk_module, "incr_and_check_global_budget", over_budget)

        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"

        send = AsyncMock()
        monkeypatch.setattr(client, "_send_request", send)

        with pytest.raises(GlobalBudgetExceeded):
            await client._call_mcp("sk_flights_search", {"origin": "SFO"})

        send.assert_not_called()

    @pytest.mark.anyio
    async def test_call_mcp_skips_budget_when_disabled(self, monkeypatch):
        import app.clients.skiplagged as sk_module

        monkeypatch.setattr(sk_module.settings, "enable_cost_ceilings", False)

        called = False

        async def fake_incr(*args, **kwargs):
            nonlocal called
            called = True
            return True, 0

        monkeypatch.setattr(sk_module, "incr_and_check_global_budget", fake_incr)

        client = SkiplaggedClient()
        client._initialized = True
        client._session_id = "test-session"
        mock_post = AsyncMock(return_value=_flights_response(1))
        with patch("app.clients.skiplagged.httpx.AsyncClient") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            await client.search_flights("SFO", "CDG", "2026-06-15")

        assert called is False
