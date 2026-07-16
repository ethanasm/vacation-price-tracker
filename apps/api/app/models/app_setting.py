from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, String
from sqlmodel import Field, SQLModel


class AppSetting(SQLModel, table=True):
    """Operator-level string-valued setting, changed at runtime (no redeploy).

    The boolean cousin of ``FeatureFlag`` — used where a toggle has more than
    two states (e.g. the ``flight_provider`` selector). Known settings, their
    allowed values, and defaults live in ``app.core.app_settings``; this table
    stores the live ``value``.
    """

    __tablename__ = "app_settings"

    name: str = Field(sa_column=Column(String(64), primary_key=True))
    description: str = Field(sa_column=Column(String(255), nullable=False))
    value: str = Field(sa_column=Column(String(64), nullable=False))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
