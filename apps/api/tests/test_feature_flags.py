"""Tests for the DB-backed feature-flag helpers."""

import pytest
from app.core.feature_flags import (
    KNOWN_FLAGS,
    FeatureFlags,
    canonical_flag_name,
    ensure_feature_flags,
    is_feature_enabled,
    list_feature_flags,
    set_feature_flag,
)
from app.models.feature_flag import FeatureFlag
from sqlmodel import select


@pytest.mark.asyncio
async def test_is_feature_enabled_defaults_when_absent(test_session):
    # No row seeded → falls back to the registry default (all False).
    assert await is_feature_enabled(test_session, FeatureFlags.EMAIL_NOTIFICATIONS) is False


@pytest.mark.asyncio
async def test_is_feature_enabled_unknown_flag(test_session):
    assert await is_feature_enabled(test_session, "does_not_exist") is False


@pytest.mark.asyncio
async def test_set_feature_flag_inserts_then_updates(test_session):
    await set_feature_flag(test_session, FeatureFlags.EMAIL_NOTIFICATIONS, True)
    assert await is_feature_enabled(test_session, FeatureFlags.EMAIL_NOTIFICATIONS) is True

    await set_feature_flag(test_session, FeatureFlags.EMAIL_NOTIFICATIONS, False)
    assert await is_feature_enabled(test_session, FeatureFlags.EMAIL_NOTIFICATIONS) is False

    rows = (await test_session.execute(select(FeatureFlag))).scalars().all()
    assert len([r for r in rows if r.name == FeatureFlags.EMAIL_NOTIFICATIONS]) == 1


@pytest.mark.asyncio
async def test_list_feature_flags_merges_registry_and_state(test_session):
    await set_feature_flag(test_session, FeatureFlags.EMAIL_NOTIFICATIONS, True)
    flags = await list_feature_flags(test_session)

    assert {f["name"] for f in flags} == {spec.name for spec in KNOWN_FLAGS}
    by_name = {f["name"]: f for f in flags}
    assert by_name[FeatureFlags.EMAIL_NOTIFICATIONS]["enabled"] is True
    assert by_name[FeatureFlags.BETA_OPTIMIZER]["enabled"] is False  # default
    assert by_name[FeatureFlags.EMAIL_NOTIFICATIONS]["description"]


@pytest.mark.asyncio
async def test_ensure_feature_flags_is_idempotent(test_session):
    await ensure_feature_flags(test_session)
    await set_feature_flag(test_session, FeatureFlags.EMAIL_NOTIFICATIONS, True)
    # Second run must not duplicate rows or reset existing state.
    await ensure_feature_flags(test_session)

    rows = (await test_session.execute(select(FeatureFlag))).scalars().all()
    assert len(rows) == len(KNOWN_FLAGS)
    assert await is_feature_enabled(test_session, FeatureFlags.EMAIL_NOTIFICATIONS) is True


def test_canonical_flag_name_returns_registry_constant():
    # Build the lookup key at runtime so it's a distinct string object; the
    # resolved value must be the registry's own constant, never the input —
    # that's what lets callers log it without touching request-supplied text.
    request_value = "".join(["kiwi", "_", "flights"])
    resolved = canonical_flag_name(request_value)
    assert resolved == FeatureFlags.KIWI_FLIGHTS
    assert resolved is not request_value


def test_canonical_flag_name_unknown_is_none():
    assert canonical_flag_name("does_not_exist") is None


@pytest.mark.asyncio
async def test_push_notifications_flag_registered(test_session):
    from app.core.feature_flags import FeatureFlags, list_feature_flags

    names = {f["name"] for f in await list_feature_flags(test_session)}
    assert FeatureFlags.PUSH_NOTIFICATIONS in names
    assert FeatureFlags.PUSH_NOTIFICATIONS == "push_notifications"
