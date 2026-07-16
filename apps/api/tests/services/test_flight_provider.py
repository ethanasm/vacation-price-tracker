"""Tests for runtime flight-provider selection."""

from __future__ import annotations

import pytest
from app.clients.fast_flights import FastFlightsClient, fast_flights_client
from app.clients.kiwi import KiwiClient, kiwi_client
from app.clients.skiplagged import SkiplaggedClient, skiplagged_client
from app.core.app_settings import AppSettings, set_app_setting
from app.services.flight_provider import (
    FLIGHT_PROVIDERS,
    PROVIDER_FAST_FLIGHTS,
    PROVIDER_KIWI,
    PROVIDER_SKIPLAGGED,
    get_flight_client,
    get_flight_provider_name,
)


@pytest.mark.anyio
async def test_defaults_to_skiplagged(test_session):
    assert await get_flight_provider_name(test_session) == PROVIDER_SKIPLAGGED


@pytest.mark.anyio
async def test_setting_switches_between_all_providers(test_session):
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, PROVIDER_KIWI)
    assert await get_flight_provider_name(test_session) == PROVIDER_KIWI
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, PROVIDER_FAST_FLIGHTS)
    assert await get_flight_provider_name(test_session) == PROVIDER_FAST_FLIGHTS
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, PROVIDER_SKIPLAGGED)
    assert await get_flight_provider_name(test_session) == PROVIDER_SKIPLAGGED


@pytest.mark.anyio
async def test_stale_setting_value_falls_back_to_skiplagged(test_session):
    # A stored value the registry no longer allows must not select behavior
    # the code doesn't have (e.g. after a provider is removed).
    await set_app_setting(test_session, AppSettings.FLIGHT_PROVIDER, "retired_provider")
    assert await get_flight_provider_name(test_session) == PROVIDER_SKIPLAGGED


def test_flight_providers_registry_matches_constants():
    assert FLIGHT_PROVIDERS == (PROVIDER_SKIPLAGGED, PROVIDER_KIWI, PROVIDER_FAST_FLIGHTS)


def test_get_flight_client_maps_names():
    assert get_flight_client(PROVIDER_KIWI) is kiwi_client
    assert isinstance(get_flight_client(PROVIDER_KIWI), KiwiClient)
    assert get_flight_client(PROVIDER_FAST_FLIGHTS) is fast_flights_client
    assert isinstance(get_flight_client(PROVIDER_FAST_FLIGHTS), FastFlightsClient)
    assert get_flight_client(PROVIDER_SKIPLAGGED) is skiplagged_client
    assert isinstance(get_flight_client("anything-else"), SkiplaggedClient)
