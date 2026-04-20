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

    # Database
    database_url: str

    # LLM (Groq)
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

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

    # SMS Notifications
    notification_api_key: str = ""

    # Feature Flags
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

    # Observability
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    log_level: str = "INFO"

    # Langfuse (LLM/MCP tracing) — leave keys blank to disable
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://us.cloud.langfuse.com"
    langfuse_environment: str = ""  # overrides `environment` tag when set

    @property
    def langfuse_enabled(self) -> bool:
        """Whether Langfuse is configured with credentials."""
        return bool(self.langfuse_public_key and self.langfuse_secret_key)

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
