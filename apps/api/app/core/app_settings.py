"""Operator-level string-valued settings, backed by the ``app_settings`` table.

The multi-state cousin of ``app.core.feature_flags``: a code registry
(`KNOWN_SETTINGS`) defines each setting's name, human description, allowed
values, and default; the table stores the live ``value``. Reads fall back to
the registry default when a row is missing (or holds a value the registry no
longer allows), so callers — including the worker — behave correctly even
before the rows are seeded.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.app_setting import AppSetting


class AppSettings:
    """Known setting names (namespace only)."""

    FLIGHT_PROVIDER = "flight_provider"


@dataclass(frozen=True)
class AppSettingSpec:
    name: str
    description: str
    default: str
    allowed_values: tuple[str, ...]


KNOWN_SETTINGS: tuple[AppSettingSpec, ...] = (
    AppSettingSpec(
        AppSettings.FLIGHT_PROVIDER,
        "Which provider serves flight searches (hotels stay on Skiplagged).",
        "skiplagged",
        ("skiplagged", "kiwi", "fast_flights"),
    ),
)

_SPECS: dict[str, AppSettingSpec] = {spec.name: spec for spec in KNOWN_SETTINGS}


def canonical_setting_name(name: str) -> str | None:
    """Resolve ``name`` to the registry's own name constant, or ``None`` if unknown.

    Handlers log/echo the returned registry constant instead of the raw request
    value, so client-controlled text never reaches the logs (CWE-117).
    """
    spec = _SPECS.get(name)
    return spec.name if spec else None


def canonical_setting_value(name: str, value: str) -> str | None:
    """Resolve ``value`` to the registry's own allowed-value constant, or ``None``.

    Same CWE-117 rationale as ``canonical_setting_name``: the returned string is
    a code-defined constant, never the raw request value.
    """
    spec = _SPECS.get(name)
    if spec is None:
        return None
    for allowed in spec.allowed_values:
        if value == allowed:
            return allowed
    return None


async def get_app_setting(session: AsyncSession, name: str) -> str:
    """Return a setting's live value, falling back to its registry default.

    A stored value the registry no longer allows also falls back to the
    default — a stale row must not select behavior the code no longer has.
    """
    spec = _SPECS.get(name)
    row = await session.get(AppSetting, name)
    if row is not None and spec is not None and row.value in spec.allowed_values:
        return row.value
    if spec is not None:
        return spec.default
    return row.value if row is not None else ""


async def list_app_settings(session: AsyncSession) -> list[dict]:
    """List every known setting (merging registry metadata with the live state)."""
    rows = {
        row.name: row
        for row in (await session.execute(select(AppSetting))).scalars().all()
    }
    return [
        {
            "name": spec.name,
            "description": spec.description,
            "value": (
                rows[spec.name].value
                if spec.name in rows and rows[spec.name].value in spec.allowed_values
                else spec.default
            ),
            "allowed_values": list(spec.allowed_values),
        }
        for spec in KNOWN_SETTINGS
    ]


async def set_app_setting(session: AsyncSession, name: str, value: str) -> None:
    """Upsert a setting's value. Callers validate against the registry first."""
    row = await session.get(AppSetting, name)
    if row is None:
        spec = _SPECS.get(name)
        row = AppSetting(
            name=name,
            description=spec.description if spec else name,
            value=value,
        )
    else:
        row.value = value
    row.updated_at = datetime.now(UTC)
    session.add(row)
    await session.commit()


async def ensure_app_settings(session: AsyncSession) -> None:
    """Idempotently seed any missing known settings with their defaults."""
    existing = {
        name for (name,) in (await session.execute(select(AppSetting.name))).all()
    }
    created = False
    for spec in KNOWN_SETTINGS:
        if spec.name not in existing:
            session.add(
                AppSetting(name=spec.name, description=spec.description, value=spec.default)
            )
            created = True
    if created:
        await session.commit()
