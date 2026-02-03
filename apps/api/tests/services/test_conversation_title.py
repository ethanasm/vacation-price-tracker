"""Tests for conversation title generation functionality.

Coverage targets:
- generate_title: LLM-based title generation
- update_conversation_title: Database title update
- should_generate_title: Title generation conditions
- get_first_exchange: Fetching first user/assistant messages
- _generate_fallback_title: Fallback title generation
- ChatService._maybe_generate_title: Integration with chat flow
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.clients.groq import ChatChunk as GroqChatChunk
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.conversation import (
    _generate_fallback_title,
    generate_title,
    get_first_exchange,
    should_generate_title,
    update_conversation_title,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# =============================================================================
# Helper Functions
# =============================================================================


def make_conversation(
    conv_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    title: str | None = None,
) -> Conversation:
    """Create a Conversation for testing."""
    return Conversation(
        id=conv_id or uuid.uuid4(),
        user_id=user_id or uuid.uuid4(),
        title=title,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


def make_message(
    conversation_id: uuid.UUID,
    role: str = "user",
    content: str = "Hello",
) -> Message:
    """Create a Message for testing."""
    return Message(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        role=role,
        content=content,
        created_at=datetime.now(),
    )


# =============================================================================
# generate_title Tests
# =============================================================================


class TestGenerateTitle:
    """Tests for the generate_title function."""

    @pytest.mark.asyncio
    async def test_generates_title_from_conversation(self):
        """Test that a title is generated from user/assistant exchange."""
        with patch("app.clients.groq.GroqClient") as mock_client_class:
            mock_client = MagicMock()

            async def mock_chat(*args, **kwargs):
                yield GroqChatChunk(content="Hawaii Trip Planning")
                yield GroqChatChunk(finish_reason="stop")

            mock_client.chat = mock_chat
            mock_client_class.return_value = mock_client

            title = await generate_title(
                user_message="I want to plan a trip to Hawaii",
                assistant_response="I'd be happy to help you plan your Hawaii trip!",
            )

            assert title == "Hawaii Trip Planning"

    @pytest.mark.asyncio
    async def test_strips_quotes_from_title(self):
        """Test that quotes are stripped from generated titles."""
        with patch("app.clients.groq.GroqClient") as mock_client_class:
            mock_client = MagicMock()

            async def mock_chat(*args, **kwargs):
                yield GroqChatChunk(content='"Planning a Beach Vacation"')
                yield GroqChatChunk(finish_reason="stop")

            mock_client.chat = mock_chat
            mock_client_class.return_value = mock_client

            title = await generate_title(
                user_message="Beach vacation",
                assistant_response="Great choice!",
            )

            assert title == "Planning a Beach Vacation"

    @pytest.mark.asyncio
    async def test_truncates_long_titles(self):
        """Test that titles longer than 255 chars are truncated."""
        with patch("app.clients.groq.GroqClient") as mock_client_class:
            mock_client = MagicMock()
            long_title = "A" * 300

            async def mock_chat(*args, **kwargs):
                yield GroqChatChunk(content=long_title)
                yield GroqChatChunk(finish_reason="stop")

            mock_client.chat = mock_chat
            mock_client_class.return_value = mock_client

            title = await generate_title(
                user_message="Test",
                assistant_response="Test response",
            )

            assert len(title) <= 255
            assert title.endswith("...")

    @pytest.mark.asyncio
    async def test_returns_fallback_on_error(self):
        """Test that a fallback title is returned when LLM fails."""
        with patch("app.clients.groq.GroqClient") as mock_client_class:
            mock_client = MagicMock()

            async def mock_chat(*args, **kwargs):
                raise Exception("LLM error")
                yield  # Make it a generator

            mock_client.chat = mock_chat
            mock_client_class.return_value = mock_client

            title = await generate_title(
                user_message="Plan my trip to Paris next month",
                assistant_response="Error",
            )

            # Should get a fallback title from the user message
            assert "Plan" in title or "trip" in title

    @pytest.mark.asyncio
    async def test_uses_correct_temperature_and_max_tokens(self):
        """Test that LLM is called with correct parameters."""
        with patch("app.clients.groq.GroqClient") as mock_client_class:
            mock_client = MagicMock()
            captured_kwargs = {}

            async def mock_chat(*args, **kwargs):
                captured_kwargs.update(kwargs)
                yield GroqChatChunk(content="Test Title")
                yield GroqChatChunk(finish_reason="stop")

            mock_client.chat = mock_chat
            mock_client_class.return_value = mock_client

            await generate_title(
                user_message="Test",
                assistant_response="Response",
            )

            assert captured_kwargs.get("temperature") == 0.3
            assert captured_kwargs.get("max_tokens") == 50

    @pytest.mark.asyncio
    async def test_truncates_long_assistant_response(self):
        """Test that long assistant responses are truncated in prompt."""
        with patch("app.clients.groq.GroqClient") as mock_client_class:
            mock_client = MagicMock()
            captured_messages = []

            async def mock_chat(messages, *args, **kwargs):
                captured_messages.extend(messages)
                yield GroqChatChunk(content="Title")
                yield GroqChatChunk(finish_reason="stop")

            mock_client.chat = mock_chat
            mock_client_class.return_value = mock_client

            long_response = "X" * 1000

            await generate_title(
                user_message="Short message",
                assistant_response=long_response,
            )

            # The user message to the LLM should contain truncated response
            user_msg = captured_messages[1]
            assert len(user_msg.content) < len(long_response) + 100


# =============================================================================
# _generate_fallback_title Tests
# =============================================================================


class TestGenerateFallbackTitle:
    """Tests for the _generate_fallback_title function."""

    def test_uses_first_six_words(self):
        """Test that fallback uses first 6 words."""
        title = _generate_fallback_title("One two three four five six seven eight")
        assert title == "One two three four five six"

    def test_handles_short_messages(self):
        """Test that short messages work correctly."""
        title = _generate_fallback_title("Hello there")
        assert title == "Hello there"

    def test_truncates_long_words(self):
        """Test that titles with long words are truncated."""
        long_word = "A" * 60
        title = _generate_fallback_title(f"Hello {long_word}")
        assert len(title) <= 50
        assert title.endswith("...")

    def test_handles_empty_message(self):
        """Test handling of empty message."""
        title = _generate_fallback_title("")
        assert title == ""


# =============================================================================
# update_conversation_title Tests
# =============================================================================


class TestUpdateConversationTitle:
    """Tests for the update_conversation_title function."""

    @pytest.mark.asyncio
    async def test_updates_existing_conversation(self, test_session: AsyncSession):
        """Test updating title of an existing conversation."""
        # Create a conversation
        conv = make_conversation()
        test_session.add(conv)
        await test_session.commit()
        await test_session.refresh(conv)

        # Update the title
        result = await update_conversation_title(
            conversation_id=conv.id,
            title="My New Title",
            db=test_session,
        )

        assert result is True

        # Verify the title was updated
        await test_session.refresh(conv)
        assert conv.title == "My New Title"

    @pytest.mark.asyncio
    async def test_returns_false_for_nonexistent_conversation(
        self, test_session: AsyncSession
    ):
        """Test that False is returned for non-existent conversation."""
        result = await update_conversation_title(
            conversation_id=uuid.uuid4(),
            title="Title",
            db=test_session,
        )

        assert result is False


# =============================================================================
# should_generate_title Tests
# =============================================================================


class TestShouldGenerateTitle:
    """Tests for the should_generate_title function."""

    @pytest.mark.asyncio
    async def test_returns_true_when_no_title_and_has_exchange(
        self, test_session: AsyncSession
    ):
        """Test returns True when conversation has no title and has messages."""
        conv = make_conversation(title=None)
        test_session.add(conv)
        await test_session.flush()

        # Add user and assistant messages
        user_msg = make_message(conv.id, role="user", content="Hello")
        assistant_msg = make_message(conv.id, role="assistant", content="Hi!")
        test_session.add(user_msg)
        test_session.add(assistant_msg)
        await test_session.commit()

        result = await should_generate_title(conv.id, test_session)
        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_when_has_title(self, test_session: AsyncSession):
        """Test returns False when conversation already has a title."""
        conv = make_conversation(title="Existing Title")
        test_session.add(conv)
        await test_session.flush()

        # Add messages
        user_msg = make_message(conv.id, role="user", content="Hello")
        assistant_msg = make_message(conv.id, role="assistant", content="Hi!")
        test_session.add(user_msg)
        test_session.add(assistant_msg)
        await test_session.commit()

        result = await should_generate_title(conv.id, test_session)
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_no_user_message(
        self, test_session: AsyncSession
    ):
        """Test returns False when no user message exists."""
        conv = make_conversation(title=None)
        test_session.add(conv)
        await test_session.flush()

        # Only add assistant message
        assistant_msg = make_message(conv.id, role="assistant", content="Hi!")
        test_session.add(assistant_msg)
        await test_session.commit()

        result = await should_generate_title(conv.id, test_session)
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_no_assistant_message(
        self, test_session: AsyncSession
    ):
        """Test returns False when no assistant message exists."""
        conv = make_conversation(title=None)
        test_session.add(conv)
        await test_session.flush()

        # Only add user message
        user_msg = make_message(conv.id, role="user", content="Hello")
        test_session.add(user_msg)
        await test_session.commit()

        result = await should_generate_title(conv.id, test_session)
        assert result is False


# =============================================================================
# get_first_exchange Tests
# =============================================================================


class TestGetFirstExchange:
    """Tests for the get_first_exchange function."""

    @pytest.mark.asyncio
    async def test_returns_first_user_and_assistant_messages(
        self, test_session: AsyncSession
    ):
        """Test that first user and assistant messages are returned."""
        conv = make_conversation()
        test_session.add(conv)
        await test_session.flush()

        # Add messages in order
        user_msg1 = make_message(conv.id, role="user", content="First user")
        user_msg2 = make_message(conv.id, role="user", content="Second user")
        assistant_msg1 = make_message(
            conv.id, role="assistant", content="First assistant"
        )
        assistant_msg2 = make_message(
            conv.id, role="assistant", content="Second assistant"
        )

        test_session.add(user_msg1)
        test_session.add(assistant_msg1)
        test_session.add(user_msg2)
        test_session.add(assistant_msg2)
        await test_session.commit()

        user_content, assistant_content = await get_first_exchange(
            conv.id, test_session
        )

        assert user_content == "First user"
        assert assistant_content == "First assistant"

    @pytest.mark.asyncio
    async def test_returns_none_when_no_messages(self, test_session: AsyncSession):
        """Test that None is returned when no messages exist."""
        conv = make_conversation()
        test_session.add(conv)
        await test_session.commit()

        user_content, assistant_content = await get_first_exchange(
            conv.id, test_session
        )

        assert user_content is None
        assert assistant_content is None

    @pytest.mark.asyncio
    async def test_returns_partial_when_only_user_message(
        self, test_session: AsyncSession
    ):
        """Test returns user message but None for assistant when only user exists."""
        conv = make_conversation()
        test_session.add(conv)
        await test_session.flush()

        user_msg = make_message(conv.id, role="user", content="User message")
        test_session.add(user_msg)
        await test_session.commit()

        user_content, assistant_content = await get_first_exchange(
            conv.id, test_session
        )

        assert user_content == "User message"
        assert assistant_content is None


# =============================================================================
# ChatService._maybe_generate_title Integration Tests
# =============================================================================


class TestMaybeGenerateTitle:
    """Tests for ChatService._maybe_generate_title method."""

    @pytest.mark.asyncio
    async def test_generates_title_when_conditions_met(
        self, test_session: AsyncSession
    ):
        """Test that title is generated when conditions are met."""
        from app.services.chat import ChatService

        # Create conversation without title
        conv = make_conversation(title=None)
        test_session.add(conv)
        await test_session.flush()

        # Add required messages
        user_msg = make_message(conv.id, role="user", content="Plan Hawaii trip")
        assistant_msg = make_message(
            conv.id, role="assistant", content="I can help with that!"
        )
        test_session.add(user_msg)
        test_session.add(assistant_msg)
        await test_session.commit()

        # Mock the generate_title function
        with patch(
            "app.services.chat.generate_title",
            new_callable=AsyncMock,
            return_value="Hawaii Trip Planning",
        ):
            service = ChatService()
            await service._maybe_generate_title(conv.id, test_session)

        # Verify title was updated
        await test_session.refresh(conv)
        assert conv.title == "Hawaii Trip Planning"

    @pytest.mark.asyncio
    async def test_skips_when_title_exists(self, test_session: AsyncSession):
        """Test that title generation is skipped when title already exists."""
        from app.services.chat import ChatService

        # Create conversation with existing title
        conv = make_conversation(title="Existing Title")
        test_session.add(conv)
        await test_session.flush()

        # Add messages
        user_msg = make_message(conv.id, role="user", content="Test")
        assistant_msg = make_message(conv.id, role="assistant", content="Response")
        test_session.add(user_msg)
        test_session.add(assistant_msg)
        await test_session.commit()

        with patch(
            "app.services.chat.generate_title",
            new_callable=AsyncMock,
        ) as mock_generate:
            service = ChatService()
            await service._maybe_generate_title(conv.id, test_session)

            # generate_title should not be called
            mock_generate.assert_not_called()

        # Title should remain unchanged
        await test_session.refresh(conv)
        assert conv.title == "Existing Title"

    @pytest.mark.asyncio
    async def test_handles_errors_gracefully(self, test_session: AsyncSession):
        """Test that errors during title generation don't break the flow."""
        from app.services.chat import ChatService

        # Create conversation
        conv = make_conversation(title=None)
        test_session.add(conv)
        await test_session.flush()

        # Add messages
        user_msg = make_message(conv.id, role="user", content="Test")
        assistant_msg = make_message(conv.id, role="assistant", content="Response")
        test_session.add(user_msg)
        test_session.add(assistant_msg)
        await test_session.commit()

        # Mock generate_title to raise an error
        with patch(
            "app.services.chat.generate_title",
            new_callable=AsyncMock,
            side_effect=Exception("LLM error"),
        ):
            service = ChatService()
            # Should not raise - errors are caught and logged
            await service._maybe_generate_title(conv.id, test_session)

        # Title should remain None
        await test_session.refresh(conv)
        assert conv.title is None
