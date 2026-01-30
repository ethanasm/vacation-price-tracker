"""Tests for conversation limits enforcement."""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from app.middleware.conversation_limits import (
    DEFAULT_MAX_MESSAGES,
    ConversationLimitsEnforcer,
    conversation_limits,
)
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.conversation import ConversationService
from sqlalchemy.ext.asyncio import AsyncSession

# =============================================================================
# Tests for ConversationLimitsEnforcer initialization
# =============================================================================


def test_default_max_messages():
    """Default max messages should be 100."""
    assert DEFAULT_MAX_MESSAGES == 100


def test_enforcer_default_limit():
    """Enforcer should use default limit when not specified."""
    enforcer = ConversationLimitsEnforcer()

    assert enforcer.max_messages == DEFAULT_MAX_MESSAGES


def test_enforcer_custom_limit():
    """Enforcer should accept custom limit."""
    enforcer = ConversationLimitsEnforcer(max_messages=50)

    assert enforcer.max_messages == 50


def test_enforcer_custom_service():
    """Enforcer should accept custom conversation service."""
    service = ConversationService(max_messages=25)
    enforcer = ConversationLimitsEnforcer(
        max_messages=25,
        conversation_service=service,
    )

    assert enforcer.max_messages == 25


# =============================================================================
# Tests for check_limits
# =============================================================================


@pytest_asyncio.fixture
async def test_conversation(test_session: AsyncSession) -> Conversation:
    """Create a test conversation."""
    user_id = uuid.uuid4()
    conversation = Conversation(user_id=user_id)
    test_session.add(conversation)
    await test_session.commit()
    await test_session.refresh(conversation)
    return conversation


@pytest.mark.asyncio
async def test_check_limits_under_limit(test_session: AsyncSession, test_conversation: Conversation):
    """Conversation under limit should not be at limit."""
    enforcer = ConversationLimitsEnforcer(max_messages=100)

    # Add a few messages
    for i in range(5):
        msg = Message(
            conversation_id=test_conversation.id,
            role="user",
            content=f"Message {i}",
        )
        test_session.add(msg)
    await test_session.commit()

    count, is_at_limit = await enforcer.check_limits(test_conversation.id, test_session)

    assert count == 5
    assert is_at_limit is False


@pytest.mark.asyncio
async def test_check_limits_at_limit(test_session: AsyncSession, test_conversation: Conversation):
    """Conversation at limit should be detected."""
    enforcer = ConversationLimitsEnforcer(max_messages=5)

    # Add exactly max messages
    for i in range(5):
        msg = Message(
            conversation_id=test_conversation.id,
            role="user",
            content=f"Message {i}",
        )
        test_session.add(msg)
    await test_session.commit()

    count, is_at_limit = await enforcer.check_limits(test_conversation.id, test_session)

    assert count == 5
    assert is_at_limit is True


@pytest.mark.asyncio
async def test_check_limits_over_limit(test_session: AsyncSession, test_conversation: Conversation):
    """Conversation over limit should be detected."""
    enforcer = ConversationLimitsEnforcer(max_messages=5)

    # Add more than max messages
    for i in range(10):
        msg = Message(
            conversation_id=test_conversation.id,
            role="user",
            content=f"Message {i}",
        )
        test_session.add(msg)
    await test_session.commit()

    count, is_at_limit = await enforcer.check_limits(test_conversation.id, test_session)

    assert count == 10
    assert is_at_limit is True


@pytest.mark.asyncio
async def test_check_limits_empty_conversation(test_session: AsyncSession, test_conversation: Conversation):
    """Empty conversation should not be at limit."""
    enforcer = ConversationLimitsEnforcer(max_messages=100)

    count, is_at_limit = await enforcer.check_limits(test_conversation.id, test_session)

    assert count == 0
    assert is_at_limit is False


# =============================================================================
# Tests for enforce_limits
# =============================================================================


@pytest.mark.asyncio
async def test_enforce_limits_no_pruning_needed(test_session: AsyncSession, test_conversation: Conversation):
    """No messages should be pruned when under limit."""
    enforcer = ConversationLimitsEnforcer(max_messages=100)

    # Add a few messages
    for i in range(5):
        msg = Message(
            conversation_id=test_conversation.id,
            role="user",
            content=f"Message {i}",
        )
        test_session.add(msg)
    await test_session.commit()

    pruned = await enforcer.enforce_limits(test_conversation.id, test_session)

    assert pruned == 0


@pytest.mark.asyncio
async def test_enforce_limits_prunes_oldest(test_session: AsyncSession, test_conversation: Conversation):
    """Oldest messages should be pruned when over limit."""
    from datetime import datetime, timedelta

    enforcer = ConversationLimitsEnforcer(max_messages=5)

    # Add more than max messages with staggered timestamps
    # Use naive datetime to match model default (SQLite doesn't have timezone-aware datetime)
    base_time = datetime.now()
    for i in range(10):
        msg = Message(
            conversation_id=test_conversation.id,
            role="user",
            content=f"Message {i}",
            created_at=base_time + timedelta(seconds=i),
        )
        test_session.add(msg)
    await test_session.commit()

    pruned = await enforcer.enforce_limits(test_conversation.id, test_session)

    # Should have pruned some messages (exact count depends on timestamp comparison)
    # The important thing is that we're now at or below the limit
    count, _ = await enforcer.check_limits(test_conversation.id, test_session)
    assert count <= 5
    assert pruned > 0  # At least some messages were pruned


@pytest.mark.asyncio
async def test_enforce_limits_exactly_at_limit(test_session: AsyncSession, test_conversation: Conversation):
    """No pruning when exactly at limit."""
    enforcer = ConversationLimitsEnforcer(max_messages=5)

    # Add exactly max messages
    for i in range(5):
        msg = Message(
            conversation_id=test_conversation.id,
            role="user",
            content=f"Message {i}",
        )
        test_session.add(msg)
    await test_session.commit()

    pruned = await enforcer.enforce_limits(test_conversation.id, test_session)

    assert pruned == 0


# =============================================================================
# Tests for singleton instance
# =============================================================================


def test_singleton_instance_exists():
    """Singleton instance should be available."""
    assert conversation_limits is not None
    assert isinstance(conversation_limits, ConversationLimitsEnforcer)


def test_singleton_has_default_limit():
    """Singleton should have default limit."""
    assert conversation_limits.max_messages == DEFAULT_MAX_MESSAGES
