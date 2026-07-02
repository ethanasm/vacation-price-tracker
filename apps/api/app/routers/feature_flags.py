"""Feature-flag endpoints for admin *users* (Settings-page toggles).

Unlike ``/v1/admin/flags`` (bearer ``ADMIN_QUERY_TOKEN``, for operators/CLI),
these authenticate with the normal user session and gate on the user's email
being listed in ``ADMIN_EMAILS``. They deliberately live outside the
``/v1/admin/`` prefix: that prefix is CSRF-exempt (bearer-only), while these
cookie-authenticated writes must keep the double-submit CSRF defense.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, StrictBool
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admins import is_admin_email
from app.core.errors import AccessDenied, NotFoundError
from app.core.feature_flags import canonical_flag_name, list_feature_flags, set_feature_flag
from app.db.deps import get_db
from app.routers.auth import UserResponse, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/feature-flags", tags=["feature-flags"])


class FeatureFlagItem(BaseModel):
    name: str
    description: str
    enabled: bool


class FeatureFlagsResponse(BaseModel):
    flags: list[FeatureFlagItem]


class FeatureFlagUpdate(BaseModel):
    # StrictBool so "yes"/1 aren't silently coerced — a mistyped truthy string
    # must not flip a production provider.
    enabled: StrictBool


def _require_admin(user: UserResponse) -> None:
    if not is_admin_email(user.email):
        raise AccessDenied("Admin access required.")


@router.get("", response_model=FeatureFlagsResponse)
async def get_feature_flags(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> FeatureFlagsResponse:
    """List every known feature flag with its live state (admin users only)."""
    _require_admin(current_user)
    flags = await list_feature_flags(db)
    return FeatureFlagsResponse(flags=[FeatureFlagItem(**flag) for flag in flags])


@router.patch("/{name}", response_model=FeatureFlagItem)
async def update_feature_flag(
    name: str,
    payload: FeatureFlagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> FeatureFlagItem:
    """Set a known feature flag's enabled state (admin users only).

    PATCH (not PUT) so the browser call passes the API's deliberately pinned
    CORS method allowlist (GET/POST/PATCH/DELETE — see app.main).
    """
    _require_admin(current_user)
    # Log/echo only the registry's own constant, never the raw path parameter
    # (client-controlled text must not reach logs or responses — CWE-117).
    flag_name = canonical_flag_name(name)
    if flag_name is None:
        raise NotFoundError("Unknown feature flag.")

    await set_feature_flag(db, flag_name, payload.enabled)
    logger.info(
        "Feature flag %s set to %s by admin user",
        flag_name,
        payload.enabled,
        extra={
            "event": "feature_flags.set",
            "flag": flag_name,
            "enabled": payload.enabled,
            "user_id": current_user.id,
        },
    )
    flags = {flag["name"]: flag for flag in await list_feature_flags(db)}
    return FeatureFlagItem(**flags[flag_name])
