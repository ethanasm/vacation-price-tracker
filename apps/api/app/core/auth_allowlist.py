"""Sign-in allowlist — gate Google sign-in by email and/or domain.

Mirrors showbook's `lib/auth-allowlist.ts`. Config comes from the env-driven
`AUTH_ALLOWED_EMAILS` / `AUTH_ALLOWED_DOMAINS` (comma-separated). Both unset →
open sign-up. If either is set → the OAuth callback denies anyone not on the
list. Read on every callback (no cache), so updating the env takes effect on
the next sign-in.
"""

from __future__ import annotations


def parse_allowlist(raw: str | None) -> list[str]:
    """Split a comma-separated env value into a lowercased, trimmed list."""
    return [item.strip().lower() for item in (raw or "").split(",") if item.strip()]


def is_email_allowed(email: str | None, *, emails: list[str], domains: list[str]) -> bool:
    """True if no allowlist is configured, or the email matches one entry."""
    if not emails and not domains:
        return True
    if not email:
        return False
    normalized = email.lower()
    if normalized in emails:
        return True
    return any(normalized.endswith("@" + domain) for domain in domains)


def should_allow_sign_in(
    *,
    email: str | None,
    email_verified: bool | None,
    emails: list[str],
    domains: list[str],
) -> bool:
    """Combined gate. Reject unverified Google accounts (a Workspace send-as /
    external alias can present an arbitrary `email` with `email_verified: false`,
    which would otherwise spoof a whitelisted address), then defer to the
    allowlist."""
    if email_verified is False:
        return False
    return is_email_allowed(email, emails=emails, domains=domains)
