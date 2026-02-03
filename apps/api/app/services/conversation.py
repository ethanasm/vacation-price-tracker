"""Conversation service for managing chat history and context windows."""

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import delete, func, select

from app.clients.groq import Message as GroqMessage
from app.clients.groq import TokenCounter
from app.models.conversation import Conversation
from app.models.message import Message

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Context window limits
# Llama 3.3 70B has 128K context, but we limit to leave room for response
MAX_CONTEXT_TOKENS = 8000
# Maximum messages to keep per conversation before pruning
MAX_MESSAGES_PER_CONVERSATION = 100
# Maximum conversations per user before automatic cleanup
MAX_CONVERSATIONS_PER_USER = 20


class ConversationService:
    """Service for managing conversations and messages.

    Handles:
    - Creating and retrieving conversations
    - Adding and retrieving messages
    - Context window management (fitting messages within token limits)
    - Pruning old messages
    """

    def __init__(
        self,
        max_context_tokens: int = MAX_CONTEXT_TOKENS,
        max_messages: int = MAX_MESSAGES_PER_CONVERSATION,
    ) -> None:
        self.max_context_tokens = max_context_tokens
        self.max_messages = max_messages

    async def create_conversation(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
        title: str | None = None,
    ) -> Conversation:
        """Create a new conversation for a user."""
        conversation = Conversation(user_id=user_id, title=title)
        db.add(conversation)
        await db.flush()
        await db.refresh(conversation)
        return conversation

    async def get_conversation(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> Conversation | None:
        """Get a conversation by ID, verifying user ownership."""
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            )
        )
        return result.scalars().first()

    async def get_or_create_conversation(
        self,
        conversation_id: uuid.UUID | None,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> Conversation:
        """Get existing conversation or create a new one."""
        if conversation_id:
            conversation = await self.get_conversation(conversation_id, user_id, db)
            if conversation:
                return conversation

        # Create new conversation
        return await self.create_conversation(user_id, db)

    async def list_conversations(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Conversation]:
        """List conversations for a user, most recent first."""
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def add_message(
        self,
        conversation_id: uuid.UUID,
        role: str,
        content: str,
        db: AsyncSession,
        tool_calls: list[dict[str, Any]] | None = None,
        tool_call_id: str | None = None,
        name: str | None = None,
    ) -> Message:
        """Add a message to a conversation."""
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=tool_calls,
            tool_call_id=tool_call_id,
            name=name,
        )
        db.add(message)
        await db.flush()
        await db.refresh(message)
        return message

    async def get_messages(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
        limit: int | None = None,
    ) -> list[Message]:
        """Get all messages for a conversation, oldest first."""
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        if limit:
            stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_messages_for_context(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
        system_prompt: str | None = None,
    ) -> list[Message]:
        """Get messages that fit within the context window.

        Returns messages in chronological order, keeping the most recent
        messages that fit within the token limit. Always includes the
        system prompt (if provided) and the most recent user message.
        """
        messages = await self.get_messages(conversation_id, db)

        if not messages:
            return []

        # Calculate tokens for system prompt
        system_tokens = 0
        if system_prompt:
            system_tokens = TokenCounter.count_tokens(system_prompt) + 4  # overhead

        available_tokens = self.max_context_tokens - system_tokens

        # Work backwards from most recent, accumulating messages that fit
        selected: list[Message] = []
        total_tokens = 0

        for msg in reversed(messages):
            msg_tokens = self._estimate_message_tokens(msg)
            if total_tokens + msg_tokens <= available_tokens:
                selected.insert(0, msg)
                total_tokens += msg_tokens
            else:
                # Stop if we can't fit more messages
                break

        logger.debug(
            "Context window: %d messages, ~%d tokens (limit %d)",
            len(selected),
            total_tokens + system_tokens,
            self.max_context_tokens,
        )

        return selected

    async def prune_old_messages(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
        keep_count: int | None = None,
    ) -> int:
        """Delete oldest messages beyond keep_count.

        Returns the number of messages deleted.
        """
        if keep_count is None:
            keep_count = self.max_messages

        # Count total messages
        count_result = await db.execute(
            select(func.count()).where(Message.conversation_id == conversation_id)
        )
        total = count_result.scalar_one()

        if total <= keep_count:
            return 0

        # Find the cutoff timestamp
        keep_stmt = (
            select(Message.created_at)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .offset(keep_count - 1)
            .limit(1)
        )
        cutoff_result = await db.execute(keep_stmt)
        cutoff = cutoff_result.scalar_one_or_none()

        if cutoff is None:
            return 0

        # Delete messages older than the cutoff
        delete_stmt = delete(Message).where(
            Message.conversation_id == conversation_id,
            Message.created_at < cutoff,
        )
        result = await db.execute(delete_stmt)
        deleted = result.rowcount

        logger.info(
            "Pruned %d messages from conversation %s (kept %d)",
            deleted,
            conversation_id,
            keep_count,
        )

        return deleted

    async def delete_conversation(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> bool:
        """Delete a conversation and all its messages.

        Returns True if deleted, False if not found.
        """
        conversation = await self.get_conversation(conversation_id, user_id, db)
        if not conversation:
            return False

        await db.delete(conversation)
        return True

    def message_to_groq_format(self, message: Message) -> GroqMessage:
        """Convert a database Message to Groq API format."""
        return GroqMessage(
            role=message.role,
            content=message.content,
            tool_calls=message.tool_calls,
            tool_call_id=message.tool_call_id,
            name=message.name,
        )

    def messages_to_groq_format(self, messages: list[Message]) -> list[GroqMessage]:
        """Convert a list of database Messages to Groq API format."""
        return [self.message_to_groq_format(msg) for msg in messages]

    def _estimate_message_tokens(self, message: Message) -> int:
        """Estimate token count for a message."""
        # Base overhead per message
        tokens = 4

        # Content tokens
        tokens += TokenCounter.count_tokens(message.content)

        # Name overhead
        if message.name:
            tokens += TokenCounter.count_tokens(message.name) + 1

        # Tool calls overhead (rough estimate)
        if message.tool_calls:
            import json

            tool_json = json.dumps(message.tool_calls)
            tokens += TokenCounter.count_tokens(tool_json)

        return tokens


# =============================================================================
# Title Generation Section (Agent 1)
# =============================================================================

# System prompt for generating conversation titles
TITLE_GENERATION_PROMPT = (
    "Generate a 3-6 word title summarizing this conversation. "
    "Return only the title, no quotes or punctuation."
)


async def generate_title(user_message: str, assistant_response: str) -> str:
    """Generate a conversation title using Groq LLM.

    Args:
        user_message: The first user message in the conversation.
        assistant_response: The assistant's response to the user message.

    Returns:
        A 3-6 word title summarizing the conversation.
    """
    from app.clients.groq import GroqClient
    from app.clients.groq import Message as GroqMessage

    client = GroqClient()

    messages = [
        GroqMessage(role="system", content=TITLE_GENERATION_PROMPT),
        GroqMessage(
            role="user",
            content=f"User: {user_message}\n\nAssistant: {assistant_response[:500]}",
        ),
    ]

    try:
        full_response = ""
        async for chunk in client.chat(
            messages=messages,
            stream=True,
            temperature=0.3,  # Lower temperature for more consistent titles
            max_tokens=50,  # Short response expected
        ):
            if chunk.content:
                full_response += chunk.content

        # Clean up the title - remove quotes and extra whitespace
        title = full_response.strip().strip('"\'').strip()

        # Ensure title isn't too long (max 255 chars for DB field)
        if len(title) > 255:
            title = title[:252] + "..."

        return title
    except Exception as e:
        logger.warning("Failed to generate conversation title: %s", e)
        # Return a fallback title based on the user message
        return _generate_fallback_title(user_message)


def _generate_fallback_title(user_message: str) -> str:
    """Generate a simple fallback title from the user message.

    Args:
        user_message: The first user message.

    Returns:
        A truncated version of the user message as the title.
    """
    # Take first few words of the user message
    words = user_message.split()[:6]
    title = " ".join(words)
    if len(title) > 50:
        title = title[:47] + "..."
    return title


async def update_conversation_title(
    conversation_id: uuid.UUID,
    title: str,
    db: AsyncSession,
) -> bool:
    """Update the title of a conversation.

    Args:
        conversation_id: UUID of the conversation to update.
        title: The new title to set.
        db: Database session.

    Returns:
        True if the update was successful, False if conversation not found.
    """
    from sqlalchemy import update

    result = await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation_id)
        .values(title=title)
    )
    return result.rowcount > 0


async def should_generate_title(
    conversation_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Check if a conversation needs a title generated.

    A title should be generated when:
    - The conversation has no title (title is None)
    - The conversation has at least 1 user message and 1 assistant message

    Args:
        conversation_id: UUID of the conversation to check.
        db: Database session.

    Returns:
        True if a title should be generated, False otherwise.
    """
    # First check if conversation already has a title
    conv_result = await db.execute(
        select(Conversation.title).where(Conversation.id == conversation_id)
    )
    title = conv_result.scalar_one_or_none()
    if title is not None:
        return False

    # Check message counts
    user_count_result = await db.execute(
        select(func.count())
        .where(Message.conversation_id == conversation_id)
        .where(Message.role == "user")
    )
    user_count = user_count_result.scalar_one()

    assistant_count_result = await db.execute(
        select(func.count())
        .where(Message.conversation_id == conversation_id)
        .where(Message.role == "assistant")
    )
    assistant_count = assistant_count_result.scalar_one()

    return user_count >= 1 and assistant_count >= 1


async def get_first_exchange(
    conversation_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[str | None, str | None]:
    """Get the first user message and first assistant response.

    Args:
        conversation_id: UUID of the conversation.
        db: Database session.

    Returns:
        Tuple of (first_user_message, first_assistant_response).
        Either may be None if not found.
    """
    # Get first user message
    user_result = await db.execute(
        select(Message.content)
        .where(Message.conversation_id == conversation_id)
        .where(Message.role == "user")
        .order_by(Message.created_at.asc())
        .limit(1)
    )
    user_message = user_result.scalar_one_or_none()

    # Get first assistant message
    assistant_result = await db.execute(
        select(Message.content)
        .where(Message.conversation_id == conversation_id)
        .where(Message.role == "assistant")
        .order_by(Message.created_at.asc())
        .limit(1)
    )
    assistant_response = assistant_result.scalar_one_or_none()

    return user_message, assistant_response


# =============================================================================
# Conversation Limit Enforcement Section (Agent 2)
# =============================================================================


async def count_user_conversations(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> int:
    """Count the total number of conversations for a user.

    Args:
        user_id: UUID of the user.
        db: Database session.

    Returns:
        The number of conversations the user has.
    """
    result = await db.execute(
        select(func.count()).where(Conversation.user_id == user_id)
    )
    return result.scalar_one()


async def delete_oldest_conversations(
    user_id: uuid.UUID,
    db: AsyncSession,
    delete_count: int,
) -> int:
    """Delete the oldest conversations for a user.

    Deletes conversations by updated_at ascending (oldest first).
    Messages are deleted via CASCADE when conversations are deleted.

    Args:
        user_id: UUID of the user.
        db: Database session.
        delete_count: Number of conversations to delete.

    Returns:
        The number of conversations actually deleted.
    """
    if delete_count <= 0:
        return 0

    # Find the IDs of the oldest conversations to delete
    oldest_stmt = (
        select(Conversation.id)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.asc())
        .limit(delete_count)
    )
    oldest_result = await db.execute(oldest_stmt)
    conversation_ids = list(oldest_result.scalars().all())

    if not conversation_ids:
        return 0

    # Delete the conversations (messages cascade)
    delete_stmt = delete(Conversation).where(Conversation.id.in_(conversation_ids))
    result = await db.execute(delete_stmt)
    deleted = result.rowcount

    logger.info(
        "Deleted %d oldest conversations for user %s",
        deleted,
        str(user_id)[:8],
    )

    return deleted


async def enforce_conversation_limit(
    user_id: uuid.UUID,
    db: AsyncSession,
    max_conversations: int = MAX_CONVERSATIONS_PER_USER,
) -> int:
    """Enforce the conversation limit for a user.

    If the user has more conversations than the limit, deletes the oldest
    ones to make room. This should be called BEFORE creating a new conversation
    to ensure there's room for the new one.

    Args:
        user_id: UUID of the user.
        db: Database session.
        max_conversations: Maximum allowed conversations (default: MAX_CONVERSATIONS_PER_USER).

    Returns:
        The number of conversations deleted (0 if under limit).
    """
    current_count = await count_user_conversations(user_id, db)

    # We delete enough to get to max_conversations - 1 to make room for the new one
    if current_count >= max_conversations:
        delete_count = current_count - max_conversations + 1
        return await delete_oldest_conversations(user_id, db, delete_count)

    return 0


# Singleton instance for shared use
conversation_service = ConversationService()
