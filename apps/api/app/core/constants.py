"""
Application-wide constants.

Organized by domain:
- Auth constants (Phase 1)
- Trip/tracking constants (Phase 1-3)
"""

from enum import Enum

# =============================================================================
# AUTH CONSTANTS (Phase 1)
# =============================================================================


class CookieNames:
    """Cookie name constants (namespace only, not passed as values)."""

    ACCESS_TOKEN = "access_token_cookie"
    REFRESH_TOKEN = "refresh_token_cookie"


class JWTClaims:
    """Standard JWT claim names (namespace only, not passed as values)."""

    SUBJECT = "sub"  # User ID
    ISSUED_AT = "iat"
    EXPIRATION = "exp"
    JWT_ID = "jti"  # Unique token identifier
    TYPE = "type"  # "access" or "refresh"


class TokenType(str, Enum):
    """Token type identifiers (used in function signatures and comparisons)."""

    ACCESS = "access"
    REFRESH = "refresh"


# =============================================================================
# TRIP/TRACKING CONSTANTS (Phase 1-3)
# =============================================================================


class TripStatus(str, Enum):
    """Trip tracking status values."""

    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


class RefreshFrequency(str, Enum):
    """Valid refresh frequency options (Phase 3: scheduled tracking)."""

    DAILY = "daily"
    EVERY_3_DAYS = "every_3_days"
    WEEKLY = "weekly"
