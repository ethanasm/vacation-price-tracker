"""Tests for runtime flight-provider selection."""

from __future__ import annotations

import asyncio
import inspect
import logging
from unittest.mock import patch

import pytest
from app.clients.fast_flights import FastFlightsClient, fast_flights_client
from app.clients.kiwi import KiwiClient, kiwi_client
from app.clients.skiplagged import SkiplaggedClient, skiplagged_client
from app.core.app_settings import AppSettings, set_app_setting
from app.services.flight_provider import (
    CAPABILITIES,
    FLIGHT_PROVIDERS,
    PROVIDER_FAST_FLIGHTS,
    PROVIDER_KIWI,
    PROVIDER_SKIPLAGGED,
    TRACKING_MAX_PAGES,
    FlightSearchRequest,
    ProviderCapabilities,
    capabilities_for,
    dropped_constraints,
    get_flight_client,
    get_flight_provider_name,
    search_flights,
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


# ---------------------------------------------------------------------------
# Shared dispatch: one request shape, per-provider argument sets
# ---------------------------------------------------------------------------


class RecordingClient:
    """Captures the kwargs the dispatcher decided this provider can accept."""

    def __init__(self) -> None:
        self.single: dict | None = None
        self.all_pages: dict | None = None

    async def search_flights(self, **kwargs):
        self.single = kwargs
        return "single-result"

    async def search_flights_all(self, **kwargs):
        self.all_pages = kwargs
        return "all-result"


_DROPPED_EVENT = "flight_provider.constraint_dropped"


def _request(**overrides) -> FlightSearchRequest:
    base = {"origin": "SFO", "destination": "JFK", "departure_date": "2026-09-01"}
    return FlightSearchRequest(**{**base, **overrides})


def test_capabilities_cover_every_provider():
    assert set(CAPABILITIES) == set(FLIGHT_PROVIDERS)
    assert capabilities_for("unknown-provider") == CAPABILITIES[PROVIDER_SKIPLAGGED]


def test_every_provider_honors_cabin_so_nothing_is_dropped():
    """All three providers can filter by cabin — Skiplagged via `fareClass`."""
    with_cabin = _request(cabin="business")
    for provider in FLIGHT_PROVIDERS:
        assert dropped_constraints(provider, with_cabin) == ()
        assert capabilities_for(provider).cabin is True


def test_dropped_constraints_still_reports_a_provider_that_cannot():
    """The mechanism has to keep working for the next provider that lacks a knob."""
    incapable = ProviderCapabilities(cabin=False, paginates=False)
    with patch.dict(CAPABILITIES, {"incapable": incapable}):
        assert dropped_constraints("incapable", _request(cabin="business")) == ("cabin",)
        assert dropped_constraints("incapable", _request()) == ()


@pytest.mark.anyio
async def test_no_warning_when_the_provider_can_honor_the_cabin(caplog):
    client = RecordingClient()
    with caplog.at_level(logging.WARNING):
        await search_flights(PROVIDER_SKIPLAGGED, _request(cabin="business"), client_factory=lambda _n, _c=client: _c)

    dropped = [r for r in caplog.records if getattr(r, "event", None) == _DROPPED_EVENT]
    assert dropped == []
    assert client.single["cabin"] == "business", "and it is actually forwarded"


def test_dropped_constraint_names_are_code_defined_not_request_values():
    """What gets logged must never be caller-controlled text (CWE-117).

    `cabin` can originate from LLM tool arguments, so the log carries the
    constraint *name* — a constant in this module — and never the value.
    """
    incapable = ProviderCapabilities(cabin=False, paginates=False)
    with patch.dict(CAPABILITIES, {"incapable": incapable}):
        injected = _request(cabin="business\nWARNING fake log line")
        assert dropped_constraints("incapable", injected) == ("cabin",)


def test_dispatch_kwargs_bind_against_every_real_client_signature():
    """The one regression class this refactor can introduce.

    The fakes elsewhere in this file swallow `**kwargs`, so they cannot catch a
    kwarg no real client accepts — that would surface only as a TypeError in
    production. Bind the arguments the dispatcher actually computes against the
    real signatures of all three clients, for both methods.
    """
    request = _request(return_date="2026-09-08", adults=2, max_stops="none", cabin="business")
    clients = {
        PROVIDER_SKIPLAGGED: SkiplaggedClient,
        PROVIDER_KIWI: KiwiClient,
        PROVIDER_FAST_FLIGHTS: FastFlightsClient,
    }

    for provider, client_cls in clients.items():
        for all_pages in (False, True):
            recorder = RecordingClient()
            asyncio.run(
                search_flights(provider, request, client_factory=lambda _n, _c=recorder: _c, all_pages=all_pages)
            )
            captured = recorder.all_pages if all_pages else recorder.single
            assert captured is not None

            method = getattr(client_cls, "search_flights_all" if all_pages else "search_flights")
            # Raises TypeError if the dispatcher passes anything this client
            # cannot accept, or omits a required parameter.
            inspect.signature(method).bind(object(), **captured)


@pytest.mark.anyio
async def test_omitting_the_client_resolves_the_shared_instance(monkeypatch):
    """`get_flight_client` is reached through the dispatcher, not just re-declared.

    This branch is the reason the provider→client mapping lives in one place;
    untested, it could regress back to three call sites without anything failing.
    """
    recorder = RecordingClient()
    monkeypatch.setattr(
        "app.services.flight_provider.get_flight_client",
        lambda provider: recorder,
    )

    result = await search_flights(PROVIDER_KIWI, _request())

    assert result == "single-result"
    assert recorder.single is not None, "the resolved client was actually called"


@pytest.mark.anyio
@pytest.mark.parametrize("provider", list(FLIGHT_PROVIDERS))
async def test_cabin_is_forwarded_to_providers_that_support_it(provider):
    client = RecordingClient()
    await search_flights(provider, _request(cabin="business"), client_factory=lambda _n, _c=client: _c)
    assert client.single["cabin"] == "business"


@pytest.mark.anyio
async def test_an_unhonorable_cabin_is_dropped_and_logged(caplog):
    """A provider that genuinely cannot filter by cabin returns a price for a
    different cabin. The operator chose it, so it is not an error — but it must
    not be invisible.

    No shipped provider is in this state today; the fixture stands in for the
    next one that is.
    """
    incapable = ProviderCapabilities(cabin=False, paginates=False)
    client = RecordingClient()
    with patch.dict(CAPABILITIES, {"incapable": incapable}), caplog.at_level(logging.WARNING):
        await search_flights("incapable", _request(cabin="business"), client_factory=lambda _n, _c=client: _c)

    assert "cabin" not in client.single
    events = [r.event for r in caplog.records if hasattr(r, "event")]
    assert _DROPPED_EVENT in events


@pytest.mark.anyio
async def test_no_warning_when_no_cabin_was_requested(caplog):
    client = RecordingClient()
    with caplog.at_level(logging.WARNING):
        await search_flights(PROVIDER_SKIPLAGGED, _request(), client_factory=lambda _n, _c=client: _c)

    assert not [r for r in caplog.records if getattr(r, "event", None) == _DROPPED_EVENT]


@pytest.mark.anyio
async def test_tracking_path_paginates_only_where_supported():
    skiplagged, kiwi = RecordingClient(), RecordingClient()
    await search_flights(PROVIDER_SKIPLAGGED, _request(), client_factory=lambda _n, _c=skiplagged: _c, all_pages=True)
    await search_flights(PROVIDER_KIWI, _request(), client_factory=lambda _n, _c=kiwi: _c, all_pages=True)

    assert skiplagged.all_pages["max_pages"] == TRACKING_MAX_PAGES
    assert "max_pages" not in kiwi.all_pages, "Kiwi accepts max_pages but ignores it"


@pytest.mark.anyio
async def test_paging_flag_selects_the_method_and_page_args():
    """Single-page (chat) carries sort/limit/offset; the full sweep does not."""
    chat, tracking = RecordingClient(), RecordingClient()
    result = await search_flights(PROVIDER_KIWI, _request(limit=10, offset=5), client_factory=lambda _n, _c=chat: _c)
    await search_flights(PROVIDER_KIWI, _request(), client_factory=lambda _n, _c=tracking: _c, all_pages=True)

    assert result == "single-result"
    assert (chat.single["sort"], chat.single["limit"], chat.single["offset"]) == ("value", 10, 5)
    assert tracking.all_pages is not None
    assert "limit" not in tracking.all_pages
    assert "offset" not in tracking.all_pages


@pytest.mark.anyio
async def test_core_query_fields_always_reach_the_client():
    client = RecordingClient()
    await search_flights(
        PROVIDER_SKIPLAGGED,
        _request(return_date="2026-09-08", adults=3, max_stops="none"),
        client_factory=lambda _n, _c=client: _c,
    )
    assert client.single["origin"] == "SFO"
    assert client.single["destination"] == "JFK"
    assert client.single["departure_date"] == "2026-09-01"
    assert client.single["return_date"] == "2026-09-08"
    assert client.single["adults"] == 3
    assert client.single["max_stops"] == "none"
