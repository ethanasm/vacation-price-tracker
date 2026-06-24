from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, String
from sqlmodel import Field, SQLModel


class FeatureFlag(SQLModel, table=True):
    """Operator-level feature flag, toggled at runtime (no redeploy).

    Replaces the old ENABLE_* env vars. Known flags + their defaults live in
    ``app.core.feature_flags``; this table stores the live ``enabled`` state.
    """

    __tablename__ = "feature_flags"

    name: str = Field(sa_column=Column(String(64), primary_key=True))
    description: str = Field(sa_column=Column(String(255), nullable=False))
    enabled: bool = Field(sa_column=Column(Boolean, nullable=False))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
