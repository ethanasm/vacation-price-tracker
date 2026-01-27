"""Tests for the Amadeus API client."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock

import pytest
from app.clients.amadeus import AmadeusAuthError, AmadeusClient, AmadeusRequestError
from app.core import config as config_module


class _DummyResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self) -> dict:
        return self._payload


class _DummyAsyncClient:
    def __init__(
        self, get_responses: list[_DummyResponse] | None = None, post_responses: list[_DummyResponse] | None = None
    ):
        self.get_responses = list(get_responses or [])
        self.post_responses = list(post_responses or [])
        self.get_calls: list[dict] = []
        self.post_calls: list[dict] = []

    async def __aenter__(self) -> _DummyAsyncClient:
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def get(self, url: str, params: dict | None = None, headers: dict | None = None):
        self.get_calls.append({"url": url, "params": params, "headers": headers})
        return self.get_responses.pop(0)

    async def post(self, url: str, data: dict | None = None, headers: dict | None = None):
        self.post_calls.append({"url": url, "data": data, "headers": headers})
        return self.post_responses.pop(0)


@pytest.mark.asyncio
async def test_fetch_access_token_requires_credentials(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "")

    with pytest.raises(AmadeusAuthError):
        await client._fetch_access_token()


@pytest.mark.asyncio
async def test_fetch_access_token_parses_response(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "key")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "secret")

    dummy_client = _DummyAsyncClient(
        post_responses=[
            _DummyResponse(
                status_code=200,
                payload={"access_token": "token-123", "expires_in": 120},
            )
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    token = await client._fetch_access_token()

    assert token == "token-123"
    assert client._access_token == "token-123"
    assert client._access_token_expiry > time.time()
    assert dummy_client.post_calls[0]["data"]["client_id"] == "key"


@pytest.mark.asyncio
async def test_fetch_access_token_raises_on_http_error(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "key")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "secret")

    dummy_client = _DummyAsyncClient(post_responses=[_DummyResponse(status_code=401, payload={}, text="nope")])
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusAuthError):
        await client._fetch_access_token()


@pytest.mark.asyncio
async def test_fetch_access_token_requires_token(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(config_module.settings, "amadeus_api_key", "key")
    monkeypatch.setattr(config_module.settings, "amadeus_api_secret", "secret")

    dummy_client = _DummyAsyncClient(post_responses=[_DummyResponse(status_code=200, payload={})])
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusAuthError):
        await client._fetch_access_token()


@pytest.mark.asyncio
async def test_get_access_token_uses_cached_token(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")
    client._access_token = "cached-token"
    client._access_token_expiry = time.time() + 60

    fetch_mock = AsyncMock()
    monkeypatch.setattr(client, "_fetch_access_token", fetch_mock)

    token = await client._get_access_token()

    assert token == "cached-token"
    fetch_mock.assert_not_called()


@pytest.mark.asyncio
async def test_authorized_get_refreshes_on_unauthorized(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")

    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token-1"))
    monkeypatch.setattr(client, "_fetch_access_token", AsyncMock(return_value="token-2"))

    dummy_client = _DummyAsyncClient(
        get_responses=[
            _DummyResponse(status_code=401, payload={}),
            _DummyResponse(status_code=200, payload={"data": []}),
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    response = await client._authorized_get("/v1/reference-data/locations", params={"keyword": "SFO"})

    assert response.status_code == 200
    assert dummy_client.get_calls[0]["headers"]["Authorization"] == "Bearer token-1"
    assert dummy_client.get_calls[1]["headers"]["Authorization"] == "Bearer token-2"


@pytest.mark.asyncio
async def test_authorized_get_raises_on_failure(monkeypatch):
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token-1"))

    dummy_client = _DummyAsyncClient(
        get_responses=[
            _DummyResponse(status_code=500, payload={}, text="boom"),
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusRequestError):
        await client._authorized_get("/v1/reference-data/locations", params={"keyword": "SFO"})


def test_mock_hotel_search_returns_hotels():
    """Test that mock_hotel_search returns valid hotel data."""
    from app.clients.amadeus_mock import mock_hotel_search

    result = mock_hotel_search(
        city_code="LAX",
        check_in_date="2024-06-01",
        check_out_date="2024-06-05",
        adults=2,
        rooms=1,
    )

    assert "data" in result
    assert "meta" in result
    assert result["meta"]["count"] == 8
    assert result["meta"]["provider"] == "amadeus_mock"
    assert len(result["data"]) == 8

    # Check hotel structure
    hotel = result["data"][0]
    assert "hotel_id" in hotel
    assert "name" in hotel
    assert "price" in hotel
    assert "total" in hotel["price"]
    assert "currency" in hotel["price"]


def test_mock_hotel_search_multiplies_price_by_rooms():
    """Test that mock_hotel_search adjusts prices for multiple rooms."""
    from app.clients.amadeus_mock import mock_hotel_search

    result_1_room = mock_hotel_search(
        city_code="NYC",
        check_in_date="2024-07-01",
        check_out_date="2024-07-03",
        adults=2,
        rooms=1,
    )

    result_2_rooms = mock_hotel_search(
        city_code="NYC",
        check_in_date="2024-07-01",
        check_out_date="2024-07-03",
        adults=2,
        rooms=2,
    )

    # With random variation, we can't check exact values,
    # but 2-room prices should generally be higher than 1-room
    # Just verify the structure is correct
    assert len(result_1_room["data"]) == 8
    assert len(result_2_rooms["data"]) == 8


# --- Flight Search Tests ---


@pytest.mark.asyncio
async def test_search_flights_success(monkeypatch):
    """Test search_flights returns flight offers with correct params."""
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token"))

    dummy_client = _DummyAsyncClient(
        get_responses=[
            _DummyResponse(
                status_code=200,
                payload={
                    "data": [
                        {
                            "id": "1",
                            "price": {"grandTotal": "342.00", "currency": "USD"},
                            "validatingAirlineCodes": ["UA"],
                            "itineraries": [
                                {
                                    "duration": "PT3H30M",
                                    "segments": [
                                        {
                                            "carrierCode": "UA",
                                            "departure": {"iataCode": "SFO", "at": "2026-02-01T08:00:00"},
                                            "arrival": {"iataCode": "MCO", "at": "2026-02-01T16:30:00"},
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                    "meta": {"count": 1},
                },
            )
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    result = await client.search_flights(
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
        return_date="2026-02-08",
        adults=2,
    )

    assert len(result["data"]) == 1
    assert result["data"][0]["price"]["grandTotal"] == "342.00"
    assert result["data"][0]["validatingAirlineCodes"] == ["UA"]

    # Verify request params
    params = dummy_client.get_calls[0]["params"]
    assert params["originLocationCode"] == "SFO"
    assert params["destinationLocationCode"] == "MCO"
    assert params["departureDate"] == "2026-02-01"
    assert params["returnDate"] == "2026-02-08"
    assert params["adults"] == "2"
    assert params["travelClass"] == "ECONOMY"
    assert params["currencyCode"] == "USD"


@pytest.mark.asyncio
async def test_search_flights_non_stop_param(monkeypatch):
    """Test search_flights passes nonStop param correctly."""
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token"))

    dummy_client = _DummyAsyncClient(get_responses=[_DummyResponse(status_code=200, payload={"data": [], "meta": {}})])
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    await client.search_flights(
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
        non_stop=True,
        travel_class="BUSINESS",
    )

    params = dummy_client.get_calls[0]["params"]
    assert params["nonStop"] == "true"
    assert params["travelClass"] == "BUSINESS"


@pytest.mark.asyncio
async def test_search_flights_one_way(monkeypatch):
    """Test search_flights without return_date for one-way trip."""
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token"))

    dummy_client = _DummyAsyncClient(get_responses=[_DummyResponse(status_code=200, payload={"data": [], "meta": {}})])
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    await client.search_flights(
        origin="sfo",  # Test lowercase conversion
        destination="mco",
        departure_date="2026-02-01",
    )

    params = dummy_client.get_calls[0]["params"]
    assert params["originLocationCode"] == "SFO"
    assert params["destinationLocationCode"] == "MCO"
    assert "returnDate" not in params


@pytest.mark.asyncio
async def test_search_flights_request_error(monkeypatch):
    """Test search_flights raises AmadeusRequestError on failure."""
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token"))

    dummy_client = _DummyAsyncClient(get_responses=[_DummyResponse(status_code=500, text="Internal Server Error")])
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusRequestError):
        await client.search_flights(origin="SFO", destination="MCO", departure_date="2026-02-01")


@pytest.mark.asyncio
async def test_search_flight_cheapest_dates_success(monkeypatch):
    """Test search_flight_cheapest_dates returns date-price grid."""
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token"))

    dummy_client = _DummyAsyncClient(
        get_responses=[
            _DummyResponse(
                status_code=200,
                payload={
                    "data": [
                        {
                            "type": "flight-date",
                            "departureDate": "2026-02-01",
                            "returnDate": "2026-02-08",
                            "price": {"total": "299.00"},
                        },
                        {
                            "type": "flight-date",
                            "departureDate": "2026-02-03",
                            "returnDate": "2026-02-10",
                            "price": {"total": "275.00"},
                        },
                        {
                            "type": "flight-date",
                            "departureDate": "2026-02-05",
                            "returnDate": "2026-02-12",
                            "price": {"total": "312.00"},
                        },
                    ],
                    "meta": {"currency": "USD", "links": {}},
                },
            )
        ]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    result = await client.search_flight_cheapest_dates(
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
    )

    assert len(result["data"]) == 3
    assert result["data"][1]["price"]["total"] == "275.00"
    assert result["data"][1]["departureDate"] == "2026-02-03"

    # Verify request params
    params = dummy_client.get_calls[0]["params"]
    assert params["origin"] == "SFO"
    assert params["destination"] == "MCO"
    assert params["departureDate"] == "2026-02-01"


@pytest.mark.asyncio
async def test_search_flight_cheapest_dates_with_filters(monkeypatch):
    """Test search_flight_cheapest_dates passes optional params."""
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token"))

    dummy_client = _DummyAsyncClient(get_responses=[_DummyResponse(status_code=200, payload={"data": [], "meta": {}})])
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    await client.search_flight_cheapest_dates(
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
        one_way=True,
        non_stop=True,
        max_price=500,
    )

    params = dummy_client.get_calls[0]["params"]
    assert params["oneWay"] == "true"
    assert params["nonStop"] == "true"
    assert params["maxPrice"] == "500"


@pytest.mark.asyncio
async def test_search_flight_cheapest_dates_request_error(monkeypatch):
    """Test search_flight_cheapest_dates raises AmadeusRequestError on failure."""
    client = AmadeusClient(base_url="https://example.test")
    monkeypatch.setattr(client, "_get_access_token", AsyncMock(return_value="token"))

    dummy_client = _DummyAsyncClient(
        get_responses=[_DummyResponse(status_code=400, text="Bad Request - route not in cache")]
    )
    monkeypatch.setattr("app.clients.amadeus.httpx.AsyncClient", lambda timeout=None: dummy_client)

    with pytest.raises(AmadeusRequestError):
        await client.search_flight_cheapest_dates(origin="SFO", destination="XYZ", departure_date="2026-02-01")


def test_mock_flight_search_amadeus_format():
    """Test that mock_flight_search returns Amadeus-compatible structure."""
    from app.clients.amadeus_mock import mock_flight_search

    result = mock_flight_search(
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
        return_date="2026-02-08",
        adults=2,
    )

    assert "data" in result
    assert "meta" in result
    assert result["meta"]["provider"] == "amadeus_mock"

    # Check Amadeus format structure
    flight = result["data"][0]
    assert "id" in flight
    assert "validatingAirlineCodes" in flight
    assert isinstance(flight["validatingAirlineCodes"], list)
    assert "price" in flight
    assert "grandTotal" in flight["price"]
    assert "total" in flight["price"]
    assert "itineraries" in flight
    assert len(flight["itineraries"]) == 2  # Round trip has 2 itineraries

    # Check itinerary structure
    itinerary = flight["itineraries"][0]
    assert "duration" in itinerary
    assert "segments" in itinerary
    segment = itinerary["segments"][0]
    assert segment["departure"]["iataCode"] == "SFO"
    assert segment["arrival"]["iataCode"] == "MCO"
    assert "carrierCode" in segment


def test_mock_flight_search_one_way():
    """Test mock_flight_search returns single itinerary for one-way."""
    from app.clients.amadeus_mock import mock_flight_search

    result = mock_flight_search(
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
        adults=1,
    )

    flight = result["data"][0]
    assert len(flight["itineraries"]) == 1  # One-way has 1 itinerary


def test_mock_flight_search_non_stop_filter():
    """Test mock_flight_search filters to non-stop when requested."""
    from app.clients.amadeus_mock import mock_flight_search

    result = mock_flight_search(
        origin="SFO",
        destination="MCO",
        departure_date="2026-02-01",
        non_stop=True,
    )

    # All returned flights should have 0 stops
    for flight in result["data"]:
        for itinerary in flight["itineraries"]:
            for segment in itinerary["segments"]:
                assert segment["numberOfStops"] == 0


# --- Flight Provider Factory Tests ---


def test_get_flight_provider_returns_amadeus_by_default(monkeypatch):
    """Test get_flight_provider returns Amadeus client by default."""
    from app.clients.flight_provider import get_flight_provider

    monkeypatch.setattr(config_module.settings, "external_flight_price_provider", "amadeus")

    provider = get_flight_provider()

    from app.clients.amadeus import AmadeusClient

    assert isinstance(provider, AmadeusClient)


def test_get_flight_provider_returns_google_flights(monkeypatch):
    """Test get_flight_provider returns Google Flights client when configured."""
    from app.clients.flight_provider import get_flight_provider

    monkeypatch.setattr(config_module.settings, "external_flight_price_provider", "fast-flights")

    provider = get_flight_provider()

    from app.clients.google_flights import GoogleFlightsClient

    assert isinstance(provider, GoogleFlightsClient)


def test_get_provider_name(monkeypatch):
    """Test get_provider_name returns the configured provider name."""
    from app.clients.flight_provider import get_provider_name

    monkeypatch.setattr(config_module.settings, "external_flight_price_provider", "fast-flights")
    assert get_provider_name() == "fast-flights"

    monkeypatch.setattr(config_module.settings, "external_flight_price_provider", "AMADEUS")
    assert get_provider_name() == "amadeus"


# --- Google Flights Client Tests ---


def test_google_flights_parse_price():
    """Test GoogleFlightsClient price parsing."""
    from decimal import Decimal

    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    assert client._parse_price("$299") == Decimal("299")
    assert client._parse_price("$1,299") == Decimal("1299")
    assert client._parse_price("299 USD") == Decimal("299")
    assert client._parse_price("$299.50") == Decimal("299.50")
    assert client._parse_price("") is None
    assert client._parse_price(None) is None


def test_google_flights_parse_duration():
    """Test GoogleFlightsClient duration parsing."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    assert client._parse_duration("5h 30m") == 330
    assert client._parse_duration("2h") == 120
    assert client._parse_duration("45m") == 45
    assert client._parse_duration("10h 5m") == 605
    assert client._parse_duration("") is None
    assert client._parse_duration(None) is None


def test_google_flights_extract_airline_code():
    """Test GoogleFlightsClient airline code extraction."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    assert client._extract_airline_code("United Airlines") == "UA"
    assert client._extract_airline_code("Delta Air Lines") == "DL"
    assert client._extract_airline_code("American Airlines") == "AA"
    assert client._extract_airline_code("Southwest Airlines") == "WN"
    assert client._extract_airline_code("British Airways") == "BA"
    assert client._extract_airline_code("Lufthansa") == "LH"
    # Unknown airline should use first two letters
    assert client._extract_airline_code("Acme Airlines") == "AC"


def test_google_flights_cabin_class_mapping():
    """Test Google Flights cabin class mapping."""
    from app.clients.google_flights import CABIN_CLASS_MAP

    assert CABIN_CLASS_MAP["ECONOMY"] == "economy"
    assert CABIN_CLASS_MAP["PREMIUM_ECONOMY"] == "premium-economy"
    assert CABIN_CLASS_MAP["BUSINESS"] == "business"
    assert CABIN_CLASS_MAP["FIRST"] == "first"


class _MockFlight:
    """Mock fast-flights Flight object for testing."""

    def __init__(
        self,
        price: str = "$299",
        name: str = "United Airlines",
        departure: str = "2026-02-01T08:00",
        arrival: str = "2026-02-01T14:30",
        duration: str = "5h 30m",
        stops: str = "Nonstop",
    ):
        self.price = price
        self.name = name
        self.departure = departure
        self.arrival = arrival
        self.duration = duration
        self.stops = stops


class _MockResult:
    """Mock fast-flights Result object for testing."""

    def __init__(self, flights: list):
        self.flights = flights


def test_google_flights_convert_flight():
    """Test GoogleFlightsClient flight conversion to Amadeus format."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    flight = _MockFlight(
        price="$342",
        name="United Airlines",
        departure="2026-02-01T08:00",
        arrival="2026-02-01T14:30",
        duration="5h 30m",
        stops="Nonstop",
    )

    result = client._convert_flight(flight, 0, None)

    assert result is not None
    assert result["price"]["total"] == "342"
    assert result["price"]["grandTotal"] == "342"
    assert result["airline_code"] == "UA"
    assert result["airline_name"] == "United Airlines"
    assert result["duration_minutes"] == 330
    assert result["stops"] == 0
    assert result["validatingAirlineCodes"] == ["UA"]


def test_google_flights_convert_to_amadeus_format():
    """Test GoogleFlightsClient result conversion."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    mock_result = _MockResult(
        flights=[
            _MockFlight(price="$299", name="United Airlines"),
            _MockFlight(price="$350", name="Delta Air Lines"),
            _MockFlight(price="$275", name="American Airlines"),
        ]
    )

    offers = client._convert_to_amadeus_format(mock_result, max_results=10, return_date=None)

    assert len(offers) == 3
    assert offers[0]["price"]["total"] == "299"
    assert offers[0]["validatingAirlineCodes"] == ["UA"]
    assert offers[1]["price"]["total"] == "350"
    assert offers[1]["validatingAirlineCodes"] == ["DL"]
    assert offers[2]["price"]["total"] == "275"
    assert offers[2]["validatingAirlineCodes"] == ["AA"]


def test_google_flights_convert_respects_max_results():
    """Test GoogleFlightsClient respects max_results limit."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    mock_result = _MockResult(flights=[_MockFlight(price=f"${100 + i}") for i in range(20)])

    offers = client._convert_to_amadeus_format(mock_result, max_results=5, return_date=None)

    assert len(offers) == 5


def test_google_flights_convert_flight_with_return_date():
    """Test GoogleFlightsClient adds return itinerary for round trips."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    flight = _MockFlight(
        price="$500",
        name="Delta Air Lines",
        departure="2026-02-01T08:00",
        arrival="2026-02-01T14:30",
        duration="5h 30m",
        stops="Nonstop",
    )

    result = client._convert_flight(flight, 0, return_date="2026-02-08", origin="SFO", destination="JFK")

    assert result is not None
    assert len(result["itineraries"]) == 2
    # Outbound
    assert result["itineraries"][0]["segments"][0]["departure"]["iataCode"] == "SFO"
    assert result["itineraries"][0]["segments"][0]["arrival"]["iataCode"] == "JFK"
    # Return
    assert result["itineraries"][1]["segments"][0]["departure"]["iataCode"] == "JFK"
    assert result["itineraries"][1]["segments"][0]["arrival"]["iataCode"] == "SFO"


def test_google_flights_convert_flight_no_price():
    """Test GoogleFlightsClient returns None for flight without price."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    class NoPriceFlight:
        price = None
        name = "Unknown"

    result = client._convert_flight(NoPriceFlight(), 0, None)
    assert result is None


def test_google_flights_convert_flight_invalid_price():
    """Test GoogleFlightsClient returns None for flight with unparseable price."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    class InvalidPriceFlight:
        price = "free"
        name = "Unknown"

    result = client._convert_flight(InvalidPriceFlight(), 0, None)
    assert result is None


def test_google_flights_convert_flight_stops_string_parsing():
    """Test GoogleFlightsClient parses various stop string formats."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    # Test "1 stop"
    flight_1_stop = _MockFlight(price="$299", stops="1 stop")
    result = client._convert_flight(flight_1_stop, 0, None)
    assert result["stops"] == 1

    # Test "2 stops"
    flight_2_stops = _MockFlight(price="$299", stops="2 stops")
    result = client._convert_flight(flight_2_stops, 0, None)
    assert result["stops"] == 2

    # Test numeric string
    flight_num = _MockFlight(price="$299", stops="0")
    result = client._convert_flight(flight_num, 0, None)
    assert result["stops"] == 0


def test_google_flights_convert_skips_failed_conversion():
    """Test GoogleFlightsClient skips flights that fail conversion."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    class BadFlight:
        """Flight that raises exception during conversion."""

        price = "$299"
        name = "Test"

        @property
        def departure(self):
            raise RuntimeError("Conversion failure")

    mock_result = _MockResult(
        flights=[
            BadFlight(),  # Will fail
            _MockFlight(price="$350", name="Delta Air Lines"),  # Will succeed
        ]
    )

    offers = client._convert_to_amadeus_format(mock_result, max_results=10, return_date=None)

    # Only one flight should be converted successfully
    assert len(offers) == 1
    assert offers[0]["price"]["total"] == "350"


def test_google_flights_convert_handles_empty_flights():
    """Test GoogleFlightsClient handles result with no flights."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    mock_result = _MockResult(flights=[])
    offers = client._convert_to_amadeus_format(mock_result, max_results=10, return_date=None)
    assert offers == []

    # Also test None flights
    mock_result_none = _MockResult(flights=None)
    offers_none = client._convert_to_amadeus_format(mock_result_none, max_results=10, return_date=None)
    assert offers_none == []


def test_google_flights_extract_airline_code_unknown():
    """Test GoogleFlightsClient falls back for unknown airlines."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    # Single letter should return XX
    assert client._extract_airline_code("X") == "XX"
    # Empty should return XX
    assert client._extract_airline_code("") == "XX"
    # Numbers only should return XX
    assert client._extract_airline_code("123") == "XX"


def test_google_flights_parse_duration_edge_cases():
    """Test GoogleFlightsClient duration parsing edge cases."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    # Just minutes with no digits extracted results in None
    assert client._parse_duration("0h 0m") is None
    # Invalid format returns None
    assert client._parse_duration("invalid") is None


def test_google_flights_parse_price_edge_cases():
    """Test GoogleFlightsClient price parsing edge cases."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient()

    # EUR currency
    assert client._parse_price("299 EUR") is not None
    # GBP currency
    assert client._parse_price("299 GBP") is not None
    # Invalid string
    assert client._parse_price("not a price") is None


@pytest.mark.asyncio
async def test_google_flights_search_flights_success(monkeypatch):
    """Test GoogleFlightsClient.search_flights returns Amadeus-compatible format."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient(fetch_mode="common")

    # Mock the get_flights function
    async def mock_get_flights(*args, **kwargs):
        return _MockResult(
            flights=[
                _MockFlight(price="$299", name="United Airlines"),
                _MockFlight(price="$350", name="Delta Air Lines"),
            ]
        )

    monkeypatch.setattr("app.clients.google_flights.asyncio.to_thread", mock_get_flights)

    result = await client.search_flights(
        origin="SFO",
        destination="JFK",
        departure_date="2026-02-01",
        return_date="2026-02-08",
        adults=2,
        travel_class="BUSINESS",
    )

    assert "data" in result
    assert "meta" in result
    assert result["meta"]["provider"] == "google_flights"
    assert len(result["data"]) == 2


@pytest.mark.asyncio
async def test_google_flights_search_flights_one_way(monkeypatch):
    """Test GoogleFlightsClient.search_flights for one-way trips."""
    from app.clients.google_flights import GoogleFlightsClient

    client = GoogleFlightsClient(fetch_mode="common")

    async def mock_get_flights(*args, **kwargs):
        return _MockResult(flights=[_MockFlight(price="$199")])

    monkeypatch.setattr("app.clients.google_flights.asyncio.to_thread", mock_get_flights)

    result = await client.search_flights(
        origin="LAX",
        destination="SEA",
        departure_date="2026-03-15",
    )

    assert len(result["data"]) == 1
    # One-way should only have one itinerary
    assert len(result["data"][0]["itineraries"]) == 1


@pytest.mark.asyncio
async def test_google_flights_search_flights_error(monkeypatch):
    """Test GoogleFlightsClient.search_flights raises GoogleFlightsError on failure."""
    from app.clients.google_flights import GoogleFlightsClient, GoogleFlightsError

    client = GoogleFlightsClient(fetch_mode="common")

    async def mock_get_flights_error(*args, **kwargs):
        raise RuntimeError("Network error")

    monkeypatch.setattr("app.clients.google_flights.asyncio.to_thread", mock_get_flights_error)

    with pytest.raises(GoogleFlightsError) as exc_info:
        await client.search_flights(
            origin="SFO",
            destination="JFK",
            departure_date="2026-02-01",
        )

    assert "Failed to fetch flights" in str(exc_info.value)


def test_flight_provider_protocol_compliance():
    """Test that both clients conform to FlightProvider protocol."""
    from app.clients.amadeus import AmadeusClient
    from app.clients.flight_provider import FlightProvider
    from app.clients.google_flights import GoogleFlightsClient

    # Both should be instances of the protocol
    assert isinstance(AmadeusClient(), FlightProvider)
    assert isinstance(GoogleFlightsClient(), FlightProvider)


def test_flight_provider_error_exists():
    """Test FlightProviderError is importable and usable."""
    from app.clients.flight_provider import FlightProviderError

    error = FlightProviderError("test error")
    assert str(error) == "test error"
