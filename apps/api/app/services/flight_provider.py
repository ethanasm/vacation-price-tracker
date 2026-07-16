"""Runtime flight-provider selection (Skiplagged vs Kiwi vs fast-flights).

Flights can come from the Skiplagged MCP, the Kiwi.com MCP, or Google Flights
via the fast-flights scraper; hotels always come from Skiplagged. The active
flight provider is an operator-level runtime choice — the ``flight_provider``
app setting in the DB ``app_settings`` table (see ``app.core.app_settings``),
changed via ``PUT /v1/admin/settings/flight_provider`` (or the Settings-page
three-way switch) with no redeploy.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.fast_flights import FastFlightsClient, fast_flights_client
from app.clients.kiwi import KiwiClient, kiwi_client
from app.clients.skiplagged import SkiplaggedClient, skiplagged_client
from app.core.app_settings import AppSettings, get_app_setting

PROVIDER_SKIPLAGGED = "skiplagged"
PROVIDER_KIWI = "kiwi"
PROVIDER_FAST_FLIGHTS = "fast_flights"

FLIGHT_PROVIDERS = (PROVIDER_SKIPLAGGED, PROVIDER_KIWI, PROVIDER_FAST_FLIGHTS)


async def get_flight_provider_name(session: AsyncSession) -> str:
    """Return the active flight provider name ("skiplagged", "kiwi", or "fast_flights")."""
    value = await get_app_setting(session, AppSettings.FLIGHT_PROVIDER)
    if value in FLIGHT_PROVIDERS:
        return value
    return PROVIDER_SKIPLAGGED


def get_flight_client(provider: str) -> FastFlightsClient | KiwiClient | SkiplaggedClient:
    """Return the shared client instance for a provider name."""
    if provider == PROVIDER_KIWI:
        return kiwi_client
    if provider == PROVIDER_FAST_FLIGHTS:
        return fast_flights_client
    return skiplagged_client
