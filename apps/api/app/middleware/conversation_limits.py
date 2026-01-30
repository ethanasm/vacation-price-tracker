"""Middleware for enforcing conversation length limits.

This module provides:
- ConversationLimitsMiddleware: Enforces max messages per conversation
- Automatic pruning of oldest messages when limits are exceeded
"""

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.services.conversation import ConversationService

logger = logging.getLogger(__name__)

# Default maximum messages per conversation
DEFAULT_MAX_MESSAGES = 100


class ConversationLimitsEnforcer:
    """Enforces conversation length limits.

    Ensures conversations don't grow unbounded by pruning oldest messages
    when the limit is exceeded. This protects against:
    - Memory/storage exhaustion from long conversations
    - Context window overflow
    - Potential abuse via conversation flooding
    """

    def __init__(
        self,
        max_messages: int = DEFAULT_MAX_MESSAGES,
        conversation_service: ConversationService | None = None,
    ) -> None:
        """Initialize the enforcer.

        Args:
            max_messages: Maximum messages allowed per conversation.
            conversation_service: Service for conversation operations.
        """
        self._max_messages = max_messages
        self._service = conversation_service or ConversationService(max_messages=max_messages)

    @property
    def max_messages(self) -> int:
        """Get the maximum messages limit."""
        return self._max_messages

    async def enforce_limits(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
    ) -> int:
        """Enforce conversation length limits by pruning old messages.

        Should be called after adding a new message to a conversation.

        Args:
            conversation_id: UUID of the conversation.
            db: Database session.

        Returns:
            Number of messages pruned.
        """
        pruned = await self._service.prune_old_messages(
            conversation_id=conversation_id,
            db=db,
            keep_count=self._max_messages,
        )

        if pruned > 0:
            logger.info(
                "Pruned %d messages from conversation %s (limit: %d)",
                pruned,
                conversation_id,
                self._max_messages,
            )

        return pruned

    async def check_limits(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
    ) -> tuple[int, bool]:
        """Check if a conversation is at or over the limit.

        Args:
            conversation_id: UUID of the conversation.
            db: Database session.

        Returns:
            Tuple of (current_count, is_at_limit).
        """
        from sqlalchemy import func, select

        from app.models.message import Message

        result = await db.execute(select(func.count()).where(Message.conversation_id == conversation_id))
        count = result.scalar_one()

        return count, count >= self._max_messages


# Singleton instance for shared use
conversation_limits = ConversationLimitsEnforcer()
