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

    # Database
    database_url: str

    # LLM (Groq)
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"

    # Skiplagged MCP (no auth required)
    skiplagged_mcp_url: str = "https://mcp.skiplagged.com/mcp"
    mock_skiplagged_api: bool = False  # Return mock data instead of calling Skiplagged MCP

    # SearchAPI (Phase 4)
    searchapi_key: str = ""
    optimizer_max_date_range_days: int = 90
    optimizer_rate_limit_per_hour: int = 2000

    # Temporal
    temporal_address: str = "temporal:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "vacation-price-tracker-tasks"
    daily_refresh_cron: str = "0 6 * * *"  # 06:00 UTC daily

    # Email Notifications
    smtp_host: str = "smtp.smtp2go.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    email_from: str = "notifications@yourdomain.com"

    # Email delivery (Resend) — leave resend_api_key blank to run in dry-run mode
    # (the digest job logs what it would send and skips delivery).
    resend_api_key: str = ""
    email_physical_address: str = ""  # CAN-SPAM footer; required for real sends
    app_base_url: str = ""  # Public app URL for digest + unsubscribe links

    # SMS Notifications
    notification_api_key: str = ""

    # Feature Flags
    enable_email_notifications: bool = False
    enable_sms_notifications: bool = False
    enable_beta_optimizer: bool = False
    max_trips_per_user: int = 10
    default_refresh_frequency: str = "daily"

    # Redis
    redis_url: str = "redis://redis:6379/0"
    cache_ttl_seconds: int = 86400

    # Rate Limiting
    rate_limit_per_minute: int = 100
    chat_rate_limit_per_minute: int = 10

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

    @property
    def axiom_enabled(self) -> bool:
        """Whether Axiom log shipping is configured."""
        return bool(self.axiom_token and self.axiom_dataset)

    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

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


settings = Settings()
