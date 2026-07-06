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
    def refresh_token(user_id: str, jti: str | None = None) -> str:
        """Key for refresh token storage.

        Keyed per-session by the token's ``jti`` so concurrent sessions (web +
        mobile) don't rotate each other out. ``jti=None`` is the legacy
        per-user key, still honored for tokens minted before jti existed.
        """
        if jti:
            return f"refresh_token:{user_id}:{jti}"
        return f"refresh_token:{user_id}"

    @staticmethod
    def refresh_token_grace(user_id: str, jti: str | None = None) -> str:
        """Key for the post-rotation grace record of a refresh token.

        Written when a refresh token is rotated; maps the retired token to its
        replacement for a short window so a client whose connection dropped
        after the server rotated (but before the response arrived) can retry
        the same token and recover the replacement instead of being signed out.
        Mirrors :meth:`refresh_token`'s jti/legacy keying.
        """
        if jti:
            return f"refresh_token_grace:{user_id}:{jti}"
        return f"refresh_token_grace:{user_id}"

    @staticmethod
    def refresh_lock(user_id: str) -> str:
        """Key for refresh-all lock per user."""
        return f"refresh:lock:{user_id}"

    @staticmethod
    def trip_refresh_lock(trip_id: str) -> str:
        """Key for single-trip refresh lock."""
        return f"refresh:trip_lock:{trip_id}"

    # Rate limiting
    @staticmethod
    def rate_limit(user_id: str, resource: str) -> str:
        """Key for rate limit tracking (e.g., resource='api', 'price_check')."""
        return f"rate_limit:{user_id}:{resource}"

    # Cost / abuse ceilings (per-user daily quota + global daily budget guard)
    @staticmethod
    def daily_quota(identifier: str, resource: str, day: str) -> str:
        """Per-user daily quota counter. day=YYYYMMDD (UTC); auto-expires at midnight."""
        return f"daily_quota:{identifier}:{resource}:{day}"

    @staticmethod
    def global_budget(metric: str, day: str) -> str:
        """Global per-UTC-day spend counter. metric in {'groq_tokens', 'skiplagged_calls', 'kiwi_calls'}."""
        return f"global_budget:{metric}:{day}"


class CacheTTL:
    """Centralized TTL constants (in seconds)."""

    IDEMPOTENCY = 86400  # 24 hours
    PRICE_CACHE = 86400  # 24 hours
    SESSION = 3600  # 1 hour
    # Refresh-token TTL lives on settings.refresh_token_expire_seconds so the
    # Redis TTL always matches the JWT exp and cookie max_age.
    # Post-rotation grace: how long a rotated-out refresh token may still be
    # replayed to recover its replacement. Long enough to cover a mobile client
    # that lost connectivity mid-refresh and retries when the app is reopened
    # (the observed prod outage gap was ~27 minutes). Replay only re-yields the
    # already-issued replacement and only while that replacement is still the
    # live, unused session token — logout or any forward rotation kills it —
    # so the longer window does not extend a dead session's life.
    REFRESH_TOKEN_GRACE = 3600  # 1 hour
    RATE_LIMIT = 60  # 1 minute window (for per-minute rate limiting)
    REFRESH_LOCK = 1800  # 30 minutes
    AUDIT_LOG_RETENTION = 86400 * 90  # 90 days
    DAILY_QUOTA_MIN_TTL = 60  # floor for the seconds-to-midnight day-bucket TTL
