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
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from provider_router import (
    AllProvidersFailed,
    Attempt,
    Deadline,
    Failure,
    Outcome,
    RouteAborted,
    Router,
    budget_exhausted,
    rate_limited,
    terminal,
    transient,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.fast_flights import (
    FastFlightsClient,
    FastFlightsTransientError,
    fast_flights_client,
)
from app.clients.kiwi import (
    KiwiClient,
    KiwiConnectionError,
    KiwiRateLimitError,
    KiwiTransientError,
    kiwi_client,
)
from app.clients.skiplagged import (
    SkiplaggedClient,
    SkiplaggedConnectionError,
    SkiplaggedRateLimitError,
    SkiplaggedTransientError,
    skiplagged_client,
)
from app.core.app_settings import AppSettings, get_app_setting
from app.core.errors import GlobalBudgetExceeded
from app.schemas.flight_search import FlightSearchResult

logger = logging.getLogger(__name__)

PROVIDER_SKIPLAGGED = "skiplagged"
PROVIDER_KIWI = "kiwi"
PROVIDER_FAST_FLIGHTS = "fast_flights"

FLIGHT_PROVIDERS = (PROVIDER_SKIPLAGGED, PROVIDER_KIWI, PROVIDER_FAST_FLIGHTS)

FlightClient = FastFlightsClient | KiwiClient | SkiplaggedClient

# How many Skiplagged result pages the tracking path walks (~75 results each).
TRACKING_MAX_PAGES = 4

# Each client already distinguishes "throttled" from "blip" from "broken"; the
# router only needs those three buckets named once. Rate limits are checked
# first because they subclass the transient errors.
RATE_LIMIT_ERRORS = (SkiplaggedRateLimitError, KiwiRateLimitError)
TRANSIENT_ERRORS = (
    SkiplaggedTransientError,
    SkiplaggedConnectionError,
    KiwiTransientError,
    KiwiConnectionError,
    FastFlightsTransientError,
    TimeoutError,
)


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


async def _search_one(
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


# --------------------------------------------------------------------------- #
# Failover
#
# The `flight_provider` setting stops being "the provider" and becomes "the
# provider we prefer". A Skiplagged 429 used to mean a failed refresh and an
# operator noticing, then flipping the setting by hand — which is exactly what
# happened during the sustained 429s of July 2026. The order below is the same
# preference, honoured automatically.
#
# The clients stay exactly as they are; what follows is the translation layer
# `provider-router` asks for — how each provider says "I can't", in one shared
# vocabulary.
# --------------------------------------------------------------------------- #


class _FlightProvider:
    """One flight client, wearing the router's contract."""

    def __init__(
        self,
        name: str,
        make_client: Callable[[str], FlightClient],
        *,
        all_pages: bool,
    ) -> None:
        self.name = name
        self._make_client = make_client
        self._all_pages = all_pages

    def supports(self, request: FlightSearchRequest) -> bool:
        """Always true — deliberately, and not because nothing can be unsupported.

        The library's instinct is to decline rather than answer a different
        question than the one asked, and that instinct is right in general. But
        this repo already decided the opposite for flights: an unhonorable
        constraint is *logged* (`flight_provider.constraint_dropped`) and the
        search runs anyway, because the operator picked this provider and a
        thinner answer beats no answer.

        Changing that here would be a behaviour change smuggled in under a
        failover change. It is also moot today — all three providers honour
        cabin, so `dropped_constraints` is empty in practice. Revisit it as its
        own decision when a provider actually differs.
        """
        return True

    async def invoke(self, request: FlightSearchRequest, deadline: Deadline) -> FlightSearchResult:
        # Built here, not in the constructor: a fallback that never gets tried
        # should never be constructed. Clients hold connection state and the
        # common case is that the preferred provider answers.
        return await _search_one(
            self.name, request, client=self._make_client(self.name), all_pages=self._all_pages
        )

    def classify(self, exc: BaseException) -> Failure:
        """Translate a client's exception into the shared vocabulary.

        The one that matters is ``GlobalBudgetExceeded``: it is route-terminal,
        so the router aborts instead of failing over. Trying the next provider
        after a daily spend ceiling trips would spend *more* against the very
        ceiling that just tripped — the failure amplifies itself.
        """
        if isinstance(exc, GlobalBudgetExceeded):
            return budget_exhausted(str(exc), cause=exc)

        retry_after = getattr(exc, "retry_after", None)
        if isinstance(exc, RATE_LIMIT_ERRORS):
            return rate_limited(
                str(exc),
                retry_after=retry_after if isinstance(retry_after, int | float) else None,
                cause=exc,
            )
        if isinstance(exc, TRANSIENT_ERRORS):
            return transient(str(exc), cause=exc)
        return terminal(str(exc), cause=exc)

    def assess(self, result: FlightSearchResult, attempt: Attempt) -> Outcome:
        """Always OK — an empty result is a real answer, not a thin one.

        "No flights on this route for these dates" is information the caller
        wants, and failing over to ask a second provider the same question
        would spend a call to be told the same thing.
        """
        return Outcome.OK


def failover_order(preferred: str) -> tuple[str, ...]:
    """``preferred`` first, then the rest in their declared order."""
    rest = tuple(p for p in FLIGHT_PROVIDERS if p != preferred)
    return (preferred, *rest) if preferred in FLIGHT_PROVIDERS else FLIGHT_PROVIDERS


async def search_flights(
    provider: str,
    request: FlightSearchRequest,
    *,
    client_factory: Callable[[str], FlightClient] | None = None,
    all_pages: bool = False,
    failover: bool = False,
) -> FlightSearchResult:
    """Run one flight search against ``provider``, optionally failing over.

    With ``failover=True``, ``provider`` is the *preferred* provider — the
    operator's setting — not the only one. On a rate limit or a transient
    failure the router moves down :func:`failover_order`; on a spend ceiling it
    aborts rather than spending more against the ceiling that just tripped.

    **Off by default, and on for the tracking sweep.** The worker refreshes
    prices unattended overnight: a Skiplagged 429 there means a missing point in
    a price history nobody is watching, so it should quietly ask Kiwi instead.
    The chat tool's search is interactive — the user is right there, a second
    provider costs them seconds of latency, and a failed search is something
    they can simply ask again. Different failure economics, different default.

    The answering provider rides along on ``FlightSearchResult.provider``, which
    is what ``price_snapshots.provider`` records — so a failover is visible in
    the price history rather than looking like the market moved.

    ``client_factory`` supplies the instance for a given provider — the chat
    tool's injected doubles, the worker's per-activity instances. A factory
    rather than one client because failover reaches providers the caller did
    not name, and a caller that deliberately constructs its own client should
    not silently get a shared global for the fallback. It is called lazily, so
    a provider that is never tried is never constructed.
    """
    make_client = client_factory or get_flight_client
    order = failover_order(provider) if failover else (provider,)
    providers = [
        _FlightProvider(name, make_client, all_pages=all_pages) for name in order
    ]

    router: Router[FlightSearchRequest, FlightSearchResult] = Router(
        providers,
        events=_log_route_event,
    )

    try:
        route = await router.invoke(request)
    except RouteAborted as exc:
        # Route-terminal: re-raise the cause so callers keep the exception type
        # they already handle (the worker turns GlobalBudgetExceeded into a
        # non-retriable Temporal failure; chat turns it into an SSE error).
        if exc.failure.cause is not None:
            raise exc.failure.cause from None
        raise
    except AllProvidersFailed as exc:
        # Same reasoning: the callers catch the clients' own exception types, so
        # surface the last real cause rather than a router error they have never
        # heard of. Only a route where every provider was *skipped* has no cause.
        last = next(
            (a.failure.cause for a in reversed(exc.attempts) if a.failure and a.failure.cause),
            None,
        )
        if last is not None:
            raise last from None
        raise

    if route.failed_over:
        logger.warning(
            "Flight search failed over from %s to %s",
            provider,
            route.provider,
            extra={
                "event": "flight_provider.failed_over",
                "preferred": provider,
                "provider": route.provider,
                "attempts": [a.provider for a in route.attempts],
            },
        )
    return route.value


def _log_route_event(event: object) -> None:
    """Relay router events into the app's structured logging.

    Only code-defined names and provider identifiers reach the log — never
    request values, which can originate from LLM tool arguments (CWE-117).
    """
    name = getattr(event, "name", "")
    provider = getattr(event, "provider", None)
    if name in _NOISY_EVENTS:
        return
    logger.info(
        "flight route event",
        extra={"event": name, "provider": provider},
    )


_NOISY_EVENTS = frozenset({"router.route.started", "router.route.selected"})
