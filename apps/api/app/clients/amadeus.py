"""Amadeus API client for flight and hotel data."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://test.api.amadeus.com"
TOKEN_EXPIRY_SAFETY_SECONDS = 30


class AmadeusClientError(Exception):
    """Base error for Amadeus client failures."""


class AmadeusAuthError(AmadeusClientError):
    """Raised when authentication with Amadeus fails."""


class AmadeusRequestError(AmadeusClientError):
    """Raised when an Amadeus API request fails."""


class AmadeusClient:
    """Amadeus client for flight and hotel searches."""

    def __init__(self, base_url: str | None = None, timeout_seconds: float = 30.0) -> None:
        self._base_url = (base_url or settings.amadeus_base_url or DEFAULT_BASE_URL).rstrip("/")
        self._timeout = httpx.Timeout(timeout_seconds)
        self._access_token: str | None = None
        self._access_token_expiry: float = 0.0

    def _token_is_valid(self) -> bool:
        return self._access_token is not None and time.time() < self._access_token_expiry

    async def _fetch_access_token(self) -> str:
        if not settings.amadeus_api_key or not settings.amadeus_api_secret:
            raise AmadeusAuthError("Amadeus credentials are not configured")

        data = {
            "grant_type": "client_credentials",
            "client_id": settings.amadeus_api_key,
            "client_secret": settings.amadeus_api_secret,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/v1/security/oauth2/token",
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if response.status_code >= 400:
            logger.warning(
                "Amadeus token request failed: status=%s body=%s",
                response.status_code,
                response.text,
            )
            raise AmadeusAuthError("Failed to fetch Amadeus access token")

        payload = response.json()
        access_token = payload.get("access_token")
        expires_in = payload.get("expires_in", 0)

        if not access_token:
            raise AmadeusAuthError("Missing access token in Amadeus response")

        expiry_buffer = max(int(expires_in) - TOKEN_EXPIRY_SAFETY_SECONDS, 0)
        self._access_token = access_token
        self._access_token_expiry = time.time() + expiry_buffer
        return access_token

    async def _get_access_token(self) -> str:
        if self._token_is_valid():
            return self._access_token
        return await self._fetch_access_token()

    async def _authorized_get(self, path: str, params: dict[str, str]) -> httpx.Response:
        token = await self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(f"{self._base_url}{path}", params=params, headers=headers)

            if response.status_code == 401:
                token = await self._fetch_access_token()
                headers = {"Authorization": f"Bearer {token}"}
                response = await client.get(f"{self._base_url}{path}", params=params, headers=headers)

        if response.status_code >= 400:
            logger.warning(
                "Amadeus request failed: status=%s body=%s",
                response.status_code,
                response.text,
            )
            raise AmadeusRequestError("Amadeus request failed")

        return response

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        travel_class: str = "ECONOMY",
        non_stop: bool = False,
        max_results: int = 10,
    ) -> dict[str, Any]:
        """
        Search for flight offers using Amadeus Flight Offers Search API v2.

        Use this for specific date searches when the user has decided on travel dates.
        Returns real-time pricing and availability with full flight details.

        Args:
            origin: IATA airport code (e.g., "SFO")
            destination: IATA airport code (e.g., "MCO")
            departure_date: ISO format date (e.g., "2026-02-01")
            return_date: ISO format date for round trip, None for one-way
            adults: Number of adult passengers (1-9)
            travel_class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST
            non_stop: If True, only return non-stop flights
            max_results: Maximum number of flight offers to return (1-250)

        Returns:
            dict with "data" array of flight offers and "meta" metadata

        Raises:
            AmadeusRequestError: If the API request fails
        """
        params = {
            "originLocationCode": origin.upper(),
            "destinationLocationCode": destination.upper(),
            "departureDate": departure_date,
            "adults": str(adults),
            "travelClass": travel_class.upper(),
            "max": str(max_results),
            "currencyCode": "USD",
        }
        if return_date:
            params["returnDate"] = return_date
        if non_stop:
            params["nonStop"] = "true"

        response = await self._authorized_get("/v2/shopping/flight-offers", params)
        return response.json()

    async def search_flight_cheapest_dates(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        one_way: bool = False,
        non_stop: bool = False,
        max_price: int | None = None,
    ) -> dict[str, Any]:
        """
        Search for cheapest flight dates using Amadeus Flight Cheapest Date Search API v1.

        Use this for flexible date searches when the user wants to find the best day to fly.
        Returns a calendar grid of prices by date. Note: Uses cached data, not all routes available.

        Args:
            origin: IATA airport code
            destination: IATA airport code
            departure_date: Start of date range to search (ISO format)
            one_way: If True, search one-way only
            non_stop: If True, only non-stop flights
            max_price: Maximum price filter in USD

        Returns:
            dict with "data" array of date-price combinations

        Raises:
            AmadeusRequestError: If the API request fails
        """
        params = {
            "origin": origin.upper(),
            "destination": destination.upper(),
            "departureDate": departure_date,
        }
        if one_way:
            params["oneWay"] = "true"
        if non_stop:
            params["nonStop"] = "true"
        if max_price:
            params["maxPrice"] = str(max_price)

        response = await self._authorized_get("/v1/shopping/flight-dates", params)
        return response.json()


    async def search_airports(
        self,
        keyword: str,
        max_results: int = 10,
    ) -> dict[str, Any]:
        """
        Search for airports and cities using Amadeus Location Search API v1.

        Args:
            keyword: Search query (city name, airport name, or IATA code).
            max_results: Maximum results to return (default: 10).

        Returns:
            dict with "data" array of location entries.

        Raises:
            AmadeusRequestError: If the API request fails.
        """
        params = {
            "subType": "AIRPORT,CITY",
            "keyword": keyword.strip().upper(),
            "page[limit]": str(max_results),
            "view": "LIGHT",
        }
        response = await self._authorized_get("/v1/reference-data/locations", params)
        return response.json()

    async def search_hotels_by_city(
        self,
        city_code: str,
        radius: int = 20,
        radius_unit: str = "KM",
        hotel_source: str = "ALL",
    ) -> dict[str, Any]:
        """
        List hotels in a city using Amadeus Hotel List API v1.

        Returns hotel IDs that can be passed to search_hotel_offers().

        Args:
            city_code: IATA city code (e.g., "MCO", "NYC")
            radius: Search radius from city center
            radius_unit: "KM" or "MILE"
            hotel_source: "ALL", "GDS", or "DIRECTCHAIN"

        Returns:
            dict with "data" array of hotel entries (each has "hotelId", "name", etc.)
        """
        params = {
            "cityCode": city_code.upper(),
            "radius": str(radius),
            "radiusUnit": radius_unit.upper(),
            "hotelSource": hotel_source.upper(),
        }
        response = await self._authorized_get("/v1/reference-data/locations/hotels/by-city", params)
        return response.json()

    async def search_hotel_offers(
        self,
        hotel_ids: list[str],
        check_in_date: str,
        check_out_date: str,
        adults: int = 1,
        rooms: int = 1,
        currency: str = "USD",
    ) -> dict[str, Any]:
        """
        Search for hotel offers using Amadeus Hotel Search API v3.

        Args:
            hotel_ids: List of Amadeus hotel IDs (from search_hotels_by_city)
            check_in_date: ISO format date (e.g., "2026-03-12")
            check_out_date: ISO format date (e.g., "2026-03-14")
            adults: Number of adult guests per room (1-9)
            rooms: Number of rooms (1-9)
            currency: Currency code for pricing

        Returns:
            dict with "data" array of hotel offers
        """
        if not hotel_ids:
            return {"data": []}

        params = {
            "hotelIds": ",".join(hotel_ids),
            "checkInDate": check_in_date,
            "checkOutDate": check_out_date,
            "adults": str(adults),
            "roomQuantity": str(rooms),
            "currency": currency,
        }
        response = await self._authorized_get("/v3/shopping/hotel-offers", params)
        return response.json()

    async def search_hotels(
        self,
        city_code: str,
        check_in_date: str,
        check_out_date: str,
        adults: int = 1,
        rooms: int = 1,
        max_hotels: int = 20,
    ) -> dict[str, Any]:
        """
        Combined hotel search: finds hotels in a city then fetches offers.

        This is the main entry point for hotel searches, combining the two-step
        Amadeus hotel API flow into a single call.

        Args:
            city_code: IATA city code (e.g., "MCO")
            check_in_date: ISO check-in date
            check_out_date: ISO check-out date
            adults: Guests per room
            rooms: Number of rooms
            max_hotels: Max hotel IDs to query for offers

        Returns:
            dict with "data" array of hotel offers and metadata
        """
        # Step 1: Get hotel IDs in the city
        hotel_list = await self.search_hotels_by_city(city_code)
        hotels = hotel_list.get("data", [])

        if not hotels:
            return {"data": [], "meta": {"count": 0, "provider": "amadeus"}}

        # Extract hotel IDs, capped at max_hotels
        hotel_ids = [h["hotelId"] for h in hotels if h.get("hotelId")][:max_hotels]

        if not hotel_ids:
            return {"data": [], "meta": {"count": 0, "provider": "amadeus"}}

        # Step 2: Get offers for those hotels
        offers_response = await self.search_hotel_offers(
            hotel_ids=hotel_ids,
            check_in_date=check_in_date,
            check_out_date=check_out_date,
            adults=adults,
            rooms=rooms,
        )

        offers_data = offers_response.get("data", [])
        offers_response.setdefault("meta", {})
        offers_response["meta"]["count"] = len(offers_data)
        offers_response["meta"]["provider"] = "amadeus"
        return offers_response


amadeus_client = AmadeusClient()
