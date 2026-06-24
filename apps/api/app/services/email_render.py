"""Render transactional emails from Jinja2 templates.

Templates live in ``apps/api/app/templates/email``. The loader resolves that
directory relative to this module (never the CWD) so it works identically when
imported by the API and by the Temporal worker, whose working directory differs.
"""

from decimal import Decimal
from pathlib import Path
from typing import TypedDict

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


class DigestTrip(TypedDict):
    """One triggered trip shown in a digest email."""

    name: str
    old_price: Decimal | None
    new_price: Decimal
    threshold_value: Decimal | None
    threshold_label: str
    trip_url: str


def _format_price(value: Decimal | None) -> str:
    if value is None:
        return "—"
    return f"${value:,.2f}"


def render_daily_digest(
    *,
    trips: list[DigestTrip],
    app_url: str,
    unsubscribe_url: str,
    physical_address: str,
) -> tuple[str, str]:
    """Render the daily digest. Returns ``(subject, html)``."""
    count = len(trips)
    if count == 1:
        subject = f"Price drop: {trips[0]['name']}"
    else:
        subject = f"Price drops on {count} of your trips"

    template = _env.get_template("daily_digest.html.j2")
    html = template.render(
        trips=trips,
        app_url=app_url,
        unsubscribe_url=unsubscribe_url,
        physical_address=physical_address,
        format_price=_format_price,
    )
    return subject, html


class CheckResult(TypedDict):
    """One health check's outcome (mirrors showbook's CheckResult)."""

    name: str
    status: str  # "ok" | "warn" | "fail" | "unknown"
    summary: str
    detail: dict | None


class FlagState(TypedDict):
    name: str
    description: str
    enabled: bool


def render_health_digest(
    *,
    status: str,
    checks: list[CheckResult],
    flags: list[FlagState],
    run_at: str,
    app_url: str,
) -> tuple[str, str]:
    """Render the system-health digest. Returns ``(subject, html)``.

    Subject mirrors showbook's ``formatSubject``.
    """
    fail = sum(1 for c in checks if c["status"] == "fail")
    warn = sum(1 for c in checks if c["status"] == "warn")
    if status == "fail":
        subject = f"[VPT health] FAIL — {fail} failing check{'' if fail == 1 else 's'}"
    elif status == "warn":
        subject = f"[VPT health] WARN — {warn} warning{'' if warn == 1 else 's'}"
    elif status == "unknown":
        subject = "[VPT health] UNKNOWN — checks unavailable"
    else:
        subject = "[VPT health] OK"

    template = _env.get_template("health_digest.html.j2")
    html = template.render(
        status=status,
        checks=checks,
        flags=flags,
        run_at=run_at,
        app_url=app_url,
    )
    return subject, html
