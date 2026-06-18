"""Validation for the read-only admin SQL debug endpoint.

A friendly, early-rejection guard that refuses anything that isn't a single
read-only statement. This is *courtesy*, not the security boundary — the real
boundary is the Postgres `BEGIN READ ONLY` transaction (plus an always-rollback)
in `app.routers.admin`. Mirrors showbook's `lib/admin-query.ts`.
"""

from __future__ import annotations

# Verbs that can only read. `TABLE x` and `VALUES (...)` are read-only forms;
# `WITH` is allowed because CTEs front almost every non-trivial diagnostic
# SELECT (a `WITH ... DELETE` is caught by the READ ONLY transaction anyway).
ALLOWED_PREFIXES = ("select", "with", "explain", "show", "table", "values")


def validate_admin_query(raw: object) -> tuple[bool, str]:
    """Return ``(True, normalized_query)`` for an accepted single read-only
    statement, or ``(False, reason)`` otherwise."""
    if not isinstance(raw, str):
        return False, "query must be a string"

    query = raw.strip()
    if not query:
        return False, "query must not be empty"

    # Strip a single trailing semicolon, then reject any remaining one — that
    # would mean a second statement (`SELECT 1; DROP TABLE x`).
    core = query[:-1].rstrip() if query.endswith(";") else query
    if not core:
        return False, "query must not be empty"
    if ";" in core:
        return False, "multiple statements are not allowed"

    first = core.split(None, 1)[0].lower()
    if first not in ALLOWED_PREFIXES:
        allowed = ", ".join(p.upper() for p in ALLOWED_PREFIXES)
        return False, f"only read-only statements are allowed ({allowed})"

    return True, core
