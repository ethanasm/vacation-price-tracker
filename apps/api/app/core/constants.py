"""
Application-wide constants.

Organized by domain:
- Auth constants (Phase 1)
- Trip/tracking constants (Phase 1-3)
"""

from enum import StrEnum

# =============================================================================
# AUTH CONSTANTS (Phase 1)
# =============================================================================


class CookieNames:
    """Cookie name constants (namespace only, not passed as values)."""

    ACCESS_TOKEN = "access_token_cookie"
    REFRESH_TOKEN = "refresh_token_cookie"
    CSRF_TOKEN = "csrf_token"


class HeaderNames:
    """Header name constants (namespace only, not passed as values)."""

    CSRF_TOKEN = "X-CSRF-Token"


class JWTClaims:
    """Standard JWT claim names (namespace only, not passed as values)."""

    SUBJECT = "sub"  # User ID
    ISSUED_AT = "iat"
    EXPIRATION = "exp"
    JWT_ID = "jti"  # Unique token identifier
    TYPE = "type"  # "access" or "refresh"


class TokenType(StrEnum):
    """Token type identifiers (used in function signatures and comparisons)."""

    ACCESS = "access"
    REFRESH = "refresh"


# =============================================================================
# TRIP/TRACKING CONSTANTS (Phase 1-3)
# =============================================================================


class TripStatus(StrEnum):
    """Trip tracking status values."""

    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    EXPIRED = "expired"  # Travel dates have passed; tracking stopped (system-set)


class RefreshFrequency(StrEnum):
    """Valid refresh frequency options (Phase 3: scheduled tracking)."""

    DAILY = "daily"
    EVERY_3_DAYS = "every_3_days"
    WEEKLY = "weekly"


# =============================================================================
# NOTIFICATION CONSTANTS (Phase 1)
# =============================================================================


class ThresholdType(StrEnum):
    """Notification threshold types for price alerts."""

    TRIP_TOTAL = "trip_total"
    FLIGHT_TOTAL = "flight_total"
    HOTEL_TOTAL = "hotel_total"


class NotificationStatus(StrEnum):
    """Delivery status for a queued notification (outbox) row."""

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


# =============================================================================
# FLIGHT PREFERENCES CONSTANTS (Phase 1)
# =============================================================================


class StopsMode(StrEnum):
    """Flight stops preference modes."""

    NONSTOP = "nonstop"
    ONE_STOP = "1-stop"
    ANY = "any"


class CabinClass(StrEnum):
    """Flight cabin class options."""

    ECONOMY = "economy"
    PREMIUM_ECONOMY = "premium_economy"
    BUSINESS = "business"
    FIRST = "first"


# =============================================================================
# HOTEL PREFERENCES CONSTANTS (Phase 1)
# =============================================================================


class RoomSelectionMode(StrEnum):
    """Hotel room selection preference modes."""

    CHEAPEST = "cheapest"
    PREFERRED = "preferred"
