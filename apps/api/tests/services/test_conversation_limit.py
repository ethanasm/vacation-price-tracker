"""Tests for conversation limit enforcement functionality.

Tests coverage:
- count_user_conversations: counting user's conversations
- delete_oldest_conversations: deleting oldest conversations by updated_at
- enforce_conversation_limit: orchestrating limit enforcement before new conversation creation
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.services.conversation import (
    MAX_CONVERSATIONS_PER_USER,
    count_user_conversations,
    delete_oldest_conversations,
    enforce_conversation_limit,
)
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession


@pytest_asyncio.fixture
async def limit_test_user(test_session: AsyncSession) -> User:
    """Create a test user for conversation limit tests."""
    user = User(
        id=uuid.uuid4(),
        email="limit_test@example.com",
        google_sub="google_limit_test_123",
    )
    test_session.add(user)
    await test_session.flush()
    await test_session.refresh(user)
    return user


async def create_conversation_simple(
    test_session: AsyncSession,
    user: User,
    title: str,
) -> Conversation:
    """Create a conversation without timestamp manipulation.

    Args:
        test_session: Database session.
        user: User who owns the conversation.
        title: Title for the conversation.

    Returns:
        The created conversation.
    """
    conversation = Conversation(
        id=uuid.uuid4(),
        user_id=user.id,
        title=title,
    )
    test_session.add(conversation)
    await test_session.flush()
    await test_session.refresh(conversation)
    return conversation


async def create_conversation_with_timestamp(
    test_session: AsyncSession,
    user: User,
    title: str,
    updated_offset_seconds: int = 0,
) -> Conversation:
    """Create a conversation and optionally adjust its updated_at timestamp.

    Args:
        test_session: Database session.
        user: User who owns the conversation.
        title: Title for the conversation.
        updated_offset_seconds: Offset in seconds from 'now' for updated_at.
            Negative values make it older, positive makes it newer.

    Returns:
        The created conversation.
    """
    conversation = Conversation(
        id=uuid.uuid4(),
        user_id=user.id,
        title=title,
    )
    test_session.add(conversation)
    await test_session.flush()
    await test_session.refresh(conversation)

    if updated_offset_seconds != 0:
        # Manually update the timestamp using SQL to avoid ORM auto-update
        new_updated_at = datetime.now(UTC) + timedelta(seconds=updated_offset_seconds)
        await test_session.execute(
            update(Conversation)
            .where(Conversation.id == conversation.id)
            .values(updated_at=new_updated_at)
        )
        await test_session.flush()
        await test_session.refresh(conversation)

    return conversation


class TestCountUserConversations:
    """Tests for count_user_conversations function."""

    @pytest.mark.asyncio
    async def test_count_empty(self, test_session: AsyncSession, limit_test_user: User):
        """Test counting conversations for user with no conversations."""
        count = await count_user_conversations(limit_test_user.id, test_session)
        assert count == 0

    @pytest.mark.asyncio
    async def test_count_single(self, test_session: AsyncSession, limit_test_user: User):
        """Test counting single conversation."""
        await create_conversation_simple(
            test_session, limit_test_user, "Single Conversation"
        )

        count = await count_user_conversations(limit_test_user.id, test_session)
        assert count == 1

    @pytest.mark.asyncio
    async def test_count_multiple(self, test_session: AsyncSession, limit_test_user: User):
        """Test counting multiple conversations."""
        for i in range(5):
            await create_conversation_simple(
                test_session, limit_test_user, f"Conversation {i}"
            )

        count = await count_user_conversations(limit_test_user.id, test_session)
        assert count == 5

    @pytest.mark.asyncio
    async def test_count_isolated_by_user(
        self,
        test_session: AsyncSession,
        limit_test_user: User,
    ):
        """Test that count is isolated per user."""
        # Create a second user in the same session
        user2 = User(
            id=uuid.uuid4(),
            email="limit_test2@example.com",
            google_sub="google_limit_test2_456",
        )
        test_session.add(user2)
        await test_session.flush()
        await test_session.refresh(user2)

        # Create conversations for user 1
        for i in range(3):
            await create_conversation_simple(
                test_session, limit_test_user, f"User1 Conv {i}"
            )

        # Create conversations for user 2
        for i in range(7):
            await create_conversation_simple(
                test_session, user2, f"User2 Conv {i}"
            )

        count1 = await count_user_conversations(limit_test_user.id, test_session)
        count2 = await count_user_conversations(user2.id, test_session)

        assert count1 == 3
        assert count2 == 7


class TestDeleteOldestConversations:
    """Tests for delete_oldest_conversations function."""

    @pytest.mark.asyncio
    async def test_delete_zero(self, test_session: AsyncSession, limit_test_user: User):
        """Test deleting zero conversations."""
        await create_conversation_simple(
            test_session, limit_test_user, "Test Conv"
        )

        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, 0)
        assert deleted == 0

        count = await count_user_conversations(limit_test_user.id, test_session)
        assert count == 1

    @pytest.mark.asyncio
    async def test_delete_negative(self, test_session: AsyncSession, limit_test_user: User):
        """Test deleting negative number of conversations (should do nothing)."""
        await create_conversation_simple(
            test_session, limit_test_user, "Test Conv"
        )

        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, -5)
        assert deleted == 0

    @pytest.mark.asyncio
    async def test_delete_from_empty(self, test_session: AsyncSession, limit_test_user: User):
        """Test deleting from user with no conversations."""
        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, 5)
        assert deleted == 0

    @pytest.mark.asyncio
    async def test_delete_single_oldest(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test deleting the single oldest conversation."""
        # Create conversations with different timestamps (older has more negative offset)
        oldest = await create_conversation_with_timestamp(
            test_session, limit_test_user, "Oldest", updated_offset_seconds=-100
        )
        middle = await create_conversation_with_timestamp(
            test_session, limit_test_user, "Middle", updated_offset_seconds=-50
        )
        newest = await create_conversation_with_timestamp(
            test_session, limit_test_user, "Newest", updated_offset_seconds=0
        )

        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, 1)
        assert deleted == 1

        # Verify oldest was deleted
        count = await count_user_conversations(limit_test_user.id, test_session)
        assert count == 2

        # Verify middle and newest still exist
        result = await test_session.execute(
            select(Conversation.id).where(Conversation.user_id == limit_test_user.id)
        )
        remaining_ids = set(result.scalars().all())
        assert oldest.id not in remaining_ids
        assert middle.id in remaining_ids
        assert newest.id in remaining_ids

    @pytest.mark.asyncio
    async def test_delete_multiple_oldest(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test deleting multiple oldest conversations."""
        convs = []
        for i in range(5):
            conv = await create_conversation_with_timestamp(
                test_session,
                limit_test_user,
                f"Conv {i}",
                updated_offset_seconds=-100 * (5 - i),  # Older first
            )
            convs.append(conv)

        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, 3)
        assert deleted == 3

        count = await count_user_conversations(limit_test_user.id, test_session)
        assert count == 2

        # The 2 newest should remain
        result = await test_session.execute(
            select(Conversation.id).where(Conversation.user_id == limit_test_user.id)
        )
        remaining_ids = set(result.scalars().all())
        assert convs[3].id in remaining_ids  # 4th created (newer)
        assert convs[4].id in remaining_ids  # 5th created (newest)

    @pytest.mark.asyncio
    async def test_delete_more_than_exist(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test requesting deletion of more conversations than exist."""
        for i in range(3):
            await create_conversation_simple(
                test_session, limit_test_user, f"Conv {i}"
            )

        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, 10)
        assert deleted == 3

        count = await count_user_conversations(limit_test_user.id, test_session)
        assert count == 0

    @pytest.mark.asyncio
    async def test_delete_isolated_by_user(
        self,
        test_session: AsyncSession,
        limit_test_user: User,
    ):
        """Test that deletion is isolated per user."""
        # Create a second user in the same session
        user2 = User(
            id=uuid.uuid4(),
            email="limit_test2@example.com",
            google_sub="google_limit_test2_456",
        )
        test_session.add(user2)
        await test_session.flush()
        await test_session.refresh(user2)

        # Create conversations for user 1
        for i in range(3):
            await create_conversation_simple(
                test_session, limit_test_user, f"User1 Conv {i}"
            )

        # Create conversations for user 2
        for i in range(5):
            await create_conversation_simple(
                test_session, user2, f"User2 Conv {i}"
            )

        # Delete from user 1
        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, 2)
        assert deleted == 2

        # User 1 should have 1 left
        count1 = await count_user_conversations(limit_test_user.id, test_session)
        assert count1 == 1

        # User 2 should still have all 5
        count2 = await count_user_conversations(user2.id, test_session)
        assert count2 == 5

    @pytest.mark.asyncio
    async def test_delete_conversation_with_messages(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test that deleting a conversation with messages works.

        Note: Message cascade deletion is configured at the DB level via
        ON DELETE CASCADE on the foreign key. SQLite in tests may not
        enforce this without PRAGMA foreign_keys=ON. This test verifies
        the conversation deletion works; production PostgreSQL handles
        message cascade automatically.
        """
        conv = await create_conversation_simple(
            test_session, limit_test_user, "With Messages"
        )

        # Add some messages
        for i in range(3):
            msg = Message(
                conversation_id=conv.id,
                role="user" if i % 2 == 0 else "assistant",
                content=f"Message {i}",
            )
            test_session.add(msg)
        await test_session.flush()

        # Verify messages exist
        from sqlalchemy import func

        msg_count_before = await test_session.execute(
            select(func.count()).where(Message.conversation_id == conv.id)
        )
        assert msg_count_before.scalar_one() == 3

        # Delete the conversation - this should not raise an error
        deleted = await delete_oldest_conversations(limit_test_user.id, test_session, 1)
        assert deleted == 1

        # Verify conversation was deleted
        conv_count = await count_user_conversations(limit_test_user.id, test_session)
        assert conv_count == 0


class TestEnforceConversationLimit:
    """Tests for enforce_conversation_limit function."""

    @pytest.mark.asyncio
    async def test_under_limit_no_deletion(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test that no deletion occurs when under limit."""
        # Create fewer than MAX conversations (use a smaller number for test speed)
        for i in range(5):
            await create_conversation_simple(
                test_session, limit_test_user, f"Conv {i}"
            )

        deleted = await enforce_conversation_limit(limit_test_user.id, test_session)
        assert deleted == 0

    @pytest.mark.asyncio
    async def test_at_limit_deletes_one_with_custom_limit(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test that one is deleted when exactly at limit (to make room)."""
        # Use a small custom limit for test speed
        custom_limit = 5

        # Create exactly custom_limit conversations
        for i in range(custom_limit):
            await create_conversation_with_timestamp(
                test_session,
                limit_test_user,
                f"Conv {i}",
                updated_offset_seconds=-i * 10,  # Older conversations first
            )

        count_before = await count_user_conversations(limit_test_user.id, test_session)
        assert count_before == custom_limit

        deleted = await enforce_conversation_limit(
            limit_test_user.id, test_session, max_conversations=custom_limit
        )
        assert deleted == 1

        count_after = await count_user_conversations(limit_test_user.id, test_session)
        assert count_after == custom_limit - 1

    @pytest.mark.asyncio
    async def test_over_limit_deletes_to_make_room_with_custom_limit(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test that excess conversations are deleted when over limit."""
        # Use a small custom limit for test speed
        custom_limit = 5
        over_count = 3
        total = custom_limit + over_count

        for i in range(total):
            await create_conversation_with_timestamp(
                test_session,
                limit_test_user,
                f"Conv {i}",
                updated_offset_seconds=-i * 10,
            )

        count_before = await count_user_conversations(limit_test_user.id, test_session)
        assert count_before == total

        deleted = await enforce_conversation_limit(
            limit_test_user.id, test_session, max_conversations=custom_limit
        )
        # Should delete enough to get to custom_limit - 1 (making room for new one)
        expected_deleted = total - custom_limit + 1
        assert deleted == expected_deleted

        count_after = await count_user_conversations(limit_test_user.id, test_session)
        assert count_after == custom_limit - 1

    @pytest.mark.asyncio
    async def test_custom_max_limit(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test enforcement with custom max_conversations parameter."""
        # Create 10 conversations
        for i in range(10):
            await create_conversation_simple(
                test_session, limit_test_user, f"Conv {i}"
            )

        # Enforce with custom limit of 5
        deleted = await enforce_conversation_limit(
            limit_test_user.id, test_session, max_conversations=5
        )
        # Should delete 10 - 5 + 1 = 6 to make room
        assert deleted == 6

        count_after = await count_user_conversations(limit_test_user.id, test_session)
        assert count_after == 4

    @pytest.mark.asyncio
    async def test_empty_user_no_deletion(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test enforcement for user with no conversations."""
        deleted = await enforce_conversation_limit(limit_test_user.id, test_session)
        assert deleted == 0

    @pytest.mark.asyncio
    async def test_preserves_newest_conversations(
        self, test_session: AsyncSession, limit_test_user: User
    ):
        """Test that enforcement keeps the newest conversations."""
        # Use a smaller limit for test speed
        custom_limit = 5
        total = custom_limit + 2

        convs = []
        for i in range(total):
            conv = await create_conversation_with_timestamp(
                test_session,
                limit_test_user,
                f"Conv {i}",
                updated_offset_seconds=-(total - i) * 100,
            )
            convs.append(conv)

        # The last (custom_limit - 1) conversations should be kept
        await enforce_conversation_limit(
            limit_test_user.id, test_session, max_conversations=custom_limit
        )

        result = await test_session.execute(
            select(Conversation.id).where(Conversation.user_id == limit_test_user.id)
        )
        remaining_ids = set(result.scalars().all())

        # Newest conversations should remain
        kept_count = custom_limit - 1
        for i in range(len(convs) - kept_count, len(convs)):
            assert convs[i].id in remaining_ids


class TestMaxConversationsConstant:
    """Tests related to the MAX_CONVERSATIONS_PER_USER constant."""

    def test_constant_value(self):
        """Verify the constant has expected value."""
        assert MAX_CONVERSATIONS_PER_USER == 20

    def test_constant_is_positive(self):
        """Ensure constant is a positive integer."""
        assert MAX_CONVERSATIONS_PER_USER > 0
        assert isinstance(MAX_CONVERSATIONS_PER_USER, int)
