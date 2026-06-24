"""Tests for daily digest email rendering."""

from decimal import Decimal

from app.services.email_render import DigestTrip, render_daily_digest, render_health_digest


def _checks(*statuses: str):
    return [
        {"name": f"check_{i}", "status": s, "summary": f"summary {i}", "detail": None}
        for i, s in enumerate(statuses)
    ]


def test_render_health_digest_ok_subject():
    subject, html = render_health_digest(
        status="ok",
        checks=_checks("ok", "ok"),
        flags=[{"name": "email_notifications", "description": "x", "enabled": True}],
        run_at="2026-06-24 07:00 UTC",
        app_url="https://app.test",
    )
    assert subject == "[VPT health] OK"
    assert "check_0" in html
    assert "email_notifications" in html


def test_render_health_digest_fail_subject_counts():
    subject, _ = render_health_digest(
        status="fail",
        checks=_checks("ok", "fail", "fail"),
        flags=[],
        run_at="now",
        app_url="",
    )
    assert subject == "[VPT health] FAIL — 2 failing checks"


def test_render_health_digest_warn_singular():
    subject, _ = render_health_digest(
        status="warn", checks=_checks("ok", "warn"), flags=[], run_at="now", app_url=""
    )
    assert subject == "[VPT health] WARN — 1 warning"


def test_render_health_digest_unknown():
    subject, _ = render_health_digest(
        status="unknown", checks=_checks("unknown"), flags=[], run_at="now", app_url=""
    )
    assert subject == "[VPT health] UNKNOWN — checks unavailable"


def _trip(name: str = "Maui Getaway") -> DigestTrip:
    return {
        "name": name,
        "old_price": Decimal("2500.00"),
        "new_price": Decimal("1900.00"),
        "threshold_value": Decimal("2000.00"),
        "threshold_label": "Trip total",
        "trip_url": "https://app.test/trips/abc",
    }


def test_render_single_trip_subject_and_body():
    subject, html = render_daily_digest(
        trips=[_trip()],
        app_url="https://app.test",
        unsubscribe_url="https://app.test/v1/notifications/unsubscribe?token=tok",
        physical_address="1 Test St",
    )

    assert subject == "Price drop: Maui Getaway"
    assert "Maui Getaway" in html
    assert "$1,900.00" in html
    assert "$2,500.00" in html
    assert "https://app.test/trips/abc" in html
    assert "unsubscribe?token=tok" in html
    assert "1 Test St" in html


def test_render_multiple_trips_subject():
    subject, html = render_daily_digest(
        trips=[_trip("Maui"), _trip("Tokyo")],
        app_url="https://app.test",
        unsubscribe_url="https://app.test/u",
        physical_address="",
    )

    assert subject == "Price drops on 2 of your trips"
    assert "Maui" in html and "Tokyo" in html


def test_render_handles_missing_old_price_and_threshold():
    trip = _trip()
    trip["old_price"] = None
    trip["threshold_value"] = None
    _, html = render_daily_digest(
        trips=[trip],
        app_url="https://app.test",
        unsubscribe_url="https://app.test/u",
        physical_address="",
    )

    # Em dash rendered for the missing previous price; no per-trip threshold line.
    assert "&#8212;" in html or "—" in html
    assert "Trip total target:" not in html
