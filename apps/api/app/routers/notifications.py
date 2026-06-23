"""Email notification endpoints (unsubscribe / opt-out)."""

import logging
import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import read_unsubscribe_token
from app.db.deps import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])

_PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Vacation Price Tracker</title></head>
<body style="font-family:Helvetica,Arial,sans-serif;text-align:center;padding:48px;color:#1a1a2e;">
<h1>{heading}</h1><p>{message}</p></body></html>"""


def _page(heading: str, message: str, status_code: int) -> HTMLResponse:
    return HTMLResponse(_PAGE.format(heading=heading, message=message), status_code=status_code)


async def _process_unsubscribe(token: str, db: AsyncSession) -> HTMLResponse:
    user_id = read_unsubscribe_token(token)
    if user_id is None:
        return _page("Invalid link", "This unsubscribe link is invalid or has expired.", 400)

    user = await db.get(User, uuid.UUID(user_id))
    if user is None:
        return _page("Invalid link", "This unsubscribe link is invalid or has expired.", 400)

    if user.email_notifications_enabled:
        user.email_notifications_enabled = False
        db.add(user)
        await db.commit()
        logger.info("User %s unsubscribed from email notifications", user_id)

    return _page(
        "You're unsubscribed",
        "You will no longer receive price-drop emails. You can re-enable them anytime in your settings.",
        200,
    )


@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Opt a user out of email notifications via a signed token (email link)."""
    return await _process_unsubscribe(token, db)


@router.post("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_one_click(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """RFC 8058 one-click unsubscribe (List-Unsubscribe-Post)."""
    return await _process_unsubscribe(token, db)
