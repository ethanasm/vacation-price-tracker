"""Tests for the Kiwi.com MCP client."""

from __future__ import annotations

import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from app.clients.kiwi import (
    KiwiClient,
    KiwiConnectionError,
    KiwiRateLimitError,
    KiwiRequestError,
    KiwiTransientError,
    _apply_max_stops,
    _apply_sort,
    _to_kiwi_date,
)


def _make_sse_response(data: dict, status_code: int = 200, headers: dict | None = None) -> httpx.Response:
    """Create a mock SSE response (Kiwi is stateless — no session header)."""
    body = f"event: message\ndata: {json.dumps(data)}\n\n"
    all_headers = {"content-type": "text/event-stream"}
    if headers:
        all_headers.update(headers)
    return httpx.Response(status_code=status_code, text=body, headers=all_headers)


def _segment(
    carrier: str = "AS",
    flight_number: str = "AS3361",
    from_: str = "SFO",
    to: str = "RDM",
    dep: str = "2026-08-22T16:28:00",
    arr: str = "2026-08-22T18:07:00",
    duration: int = 5940,
) -> dict:
    return {
        "from": from_,
        "to": to,
        "fromCity": "San Francisco",
        "toCity": "Redmond",
        "departureTime": dep,
        "arrivalTime": arr,
        "durationSeconds": duration,
        "carrier": carrier,
        "flightNumber": flight_number,
        "cabinClass": "Economy",
    }


def _itinerary(
    price: int = 187,
    outbound_stops: int = 0,
    inbound_stops: int | None = 0,
    outbound_duration: int = 5940,
    itinerary_id: str = "abc_0|abc_1",
) -> dict:
    itin = {
        "id": itinerary_id,
        "price": price,
        "priceFormatted": f"{price} USD",
        "totalDurationSeconds": 12300,
        "bookingUrl": "https://kiwi.com/u/test",
        "outbound": {
            "from": "SFO",
            "to": "RDM",
            "departureTime": "2026-08-22T16:28:00",
            "arrivalTime": "2026-08-22T18:07:00",
            "durationSeconds": outbound_duration,
            "stops": outbound_stops,
            "route": ["SFO", "RDM"],
            "cabinClass": "Economy",
            "segments": [_segment()] * (outbound_stops + 1),
        },
    }
    if inbound_stops is not None:
        itin["inbound"] = {
            "from": "RDM",
            "to": "SFO",
            "departureTime": "2026-08-29T18:47:00",
            "arrivalTime": "2026-08-29T20:33:00",
            "durationSeconds": 6360,
            "stops": inbound_stops,
            "route": ["RDM", "SFO"],
            "cabinClass": "Economy",
            "segments": [
                _segment(flight_number="AS3360", from_="RDM", to="SFO")
            ]
            * (inbound_stops + 1),
        }
    return itin


def _search_response(itineraries: list[dict] | None = None, currency: str = "USD") -> httpx.Response:
    if itineraries is None:
        itineraries = [_itinerary()]
    return _make_sse_response({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "content": [{"type": "text", "text": "found"}],
            "structuredContent": {
                "query": "SFO → RDM",
                "currency": currency,
                "passengers": {"adults": 1, "children": 0, "infants": 0},
                "resultsCount": len(itineraries),
                "itineraries": itineraries,
                "searchTimeMs": 100,
            },
            "isError": False,
        },
    })


def _patched_client(mock_post):
    """Context manager patching httpx.AsyncClient inside the kiwi module."""
    patcher = patch("app.clients.kiwi.httpx.AsyncClient")
    MockClient = patcher.start()
    MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
    MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
    return patcher


class TestHelpers:
    def test_to_kiwi_date(self):
        assert _to_kiwi_date("2026-08-22") == "22/08/2026"

    def test_to_kiwi_date_rejects_garbage(self):
        with pytest.raises(ValueError):
            _to_kiwi_date("not-a-date")


class TestKiwiFlightSearch:
    @pytest.mark.anyio
    async def test_search_flights_success(self):
        client = KiwiClient()
        mock_post = AsyncMock(return_value=_search_response())
        patcher = _patched_client(mock_post)
        try:
            result = await client.search_flights(
                "sfo", "rdm", "2026-08-22", return_date="2026-08-29", cabin="economy"
            )
        finally:
            patcher.stop()

        assert result.success is True
        assert result.provider == "kiwi"
        assert result.origin == "SFO"
        assert result.is_round_trip is True
        assert len(result.flights) == 1
        flight = result.flights[0]
        assert flight.carrier_code == "AS"
        assert flight.airline_name == "Alaska Airlines"
        assert flight.price_amount == Decimal("187")
        assert flight.price_currency == "USD"
        assert flight.departure_airport == "SFO"
        assert flight.arrival_airport == "RDM"
        assert flight.duration_minutes == 99
        assert flight.stops == 0
        assert flight.stops_text == "Direct"
        assert flight.booking_link == "https://kiwi.com/u/test"
        assert flight.provider == "kiwi"
        assert flight.raw_data["provider"] == "kiwi"
        assert "inbound" in flight.raw_data

        # Request used Kiwi's date format + cabin code
        sent = mock_post.call_args.kwargs["json"]["params"]["arguments"]
        assert sent["departureDate"] == "22/08/2026"
        assert sent["returnDate"] == "29/08/2026"
        assert sent["cabinClass"] == "M"
        assert sent["currency"] == "USD"

    @pytest.mark.anyio
    async def test_one_way_omits_return_and_unknown_cabin_omitted(self):
        client = KiwiClient()
        mock_post = AsyncMock(return_value=_search_response())
        patcher = _patched_client(mock_post)
        try:
            result = await client.search_flights("SFO", "RDM", "2026-08-22", cabin="steerage")
        finally:
            patcher.stop()
        assert result.is_round_trip is False
        sent = mock_post.call_args.kwargs["json"]["params"]["arguments"]
        assert "returnDate" not in sent
        assert "cabinClass" not in sent

    @pytest.mark.anyio
    async def test_unpriced_and_malformed_itineraries_dropped(self):
        bad_price = _itinerary(price=0)
        no_outbound = {"id": "x", "price": 100}
        not_a_dict = "junk"
        unparseable_price = _itinerary()
        unparseable_price["price"] = "free!"
        good = _itinerary(price=250)
        client = KiwiClient()
        mock_post = AsyncMock(
            return_value=_search_response([bad_price, no_outbound, not_a_dict, unparseable_price, good])
        )
        patcher = _patched_client(mock_post)
        try:
            result = await client.search_flights("SFO", "RDM", "2026-08-22")
        finally:
            patcher.stop()
        assert len(result.flights) == 1
        assert result.flights[0].price_amount == Decimal("250")

    @pytest.mark.anyio
    async def test_missing_itineraries_yields_empty_success(self):
        client = KiwiClient()
        mock_post = AsyncMock(
            return_value=_make_sse_response({
                "jsonrpc": "2.0",
                "id": 1,
                "result": {"structuredContent": {"currency": "USD"}, "isError": False},
            })
        )
        patcher = _patched_client(mock_post)
        try:
            result = await client.search_flights("SFO", "RDM", "2026-08-22")
        finally:
            patcher.stop()
        assert result.success is True
        assert result.flights == []

    @pytest.mark.anyio
    async def test_search_flights_all_is_single_call(self):
        client = KiwiClient()
        mock_post = AsyncMock(return_value=_search_response([_itinerary(), _itinerary(price=200)]))
        patcher = _patched_client(mock_post)
        try:
            result = await client.search_flights_all(
                "SFO", "RDM", "2026-08-22", max_pages=4, cabin="business"
            )
        finally:
            patcher.stop()
        assert mock_post.call_count == 1
        assert len(result.flights) == 2
        sent = mock_post.call_args.kwargs["json"]["params"]["arguments"]
        assert sent["cabinClass"] == "C"

    @pytest.mark.anyio
    async def test_limit_and_offset_slice_client_side(self):
        itins = [_itinerary(price=100 + i, itinerary_id=f"itin-{i}") for i in range(5)]
        client = KiwiClient()
        mock_post = AsyncMock(return_value=_search_response(itins))
        patcher = _patched_client(mock_post)
        try:
            result = await client.search_flights("SFO", "RDM", "2026-08-22", limit=2, offset=1)
        finally:
            patcher.stop()
        assert [f.price_amount for f in result.flights] == [Decimal("101"), Decimal("102")]

    @pytest.mark.anyio
    async def test_unexpected_error_returns_failed_result(self):
        client = KiwiClient()
        with patch.object(client, "_call_mcp", AsyncMock(side_effect=RuntimeError("boom"))):
            result = await client.search_flights("SFO", "RDM", "2026-08-22")
        assert result.success is False
        assert "boom" in (result.error or "")

    @pytest.mark.anyio
    async def test_search_flights_all_retries_empty_then_returns_results(self):
        """A cold Kiwi search can return an empty itinerary list that fills on
        an immediate re-query (prod 2026-07-06) — tracking searches retry."""
        client = KiwiClient()
        empty = _search_response([])
        full = _search_response([_itinerary()])
        mock_post = AsyncMock(side_effect=[empty, full])
        patcher = _patched_client(mock_post)
        try:
            with patch("app.clients.kiwi.asyncio.sleep", AsyncMock()):
                result = await client.search_flights_all("SFO", "RDM", "2026-08-22")
        finally:
            patcher.stop()
        assert mock_post.call_count == 2
        assert result.success is True
        assert len(result.flights) == 1

    @pytest.mark.anyio
    async def test_search_flights_all_empty_after_retries_returns_empty(self):
        client = KiwiClient()
        mock_post = AsyncMock(return_value=_search_response([]))
        patcher = _patched_client(mock_post)
        try:
            with patch("app.clients.kiwi.asyncio.sleep", AsyncMock()):
                result = await client.search_flights_all("SFO", "RDM", "2026-08-22")
        finally:
            patcher.stop()
        assert mock_post.call_count == 3  # initial + EMPTY_RESULT_RETRIES
        assert result.success is True
        assert result.flights == []

    @pytest.mark.anyio
    async def test_search_flights_all_does_not_retry_failed_result(self):
        client = KiwiClient()
        with patch.object(
            client, "_call_mcp", AsyncMock(side_effect=RuntimeError("boom"))
        ) as mock_call:
            result = await client.search_flights_all("SFO", "RDM", "2026-08-22")
        assert mock_call.await_count == 1
        assert result.success is False


class TestClientSideFilters:
    def _flights(self, specs):
        """Build minimal FlightSearchFlight-like objects via the real normalizer."""
        flights = []
        for price, out_stops, in_stops, duration in specs:
            itin = _itinerary(
                price=price,
                outbound_stops=out_stops,
                inbound_stops=in_stops,
                outbound_duration=duration,
            )
            flight = KiwiClient._normalize_itinerary(itin, "USD")
            assert flight is not None
            flights.append(flight)
        return flights

    def test_max_stops_none_requires_nonstop_both_legs(self):
        flights = self._flights([(100, 0, 0, 6000), (110, 0, 1, 6000), (120, 1, 0, 6000)])
        kept = _apply_max_stops(flights, "none")
        assert [f.price_amount for f in kept] == [Decimal("100")]

    def test_max_stops_one_allows_single_stop(self):
        flights = self._flights([(100, 0, 0, 6000), (110, 1, 1, 6000), (120, 2, 0, 6000)])
        kept = _apply_max_stops(flights, "one")
        assert [f.price_amount for f in kept] == [Decimal("100"), Decimal("110")]

    def test_max_stops_many_or_none_filter_is_noop(self):
        flights = self._flights([(100, 2, 2, 6000)])
        assert _apply_max_stops(flights, "many") == flights
        assert _apply_max_stops(flights, None) == flights

    def test_max_stops_falls_back_to_flight_stops_without_raw_legs(self):
        flights = self._flights([(100, 1, 0, 6000)])
        flights[0].raw_data = {}
        assert _apply_max_stops(flights, "none") == []

    def test_sort_price_and_duration_and_value(self):
        flights = self._flights([(300, 0, 0, 3000), (100, 0, 0, 9000), (200, 0, 0, 6000)])
        assert [f.price_amount for f in _apply_sort(flights, "price")] == [
            Decimal("100"),
            Decimal("200"),
            Decimal("300"),
        ]
        assert [f.duration_minutes for f in _apply_sort(flights, "duration")] == [50, 100, 150]
        assert _apply_sort(flights, "value") == flights

    def test_sort_duration_handles_missing_duration(self):
        flights = self._flights([(100, 0, 0, 3000), (200, 0, 0, 6000)])
        flights[0].duration_minutes = None
        assert _apply_sort(flights, "duration")[0].price_amount == Decimal("200")


class TestKiwiTransportErrors:
    @pytest.mark.anyio
    async def test_http_429_raises_rate_limit_with_retry_after(self):
        client = KiwiClient()
        resp = httpx.Response(429, text="slow down", headers={"retry-after": "120"})
        mock_post = AsyncMock(return_value=resp)
        patcher = _patched_client(mock_post)
        try:
            with pytest.raises(KiwiRateLimitError) as exc_info:
                await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()
        # retry_after=120 > MAX_BACKOFF → no in-process retry
        assert mock_post.call_count == 1
        assert exc_info.value.retry_after == 120.0

    @pytest.mark.anyio
    async def test_transient_5xx_retries_then_succeeds(self):
        client = KiwiClient()
        mock_post = AsyncMock(
            side_effect=[httpx.Response(503, text="unavailable"), _search_response()]
        )
        patcher = _patched_client(mock_post)
        try:
            with patch("app.clients.kiwi.asyncio.sleep", AsyncMock()):
                result = await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()
        assert mock_post.call_count == 2
        assert result["resultsCount"] == 1

    @pytest.mark.anyio
    async def test_transient_errors_exhaust_retries(self):
        client = KiwiClient()
        mock_post = AsyncMock(return_value=httpx.Response(502, text="bad gateway"))
        patcher = _patched_client(mock_post)
        try:
            with patch("app.clients.kiwi.asyncio.sleep", AsyncMock()):
                with pytest.raises(KiwiTransientError):
                    await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()
        assert mock_post.call_count == 3  # initial + MAX_TRANSIENT_RETRIES

    @pytest.mark.anyio
    async def test_http_400_raises_request_error(self):
        client = KiwiClient()
        mock_post = AsyncMock(return_value=httpx.Response(400, text="bad request"))
        patcher = _patched_client(mock_post)
        try:
            with pytest.raises(KiwiRequestError):
                await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    @pytest.mark.parametrize(
        "exc", [httpx.ConnectError("refused"), httpx.TimeoutException("slow"), httpx.HTTPError("proto")]
    )
    async def test_connection_failures_raise_connection_error(self, exc):
        client = KiwiClient()
        mock_post = AsyncMock(side_effect=exc)
        patcher = _patched_client(mock_post)
        try:
            with pytest.raises(KiwiConnectionError):
                await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    async def test_tool_error_with_429_text_raises_rate_limit(self):
        client = KiwiClient()
        data = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "isError": True,
                "content": [{"type": "text", "text": "Request failed with status code 429"}],
            },
        }
        mock_post = AsyncMock(return_value=_make_sse_response(data))
        patcher = _patched_client(mock_post)
        try:
            with patch("app.clients.kiwi.asyncio.sleep", AsyncMock()):
                with pytest.raises(KiwiRateLimitError):
                    await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    async def test_tool_error_generic_raises_request_error(self):
        client = KiwiClient()
        data = {"jsonrpc": "2.0", "id": 1, "result": {"isError": True, "content": []}}
        mock_post = AsyncMock(return_value=_make_sse_response(data))
        patcher = _patched_client(mock_post)
        try:
            with pytest.raises(KiwiRequestError, match="Unknown tool error"):
                await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    async def test_jsonrpc_error_payload_raises(self):
        client = KiwiClient()
        data = {"jsonrpc": "2.0", "id": 1, "error": {"code": -32000, "message": "kaput"}}
        mock_post = AsyncMock(return_value=_make_sse_response(data))
        patcher = _patched_client(mock_post)
        try:
            with pytest.raises(KiwiRequestError, match="kaput"):
                await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    async def test_jsonrpc_error_rate_limit_message_classified(self):
        client = KiwiClient()
        data = {"jsonrpc": "2.0", "id": 1, "error": {"code": -32000, "message": "Too Many Requests"}}
        mock_post = AsyncMock(return_value=_make_sse_response(data))
        patcher = _patched_client(mock_post)
        try:
            with patch("app.clients.kiwi.asyncio.sleep", AsyncMock()):
                with pytest.raises(KiwiRateLimitError):
                    await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    async def test_plain_json_response_parsed(self):
        client = KiwiClient()
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {"structuredContent": {"currency": "USD", "itineraries": []}},
        }
        resp = httpx.Response(
            200, text=json.dumps(payload), headers={"content-type": "application/json"}
        )
        mock_post = AsyncMock(return_value=resp)
        patcher = _patched_client(mock_post)
        try:
            result = await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()
        assert result == {"currency": "USD", "itineraries": []}

    @pytest.mark.anyio
    async def test_invalid_json_body_raises(self):
        client = KiwiClient()
        resp = httpx.Response(200, text="<html>", headers={"content-type": "application/json"})
        mock_post = AsyncMock(return_value=resp)
        patcher = _patched_client(mock_post)
        try:
            with pytest.raises(KiwiRequestError, match="Invalid JSON"):
                await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    async def test_sse_without_data_lines_raises(self):
        client = KiwiClient()
        resp = httpx.Response(
            200, text="event: message\n\n", headers={"content-type": "text/event-stream"}
        )
        mock_post = AsyncMock(return_value=resp)
        patcher = _patched_client(mock_post)
        try:
            with pytest.raises(KiwiRequestError, match="No valid data"):
                await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()

    @pytest.mark.anyio
    async def test_sse_skips_malformed_data_lines(self):
        good = {"jsonrpc": "2.0", "id": 1, "result": {"structuredContent": {"itineraries": []}}}
        text = f"data: {{not-json}}\ndata: {json.dumps(good)}\n\n"
        resp = httpx.Response(200, text=text, headers={"content-type": "text/event-stream"})
        client = KiwiClient()
        mock_post = AsyncMock(return_value=resp)
        patcher = _patched_client(mock_post)
        try:
            result = await client._call_mcp("search-flight", {})
        finally:
            patcher.stop()
        assert result == {"itineraries": []}

    @pytest.mark.anyio
    async def test_global_budget_exceeded_propagates(self):
        from app.core.errors import GlobalBudgetExceeded

        client = KiwiClient()
        with patch(
            "app.clients.kiwi.incr_and_check_global_budget",
            AsyncMock(return_value=(False, 50001)),
        ):
            with pytest.raises(GlobalBudgetExceeded):
                await client._call_mcp("search-flight", {})

    def test_extract_result_falls_back_to_text_content(self):
        data = {
            "result": {
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": "not json"},
                    {"type": "text", "text": json.dumps({"itineraries": []})},
                ]
            }
        }
        assert KiwiClient._extract_result(data) == {"itineraries": []}

    def test_extract_result_non_dict_result(self):
        assert KiwiClient._extract_result({"result": [1, 2]}) == [1, 2]

    def test_extract_result_no_parseable_content(self):
        data = {"result": {"content": "nope"}}
        assert KiwiClient._extract_result(data) == {"content": "nope"}

    def test_parse_retry_after_variants(self):
        assert KiwiClient._parse_retry_after(httpx.Response(429, headers={"retry-after": "2"})) == 2.0
        assert (
            KiwiClient._parse_retry_after(
                httpx.Response(429, headers={"retry-after": "Wed, 21 Oct 2026 07:28:00 GMT"})
            )
            is None
        )
        assert KiwiClient._parse_retry_after(httpx.Response(429)) is None

    def test_backoff_delay_honors_retry_after_and_caps(self):
        exc = KiwiRateLimitError("429", retry_after=1.5)
        assert KiwiClient._backoff_delay(exc, 0) == 1.5
        exc_long = KiwiRateLimitError("429", retry_after=300)
        assert KiwiClient._backoff_delay(exc_long, 0) is None
        plain = KiwiTransientError("503")
        assert KiwiClient._backoff_delay(plain, 0) == 0.5
        assert KiwiClient._backoff_delay(plain, 10) == 4.0

    def test_custom_mcp_url_normalized(self):
        client = KiwiClient(mcp_url="https://example.test/mcp")
        assert client._mcp_url == "https://example.test/mcp/"


class TestTotalResults:
    @pytest.mark.anyio
    async def test_total_results_reports_pre_slice_count(self):
        itins = [_itinerary(price=100 + i, itinerary_id=f"itin-{i}") for i in range(5)]
        client = KiwiClient()
        mock_post = AsyncMock(return_value=_search_response(itins))
        patcher = _patched_client(mock_post)
        try:
            result = await client.search_flights("SFO", "RDM", "2026-08-22", limit=2)
        finally:
            patcher.stop()
        assert len(result.flights) == 2
        assert result.total_results == 5
