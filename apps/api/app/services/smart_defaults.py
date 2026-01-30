"""Smart defaults inference utilities for trip creation.

This module provides:
- infer_return_date: Parse trip duration from natural language
- suggest_airports: Suggest airport codes for a city
- recommend_threshold: Calculate notification threshold from price
- get_default_adults: Get default adult count from user's trips
"""

from __future__ import annotations

import logging
import re
from datetime import date, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Common duration patterns (number + unit)
# Note: Order matters - more specific patterns should come before general ones
DURATION_PATTERNS = [
    # "a week", "one week", "1 week"
    (r"\b(?:a|one|1)\s+week\b", 7),
    (r"\b(\d+)\s*weeks?\b", None),  # Captures number
    # Long weekend (typically 4 days: Fri-Mon) - must be before "weekend"
    (r"\blong\s+weekend\b", 4),
    # "a weekend", "the weekend"
    (r"\b(?:a|the)?\s*weekend\b", 3),
    # "a day", "one day", "1 day"
    (r"\b(?:a|one|1)\s+day\b", 1),
    (r"\b(\d+)\s*days?\b", None),  # Captures number
    # "a night", "one night", "1 night"
    (r"\b(?:a|one|1)\s+night\b", 2),  # 1 night = 2 days trip
    (r"\b(\d+)\s*nights?\b", None),  # Captures number (nights + 1 = days)
    # Fortnight (14 days)
    (r"\bfortnight\b", 14),
]

# Airport codes for major cities (sorted by airport importance)
# This is a simplified mapping - in production, use an airport database
CITY_AIRPORTS: dict[str, list[str]] = {
    # US Cities
    "san francisco": ["SFO", "OAK", "SJC"],
    "sf": ["SFO", "OAK", "SJC"],
    "bay area": ["SFO", "OAK", "SJC"],
    "oakland": ["OAK", "SFO", "SJC"],
    "san jose": ["SJC", "SFO", "OAK"],
    "los angeles": ["LAX", "BUR", "SNA", "ONT", "LGB"],
    "la": ["LAX", "BUR", "SNA", "ONT", "LGB"],
    "new york": ["JFK", "EWR", "LGA"],
    "nyc": ["JFK", "EWR", "LGA"],
    "new york city": ["JFK", "EWR", "LGA"],
    "manhattan": ["JFK", "LGA", "EWR"],
    "chicago": ["ORD", "MDW"],
    "miami": ["MIA", "FLL"],
    "boston": ["BOS"],
    "seattle": ["SEA"],
    "denver": ["DEN"],
    "atlanta": ["ATL"],
    "dallas": ["DFW", "DAL"],
    "houston": ["IAH", "HOU"],
    "phoenix": ["PHX"],
    "las vegas": ["LAS"],
    "vegas": ["LAS"],
    "orlando": ["MCO", "SFB"],
    "washington": ["DCA", "IAD", "BWI"],
    "dc": ["DCA", "IAD", "BWI"],
    "washington dc": ["DCA", "IAD", "BWI"],
    "honolulu": ["HNL"],
    "hawaii": ["HNL", "OGG", "LIH", "KOA"],
    "maui": ["OGG"],
    "kauai": ["LIH"],
    "big island": ["KOA"],
    "san diego": ["SAN"],
    "austin": ["AUS"],
    "portland": ["PDX"],
    "minneapolis": ["MSP"],
    "detroit": ["DTW"],
    "philadelphia": ["PHL"],
    "charlotte": ["CLT"],
    "salt lake city": ["SLC"],
    "tampa": ["TPA"],
    "anchorage": ["ANC"],
    "alaska": ["ANC", "FAI"],
    # International Cities
    "london": ["LHR", "LGW", "STN"],
    "paris": ["CDG", "ORY"],
    "tokyo": ["NRT", "HND"],
    "rome": ["FCO", "CIA"],
    "amsterdam": ["AMS"],
    "barcelona": ["BCN"],
    "madrid": ["MAD"],
    "dublin": ["DUB"],
    "frankfurt": ["FRA"],
    "munich": ["MUC"],
    "zurich": ["ZRH"],
    "geneva": ["GVA"],
    "sydney": ["SYD"],
    "melbourne": ["MEL"],
    "auckland": ["AKL"],
    "singapore": ["SIN"],
    "hong kong": ["HKG"],
    "bangkok": ["BKK"],
    "dubai": ["DXB"],
    "cancun": ["CUN"],
    "mexico city": ["MEX"],
    "toronto": ["YYZ"],
    "vancouver": ["YVR"],
    "montreal": ["YUL"],
    "lisbon": ["LIS"],
    "athens": ["ATH"],
    "istanbul": ["IST"],
    "cairo": ["CAI"],
    "cape town": ["CPT"],
    "rio de janeiro": ["GIG"],
    "sao paulo": ["GRU"],
    "buenos aires": ["EZE"],
    "lima": ["LIM"],
    "bogota": ["BOG"],
    "reykjavik": ["KEF"],
    "iceland": ["KEF"],
}

# Default threshold percentage (recommend 10% below current price)
DEFAULT_THRESHOLD_PERCENTAGE = 0.10

# Default number of adults if no history
DEFAULT_ADULTS = 1


def infer_return_date(description: str, depart_date: date) -> date | None:
    """Infer return date from a natural language trip description.

    Parses expressions like "a week in Hawaii", "3 days in Paris",
    "long weekend in Vegas", etc.

    Args:
        description: Natural language trip description.
        depart_date: The departure date.

    Returns:
        Calculated return date, or None if no duration found.

    Examples:
        >>> from datetime import date
        >>> infer_return_date("a week in Hawaii", date(2026, 3, 15))
        datetime.date(2026, 3, 22)
        >>> infer_return_date("5 days in Paris", date(2026, 3, 15))
        datetime.date(2026, 3, 20)
        >>> infer_return_date("long weekend in Vegas", date(2026, 3, 15))
        datetime.date(2026, 3, 19)
    """
    description_lower = description.lower()

    for pattern, fixed_days in DURATION_PATTERNS:
        match = re.search(pattern, description_lower, re.IGNORECASE)
        if match:
            if fixed_days is not None:
                days = fixed_days
            else:
                # Extract number from capture group
                try:
                    num = int(match.group(1))
                except (IndexError, ValueError):
                    continue

                # Determine unit from pattern
                if "night" in pattern:
                    # N nights = N+1 days (e.g., 3 nights = 4 day trip)
                    days = num + 1
                elif "week" in pattern:
                    days = num * 7
                else:
                    # Days
                    days = num

            logger.debug(
                "Inferred %d days from '%s' (matched pattern: %s)",
                days,
                description,
                pattern,
            )
            return depart_date + timedelta(days=days)

    logger.debug("No duration pattern found in: '%s'", description)
    return None


def suggest_airports(city_name: str) -> list[str]:
    """Suggest airport IATA codes for a city name.

    Returns airports ordered by preference (primary first).

    Args:
        city_name: City name, state, or region.

    Returns:
        List of IATA airport codes, or empty list if not found.

    Examples:
        >>> suggest_airports("San Francisco")
        ['SFO', 'OAK', 'SJC']
        >>> suggest_airports("NYC")
        ['JFK', 'EWR', 'LGA']
        >>> suggest_airports("Unknown City")
        []
    """
    normalized = city_name.lower().strip()

    # Direct match
    if normalized in CITY_AIRPORTS:
        return CITY_AIRPORTS[normalized].copy()

    # Partial match (city name contains the query)
    for city, airports in CITY_AIRPORTS.items():
        if normalized in city or city in normalized:
            return airports.copy()

    logger.debug("No airports found for city: '%s'", city_name)
    return []


def recommend_threshold(current_price: float, percentage: float | None = None) -> float:
    """Calculate recommended notification threshold based on current price.

    Recommends a threshold that is a percentage below the current price,
    rounded to the nearest $10 for nice numbers.

    Args:
        current_price: Current total trip price.
        percentage: Percentage discount to suggest (default: 10%).

    Returns:
        Recommended threshold price, rounded to nearest $10.

    Examples:
        >>> recommend_threshold(1500)  # 10% below $1500 = $1350
        1350.0
        >>> recommend_threshold(1234)  # 10% below = $1110.60 -> rounds to $1110
        1110.0
        >>> recommend_threshold(100, percentage=0.20)  # 20% below = $80
        80.0
    """
    if current_price <= 0:
        return 0.0

    if percentage is None:
        percentage = DEFAULT_THRESHOLD_PERCENTAGE

    # Calculate discounted price
    discounted = current_price * (1 - percentage)

    # Round to nearest $10
    rounded = round(discounted / 10) * 10

    logger.debug(
        "Recommend threshold: $%.2f -> $%.2f (%.0f%% below, rounded)",
        current_price,
        rounded,
        percentage * 100,
    )

    return float(rounded)


async def get_default_adults(user_id: str, db: AsyncSession) -> int:
    """Get default number of adults from user's most recent trip.

    Looks at the user's trip history and returns the most recently used
    adult count. Falls back to 1 if no trips exist.

    Args:
        user_id: UUID of the user.
        db: Database session.

    Returns:
        Number of adults from most recent trip, or 1 if no trips.
    """
    from uuid import UUID

    from sqlalchemy import select

    from app.models.trip import Trip

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        logger.warning("Invalid user_id format: %s", user_id[:8] if user_id else "None")
        return DEFAULT_ADULTS

    # Get most recent trip for this user
    result = await db.execute(
        select(Trip.adults).where(Trip.user_id == user_uuid).order_by(Trip.created_at.desc()).limit(1)
    )
    row = result.scalars().first()

    if row is not None:
        logger.debug("Default adults from history: %d (user: %s)", row, user_id[:8])
        return row

    logger.debug("No trips found for user: %s, using default: %d", user_id[:8], DEFAULT_ADULTS)
    return DEFAULT_ADULTS


def parse_trip_duration_text(text: str) -> int | None:
    """Parse just the duration from text without calculating return date.

    Useful for extracting the numeric duration when departure date isn't known.

    Args:
        text: Natural language text containing duration.

    Returns:
        Number of days, or None if no duration found.

    Examples:
        >>> parse_trip_duration_text("a week in hawaii")
        7
        >>> parse_trip_duration_text("5 nights in Paris")
        6
        >>> parse_trip_duration_text("no duration here")
        None
    """
    text_lower = text.lower()

    for pattern, fixed_days in DURATION_PATTERNS:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            if fixed_days is not None:
                return fixed_days
            else:
                try:
                    num = int(match.group(1))
                except (IndexError, ValueError):
                    continue

                if "night" in pattern:
                    return num + 1
                elif "week" in pattern:
                    return num * 7
                else:
                    return num

    return None


class SmartDefaults:
    """Utility class providing smart default inference methods.

    This class wraps the module-level functions for convenient dependency
    injection and testing.
    """

    def __init__(self, db: AsyncSession | None = None) -> None:
        """Initialize with optional database session.

        Args:
            db: Optional database session for user-specific defaults.
        """
        self._db = db

    def infer_return_date(self, description: str, depart_date: date) -> date | None:
        """Infer return date from description. See module-level function."""
        return infer_return_date(description, depart_date)

    def suggest_airports(self, city_name: str) -> list[str]:
        """Suggest airports for city. See module-level function."""
        return suggest_airports(city_name)

    def recommend_threshold(self, current_price: float, percentage: float | None = None) -> float:
        """Recommend threshold price. See module-level function."""
        return recommend_threshold(current_price, percentage)

    async def get_default_adults(self, user_id: str) -> int:
        """Get default adults from user history. See module-level function."""
        if self._db is None:
            return DEFAULT_ADULTS
        return await get_default_adults(user_id, self._db)

    def parse_duration(self, text: str) -> int | None:
        """Parse duration from text. See module-level parse_trip_duration_text."""
        return parse_trip_duration_text(text)
