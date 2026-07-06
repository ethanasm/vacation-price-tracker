"""Daily system-health digest (showbook-style).

Runs independent checks in parallel — each catching its own errors and returning
a ``CheckResult`` — rolls them up to an overall status, and emails a summary to
``ADMIN_EMAILS`` via the shared ``ResendClient``. Never throws: a single check or
the email failing must not fail the workflow.

Axiom-backed checks return ``unknown`` when the query token is unset (mirrors
showbook's skip semantics); DB/infra checks run without Axiom.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from app.clients.axiom_query import query_count
from app.clients.email import ResendClient
from app.core.cache_keys import CacheKeys
from app.core.config import settings
from app.core.constants import NotificationStatus, TripStatus
from app.core.feature_flags import list_feature_flags
from app.db.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.models.notification_outbox import NotificationOutbox
from app.models.price_snapshot import PriceSnapshot
from app.models.trip import Trip
from app.services.email_render import CheckResult, render_health_digest
from sqlalchemy import func, text
from sqlmodel import select
from temporalio import activity
from temporalio.client import Client

logger = logging.getLogger(__name__)

REFRESH_SCHEDULE_ID = "daily-price-refresh"
_DATA_FRESHNESS_WINDOW_HOURS = 24
_ERROR_VOLUME_FAIL_THRESHOLD = 100


def _result(name: str, status: str, summary: str, detail: dict | None = None) -> CheckResult:
    return {"name": name, "status": status, "summary": summary, "detail": detail}


def _errored(name: str, status: str, summary: str, exc: BaseException) -> CheckResult:
    """Degrade a thrown check to a CheckResult, but log the exception first.

    The email digest only carries ``str(exc)``; without this log the stack never
    reaches Axiom/stdout and the underlying cause is undiagnosable.
    """
    logger.warning(
        "Health check %s errored",
        name,
        exc_info=exc,
        extra={"event": f"health.check.{name}.error"},
    )
    return _result(name, status, summary)


def _rollup(checks: list[CheckResult]) -> str:
    statuses = {c["status"] for c in checks}
    if "fail" in statuses:
        return "fail"
    if "warn" in statuses:
        return "warn"
    if statuses == {"unknown"}:
        return "unknown"
    return "ok"


async def _check_database() -> CheckResult:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return _result("database", "ok", "Postgres reachable")
    except Exception as exc:
        return _errored("database", "fail", f"Postgres unreachable: {exc}", exc)


async def _check_redis() -> CheckResult:
    try:
        await redis_client.ping()
        return _result("redis", "ok", "Redis reachable")
    except Exception as exc:
        return _errored("redis", "fail", f"Redis unreachable: {exc}", exc)


def _check_temporal(client: Client | None) -> CheckResult:
    if client is None:
        return _result("temporal", "fail", "Temporal unreachable")
    return _result("temporal", "ok", "Temporal reachable")


async def _check_data_freshness() -> CheckResult:
    try:
        cutoff = datetime.now(UTC) - timedelta(hours=_DATA_FRESHNESS_WINDOW_HOURS)
        async with AsyncSessionLocal() as session:
            count = (
                await session.execute(
                    select(func.count())
                    .select_from(PriceSnapshot)
                    .where(PriceSnapshot.created_at >= cutoff)
                )
            ).scalar_one()
        detail = {"snapshots_24h": count}
        if count == 0:
            return _result(
                "data_freshness",
                "fail",
                "No price snapshots in the last 24h — the refresh may not be running",
                detail,
            )
        return _result("data_freshness", "ok", f"{count} price snapshots in the last 24h", detail)
    except Exception as exc:
        return _errored("data_freshness", "fail", f"Snapshot query failed: {exc}", exc)


async def _check_failed_trips() -> CheckResult:
    try:
        async with AsyncSessionLocal() as session:
            errored = (
                await session.execute(
                    select(func.count())
                    .select_from(Trip)
                    .where(Trip.status == TripStatus.ERROR)
                )
            ).scalar_one()
            active = (
                await session.execute(
                    select(func.count())
                    .select_from(Trip)
                    .where(Trip.status == TripStatus.ACTIVE)
                )
            ).scalar_one()
        detail = {"error": errored, "active": active}
        if errored:
            return _result("failed_trips", "warn", f"{errored} trip(s) in ERROR status", detail)
        return _result("failed_trips", "ok", f"No errored trips ({active} active)", detail)
    except Exception as exc:
        return _errored("failed_trips", "fail", f"Trip status query failed: {exc}", exc)


async def _check_notifications() -> CheckResult:
    try:
        async with AsyncSessionLocal() as session:
            failed = (
                await session.execute(
                    select(func.count())
                    .select_from(NotificationOutbox)
                    .where(NotificationOutbox.status == NotificationStatus.FAILED)
                )
            ).scalar_one()
            pending = (
                await session.execute(
                    select(func.count())
                    .select_from(NotificationOutbox)
                    .where(NotificationOutbox.status == NotificationStatus.PENDING)
                )
            ).scalar_one()
        detail = {"failed": failed, "pending": pending}
        if failed:
            return _result(
                "notifications", "warn", f"{failed} notification(s) failed to send", detail
            )
        return _result(
            "notifications", "ok", f"No failed notifications ({pending} pending)", detail
        )
    except Exception as exc:
        return _errored("notifications", "fail", f"Outbox query failed: {exc}", exc)


async def _check_budget(name: str, metric: str, limit: int, label: str) -> CheckResult:
    try:
        day = datetime.now(UTC).strftime("%Y%m%d")
        raw = await redis_client.get(CacheKeys.global_budget(metric, day))
        used = int(raw) if raw else 0
        pct = (used / limit * 100) if limit else 0.0
        detail = {"used": used, "limit": limit, "pct": round(pct, 1)}
        summary = f"{label}: {used:,}/{limit:,} ({pct:.0f}%) today"
        if limit and used >= limit:
            return _result(name, "fail", f"{summary} — breaker tripped", detail)
        if pct >= 80:
            return _result(name, "warn", summary, detail)
        return _result(name, "ok", summary, detail)
    except Exception as exc:
        return _errored(name, "unknown", f"{label} budget read failed: {exc}", exc)


def _summarize_chained_refresh(refresh_summary: dict) -> CheckResult:
    """Build the refresh_run check from the run that chained this health check.

    No Temporal history read: the ScheduledRefreshAllUsersWorkflow that just
    finished passed its own results (plus the digest outcome) in.
    """
    total = refresh_summary.get("users_total", 0)
    ok = refresh_summary.get("users_successful", 0)
    failed = refresh_summary.get("users_failed", 0)
    digests = refresh_summary.get("digests")
    digest_note = ""
    if isinstance(digests, dict):
        digest_note = (
            f"; digests sent {digests.get('sent', 0)}/{digests.get('users_total', 0)}"
            f" (skipped {digests.get('skipped', 0)})"
        )
    if failed:
        return _result(
            "refresh_run",
            "warn",
            f"Today's refresh completed with {failed} user failure(s)"
            f" ({ok}/{total} ok){digest_note}",
            dict(refresh_summary),
        )
    return _result(
        "refresh_run",
        "ok",
        f"Today's refresh OK ({ok}/{total} users){digest_note}",
        dict(refresh_summary),
    )


async def _refresh_run_check(
    client: Client | None, refresh_summary: dict | None
) -> CheckResult:
    """Chained runs report their own results; cron runs read schedule history."""
    if refresh_summary is not None:
        return _summarize_chained_refresh(refresh_summary)
    return await _check_refresh_run(client)


async def _check_refresh_run(client: Client | None) -> CheckResult:
    if client is None:
        return _result("refresh_run", "unknown", "Temporal unreachable — schedule history unread")
    try:
        handle = client.get_schedule_handle(REFRESH_SCHEDULE_ID)
        desc = await handle.describe()
        actions = desc.info.recent_actions
        if not actions:
            return _result("refresh_run", "warn", "No recorded refresh runs yet")
        last = actions[-1]
        wf = client.get_workflow_handle(
            last.action.workflow_id, run_id=last.action.first_execution_run_id
        )
        wf_desc = await wf.describe()
        status_name = wf_desc.status.name if wf_desc.status else "UNKNOWN"
        detail: dict = {"workflow_id": last.action.workflow_id, "status": status_name}
        if status_name == "COMPLETED":
            try:
                result = await wf.result()
                if isinstance(result, dict):
                    detail.update(result)
                    failed = result.get("users_failed", 0)
                    if failed:
                        return _result(
                            "refresh_run",
                            "warn",
                            f"Last refresh completed with {failed} user failure(s)",
                            detail,
                        )
                    return _result(
                        "refresh_run",
                        "ok",
                        f"Last refresh OK ({result.get('users_successful', 0)}/"
                        f"{result.get('users_total', 0)} users)",
                        detail,
                    )
            except Exception as exc:  # pragma: no cover - result fetch best-effort
                logger.warning(
                    "Health check refresh_run could not read the workflow result",
                    exc_info=exc,
                    extra={"event": "health.check.refresh_run.result_read_failed"},
                )
            return _result("refresh_run", "ok", "Last refresh completed", detail)
        if status_name == "RUNNING":
            # The cron health check fires an hour after the refresh; a run
            # still open at that point is stuck or badly delayed (the Jun 2026
            # outage sat "RUNNING" for 11 days and read as ok here).
            return _result(
                "refresh_run", "warn", "Refresh still running at health-check time", detail
            )
        if status_name in {"FAILED", "TERMINATED", "TIMED_OUT", "CANCELED"}:
            return _result("refresh_run", "fail", f"Last refresh {status_name}", detail)
        return _result("refresh_run", "warn", f"Last refresh status: {status_name}", detail)
    except Exception as exc:
        return _errored("refresh_run", "unknown", f"Schedule history read failed: {exc}", exc)


async def _check_error_volume() -> CheckResult:
    if not settings.axiom_query_enabled:
        return _result("error_volume", "unknown", "Axiom query token unset — skipped")
    # axiom_dataset is trusted operator config (env), not user input — safe to interpolate.
    apl = (
        f'["{settings.axiom_dataset}"] '
        '| where _time > ago(24h) and level == "error" | count'
    )
    count = await query_count(apl)
    if count is None:
        return _result("error_volume", "unknown", "Axiom query failed")
    detail = {"errors_24h": count}
    if count >= _ERROR_VOLUME_FAIL_THRESHOLD:
        return _result("error_volume", "fail", f"{count} error logs in the last 24h", detail)
    if count > 0:
        return _result("error_volume", "warn", f"{count} error logs in the last 24h", detail)
    return _result("error_volume", "ok", "No error logs in the last 24h", detail)


async def _connect_temporal() -> Client | None:
    try:
        return await Client.connect(
            settings.temporal_address, namespace=settings.temporal_namespace
        )
    except Exception as exc:
        logger.warning(
            "Health check could not connect to Temporal",
            exc_info=exc,
            extra={"event": "health.check.temporal.connect_failed"},
        )
        return None


@activity.defn
async def run_health_check_activity(refresh_summary: dict | None = None) -> dict:
    """Run all health checks, roll up status, and email the digest to ADMIN_EMAILS.

    ``refresh_summary`` (results of the ScheduledRefreshAllUsersWorkflow run
    that chained this check, including the digest outcome) feeds the
    refresh_run check directly; without it the outcome is read from Temporal
    schedule history (standalone cron firing).
    """
    now = datetime.now(UTC)
    temporal_client = await _connect_temporal()

    checks: list[CheckResult] = list(
        await asyncio.gather(
            _check_database(),
            _check_redis(),
            _check_data_freshness(),
            _check_failed_trips(),
            _check_notifications(),
            _check_budget(
                "groq_budget", "groq_tokens", settings.global_daily_groq_token_budget, "Groq tokens"
            ),
            _check_budget(
                "skiplagged_budget",
                "skiplagged_calls",
                settings.global_daily_skiplagged_call_budget,
                "Skiplagged calls",
            ),
            _check_budget(
                "kiwi_budget",
                "kiwi_calls",
                settings.global_daily_skiplagged_call_budget,
                "Kiwi calls",
            ),
            _refresh_run_check(temporal_client, refresh_summary),
            _check_error_volume(),
        )
    )
    checks.insert(2, _check_temporal(temporal_client))

    status = _rollup(checks)
    counts = {s: sum(1 for c in checks if c["status"] == s) for s in ("ok", "warn", "fail", "unknown")}

    # One queryable event per sub-check (showbook's health.check.<name>.<status>
    # pattern) so a single failing check is visible in Axiom without parsing the
    # rollup — failed checks at error, degraded at warn.
    _CHECK_LEVELS = {"fail": logging.ERROR, "warn": logging.WARNING}
    for check in checks:
        logger.log(
            _CHECK_LEVELS.get(check["status"], logging.INFO),
            "Health check %s: %s — %s",
            check["name"],
            check["status"],
            check["summary"],
            extra={
                "event": f"health.check.{check['name']}.{check['status']}",
                "status": check["status"],
            },
        )

    try:
        async with AsyncSessionLocal() as session:
            flags = await list_feature_flags(session)
    except Exception as exc:  # pragma: no cover - informational only
        logger.warning(
            "Health check could not read feature flags",
            exc_info=exc,
            extra={"event": "health.check.flags.error"},
        )
        flags = []

    recipients = settings.admin_emails_list
    sent = 0
    if not recipients:
        logger.info(
            "Health check complete (%s); email skipped — no ADMIN_EMAILS",
            status,
            extra={"event": "health.check.summary", "status": status, **counts, "sent": 0},
        )
        return {"status": status, "sent": 0, "skipped": True, **counts}

    # Render + send inside one guard so a template regression (or any send
    # failure) is logged rather than thrown — the activity must never fail the
    # workflow over the email itself.
    try:
        subject, html = render_health_digest(
            status=status,
            checks=checks,
            flags=flags,
            run_at=now.strftime("%Y-%m-%d %H:%M UTC"),
            app_url=settings.frontend_url.rstrip("/"),
        )
        await ResendClient().send(
            to=recipients,
            subject=subject,
            html=html,
            idempotency_key=f"health-summary-{now.strftime('%Y%m%d')}",
        )
        sent = len(recipients)
    except Exception as exc:
        logger.error(
            "Health digest render/send failed",
            exc_info=exc,
            extra={"event": "health.check.email.failed"},
        )

    logger.info(
        "Health check complete (%s)",
        status,
        extra={"event": "health.check.summary", "status": status, **counts, "sent": sent},
    )
    return {"status": status, "sent": sent, "skipped": False, **counts}
