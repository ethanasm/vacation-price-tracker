"""App-setting endpoints for admin *users* (Settings-page controls).

The string-valued cousin of ``app.routers.feature_flags`` — used where a
control has more than two states (e.g. the ``flight_provider`` three-way
switch). Unlike ``/v1/admin/settings`` (bearer ``ADMIN_QUERY_TOKEN``, for
operators/CLI), these authenticate with the normal user session and gate on
the user's email being listed in ``ADMIN_EMAILS``. They deliberately live
outside the ``/v1/admin/`` prefix: that prefix is CSRF-exempt (bearer-only),
while these cookie-authenticated writes must keep the double-submit CSRF
defense.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, StrictStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admins import is_admin_email
from app.core.app_settings import (
    canonical_setting_name,
    canonical_setting_value,
    list_app_settings,
    set_app_setting,
)
from app.core.errors import AccessDenied, BadRequestError, NotFoundError
from app.db.deps import get_db
from app.routers.auth import UserResponse, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/app-settings", tags=["app-settings"])


class AppSettingItem(BaseModel):
    name: str
    description: str
    value: str
    allowed_values: list[str]


class AppSettingsResponse(BaseModel):
    settings: list[AppSettingItem]


class AppSettingUpdate(BaseModel):
    # StrictStr so a non-string body value fails loudly instead of being
    # coerced — a mistyped payload must not change a production provider.
    value: StrictStr


def _require_admin(user: UserResponse) -> None:
    if not is_admin_email(user.email):
        raise AccessDenied("Admin access required.")


@router.get("", response_model=AppSettingsResponse)
async def get_app_settings(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> AppSettingsResponse:
    """List every known app setting with its live value (admin users only)."""
    _require_admin(current_user)
    settings = await list_app_settings(db)
    return AppSettingsResponse(settings=[AppSettingItem(**setting) for setting in settings])


@router.patch("/{name}", response_model=AppSettingItem)
async def update_app_setting(
    name: str,
    payload: AppSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> AppSettingItem:
    """Set a known app setting's value (admin users only).

    PATCH (not PUT) so the browser call passes the API's deliberately pinned
    CORS method allowlist (GET/POST/PATCH/DELETE — see app.main).
    """
    _require_admin(current_user)
    # Log/echo only the registry's own constants, never raw request values
    # (client-controlled text must not reach logs or responses — CWE-117).
    setting_name = canonical_setting_name(name)
    if setting_name is None:
        raise NotFoundError("Unknown app setting.")
    setting_value = canonical_setting_value(setting_name, payload.value)
    if setting_value is None:
        raise BadRequestError("Value not allowed for this setting.")

    await set_app_setting(db, setting_name, setting_value)
    logger.info(
        "App setting %s set to %s by admin user",
        setting_name,
        setting_value,
        extra={
            "event": "app_settings.set",
            "setting": setting_name,
            "value": setting_value,
            "user_id": current_user.id,
        },
    )
    settings = {setting["name"]: setting for setting in await list_app_settings(db)}
    return AppSettingItem(**settings[setting_name])
