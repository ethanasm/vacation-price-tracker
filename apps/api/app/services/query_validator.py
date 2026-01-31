"""Query validation for travel-related requests.

This module provides validation to ensure chat queries are travel-related
and within the scope of the vacation price tracker assistant.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Keywords that indicate travel-related queries
TRAVEL_KEYWORDS = frozenset(
    {
        # Trip management
        "trip",
        "trips",
        "vacation",
        "vacations",
        "travel",
        "traveling",
        "travelling",
        "journey",
        "getaway",
        # Transportation
        "flight",
        "flights",
        "fly",
        "flying",
        "airline",
        "airlines",
        "plane",
        "airport",
        "airports",
        # Accommodation
        "hotel",
        "hotels",
        "stay",
        "staying",
        "accommodation",
        "lodging",
        "room",
        "rooms",
        "resort",
        "resorts",
        # Pricing
        "price",
        "prices",
        "pricing",
        "cost",
        "costs",
        "cheap",
        "cheaper",
        "cheapest",
        "expensive",
        "budget",
        "deal",
        "deals",
        "discount",
        # Tracking
        "track",
        "tracking",
        "monitor",
        "monitoring",
        "watch",
        "watching",
        "alert",
        "alerts",
        "notify",
        "notification",
        "notifications",
        # Dates and scheduling
        "depart",
        "departure",
        "return",
        "arrive",
        "arrival",
        "date",
        "dates",
        "book",
        "booking",
        # Locations
        "destination",
        "destinations",
        "origin",
        # Actions
        "create",
        "list",
        "show",
        "delete",
        "pause",
        "resume",
        "refresh",
        "update",
        # General travel terms
        "itinerary",
        "passenger",
        "passengers",
        "adult",
        "adults",
        "traveler",
        "travelers",
        "class",
        "economy",
        "business",
        "first",
        # Airport codes (common examples)
        "iata",
        "sfo",
        "lax",
        "jfk",
        "lga",
        "ewr",
        "ord",
        "atl",
        "dfw",
        "den",
        "sea",
        "mia",
        "bos",
        "phl",
        "hnl",
        "lhr",
        "cdg",
        "nrt",
        "hnd",
    }
)

# Patterns that strongly indicate non-travel requests
NON_TRAVEL_PATTERNS = [
    # Database/system operations
    r"\b(drop|delete|truncate|alter|create)\s+(table|database|schema|index)\b",
    r"\bsql\s*(injection|query|command)\b",
    r"\b(exec|execute|run)\s*(command|script|code|sql)\b",
    # Hacking/security attacks
    r"\b(hack|exploit|inject|bypass|crack)\b",
    r"\bpassword\s*(hash|crack|reset|dump)\b",
    r"\b(shell|terminal|bash|cmd|powershell)\s*(command|access)\b",
    # Code execution
    r"\b(eval|exec|subprocess|os\.system|import\s+os)\b",
    r"\bwrite\s*(file|code|script)\s+to\b",
    # System access
    r"\b(root|admin|sudo|privilege|escalat)\b",
    r"\baccess\s+(server|system|database|credentials)\b",
    # File operations outside scope
    r"\b(read|write|delete|modify)\s+(file|files|directory)\b",
]

# Compiled regex patterns for efficiency
_NON_TRAVEL_COMPILED = [re.compile(pattern, re.IGNORECASE) for pattern in NON_TRAVEL_PATTERNS]


@dataclass
class QueryValidationResult:
    """Result of query validation.

    Attributes:
        is_valid: Whether the query is within scope.
        reason: Explanation if query is not valid.
        confidence: Confidence score (0.0 to 1.0).
    """

    is_valid: bool
    reason: str | None = None
    confidence: float = 1.0


def _normalize_query(query: str) -> str:
    """Normalize query text for analysis."""
    return query.lower().strip()


def _contains_travel_keywords(query: str) -> tuple[bool, int]:
    """Check if query contains travel-related keywords.

    Returns:
        Tuple of (has_keywords, keyword_count).
    """
    normalized = _normalize_query(query)
    words = set(re.findall(r"\b\w+\b", normalized))
    matches = words & TRAVEL_KEYWORDS
    return len(matches) > 0, len(matches)


def _matches_non_travel_pattern(query: str) -> tuple[bool, str | None]:
    """Check if query matches non-travel patterns.

    Returns:
        Tuple of (matches, matched_pattern_description).
    """
    for pattern in _NON_TRAVEL_COMPILED:
        if pattern.search(query):
            return True, pattern.pattern
    return False, None


def _is_greeting_or_simple(query: str) -> bool:
    """Check if query is a simple greeting or acknowledgment.

    These should be allowed even without travel keywords.
    """
    simple_patterns = [
        r"^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))[\s!.,]*$",
        r"^(thanks|thank\s+you|ok|okay|sure|yes|no|bye|goodbye)[\s!.,]*$",
        r"^(help|what\s+can\s+you\s+do|how\s+do\s+you\s+work)[\s!?.,]*$",
    ]
    normalized = _normalize_query(query)
    for pattern in simple_patterns:
        if re.match(pattern, normalized, re.IGNORECASE):
            return True
    return False


def validate_query(query: str) -> QueryValidationResult:
    """Validate if a query is within the travel assistant's scope.

    Args:
        query: The user's query text.

    Returns:
        QueryValidationResult indicating if the query is valid.
    """
    if not query or not query.strip():
        return QueryValidationResult(
            is_valid=False,
            reason="Empty query provided.",
            confidence=1.0,
        )

    normalized = _normalize_query(query)

    # Check for explicitly malicious/non-travel patterns first
    matches_non_travel, matched_pattern = _matches_non_travel_pattern(normalized)
    if matches_non_travel:
        logger.warning("Query matched non-travel pattern: %s", matched_pattern)
        return QueryValidationResult(
            is_valid=False,
            reason="This request is outside my scope as a travel assistant.",
            confidence=0.95,
        )

    # Allow simple greetings and help requests
    if _is_greeting_or_simple(normalized):
        return QueryValidationResult(
            is_valid=True,
            confidence=1.0,
        )

    # Check for travel-related keywords
    has_travel_keywords, keyword_count = _contains_travel_keywords(normalized)

    if has_travel_keywords:
        # More keywords = higher confidence
        confidence = min(0.7 + (keyword_count * 0.1), 1.0)
        return QueryValidationResult(
            is_valid=True,
            confidence=confidence,
        )

    # Short queries without travel keywords might still be contextual follow-ups
    # Allow them but with lower confidence
    if len(normalized.split()) <= 5:
        return QueryValidationResult(
            is_valid=True,
            confidence=0.5,
        )

    # Longer queries without any travel context are likely off-topic
    # But we'll still allow them and let the LLM handle the response
    # The system prompt will guide it to redirect non-travel queries
    logger.info("Query has no travel keywords but allowing: %s", query[:50])
    return QueryValidationResult(
        is_valid=True,
        reason="Query may be off-topic but allowing LLM to respond.",
        confidence=0.3,
    )


def is_query_in_scope(query: str) -> bool:
    """Simple check if query is within travel scope.

    This is a convenience function that returns just a boolean.

    Args:
        query: The user's query text.

    Returns:
        True if query is valid, False otherwise.
    """
    result = validate_query(query)
    return result.is_valid
