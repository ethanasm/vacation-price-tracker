"""User preference endpoints (e.g. the Settings page email-notifications toggle)."""

import logging
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.errors import AuthenticationRequired
from app.db.deps import get_db
from app.models.user import User
from app.routers.auth import UserResponse, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/users", tags=["users"])


class UserPreferencesUpdate(BaseModel):
    """Per-user notification preferences the user can edit in Settings.

    Both fields are optional so a client can toggle one channel without having
    to echo the other; an omitted field leaves that preference unchanged.
    """

    email_notifications_enabled: bool | None = None
    push_notifications_enabled: bool | None = None


class UserPreferencesResponse(BaseModel):
    """Notification preferences echoed back after an update.

    Distinct from ``auth.UserResponse`` (the mobile-token contract shape) so the
    per-user push toggle can be surfaced here without changing that contract.
    """

    id: str
    email: str
    email_notifications_enabled: bool
    push_notifications_enabled: bool


@router.patch("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    payload: UserPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> UserPreferencesResponse:
    """Update the current user's notification preferences (email and/or push)."""
    result = await db.execute(select(User).where(User.id == uuid.UUID(current_user.id)))
    user = result.scalars().first()
    if user is None:  # pragma: no cover - get_current_user already verified the user
        raise AuthenticationRequired("User not found")

    if payload.email_notifications_enabled is not None:
        user.email_notifications_enabled = payload.email_notifications_enabled
    if payload.push_notifications_enabled is not None:
        user.push_notifications_enabled = payload.push_notifications_enabled
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(
        "Updated user preferences",
        extra={
            "event": "users.preferences.update",
            "email_notifications_enabled": user.email_notifications_enabled,
            "push_notifications_enabled": user.push_notifications_enabled,
        },
    )
    return UserPreferencesResponse(
        id=str(user.id),
        email=user.email,
        email_notifications_enabled=user.email_notifications_enabled,
        push_notifications_enabled=user.push_notifications_enabled,
    )
