"""Tests for the DB-backed app-setting helpers (string-valued toggles)."""

import pytest
from app.core.app_settings import (
    KNOWN_SETTINGS,
    AppSettings,
    canonical_setting_name,
    canonical_setting_value,
    ensure_app_settings,
    get_app_setting,
    list_app_settings,
    set_app_setting,
)
from app.models.app_setting import AppSetting
from sqlmodel import select


@pytest.mark.asyncio
async def test_get_app_setting_defaults_when_absent(test_session):
    # No row seeded → falls back to the registry default.
    assert await get_app_setting(test_session, AppSettings.FLIGHT_PROVIDER) == "skiplagged"


@pytest.mark.asyncio
async def test_get_app_setting_unknown_setting(test_session):
    assert await get_app_setting(test_session, "does_not_exist") == ""


@pytest.mark.asyncio
async def test_set_app_setting_inserts_then_updates(test_session):
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, "kiwi")
    assert await get_app_setting(test_session, AppSettings.FLIGHT_PROVIDER) == "kiwi"

    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, "fast_flights")
    assert await get_app_setting(test_session, AppSettings.FLIGHT_PROVIDER) == "fast_flights"

    rows = (await test_session.execute(select(AppSetting))).scalars().all()
    assert len([r for r in rows if r.name == AppSettings.FLIGHT_PROVIDER]) == 1


@pytest.mark.asyncio
async def test_get_app_setting_disallowed_stored_value_falls_back(test_session):
    # A stale row holding a value the registry no longer allows must fall back
    # to the default rather than select behavior the code doesn't have.
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, "retired_provider")
    assert await get_app_setting(test_session, AppSettings.FLIGHT_PROVIDER) == "skiplagged"


@pytest.mark.asyncio
async def test_list_app_settings_merges_registry_and_state(test_session):
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, "kiwi")
    settings = await list_app_settings(test_session)

    assert {s["name"] for s in settings} == {spec.name for spec in KNOWN_SETTINGS}
    by_name = {s["name"]: s for s in settings}
    provider = by_name[AppSettings.FLIGHT_PROVIDER]
    assert provider["value"] == "kiwi"
    assert provider["description"]
    assert provider["allowed_values"] == ["skiplagged", "kiwi", "fast_flights"]


@pytest.mark.asyncio
async def test_list_app_settings_disallowed_stored_value_shows_default(test_session):
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, "retired_provider")
    by_name = {s["name"]: s for s in await list_app_settings(test_session)}
    assert by_name[AppSettings.FLIGHT_PROVIDER]["value"] == "skiplagged"


@pytest.mark.asyncio
async def test_ensure_app_settings_is_idempotent(test_session):
    await ensure_app_settings(test_session)
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, "fast_flights")
    # Second run must not duplicate rows or reset existing state.
    await ensure_app_settings(test_session)

    rows = (await test_session.execute(select(AppSetting))).scalars().all()
    assert len(rows) == len(KNOWN_SETTINGS)
    assert await get_app_setting(test_session, AppSettings.FLIGHT_PROVIDER) == "fast_flights"


def test_canonical_setting_name_returns_registry_constant():
    # Build the lookup key at runtime so it's a distinct string object; the
    # resolved value must be the registry's own constant, never the input —
    # that's what lets callers log it without touching request-supplied text.
    request_value = "".join(["flight", "_", "provider"])
    resolved = canonical_setting_name(request_value)
    assert resolved == AppSettings.FLIGHT_PROVIDER
    assert resolved is not request_value


def test_canonical_setting_name_unknown_is_none():
    assert canonical_setting_name("does_not_exist") is None


def test_canonical_setting_value_returns_registry_constant():
    request_value = "".join(["fast", "_", "flights"])
    resolved = canonical_setting_value(AppSettings.FLIGHT_PROVIDER, request_value)
    assert resolved == "fast_flights"
    assert resolved is not request_value


def test_canonical_setting_value_rejects_unknown_value():
    assert canonical_setting_value(AppSettings.FLIGHT_PROVIDER, "expedia") is None


def test_canonical_setting_value_unknown_setting_is_none():
    assert canonical_setting_value("does_not_exist", "skiplagged") is None
