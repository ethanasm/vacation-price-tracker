"""Redis cache key patterns for the application."""


class CacheKeys:
    """Centralized Redis key management."""

    # Idempotency keys for preventing duplicate requests
    @staticmethod
    def idempotency(key: str) -> str:
        """Key for idempotency token storage (24hr TTL)."""
        return f"idempotency:{key}"

    # Price caching for rate limit management
    @staticmethod
    def price_cache(trip_id: str, date: str) -> str:
        """Key for cached price lookup results."""
        return f"price_cache:{trip_id}:{date}"

    @staticmethod
    def flight_cache(origin: str, destination: str, date: str) -> str:
        """Key for flight search results."""
        return f"flight:{origin}:{destination}:{date}"

    @staticmethod
    def hotel_cache(location: str, checkin: str, checkout: str) -> str:
        """Key for hotel search results."""
        return f"hotel:{location}:{checkin}:{checkout}"

    # User session management
    @staticmethod
    def user_session(user_id: str) -> str:
        """Key for user session data."""
        return f"session:{user_id}"

    @staticmethod
    def refresh_token(user_id: str) -> str:
        """Key for refresh token storage."""
        return f"refresh_token:{user_id}"

    @staticmethod
    def refresh_lock(user_id: str) -> str:
        """Key for refresh-all lock per user."""
        return f"refresh:lock:{user_id}"

    # Rate limiting
    @staticmethod
    def rate_limit(user_id: str, resource: str) -> str:
        """Key for rate limit tracking (e.g., resource='api', 'price_check')."""
        return f"rate_limit:{user_id}:{resource}"


class CacheTTL:
    """Centralized TTL constants (in seconds)."""

    IDEMPOTENCY = 86400  # 24 hours
    PRICE_CACHE = 86400  # 24 hours
    SESSION = 3600  # 1 hour
    REFRESH_TOKEN = 604800  # 7 days
    RATE_LIMIT = 60  # 1 minute window (for per-minute rate limiting)
    REFRESH_LOCK = 1800  # 30 minutes
    AUDIT_LOG_RETENTION = 86400 * 90  # 90 days
