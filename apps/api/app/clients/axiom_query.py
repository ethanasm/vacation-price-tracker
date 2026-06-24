"""Read-only Axiom query client (for the health digest's error-volume check).

The app's ingest token (`AXIOM_TOKEN`) cannot query; reading needs a Personal
Access Token with Query capability (`AXIOM_QUERY_TOKEN`) plus the org slug
(`AXIOM_ORG_ID`). Best-effort: every failure (unconfigured, network, unexpected
shape) returns ``None`` so the caller degrades to an `unknown` check rather than
failing the digest.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

AXIOM_APL_URL = "https://api.axiom.co/v1/datasets/_apl?format=tabular"
DEFAULT_TIMEOUT_SECONDS = 15.0


async def query_count(apl: str) -> int | None:
    """Run an APL query that returns a single count; return it, or None on any error.

    Expects an APL ending in ``| count`` (Axiom returns a single row/column).
    """
    if not settings.axiom_query_enabled:
        return None
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(DEFAULT_TIMEOUT_SECONDS)) as client:
            response = await client.post(
                AXIOM_APL_URL,
                json={"apl": apl},
                headers={
                    "Authorization": f"Bearer {settings.axiom_query_token}",
                    "X-AXIOM-ORG-ID": settings.axiom_org_id,
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            return _extract_count(response.json())
    except Exception as exc:  # pragma: no cover - network/parse error path
        logger.warning(
            "Axiom query failed",
            exc_info=exc,
            extra={"event": "axiom.query.failed"},
        )
        return None


def _extract_count(payload: dict) -> int | None:
    """Pull the scalar count out of Axiom's tabular response shape."""
    tables = payload.get("tables") or []
    for table in tables:
        columns = table.get("columns") or []
        # tabular `| count` → a single column with a single row holding the total.
        if columns and columns[0]:
            try:
                return int(columns[0][0])
            except (TypeError, ValueError, IndexError):
                return None
    return None
