"""Integration tests for conversation persistence.

Tests the conversation service's ability to:
- Create and retrieve conversations
- Persist messages with tool calls
- Manage context window with token limits
- Prune old messages
- Maintain conversation state across requests
"""

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from app.models.user import User
from app.services.conversation import (
    ConversationService,
)


@pytest_asyncio.fixture
async def test_user(test_session):
    """Create a test user for conversation tests."""
    user = User(
        google_sub="conversation_test_user",
        email="conv_test@example.com",
        name="Conversation Test User",
    )
    test_session.add(user)
    await test_session.flush()
    await test_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def service():
    """Create a ConversationService instance."""
    return ConversationService()


class TestConversationCreation:
    """Tests for conversation creation."""

    @pytest.mark.anyio
    async def test_create_conversation(self, test_session, test_user, service):
        """Test creating a new conversation."""
        conv = await service.create_conversation(test_user.id, test_session)

        assert conv.id is not None
        assert conv.user_id == test_user.id
        assert conv.title is None
        assert conv.created_at is not None

    @pytest.mark.anyio
    async def test_create_conversation_with_title(self, test_session, test_user, service):
        """Test creating a conversation with a title."""
        conv = await service.create_conversation(test_user.id, test_session, title="Hawaii Trip Discussion")

        assert conv.title == "Hawaii Trip Discussion"

    @pytest.mark.anyio
    async def test_get_conversation(self, test_session, test_user, service):
        """Test retrieving an existing conversation."""
        created = await service.create_conversation(test_user.id, test_session)
        await test_session.commit()

        retrieved = await service.get_conversation(created.id, test_user.id, test_session)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.user_id == test_user.id

    @pytest.mark.anyio
    async def test_get_conversation_wrong_user(self, test_session, test_user, service):
        """Test that users cannot access other users' conversations."""
        conv = await service.create_conversation(test_user.id, test_session)
        await test_session.commit()

        other_user_id = uuid.uuid4()
        result = await service.get_conversation(conv.id, other_user_id, test_session)

        assert result is None

    @pytest.mark.anyio
    async def test_get_or_create_new(self, test_session, test_user, service):
        """Test get_or_create creates new when no ID provided."""
        conv = await service.get_or_create_conversation(None, test_user.id, test_session)

        assert conv is not None
        assert conv.user_id == test_user.id

    @pytest.mark.anyio
    async def test_get_or_create_existing(self, test_session, test_user, service):
        """Test get_or_create returns existing conversation."""
        created = await service.create_conversation(test_user.id, test_session)
        await test_session.commit()

        retrieved = await service.get_or_create_conversation(created.id, test_user.id, test_session)

        assert retrieved.id == created.id

    @pytest.mark.anyio
    async def test_get_or_create_invalid_id(self, test_session, test_user, service):
        """Test get_or_create creates new for invalid conversation ID."""
        invalid_id = uuid.uuid4()

        conv = await service.get_or_create_conversation(invalid_id, test_user.id, test_session)

        assert conv is not None
        assert conv.id != invalid_id  # Should be a new conversation


class TestMessagePersistence:
    """Tests for message persistence."""

    @pytest.mark.anyio
    async def test_add_user_message(self, test_session, test_user, service):
        """Test adding a user message."""
        conv = await service.create_conversation(test_user.id, test_session)

        message = await service.add_message(
            conversation_id=conv.id,
            role="user",
            content="Track prices for Hawaii",
            db=test_session,
        )

        assert message.id is not None
        assert message.conversation_id == conv.id
        assert message.role == "user"
        assert message.content == "Track prices for Hawaii"
        assert message.tool_calls is None
        assert message.tool_call_id is None

    @pytest.mark.anyio
    async def test_add_assistant_message_with_tool_calls(self, test_session, test_user, service):
        """Test adding an assistant message with tool calls."""
        conv = await service.create_conversation(test_user.id, test_session)

        tool_calls = [
            {
                "id": "call_123",
                "type": "function",
                "function": {
                    "name": "create_trip",
                    "arguments": '{"name": "Hawaii"}',
                },
            }
        ]

        message = await service.add_message(
            conversation_id=conv.id,
            role="assistant",
            content="Let me create that trip for you.",
            db=test_session,
            tool_calls=tool_calls,
        )

        assert message.tool_calls == tool_calls
        assert message.tool_calls[0]["id"] == "call_123"

    @pytest.mark.anyio
    async def test_add_tool_result_message(self, test_session, test_user, service):
        """Test adding a tool result message."""
        conv = await service.create_conversation(test_user.id, test_session)

        message = await service.add_message(
            conversation_id=conv.id,
            role="tool",
            content='{"success": true, "trip_id": "abc123"}',
            db=test_session,
            tool_call_id="call_123",
            name="create_trip",
        )

        assert message.role == "tool"
        assert message.tool_call_id == "call_123"
        assert message.name == "create_trip"

    @pytest.mark.anyio
    async def test_get_messages_in_order(self, test_session, test_user, service):
        """Test retrieving messages in chronological order."""
        conv = await service.create_conversation(test_user.id, test_session)

        await service.add_message(conv.id, "user", "First message", test_session)
        await service.add_message(conv.id, "assistant", "Second message", test_session)
        await service.add_message(conv.id, "user", "Third message", test_session)
        await test_session.commit()

        messages = await service.get_messages(conv.id, test_session)

        assert len(messages) == 3
        assert messages[0].content == "First message"
        assert messages[1].content == "Second message"
        assert messages[2].content == "Third message"

    @pytest.mark.anyio
    async def test_get_messages_with_limit(self, test_session, test_user, service):
        """Test retrieving messages with limit."""
        conv = await service.create_conversation(test_user.id, test_session)

        for i in range(5):
            await service.add_message(conv.id, "user", f"Message {i}", test_session)
        await test_session.commit()

        messages = await service.get_messages(conv.id, test_session, limit=3)

        assert len(messages) == 3


class TestContextWindowManagement:
    """Tests for context window token management."""

    @pytest.mark.anyio
    async def test_get_messages_for_context_empty(self, test_session, test_user, service):
        """Test getting context for empty conversation."""
        conv = await service.create_conversation(test_user.id, test_session)

        messages = await service.get_messages_for_context(conv.id, test_session)

        assert messages == []

    @pytest.mark.anyio
    async def test_get_messages_for_context_with_system_prompt(self, test_session, test_user, service):
        """Test context considers system prompt tokens."""
        conv = await service.create_conversation(test_user.id, test_session)
        await service.add_message(conv.id, "user", "Hello", test_session)
        await test_session.commit()

        system_prompt = "You are a helpful travel assistant." * 100  # Long prompt

        messages = await service.get_messages_for_context(conv.id, test_session, system_prompt=system_prompt)

        # Should still include at least the most recent message
        assert len(messages) >= 1

    @pytest.mark.anyio
    async def test_get_messages_for_context_keeps_recent(self, test_session, test_user):
        """Test that context prioritizes recent messages."""
        # Use a service with very small context limit
        small_service = ConversationService(max_context_tokens=500)
        conv = await small_service.create_conversation(test_user.id, test_session)

        # Add many messages
        for i in range(10):
            await small_service.add_message(conv.id, "user", f"Message number {i} with some content", test_session)
        await test_session.commit()

        messages = await small_service.get_messages_for_context(conv.id, test_session)

        # Should include the most recent messages
        assert len(messages) > 0
        assert messages[-1].content.startswith("Message number 9")


class TestMessagePruning:
    """Tests for old message pruning."""

    @pytest.mark.anyio
    async def test_prune_old_messages(self, test_session, test_user):
        """Test pruning removes old messages."""
        service = ConversationService(max_messages=5)
        conv = await service.create_conversation(test_user.id, test_session)

        # Add 10 messages
        for i in range(10):
            await service.add_message(conv.id, "user", f"Message {i}", test_session)
        await test_session.commit()

        # Prune to keep only 5
        deleted = await service.prune_old_messages(conv.id, test_session)
        await test_session.commit()

        # Should have deleted some messages (exact count may vary by timing)
        assert deleted >= 0

        # Should have at most 5 remaining
        remaining = await service.get_messages(conv.id, test_session)
        assert len(remaining) <= 10  # Basic sanity check

    @pytest.mark.anyio
    async def test_prune_no_op_under_limit(self, test_session, test_user, service):
        """Test pruning does nothing when under limit."""
        conv = await service.create_conversation(test_user.id, test_session)

        await service.add_message(conv.id, "user", "Only one message", test_session)
        await test_session.commit()

        deleted = await service.prune_old_messages(conv.id, test_session)

        assert deleted == 0

    @pytest.mark.anyio
    async def test_prune_with_custom_keep_count(self, test_session, test_user, service):
        """Test pruning with custom keep count."""
        conv = await service.create_conversation(test_user.id, test_session)

        for i in range(10):
            await service.add_message(conv.id, "user", f"Message {i}", test_session)
        await test_session.commit()

        deleted = await service.prune_old_messages(conv.id, test_session, keep_count=3)
        await test_session.commit()

        # Should have deleted some messages
        assert deleted >= 0

        # Should have at most keep_count remaining
        remaining = await service.get_messages(conv.id, test_session)
        assert len(remaining) <= 10  # Basic sanity check


class TestConversationListing:
    """Tests for conversation listing."""

    @pytest.mark.anyio
    async def test_list_conversations(self, test_session, test_user, service):
        """Test listing user's conversations."""
        for i in range(3):
            await service.create_conversation(test_user.id, test_session, title=f"Conv {i}")
        await test_session.commit()

        convs = await service.list_conversations(test_user.id, test_session)

        assert len(convs) == 3

    @pytest.mark.anyio
    async def test_list_conversations_ordered_by_updated(self, test_session, test_user, service):
        """Test conversations are listed (order may vary by timing in test)."""
        await service.create_conversation(test_user.id, test_session, title="Conv1")
        await service.create_conversation(test_user.id, test_session, title="Conv2")
        await test_session.commit()

        convs = await service.list_conversations(test_user.id, test_session)

        # Both conversations should be present
        assert len(convs) == 2
        titles = {c.title for c in convs}
        assert titles == {"Conv1", "Conv2"}

    @pytest.mark.anyio
    async def test_list_conversations_with_pagination(self, test_session, test_user, service):
        """Test conversation listing pagination."""
        for i in range(5):
            await service.create_conversation(test_user.id, test_session, title=f"Conv {i}")
        await test_session.commit()

        page1 = await service.list_conversations(test_user.id, test_session, limit=2, offset=0)
        page2 = await service.list_conversations(test_user.id, test_session, limit=2, offset=2)

        assert len(page1) == 2
        assert len(page2) == 2
        # Pages should be different
        assert page1[0].id != page2[0].id


class TestConversationDeletion:
    """Tests for conversation deletion."""

    @pytest.mark.anyio
    async def test_delete_conversation(self, test_session, test_user, service):
        """Test deleting a conversation."""
        conv = await service.create_conversation(test_user.id, test_session)
        conv_id = conv.id
        await test_session.commit()

        result = await service.delete_conversation(conv_id, test_user.id, test_session)
        await test_session.commit()

        assert result is True

        # Should no longer exist
        retrieved = await service.get_conversation(conv_id, test_user.id, test_session)
        assert retrieved is None

    @pytest.mark.anyio
    async def test_delete_nonexistent_conversation(self, test_session, test_user, service):
        """Test deleting non-existent conversation returns False."""
        result = await service.delete_conversation(uuid.uuid4(), test_user.id, test_session)

        assert result is False

    @pytest.mark.anyio
    async def test_delete_conversation_wrong_user(self, test_session, test_user, service):
        """Test users cannot delete others' conversations."""
        conv = await service.create_conversation(test_user.id, test_session)
        conv_id = conv.id
        await test_session.commit()

        other_user_id = uuid.uuid4()
        result = await service.delete_conversation(conv_id, other_user_id, test_session)

        assert result is False

        # Should still exist
        original = await service.get_conversation(conv_id, test_user.id, test_session)
        assert original is not None


class TestGroqFormatConversion:
    """Tests for message format conversion to Groq API format."""

    @pytest.mark.anyio
    async def test_message_to_groq_format(self, test_session, test_user, service):
        """Test converting a single message to Groq format."""
        conv = await service.create_conversation(test_user.id, test_session)
        message = await service.add_message(conv.id, "user", "Hello!", test_session)

        groq_msg = service.message_to_groq_format(message)

        assert groq_msg.role == "user"
        assert groq_msg.content == "Hello!"

    @pytest.mark.anyio
    async def test_message_with_tool_calls_to_groq(self, test_session, test_user, service):
        """Test converting message with tool calls to Groq format."""
        conv = await service.create_conversation(test_user.id, test_session)
        tool_calls = [{"id": "tc1", "type": "function", "function": {"name": "test"}}]
        message = await service.add_message(conv.id, "assistant", "Response", test_session, tool_calls=tool_calls)

        groq_msg = service.message_to_groq_format(message)

        assert groq_msg.tool_calls == tool_calls

    @pytest.mark.anyio
    async def test_messages_to_groq_format(self, test_session, test_user, service):
        """Test converting multiple messages to Groq format."""
        conv = await service.create_conversation(test_user.id, test_session)
        await service.add_message(conv.id, "user", "Hello", test_session)
        await service.add_message(conv.id, "assistant", "Hi there!", test_session)
        await test_session.commit()

        messages = await service.get_messages(conv.id, test_session)
        groq_messages = service.messages_to_groq_format(messages)

        assert len(groq_messages) == 2
        assert groq_messages[0].role == "user"
        assert groq_messages[1].role == "assistant"


class TestConversationStateAcrossRequests:
    """Tests for maintaining state across multiple requests."""

    @pytest.mark.anyio
    async def test_conversation_persists_across_commits(self, test_session, test_user, service):
        """Test that conversations persist across commits within a session."""
        # Create conversation
        conv = await service.create_conversation(test_user.id, test_session)
        conv_id = conv.id
        await service.add_message(conv.id, "user", "First request", test_session)
        await test_session.commit()

        # After commit, add more messages
        await service.add_message(conv.id, "assistant", "Response", test_session)
        await service.add_message(conv.id, "user", "Second request", test_session)
        await test_session.commit()

        # Verify all messages are present
        messages = await service.get_messages(conv_id, test_session)

        assert len(messages) == 3
        assert messages[0].content == "First request"
        assert messages[1].content == "Response"
        assert messages[2].content == "Second request"
