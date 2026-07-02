"""Runtime flight-provider selection (Skiplagged vs Kiwi).

Flights can come from either the Skiplagged MCP or the Kiwi.com MCP; hotels
always come from Skiplagged. The active flight provider is an operator-level
runtime toggle — the ``kiwi_flights`` feature flag in the DB ``feature_flags``
table (see ``app.core.feature_flags``), flippable via
``PUT /v1/admin/flags/kiwi_flights`` with no redeploy.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.kiwi import KiwiClient, kiwi_client
from app.clients.skiplagged import SkiplaggedClient, skiplagged_client
from app.core.feature_flags import FeatureFlags, is_feature_enabled

PROVIDER_SKIPLAGGED = "skiplagged"
PROVIDER_KIWI = "kiwi"


async def get_flight_provider_name(session: AsyncSession) -> str:
    """Return the active flight provider name ("kiwi" or "skiplagged")."""
    if await is_feature_enabled(session, FeatureFlags.KIWI_FLIGHTS):
        return PROVIDER_KIWI
    return PROVIDER_SKIPLAGGED


def get_flight_client(provider: str) -> KiwiClient | SkiplaggedClient:
    """Return the shared client instance for a provider name."""
    if provider == PROVIDER_KIWI:
        return kiwi_client
    return skiplagged_client
