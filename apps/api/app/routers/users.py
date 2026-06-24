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
    """Per-user notification preferences the user can edit in Settings."""

    email_notifications_enabled: bool


@router.patch("/preferences", response_model=UserResponse)
async def update_preferences(
    payload: UserPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    """Update the current user's notification preferences."""
    result = await db.execute(select(User).where(User.id == uuid.UUID(current_user.id)))
    user = result.scalars().first()
    if user is None:  # pragma: no cover - get_current_user already verified the user
        raise AuthenticationRequired("User not found")

    user.email_notifications_enabled = payload.email_notifications_enabled
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(
        "Updated user preferences",
        extra={
            "event": "users.preferences.update",
            "email_notifications_enabled": user.email_notifications_enabled,
        },
    )
    return UserResponse(
        id=str(user.id),
        email=user.email,
        email_notifications_enabled=user.email_notifications_enabled,
    )
