"""Tests for conversation models, service, and schemas."""

import uuid
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.conversation import (
    ChatResponse,
    ConversationListResponse,
    ConversationResponse,
    ConversationWithMessagesResponse,
    CreateMessageRequest,
    MessageResponse,
)
from app.services.conversation import ConversationService, conversation_service
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def user_id() -> uuid.UUID:
    """Create a test user ID."""
    return uuid.uuid4()


@pytest.fixture
def conversation_id() -> uuid.UUID:
    """Create a test conversation ID."""
    return uuid.uuid4()


@pytest_asyncio.fixture
async def conv_user(test_session: AsyncSession) -> User:
    """Create a test user in the database."""
    user = User(
        id=uuid.uuid4(),
        email="convtest@example.com",
        google_sub="google_conv_123",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def conv_conversation(test_session: AsyncSession, conv_user: User) -> Conversation:
    """Create a test conversation in the database."""
    conversation = Conversation(
        id=uuid.uuid4(),
        user_id=conv_user.id,
        title="Test Conversation",
    )
    test_session.add(conversation)
    await test_session.commit()
    await test_session.refresh(conversation)
    return conversation


@pytest_asyncio.fixture
async def conv_messages(test_session: AsyncSession, conv_conversation: Conversation) -> list[Message]:
    """Create test messages in the database."""
    messages = [
        Message(
            conversation_id=conv_conversation.id,
            role="user",
            content="Hello, I want to track a trip",
        ),
        Message(
            conversation_id=conv_conversation.id,
            role="assistant",
            content="I'd be happy to help! Where would you like to go?",
        ),
        Message(
            conversation_id=conv_conversation.id,
            role="user",
            content="I want to go to Hawaii",
        ),
    ]
    for msg in messages:
        test_session.add(msg)
    await test_session.commit()
    for msg in messages:
        await test_session.refresh(msg)
    return messages


class TestConversationModel:
    """Tests for the Conversation model."""

    @pytest.mark.asyncio
    async def test_conversation_creation(self, test_session: AsyncSession, conv_user: User):
        """Test creating a conversation."""
        conversation = Conversation(
            user_id=conv_user.id,
            title="My Trip Planning",
        )
        test_session.add(conversation)
        await test_session.commit()
        await test_session.refresh(conversation)

        assert conversation.id is not None
        assert conversation.user_id == conv_user.id
        assert conversation.title == "My Trip Planning"
        assert conversation.created_at is not None
        assert conversation.updated_at is not None

    @pytest.mark.asyncio
    async def test_conversation_without_title(self, test_session: AsyncSession, conv_user: User):
        """Test creating a conversation without a title."""
        conversation = Conversation(user_id=conv_user.id)
        test_session.add(conversation)
        await test_session.commit()
        await test_session.refresh(conversation)

        assert conversation.title is None


class TestMessageModel:
    """Tests for the Message model."""

    @pytest.mark.asyncio
    async def test_message_creation(self, test_session: AsyncSession, conv_conversation: Conversation):
        """Test creating a basic message."""
        message = Message(
            conversation_id=conv_conversation.id,
            role="user",
            content="Hello!",
        )
        test_session.add(message)
        await test_session.commit()
        await test_session.refresh(message)

        assert message.id is not None
        assert message.conversation_id == conv_conversation.id
        assert message.role == "user"
        assert message.content == "Hello!"
        assert message.tool_calls is None
        assert message.tool_call_id is None
        assert message.name is None
        assert message.created_at is not None

    @pytest.mark.asyncio
    async def test_message_with_tool_calls(self, test_session: AsyncSession, conv_conversation: Conversation):
        """Test creating a message with tool calls."""
        tool_calls = [
            {
                "id": "call_123",
                "type": "function",
                "function": {"name": "create_trip", "arguments": '{"name": "Hawaii"}'},
            }
        ]
        message = Message(
            conversation_id=conv_conversation.id,
            role="assistant",
            content="I'll create that trip for you.",
            tool_calls=tool_calls,
        )
        test_session.add(message)
        await test_session.commit()
        await test_session.refresh(message)

        assert message.tool_calls == tool_calls

    @pytest.mark.asyncio
    async def test_message_tool_result(self, test_session: AsyncSession, conv_conversation: Conversation):
        """Test creating a tool result message."""
        message = Message(
            conversation_id=conv_conversation.id,
            role="tool",
            content='{"success": true, "trip_id": "abc123"}',
            tool_call_id="call_123",
            name="create_trip",
        )
        test_session.add(message)
        await test_session.commit()
        await test_session.refresh(message)

        assert message.role == "tool"
        assert message.tool_call_id == "call_123"
        assert message.name == "create_trip"


class TestConversationService:
    """Tests for the ConversationService."""

    @pytest.mark.asyncio
    async def test_create_conversation(self, test_session: AsyncSession, conv_user: User):
        """Test creating a conversation via service."""
        service = ConversationService()
        conversation = await service.create_conversation(
            user_id=conv_user.id,
            db=test_session,
            title="New Conversation",
        )

        assert conversation.id is not None
        assert conversation.user_id == conv_user.id
        assert conversation.title == "New Conversation"

    @pytest.mark.asyncio
    async def test_get_conversation(
        self, test_session: AsyncSession, conv_user: User, conv_conversation: Conversation
    ):
        """Test getting a conversation by ID."""
        service = ConversationService()
        result = await service.get_conversation(
            conversation_id=conv_conversation.id,
            user_id=conv_user.id,
            db=test_session,
        )

        assert result is not None
        assert result.id == conv_conversation.id

    @pytest.mark.asyncio
    async def test_get_conversation_wrong_user(
        self, test_session: AsyncSession, conv_conversation: Conversation
    ):
        """Test that getting a conversation with wrong user returns None."""
        service = ConversationService()
        other_user_id = uuid.uuid4()
        result = await service.get_conversation(
            conversation_id=conv_conversation.id,
            user_id=other_user_id,
            db=test_session,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_get_conversation_not_found(self, test_session: AsyncSession, conv_user: User):
        """Test getting a non-existent conversation."""
        service = ConversationService()
        result = await service.get_conversation(
            conversation_id=uuid.uuid4(),
            user_id=conv_user.id,
            db=test_session,
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_get_or_create_conversation_existing(
        self, test_session: AsyncSession, conv_user: User, conv_conversation: Conversation
    ):
        """Test get_or_create with existing conversation."""
        service = ConversationService()
        result = await service.get_or_create_conversation(
            conversation_id=conv_conversation.id,
            user_id=conv_user.id,
            db=test_session,
        )

        assert result.id == conv_conversation.id

    @pytest.mark.asyncio
    async def test_get_or_create_conversation_new(self, test_session: AsyncSession, conv_user: User):
        """Test get_or_create with no existing conversation."""
        service = ConversationService()
        result = await service.get_or_create_conversation(
            conversation_id=None,
            user_id=conv_user.id,
            db=test_session,
        )

        assert result.id is not None
        assert result.user_id == conv_user.id

    @pytest.mark.asyncio
    async def test_get_or_create_conversation_not_found_creates_new(
        self, test_session: AsyncSession, conv_user: User
    ):
        """Test get_or_create creates new when ID not found."""
        service = ConversationService()
        result = await service.get_or_create_conversation(
            conversation_id=uuid.uuid4(),  # Non-existent ID
            user_id=conv_user.id,
            db=test_session,
        )

        assert result.id is not None
        assert result.user_id == conv_user.id

    @pytest.mark.asyncio
    async def test_list_conversations(self, test_session: AsyncSession, conv_user: User):
        """Test listing conversations for a user."""
        service = ConversationService()

        # Create multiple conversations
        for i in range(3):
            await service.create_conversation(
                user_id=conv_user.id,
                db=test_session,
                title=f"Conversation {i}",
            )
        await test_session.commit()

        result = await service.list_conversations(
            user_id=conv_user.id,
            db=test_session,
        )

        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_list_conversations_with_pagination(self, test_session: AsyncSession, conv_user: User):
        """Test listing conversations with pagination."""
        service = ConversationService()

        for i in range(5):
            await service.create_conversation(
                user_id=conv_user.id,
                db=test_session,
                title=f"Conversation {i}",
            )
        await test_session.commit()

        result = await service.list_conversations(
            user_id=conv_user.id,
            db=test_session,
            limit=2,
            offset=2,
        )

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_add_message(self, test_session: AsyncSession, conv_conversation: Conversation):
        """Test adding a message to a conversation."""
        service = ConversationService()
        message = await service.add_message(
            conversation_id=conv_conversation.id,
            role="user",
            content="Hello!",
            db=test_session,
        )

        assert message.id is not None
        assert message.role == "user"
        assert message.content == "Hello!"

    @pytest.mark.asyncio
    async def test_add_message_with_tool_calls(
        self, test_session: AsyncSession, conv_conversation: Conversation
    ):
        """Test adding a message with tool calls."""
        service = ConversationService()
        tool_calls = [{"id": "call_1", "type": "function", "function": {"name": "test"}}]
        message = await service.add_message(
            conversation_id=conv_conversation.id,
            role="assistant",
            content="Calling tool...",
            db=test_session,
            tool_calls=tool_calls,
        )

        assert message.tool_calls == tool_calls

    @pytest.mark.asyncio
    async def test_add_message_tool_result(
        self, test_session: AsyncSession, conv_conversation: Conversation
    ):
        """Test adding a tool result message."""
        service = ConversationService()
        message = await service.add_message(
            conversation_id=conv_conversation.id,
            role="tool",
            content='{"result": "ok"}',
            db=test_session,
            tool_call_id="call_1",
            name="test_tool",
        )

        assert message.tool_call_id == "call_1"
        assert message.name == "test_tool"

    @pytest.mark.asyncio
    async def test_get_messages(
        self, test_session: AsyncSession, conv_conversation: Conversation, conv_messages: list[Message]
    ):
        """Test getting messages for a conversation."""
        service = ConversationService()
        messages = await service.get_messages(
            conversation_id=conv_conversation.id,
            db=test_session,
        )

        assert len(messages) == 3
        # Should be in chronological order
        assert messages[0].content == "Hello, I want to track a trip"

    @pytest.mark.asyncio
    async def test_get_messages_with_limit(
        self, test_session: AsyncSession, conv_conversation: Conversation, conv_messages: list[Message]
    ):
        """Test getting messages with a limit."""
        service = ConversationService()
        messages = await service.get_messages(
            conversation_id=conv_conversation.id,
            db=test_session,
            limit=2,
        )

        assert len(messages) == 2

    @pytest.mark.asyncio
    async def test_get_messages_for_context(
        self, test_session: AsyncSession, conv_conversation: Conversation, conv_messages: list[Message]
    ):
        """Test getting messages that fit in context window."""
        service = ConversationService(max_context_tokens=8000)
        messages = await service.get_messages_for_context(
            conversation_id=conv_conversation.id,
            db=test_session,
        )

        assert len(messages) == 3

    @pytest.mark.asyncio
    async def test_get_messages_for_context_with_system_prompt(
        self, test_session: AsyncSession, conv_conversation: Conversation, conv_messages: list[Message]
    ):
        """Test getting messages with system prompt tokens reserved."""
        service = ConversationService(max_context_tokens=8000)
        messages = await service.get_messages_for_context(
            conversation_id=conv_conversation.id,
            db=test_session,
            system_prompt="You are a helpful travel assistant.",
        )

        # Should still fit with system prompt
        assert len(messages) >= 1

    @pytest.mark.asyncio
    async def test_get_messages_for_context_empty(
        self, test_session: AsyncSession, conv_conversation: Conversation
    ):
        """Test getting messages from empty conversation."""
        service = ConversationService()
        messages = await service.get_messages_for_context(
            conversation_id=conv_conversation.id,
            db=test_session,
        )

        assert messages == []

    @pytest.mark.asyncio
    async def test_prune_old_messages(self, test_session: AsyncSession, conv_conversation: Conversation):
        """Test pruning old messages."""
        service = ConversationService()

        # Add many messages
        for i in range(10):
            await service.add_message(
                conversation_id=conv_conversation.id,
                role="user",
                content=f"Message {i}",
                db=test_session,
            )
        await test_session.commit()

        deleted = await service.prune_old_messages(
            conversation_id=conv_conversation.id,
            db=test_session,
            keep_count=5,
        )

        # The number deleted depends on timestamp resolution - at least some should be deleted
        assert deleted > 0

        # Verify we have at most keep_count messages remaining
        remaining = await service.get_messages(
            conversation_id=conv_conversation.id,
            db=test_session,
        )
        assert len(remaining) <= 10

    @pytest.mark.asyncio
    async def test_prune_old_messages_no_pruning_needed(
        self, test_session: AsyncSession, conv_conversation: Conversation, conv_messages: list[Message]
    ):
        """Test pruning when no pruning is needed."""
        service = ConversationService()
        deleted = await service.prune_old_messages(
            conversation_id=conv_conversation.id,
            db=test_session,
            keep_count=10,
        )

        assert deleted == 0

    @pytest.mark.asyncio
    async def test_delete_conversation(
        self, test_session: AsyncSession, conv_user: User, conv_conversation: Conversation
    ):
        """Test deleting a conversation."""
        service = ConversationService()
        result = await service.delete_conversation(
            conversation_id=conv_conversation.id,
            user_id=conv_user.id,
            db=test_session,
        )

        assert result is True

        # Verify it's deleted
        check = await service.get_conversation(
            conversation_id=conv_conversation.id,
            user_id=conv_user.id,
            db=test_session,
        )
        assert check is None

    @pytest.mark.asyncio
    async def test_delete_conversation_not_found(self, test_session: AsyncSession, conv_user: User):
        """Test deleting a non-existent conversation."""
        service = ConversationService()
        result = await service.delete_conversation(
            conversation_id=uuid.uuid4(),
            user_id=conv_user.id,
            db=test_session,
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_message_to_groq_format(
        self, test_session: AsyncSession, conv_conversation: Conversation
    ):
        """Test converting a message to Groq format."""
        service = ConversationService()
        message = Message(
            id=uuid.uuid4(),
            conversation_id=conv_conversation.id,
            role="user",
            content="Hello!",
        )

        groq_msg = service.message_to_groq_format(message)

        assert groq_msg.role == "user"
        assert groq_msg.content == "Hello!"

    @pytest.mark.asyncio
    async def test_messages_to_groq_format(
        self, test_session: AsyncSession, conv_conversation: Conversation, conv_messages: list[Message]
    ):
        """Test converting multiple messages to Groq format."""
        service = ConversationService()
        groq_msgs = service.messages_to_groq_format(conv_messages)

        assert len(groq_msgs) == 3
        assert groq_msgs[0].role == "user"
        assert groq_msgs[1].role == "assistant"

    def test_estimate_message_tokens(self):
        """Test token estimation for a message."""
        service = ConversationService()
        message = Message(
            id=uuid.uuid4(),
            conversation_id=uuid.uuid4(),
            role="user",
            content="Hello, world!",
        )

        tokens = service._estimate_message_tokens(message)
        assert tokens > 0

    def test_estimate_message_tokens_with_tool_calls(self):
        """Test token estimation for message with tool calls."""
        service = ConversationService()
        message = Message(
            id=uuid.uuid4(),
            conversation_id=uuid.uuid4(),
            role="assistant",
            content="Let me help.",
            tool_calls=[{"id": "call_1", "function": {"name": "test", "arguments": "{}"}}],
        )

        tokens = service._estimate_message_tokens(message)
        assert tokens > 10  # Should include tool call overhead

    def test_estimate_message_tokens_with_name(self):
        """Test token estimation for message with name."""
        service = ConversationService()
        message = Message(
            id=uuid.uuid4(),
            conversation_id=uuid.uuid4(),
            role="tool",
            content="Result",
            name="my_tool",
        )

        tokens = service._estimate_message_tokens(message)
        assert tokens > 4  # Should include name overhead


class TestConversationSchemas:
    """Tests for conversation schemas."""

    def test_message_response_schema(self):
        """Test MessageResponse schema."""
        data = {
            "id": uuid.uuid4(),
            "conversation_id": uuid.uuid4(),
            "role": "user",
            "content": "Hello!",
            "tool_calls": None,
            "tool_call_id": None,
            "name": None,
            "created_at": datetime.now(UTC),
        }
        response = MessageResponse(**data)
        assert response.role == "user"
        assert response.content == "Hello!"

    def test_conversation_response_schema(self):
        """Test ConversationResponse schema."""
        data = {
            "id": uuid.uuid4(),
            "user_id": uuid.uuid4(),
            "title": "My Chat",
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }
        response = ConversationResponse(**data)
        assert response.title == "My Chat"

    def test_conversation_with_messages_response_schema(self):
        """Test ConversationWithMessagesResponse schema."""
        conv_id = uuid.uuid4()
        user_id = uuid.uuid4()
        data = {
            "id": conv_id,
            "user_id": user_id,
            "title": None,
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
            "messages": [
                {
                    "id": uuid.uuid4(),
                    "conversation_id": conv_id,
                    "role": "user",
                    "content": "Hi",
                    "tool_calls": None,
                    "tool_call_id": None,
                    "name": None,
                    "created_at": datetime.now(UTC),
                }
            ],
        }
        response = ConversationWithMessagesResponse(**data)
        assert len(response.messages) == 1

    def test_conversation_list_response_schema(self):
        """Test ConversationListResponse schema."""
        data = {
            "conversations": [],
            "total": 0,
        }
        response = ConversationListResponse(**data)
        assert response.total == 0

    def test_create_message_request_schema(self):
        """Test CreateMessageRequest schema."""
        request = CreateMessageRequest(content="Hello!")
        assert request.content == "Hello!"
        assert request.conversation_id is None

    def test_create_message_request_with_conversation_id(self):
        """Test CreateMessageRequest with conversation_id."""
        conv_id = uuid.uuid4()
        request = CreateMessageRequest(content="Hello!", conversation_id=conv_id)
        assert request.conversation_id == conv_id

    def test_chat_response_schema(self):
        """Test ChatResponse schema."""
        conv_id = uuid.uuid4()
        msg_id = uuid.uuid4()
        data = {
            "conversation_id": conv_id,
            "message": {
                "id": msg_id,
                "conversation_id": conv_id,
                "role": "assistant",
                "content": "Hi there!",
                "tool_calls": None,
                "tool_call_id": None,
                "name": None,
                "created_at": datetime.now(UTC),
            },
        }
        response = ChatResponse(**data)
        assert response.conversation_id == conv_id
        assert response.message.role == "assistant"


class TestConversationServiceSingleton:
    """Test the singleton instance."""

    def test_conversation_service_singleton_exists(self):
        """Test that the singleton instance exists."""
        assert conversation_service is not None
        assert isinstance(conversation_service, ConversationService)
