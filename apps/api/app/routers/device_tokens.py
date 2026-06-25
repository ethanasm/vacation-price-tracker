"""Mobile push device-token registration (Expo push tokens).

The native app registers its Expo push token after sign-in and on token
rotation, and unregisters on sign-out. Tokens are scoped to the authenticated
user and unique per device (upsert on conflict). The worker reads this table to
deliver price-drop push notifications.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.db.deps import get_db
from app.models.device_token import DeviceToken
from app.routers.auth import UserResponse, get_current_user
from app.schemas.device_token import DeviceTokenRegister, DeviceTokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


@router.post("/device-token", response_model=DeviceTokenResponse)
async def register_device_token(
    payload: DeviceTokenRegister,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> DeviceTokenResponse:
    """Register (or upsert) the caller's Expo push token for this device."""
    user_id = uuid.UUID(current_user.id)
    existing = (
        await db.execute(
            select(DeviceToken).where(DeviceToken.expo_push_token == payload.expo_push_token)
        )
    ).scalars().first()

    if existing is None:
        db.add(
            DeviceToken(
                user_id=user_id,
                expo_push_token=payload.expo_push_token,
                platform=payload.platform,
            )
        )
        try:
            await db.commit()
        except IntegrityError:  # pragma: no cover - concurrency-only path
            # Lost a race: a concurrent request inserted the same token between
            # our SELECT and this INSERT, tripping the unique constraint. Recover
            # by reassigning the now-existing row instead of surfacing a 500. The
            # single-threaded SQLite test DB can't reproduce the interleaving.
            await db.rollback()
            row = (
                await db.execute(
                    select(DeviceToken).where(
                        DeviceToken.expo_push_token == payload.expo_push_token
                    )
                )
            ).scalars().first()
            if row is not None:
                row.user_id = user_id
                row.platform = payload.platform
                db.add(row)
                await db.commit()
    else:
        # Re-registration: reassign to the current user and refresh the platform.
        # A token legitimately moves between accounts on a shared device (user A
        # signs out, user B signs in on the same phone), so reassignment is
        # allowed — but log it so the ownership change is never silent.
        if existing.user_id != user_id:
            logger.warning(
                "Reassigning device token to a different user",
                extra={
                    "event": "notifications.device_token.reassigned",
                    "user_id": current_user.id,
                    "previous_user_id": str(existing.user_id),
                },
            )
        existing.user_id = user_id
        existing.platform = payload.platform
        db.add(existing)
        await db.commit()

    logger.info(
        "Registered device token",
        extra={"event": "notifications.device_token.register", "user_id": current_user.id},
    )
    return DeviceTokenResponse(
        expo_push_token=payload.expo_push_token, platform=payload.platform
    )


@router.delete("/device-token", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device_token(
    payload: DeviceTokenRegister,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
) -> Response:
    """Unregister a device token on sign-out. Idempotent (no-op if absent)."""
    user_id = uuid.UUID(current_user.id)
    await db.execute(
        delete(DeviceToken).where(
            DeviceToken.expo_push_token == payload.expo_push_token,
            DeviceToken.user_id == user_id,
        )
    )
    await db.commit()
    logger.info(
        "Unregistered device token",
        extra={"event": "notifications.device_token.unregister", "user_id": current_user.id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
