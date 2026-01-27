"""Google Flights client using fast-flights library."""

from __future__ import annotations

import asyncio
import logging
import uuid
from decimal import Decimal
from typing import Any

from fast_flights import FlightData, Passengers, Result, get_flights

from app.core.config import settings

logger = logging.getLogger(__name__)

# Cabin class mapping from internal format to fast-flights format
CABIN_CLASS_MAP = {
    "ECONOMY": "economy",
    "PREMIUM_ECONOMY": "premium-economy",
    "BUSINESS": "business",
    "FIRST": "first",
}


class GoogleFlightsError(Exception):
    """Base error for Google Flights client failures."""


class GoogleFlightsClient:
    """Google Flights client using fast-flights library for scraping."""

    def __init__(self, fetch_mode: str | None = None) -> None:
        """
        Initialize the Google Flights client.

        Args:
            fetch_mode: The fetch mode to use. If None, uses FAST_FLIGHTS_FETCH_MODE env var.
                Options:
                - "common": Direct requests only (your IP exposed)
                - "fallback": Tries direct first, serverless if fails
                - "local": Uses local Playwright installation
                Note: "force-fallback" (serverless Playwright) is currently broken upstream.
                See: https://github.com/AWeirdDev/flights/issues/53
        """
        self._fetch_mode = fetch_mode or settings.fast_flights_fetch_mode

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
        Search for flight offers using Google Flights via fast-flights.

        Args:
            origin: IATA airport code (e.g., "SFO")
            destination: IATA airport code (e.g., "JFK")
            departure_date: ISO format date (e.g., "2026-02-01")
            return_date: ISO format date for round trip, None for one-way
            adults: Number of adult passengers (1-9)
            travel_class: ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST
            non_stop: If True, only return non-stop flights (not fully supported)
            max_results: Maximum number of flight offers to return

        Returns:
            dict with "data" array of flight offers in Amadeus-compatible format

        Raises:
            GoogleFlightsError: If the scraping request fails
        """
        # Build flight data for the search
        flight_data = [
            FlightData(
                date=departure_date,
                from_airport=origin.upper(),
                to_airport=destination.upper(),
            )
        ]

        # Add return leg for round trips
        if return_date:
            flight_data.append(
                FlightData(
                    date=return_date,
                    from_airport=destination.upper(),
                    to_airport=origin.upper(),
                )
            )

        trip_type = "round-trip" if return_date else "one-way"
        seat_class = CABIN_CLASS_MAP.get(travel_class.upper(), "economy")

        logger.info(
            "Searching Google Flights: %s -> %s, %s, %s, %d adults, %s",
            origin,
            destination,
            departure_date,
            trip_type,
            adults,
            flight_data
        )

        try:
            # Run synchronous fast-flights in thread pool to avoid blocking
            result = await asyncio.to_thread(
                get_flights,
                flight_data=flight_data,
                trip=trip_type,
                seat=seat_class,
                passengers=Passengers(adults=adults),
                fetch_mode=self._fetch_mode,
            )
        except Exception as exc:
            logger.warning("Google Flights search failed: %s", exc)
            raise GoogleFlightsError(f"Failed to fetch flights: {exc}") from exc

        # Convert to Amadeus-compatible format
        offers = self._convert_to_amadeus_format(result, max_results, return_date, origin, destination)
        logger.info("Found %d flight offers from Google Flights", len(offers))

        return {
            "data": offers,
            "meta": {
                "provider": "google_flights",
                "count": len(offers),
            },
        }

    def _convert_to_amadeus_format(
        self,
        result: Result,
        max_results: int,
        return_date: str | None,
        origin: str | None = None,
        destination: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Convert fast-flights Result to Amadeus-compatible format.

        Args:
            result: The fast-flights Result object
            max_results: Maximum number of offers to return
            return_date: Return date if round trip
            origin: Origin airport code
            destination: Destination airport code

        Returns:
            List of flight offers in Amadeus-compatible format
        """
        offers = []

        # fast-flights returns flights in result.flights
        flights = getattr(result, "flights", []) or []

        for i, flight in enumerate(flights[:max_results]):
            try:
                offer = self._convert_flight(flight, i, return_date, origin, destination)
                if offer:
                    offers.append(offer)
            except Exception as exc:
                logger.debug("Failed to convert flight %d: %s", i, exc)
                continue

        return offers

    def _convert_flight(
        self,
        flight: Any,
        index: int,
        return_date: str | None,
        origin: str | None = None,
        destination: str | None = None,
    ) -> dict[str, Any] | None:
        """
        Convert a single fast-flights flight to Amadeus format.

        Args:
            flight: A fast-flights flight object
            index: Index for generating unique ID
            return_date: Return date if round trip
            origin: Origin airport code
            destination: Destination airport code

        Returns:
            Flight offer dict in Amadeus format, or None if conversion fails
        """
        # Extract price - fast-flights uses flight.price as a string like "$299"
        price_str = getattr(flight, "price", None)
        if not price_str:
            return None

        # Parse price string (e.g., "$299" or "299 USD")
        price = self._parse_price(price_str)
        if price is None:
            return None

        # Extract airline info
        airline_name = getattr(flight, "name", None) or "Unknown"

        # Try to extract airline code from the name or use first two letters
        airline_code = self._extract_airline_code(airline_name)

        # Extract timing info
        departure_time = getattr(flight, "departure", None)
        arrival_time = getattr(flight, "arrival", None)

        # Extract duration
        duration_str = getattr(flight, "duration", None)
        duration_minutes = self._parse_duration(duration_str)

        # Extract stops
        stops = getattr(flight, "stops", 0)
        if isinstance(stops, str):
            if "nonstop" in stops.lower() or stops == "0":
                stops = 0
            else:
                # Try to extract number from string like "1 stop"
                try:
                    stops = int("".join(filter(str.isdigit, stops)) or "1")
                except ValueError:
                    stops = 1

        # Generate flight number (carrier code + index-based number)
        flight_number = str(100 + index)

        # Build itinerary segments with full airport info
        outbound_segment = {
            "departure": {
                "iataCode": origin.upper() if origin else None,
                "at": departure_time,
            } if departure_time or origin else {},
            "arrival": {
                "iataCode": destination.upper() if destination else None,
                "at": arrival_time,
            } if arrival_time or destination else {},
            "carrierCode": airline_code,
            "number": flight_number,
            "operating": {"carrierCode": airline_code},
            "duration": f"PT{duration_minutes}M" if duration_minutes else None,
        }

        itineraries = [
            {
                "duration": f"PT{duration_minutes}M" if duration_minutes else None,
                "segments": [outbound_segment],
            }
        ]

        # Add return itinerary for round trips
        if return_date:
            return_segment = {
                "departure": {
                    "iataCode": destination.upper() if destination else None,
                    "at": None,  # We don't have return flight times from fast-flights
                },
                "arrival": {
                    "iataCode": origin.upper() if origin else None,
                    "at": None,
                },
                "carrierCode": airline_code,
                "number": str(200 + index),
                "operating": {"carrierCode": airline_code},
            }
            itineraries.append(
                {
                    "duration": None,
                    "segments": [return_segment],
                }
            )

        return {
            "id": str(uuid.uuid4())[:8],
            "price": {
                "total": str(price),
                "grandTotal": str(price),
                "currency": "USD",
            },
            "validatingAirlineCodes": [airline_code] if airline_code else [],
            "itineraries": itineraries,
            "travelerPricings": [],
            # Additional fields for easier access
            "airline_name": airline_name,
            "airline_code": airline_code,
            "departure_time": departure_time,
            "arrival_time": arrival_time,
            "duration_minutes": duration_minutes,
            "stops": stops,
        }

    def _parse_price(self, price_str: str) -> Decimal | None:
        """Parse price string like '$299' or '299 USD' to Decimal."""
        if not price_str:
            return None

        # Remove currency symbols and whitespace
        cleaned = price_str.replace("$", "").replace(",", "").strip()

        # Remove currency code if present
        for code in ["USD", "EUR", "GBP"]:
            cleaned = cleaned.replace(code, "").strip()

        try:
            return Decimal(cleaned)
        except Exception:
            return None

    def _parse_duration(self, duration_str: str | None) -> int | None:
        """Parse duration string like '5h 30m' to minutes."""
        if not duration_str:
            return None

        try:
            minutes = 0
            duration_str = duration_str.lower()

            # Extract hours
            if "h" in duration_str:
                hours_part = duration_str.split("h")[0].strip()
                hours = int("".join(filter(str.isdigit, hours_part)) or "0")
                minutes += hours * 60

            # Extract minutes
            if "m" in duration_str:
                if "h" in duration_str:
                    mins_part = duration_str.split("h")[1].split("m")[0].strip()
                else:
                    mins_part = duration_str.split("m")[0].strip()
                mins = int("".join(filter(str.isdigit, mins_part)) or "0")
                minutes += mins

            return minutes if minutes > 0 else None
        except Exception:
            return None

    def _extract_airline_code(self, airline_name: str) -> str:
        """
        Extract or derive airline IATA code from airline name.

        This is a best-effort mapping for common airlines.
        """
        # Common airline name to code mapping
        airline_codes = {
            "united": "UA",
            "american": "AA",
            "delta": "DL",
            "southwest": "WN",
            "jetblue": "B6",
            "alaska": "AS",
            "spirit": "NK",
            "frontier": "F9",
            "hawaiian": "HA",
            "sun country": "SY",
            "british airways": "BA",
            "lufthansa": "LH",
            "air france": "AF",
            "klm": "KL",
            "emirates": "EK",
            "qatar": "QR",
            "singapore": "SQ",
            "cathay": "CX",
            "ana": "NH",
            "jal": "JL",
            "korean air": "KE",
            "air canada": "AC",
            "westjet": "WS",
            "qantas": "QF",
            "virgin atlantic": "VS",
            "virgin australia": "VA",
            "icelandair": "FI",
            "norwegian": "DY",
            "ryanair": "FR",
            "easyjet": "U2",
            "vueling": "VY",
            "iberia": "IB",
            "tap portugal": "TP",
            "swiss": "LX",
            "austrian": "OS",
            "brussels": "SN",
            "aer lingus": "EI",
            "finnair": "AY",
            "sas": "SK",
            "turkish": "TK",
            "etihad": "EY",
            "royal jordanian": "RJ",
            "el al": "LY",
            "egyptair": "MS",
            "south african": "SA",
            "copa": "CM",
            "avianca": "AV",
            "latam": "LA",
            "aeromexico": "AM",
            "interjet": "4O",
            "volaris": "Y4",
            "vivaaerobus": "VB",
        }

        name_lower = airline_name.lower()
        for name, code in airline_codes.items():
            if name in name_lower:
                return code

        # Fallback: use first two uppercase letters
        letters = [c for c in airline_name if c.isalpha()]
        if len(letters) >= 2:
            return (letters[0] + letters[1]).upper()

        return "XX"  # Unknown airline


# Singleton instance
google_flights_client = GoogleFlightsClient()
