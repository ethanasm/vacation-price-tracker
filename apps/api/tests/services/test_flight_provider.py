"""Tests for runtime flight-provider selection."""

from __future__ import annotations

import pytest
from app.clients.kiwi import KiwiClient, kiwi_client
from app.clients.skiplagged import SkiplaggedClient, skiplagged_client
from app.core.feature_flags import FeatureFlags, set_feature_flag
from app.services.flight_provider import (
    PROVIDER_KIWI,
    PROVIDER_SKIPLAGGED,
    get_flight_client,
    get_flight_provider_name,
)


@pytest.mark.anyio
async def test_defaults_to_skiplagged(test_session):
    assert await get_flight_provider_name(test_session) == PROVIDER_SKIPLAGGED


@pytest.mark.anyio
async def test_flag_switches_to_kiwi_and_back(test_session):
    await set_feature_flag(test_session, FeatureFlags.KIWI_FLIGHTS, True)
    assert await get_flight_provider_name(test_session) == PROVIDER_KIWI
    await set_feature_flag(test_session, FeatureFlags.KIWI_FLIGHTS, False)
    assert await get_flight_provider_name(test_session) == PROVIDER_SKIPLAGGED


def test_get_flight_client_maps_names():
    assert get_flight_client(PROVIDER_KIWI) is kiwi_client
    assert isinstance(get_flight_client(PROVIDER_KIWI), KiwiClient)
    assert get_flight_client(PROVIDER_SKIPLAGGED) is skiplagged_client
    assert isinstance(get_flight_client("anything-else"), SkiplaggedClient)
