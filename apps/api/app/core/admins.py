"""Admin-user resolution from the ADMIN_EMAILS env var.

`ADMIN_EMAILS` (comma-separated) already designates who receives the ops health
digest; the same list now also grants access to the in-app admin settings
(feature-flag toggles). Read at call time — updating the env + restarting the
API changes the admin set, no code change.
"""

from __future__ import annotations

from app.core.config import settings


def admin_email_set() -> frozenset[str]:
    """The normalized (lowercased, trimmed) set of admin emails."""
    return frozenset(
        email.strip().lower()
        for email in (settings.admin_emails or "").split(",")
        if email.strip()
    )


def is_admin_email(email: str | None) -> bool:
    """Whether ``email`` belongs to an operator listed in ADMIN_EMAILS."""
    if not email:
        return False
    return email.strip().lower() in admin_email_set()
