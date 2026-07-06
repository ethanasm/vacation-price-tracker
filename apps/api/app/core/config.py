from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        # Load env vars from real .env, then test overrides, then fall back to the example
        env_file=(".env", ".env.test", ".env.example"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra env vars not defined in the model
    )

    # Core
    project_name: str = "Vacation Price Tracker"
    environment: str = "development"
    frontend_url: str = "https://localhost:3000"
    backend_url: str = "https://localhost:8000"
    cors_allowed_origins: str = ""
    secret_key: str

    # Google OAuth
    google_client_id: str
    google_client_secret: str

    # Sign-in allowlist (comma-separated). Both blank → open sign-up; if either
    # is set, the OAuth callback denies anyone not on the list.
    auth_allowed_emails: str = ""
    auth_allowed_domains: str = ""

    # Mobile auth bridge: comma-separated Google OAuth client IDs (iOS + Android)
    # that may mint a session via POST /v1/auth/mobile-token. The native app's
    # ID token's `aud` claim must match one of these.
    google_oauth_mobile_audiences: str = ""

    # Database
    database_url: str

    # LLM (Groq)
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"

    # Skiplagged MCP (no auth required)
    skiplagged_mcp_url: str = "https://mcp.skiplagged.com/mcp"
    mock_skiplagged_api: bool = False  # Return mock data instead of calling Skiplagged MCP

    # Kiwi.com MCP (no auth required) — alternative flight provider, selected at
    # runtime via the `kiwi_flights` feature flag (DB `feature_flags` table).
    kiwi_mcp_url: str = "https://mcp.kiwi.com/"

    # SearchAPI (Phase 4)
    searchapi_key: str = ""
    optimizer_max_date_range_days: int = 90
    optimizer_rate_limit_per_hour: int = 2000

    # Temporal
    temporal_address: str = "temporal:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "vacation-price-tracker-tasks"
    daily_refresh_cron: str = "0 6 * * *"  # 06:00 UTC daily
    daily_health_cron: str = "0 7 * * *"  # 07:00 UTC daily — system health digest

    # Email Notifications
    smtp_host: str = "smtp.smtp2go.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    email_from: str = "notifications@yourdomain.com"

    # Email delivery (Resend) — leave resend_api_key blank to run in dry-run mode
    # (the digest job logs what it would send and skips delivery). Digest and
    # unsubscribe links reuse frontend_url (app) and backend_url (API).
    resend_api_key: str = ""
    email_physical_address: str = ""  # CAN-SPAM footer; required for real sends

    # Daily system-health digest recipients (comma-separated). Blank → the health
    # check still runs and logs, but emails nobody.
    admin_emails: str = ""

    # SMS Notifications
    notification_api_key: str = ""

    # Limits. Boolean feature gates (email/sms/optimizer) live in the DB
    # `feature_flags` table (see app.core.feature_flags), not here.
    max_trips_per_user: int = 10
    default_refresh_frequency: str = "daily"

    # Redis
    redis_url: str = "redis://redis:6379/0"
    cache_ttl_seconds: int = 86400

    # Rate Limiting
    rate_limit_per_minute: int = 100
    chat_rate_limit_per_minute: int = 10

    # Number of trusted reverse-proxy hops in front of the app, counted from the
    # right of `X-Forwarded-For`. Prod runs behind a single Cloudflare Tunnel hop,
    # so the client IP is the 1st entry from the right (default 1). Set to 0 for a
    # direct-bind deployment (no proxy) so a client-supplied XFF is ignored in
    # favour of the socket peer. Getting this right matters: the per-IP rate limit
    # and daily quota key on this IP, so an over-count lets a client forge buckets.
    trusted_proxy_count: int = 1

    # Cost / abuse ceilings (daily quotas + global daily spend circuit-breaker).
    # Always on, like the per-minute rate limiter above. All counters live in
    # Redis and auto-reset at UTC midnight. The four limits are the tunable knobs
    # (surfaced in .env.example); set one very high to effectively disable it.
    chat_daily_quota_per_user: int = 200  # message-producing chat requests/user/day
    daily_quota_per_user: int = 2000  # overall API requests/user/day
    global_daily_groq_token_budget: int = 50_000_000  # Groq tokens/day across all users
    global_daily_skiplagged_call_budget: int = 50_000  # Skiplagged MCP calls/day, all users

    # Observability
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    log_level: str = "INFO"

    # Admin SQL debug endpoint (POST /v1/admin/sql) — disabled unless the token
    # is set and >= 32 chars. Prefer a dedicated read-only DB role via
    # admin_query_database_url; falls back to database_url when blank.
    admin_query_token: str = ""
    admin_query_database_url: str = ""

    # End-to-end test harness (P4 mobile-e2e). When `e2e_mode` is on (set ONLY on
    # the isolated vpt-e2e deployment), POST /v1/e2e/mint-token issues a bearer
    # JWT for a synthetic user so Maestro can authenticate without real Google
    # OAuth. Guarded by a shared secret matched against vpt_e2e_backend_token.
    # Both default off/blank so the endpoint is inert in normal prod.
    e2e_mode: bool = False
    vpt_e2e_backend_token: str = ""

    # Langfuse (LLM/MCP tracing) — leave keys blank to disable
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://us.cloud.langfuse.com"
    langfuse_environment: str = ""  # overrides `environment` tag when set

    @property
    def langfuse_enabled(self) -> bool:
        """Whether Langfuse is configured with credentials."""
        return bool(self.langfuse_public_key and self.langfuse_secret_key)

    # Axiom (structured app-log shipping) — leave token/dataset blank to disable
    # (stdout-only). One shared dataset for api + worker + web, distinguished by
    # the `service` field. The `fields` map field bounds the column schema.
    axiom_token: str = ""  # ingest-only API token
    axiom_dataset: str = ""  # e.g. vacation-price-tracker-prod
    # Read access (the ingest token can't query). A Personal Access Token with
    # Query capability + the org slug, used by the health digest's error-volume
    # check. Blank → that check reports `unknown` (skipped).
    axiom_query_token: str = ""
    axiom_org_id: str = ""

    @property
    def axiom_enabled(self) -> bool:
        """Whether Axiom log shipping is configured."""
        return bool(self.axiom_token and self.axiom_dataset)

    @property
    def axiom_query_enabled(self) -> bool:
        """Whether Axiom read/query access is configured (health digest)."""
        return bool(self.axiom_query_token and self.axiom_org_id and self.axiom_dataset)

    @property
    def admin_emails_list(self) -> list[str]:
        """Comma-separated ADMIN_EMAILS recipients for the health digest."""
        return [e.strip() for e in self.admin_emails.split(",") if e.strip()]

    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    # Idle-session ceiling. Each refresh rotates in a new refresh token with a
    # fresh 30-day expiry, so active users stay signed in indefinitely; only
    # 30 days of inactivity signs a session out (parity with showbook's
    # 30-day rolling web session).
    refresh_token_expire_days: int = 30

    @property
    def refresh_token_expire_seconds(self) -> int:
        """Refresh-token lifetime in seconds (cookie max_age + Redis TTL)."""
        return self.refresh_token_expire_days * 24 * 60 * 60

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        """Comma-separated CORS allowed origins from env."""
        if not self.cors_allowed_origins:
            return []
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def google_oauth_mobile_audiences_list(self) -> list[str]:
        """Allowed mobile OAuth client IDs (aud) for the mobile-token bridge."""
        raw = self.google_oauth_mobile_audiences
        return [a.strip() for a in raw.split(",") if a.strip()]


settings = Settings()
