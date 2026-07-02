"""Operator-level feature flags, backed by the ``feature_flags`` table.

A code registry (`KNOWN_FLAGS`) defines each flag's name, human description, and
default; the table stores the live ``enabled`` value. Reads fall back to the
registry default when a row is missing, so callers (including the worker) behave
correctly even before the rows are seeded.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.feature_flag import FeatureFlag


class FeatureFlags:
    """Known feature-flag names (namespace only)."""

    EMAIL_NOTIFICATIONS = "email_notifications"
    SMS_NOTIFICATIONS = "sms_notifications"
    PUSH_NOTIFICATIONS = "push_notifications"
    BETA_OPTIMIZER = "beta_optimizer"
    KIWI_FLIGHTS = "kiwi_flights"


@dataclass(frozen=True)
class FeatureFlagSpec:
    name: str
    description: str
    default: bool


KNOWN_FLAGS: tuple[FeatureFlagSpec, ...] = (
    FeatureFlagSpec(
        FeatureFlags.EMAIL_NOTIFICATIONS,
        "Send daily price-drop email digests to users.",
        False,
    ),
    FeatureFlagSpec(
        FeatureFlags.SMS_NOTIFICATIONS,
        "Send SMS price alerts (requires an SMS provider).",
        False,
    ),
    FeatureFlagSpec(
        FeatureFlags.PUSH_NOTIFICATIONS,
        "Send Expo push notifications to mobile devices on price drops.",
        False,
    ),
    FeatureFlagSpec(
        FeatureFlags.BETA_OPTIMIZER,
        "Enable the flexible-date optimizer (beta).",
        False,
    ),
    FeatureFlagSpec(
        FeatureFlags.KIWI_FLIGHTS,
        "Use Kiwi.com as the flight search provider instead of Skiplagged "
        "(hotels stay on Skiplagged).",
        False,
    ),
)

_SPECS: dict[str, FeatureFlagSpec] = {spec.name: spec for spec in KNOWN_FLAGS}


def is_known_flag(name: str) -> bool:
    """Whether ``name`` is a registered feature flag."""
    return name in _SPECS


async def is_feature_enabled(session: AsyncSession, name: str) -> bool:
    """Return a flag's live state, falling back to its registry default."""
    row = await session.get(FeatureFlag, name)
    if row is not None:
        return row.enabled
    spec = _SPECS.get(name)
    return spec.default if spec else False


async def list_feature_flags(session: AsyncSession) -> list[dict]:
    """List every known flag (merging registry metadata with the live state)."""
    rows = {
        row.name: row
        for row in (await session.execute(select(FeatureFlag))).scalars().all()
    }
    return [
        {
            "name": spec.name,
            "description": spec.description,
            "enabled": rows[spec.name].enabled if spec.name in rows else spec.default,
        }
        for spec in KNOWN_FLAGS
    ]


async def set_feature_flag(session: AsyncSession, name: str, enabled: bool) -> None:
    """Upsert a flag's enabled state."""
    row = await session.get(FeatureFlag, name)
    if row is None:
        spec = _SPECS.get(name)
        row = FeatureFlag(
            name=name,
            description=spec.description if spec else name,
            enabled=enabled,
        )
    else:
        row.enabled = enabled
    row.updated_at = datetime.now(UTC)
    session.add(row)
    await session.commit()


async def ensure_feature_flags(session: AsyncSession) -> None:
    """Idempotently seed any missing known flags with their defaults."""
    existing = {
        name for (name,) in (await session.execute(select(FeatureFlag.name))).all()
    }
    created = False
    for spec in KNOWN_FLAGS:
        if spec.name not in existing:
            session.add(
                FeatureFlag(name=spec.name, description=spec.description, enabled=spec.default)
            )
            created = True
    if created:
        await session.commit()
