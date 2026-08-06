"""Runtime flight-provider selection (Skiplagged vs Kiwi vs fast-flights).

Flights can come from the Skiplagged MCP, the Kiwi.com MCP, or Google Flights
via the fast-flights scraper; hotels always come from Skiplagged. The active
flight provider is an operator-level runtime choice — the ``flight_provider``
app setting in the DB ``app_settings`` table (see ``app.core.app_settings``),
changed via ``PUT /v1/admin/settings/flight_provider`` (or the Settings-page
three-way switch) with no redeploy.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.fast_flights import FastFlightsClient, fast_flights_client
from app.clients.kiwi import KiwiClient, kiwi_client
from app.clients.skiplagged import SkiplaggedClient, skiplagged_client
from app.core.app_settings import AppSettings, get_app_setting
from app.schemas.flight_search import FlightSearchResult

logger = logging.getLogger(__name__)

PROVIDER_SKIPLAGGED = "skiplagged"
PROVIDER_KIWI = "kiwi"
PROVIDER_FAST_FLIGHTS = "fast_flights"

FLIGHT_PROVIDERS = (PROVIDER_SKIPLAGGED, PROVIDER_KIWI, PROVIDER_FAST_FLIGHTS)

FlightClient = FastFlightsClient | KiwiClient | SkiplaggedClient

# How many Skiplagged result pages the tracking path walks (~75 results each).
TRACKING_MAX_PAGES = 4


@dataclass(frozen=True)
class ProviderCapabilities:
    """What a provider can actually honor.

    The three clients are interface-compatible on their *results* but not on
    their *inputs*, and the gaps are silent: passing ``cabin`` to a provider
    that has no such parameter does not fail, it returns a price for a
    different cabin. Declaring the gaps here is what lets the call sites see
    them instead of discovering them from a user's bug report.
    """

    cabin: bool
    """Whether the provider can constrain results by cabin class."""

    paginates: bool
    """Whether the provider walks multiple result pages (``max_pages``)."""


# Every provider currently honors cabin. Kept as a table rather than collapsed
# away because the *point* is that a provider's parameter set is data, not
# something each call site re-derives — and the next provider may well differ.
#
# A capability MUST describe the provider, not this repo's adapter. An earlier
# version declared Skiplagged `cabin=False` on the strength of our client not
# sending the parameter; the provider had supported it (`fareClass`) all along.
# Verify against the provider's own schema before recording a `False` here.
CAPABILITIES: dict[str, ProviderCapabilities] = {
    PROVIDER_SKIPLAGGED: ProviderCapabilities(cabin=True, paginates=True),
    PROVIDER_KIWI: ProviderCapabilities(cabin=True, paginates=False),
    PROVIDER_FAST_FLIGHTS: ProviderCapabilities(cabin=True, paginates=False),
}


@dataclass(frozen=True)
class FlightSearchRequest:
    """One provider-agnostic flight query.

    The union of what any provider accepts. Constraints a given provider cannot
    honor are dropped by :func:`search_flights` — visibly, via
    ``flight_provider.constraint_dropped`` — rather than silently at the client
    boundary.
    """

    origin: str
    destination: str
    departure_date: str
    return_date: str | None = None
    adults: int = 1
    max_stops: str | None = None
    sort: str = "value"
    limit: int = 75
    offset: int = 0
    cabin: str | None = None


async def get_flight_provider_name(session: AsyncSession) -> str:
    """Return the active flight provider name ("skiplagged", "kiwi", or "fast_flights")."""
    value = await get_app_setting(session, AppSettings.FLIGHT_PROVIDER)
    if value in FLIGHT_PROVIDERS:
        return value
    return PROVIDER_SKIPLAGGED


def get_flight_client(provider: str) -> FlightClient:
    """Return the shared client instance for a provider name."""
    if provider == PROVIDER_KIWI:
        return kiwi_client
    if provider == PROVIDER_FAST_FLIGHTS:
        return fast_flights_client
    return skiplagged_client


def capabilities_for(provider: str) -> ProviderCapabilities:
    """Capabilities for ``provider``, defaulting to Skiplagged's (the fallback client)."""
    return CAPABILITIES.get(provider, CAPABILITIES[PROVIDER_SKIPLAGGED])


def dropped_constraints(provider: str, request: FlightSearchRequest) -> tuple[str, ...]:
    """Constraints in ``request`` that ``provider`` will genuinely not honor.

    Empty for every provider today — all three honor cabin. The check stays
    because the next provider may not, and a constraint silently dropped is an
    answer to a different question than the one asked.

    Returns code-defined constraint names, never request values, so callers can
    log the result directly (CWE-117).
    """
    caps = capabilities_for(provider)
    dropped: list[str] = []
    if request.cabin and not caps.cabin:
        dropped.append("cabin")
    return tuple(dropped)


async def search_flights(
    provider: str,
    request: FlightSearchRequest,
    *,
    client: FlightClient | None = None,
    all_pages: bool = False,
) -> FlightSearchResult:
    """Run one flight search, passing only the arguments ``provider`` accepts.

    The single place that knows each provider's parameter set. Both call sites
    (the chat tool's single page and the worker's full tracking sweep) go
    through here so a provider's quirks are described once rather than
    re-derived per caller.

    ``client`` defaults to the shared instance for ``provider``; pass one to
    keep an instance you already hold — the chat tool's injected test doubles,
    or the worker's per-activity client.
    """
    caps = capabilities_for(provider)
    if client is None:
        client = get_flight_client(provider)

    kwargs: dict[str, Any] = {
        "origin": request.origin,
        "destination": request.destination,
        "departure_date": request.departure_date,
        "return_date": request.return_date,
        "adults": request.adults,
        "max_stops": request.max_stops,
    }

    if caps.cabin:
        kwargs["cabin"] = request.cabin

    for constraint in dropped_constraints(provider, request):
        # Not an error — the operator picked this provider — but it must not be
        # invisible: the returned price is for something other than what was
        # asked for. Only the code-defined constraint *name* is logged, never
        # the requested value, which can originate from LLM tool args (CWE-117).
        logger.warning(
            "Provider %s cannot honor the requested %s; searching without it",
            provider,
            constraint,
            extra={
                "event": "flight_provider.constraint_dropped",
                "provider": provider,
                "constraint": constraint,
            },
        )

    if all_pages:
        if caps.paginates:
            kwargs["max_pages"] = TRACKING_MAX_PAGES
        return await client.search_flights_all(**kwargs)

    kwargs["sort"] = request.sort
    kwargs["limit"] = request.limit
    kwargs["offset"] = request.offset
    return await client.search_flights(**kwargs)
