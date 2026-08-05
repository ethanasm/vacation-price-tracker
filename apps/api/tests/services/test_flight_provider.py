"""Tests for runtime flight-provider selection."""

from __future__ import annotations

import asyncio
import inspect
import logging

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


def test_dropped_constraints_reports_cabin_only_where_unsupported():
    with_cabin = _request(cabin="business")
    assert dropped_constraints(PROVIDER_SKIPLAGGED, with_cabin) == ("cabin",)
    assert dropped_constraints(PROVIDER_KIWI, with_cabin) == ()
    assert dropped_constraints(PROVIDER_FAST_FLIGHTS, with_cabin) == ()
    # No cabin asked for, nothing to drop.
    assert dropped_constraints(PROVIDER_SKIPLAGGED, _request()) == ()


def test_economy_on_skiplagged_is_honored_implicitly_not_dropped():
    """The default path must stay quiet.

    `TripFlightPrefs.cabin` defaults to ECONOMY and the worker always sends it,
    so treating "no cabin parameter" as "constraint dropped" would fire on every
    tracked trip on every refresh against the default provider — a warning that
    is ~100% false positive trains everyone to ignore it.
    """
    assert dropped_constraints(PROVIDER_SKIPLAGGED, _request(cabin="economy")) == ()
    assert capabilities_for(PROVIDER_SKIPLAGGED).implicit_cabin == "economy"


@pytest.mark.anyio
async def test_economy_on_skiplagged_logs_nothing(caplog):
    client = RecordingClient()
    with caplog.at_level(logging.WARNING):
        await search_flights(PROVIDER_SKIPLAGGED, _request(cabin="economy"), client=client)

    dropped = [r for r in caplog.records if getattr(r, "event", None) == _DROPPED_EVENT]
    assert dropped == []


def test_dropped_constraint_names_are_code_defined_not_request_values():
    """What gets logged must never be caller-controlled text (CWE-117).

    `cabin` can originate from LLM tool arguments, so the log carries the
    constraint *name* — a constant in this module — and never the value.
    """
    assert dropped_constraints(PROVIDER_SKIPLAGGED, _request(cabin="business")) == ("cabin",)
    injected = _request(cabin="business\nWARNING fake log line")
    assert dropped_constraints(PROVIDER_SKIPLAGGED, injected) == ("cabin",)


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
                search_flights(provider, request, client=recorder, all_pages=all_pages)
            )
            captured = recorder.all_pages if all_pages else recorder.single
            assert captured is not None

            method = getattr(client_cls, "search_flights_all" if all_pages else "search_flights")
            # Raises TypeError if the dispatcher passes anything this client
            # cannot accept, or omits a required parameter.
            inspect.signature(method).bind(object(), **captured)


@pytest.mark.anyio
@pytest.mark.parametrize("provider", [PROVIDER_KIWI, PROVIDER_FAST_FLIGHTS])
async def test_cabin_is_forwarded_to_providers_that_support_it(provider):
    client = RecordingClient()
    await search_flights(provider, _request(cabin="business"), client=client)
    assert client.single["cabin"] == "business"


@pytest.mark.anyio
async def test_cabin_is_dropped_for_skiplagged_and_logged(caplog):
    """Skiplagged has no cabin parameter, so the price returned is for a different cabin.

    The operator chose this provider, so it is not an error — but it must not be
    invisible, which is exactly how it behaved before.
    """
    client = RecordingClient()
    with caplog.at_level(logging.WARNING):
        await search_flights(PROVIDER_SKIPLAGGED, _request(cabin="business"), client=client)

    assert "cabin" not in client.single
    events = [r.event for r in caplog.records if hasattr(r, "event")]
    assert _DROPPED_EVENT in events


@pytest.mark.anyio
async def test_no_warning_when_no_cabin_was_requested(caplog):
    client = RecordingClient()
    with caplog.at_level(logging.WARNING):
        await search_flights(PROVIDER_SKIPLAGGED, _request(), client=client)

    assert not [r for r in caplog.records if getattr(r, "event", None) == _DROPPED_EVENT]


@pytest.mark.anyio
async def test_tracking_path_paginates_only_where_supported():
    skiplagged, kiwi = RecordingClient(), RecordingClient()
    await search_flights(PROVIDER_SKIPLAGGED, _request(), client=skiplagged, all_pages=True)
    await search_flights(PROVIDER_KIWI, _request(), client=kiwi, all_pages=True)

    assert skiplagged.all_pages["max_pages"] == TRACKING_MAX_PAGES
    assert "max_pages" not in kiwi.all_pages, "Kiwi accepts max_pages but ignores it"


@pytest.mark.anyio
async def test_paging_flag_selects_the_method_and_page_args():
    """Single-page (chat) carries sort/limit/offset; the full sweep does not."""
    chat, tracking = RecordingClient(), RecordingClient()
    result = await search_flights(PROVIDER_KIWI, _request(limit=10, offset=5), client=chat)
    await search_flights(PROVIDER_KIWI, _request(), client=tracking, all_pages=True)

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
        client=client,
    )
    assert client.single["origin"] == "SFO"
    assert client.single["destination"] == "JFK"
    assert client.single["departure_date"] == "2026-09-01"
    assert client.single["return_date"] == "2026-09-08"
    assert client.single["adults"] == 3
    assert client.single["max_stops"] == "none"
