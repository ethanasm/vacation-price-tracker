import { render, screen } from "@testing-library/react";
import { ChatMessage, ChatMessageList } from "../../../components/chat/chat-message";
import type { ChatMessage as ChatMessageType } from "../../../lib/chat-types";

describe("ChatMessage", () => {
  const baseMessage: ChatMessageType = {
    id: "msg-1",
    role: "user",
    content: "Hello world",
    createdAt: new Date("2024-01-15T10:30:00"),
  };

  describe("user messages", () => {
    it("renders user message content", () => {
      render(<ChatMessage message={baseMessage} />);

      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });

    it("displays user avatar icon", () => {
      render(<ChatMessage message={baseMessage} />);

      const messageItem = screen.getByRole("listitem", { name: /user message/i });
      expect(messageItem).toBeInTheDocument();
    });

    it("applies reverse flex direction for user messages", () => {
      const { container } = render(<ChatMessage message={baseMessage} />);

      const messageWrapper = container.querySelector('[role="listitem"]');
      expect(messageWrapper).toHaveClass("flex-row-reverse");
    });

    it("uses primary color for user message bubble", () => {
      const { container } = render(<ChatMessage message={baseMessage} />);

      const bubble = container.querySelector(".bg-primary");
      expect(bubble).toBeInTheDocument();
    });
  });

  describe("assistant messages", () => {
    const assistantMessage: ChatMessageType = {
      id: "msg-2",
      role: "assistant",
      content: "Hi there! How can I help you?",
      createdAt: new Date("2024-01-15T10:31:00"),
    };

    it("renders assistant message content", () => {
      render(<ChatMessage message={assistantMessage} />);

      expect(screen.getByText("Hi there! How can I help you?")).toBeInTheDocument();
    });

    it("displays bot avatar icon", () => {
      render(<ChatMessage message={assistantMessage} />);

      const messageItem = screen.getByRole("listitem", { name: /assistant message/i });
      expect(messageItem).toBeInTheDocument();
    });

    it("does not apply reverse direction for assistant messages", () => {
      const { container } = render(<ChatMessage message={assistantMessage} />);

      const messageWrapper = container.querySelector('[role="listitem"]');
      expect(messageWrapper).not.toHaveClass("flex-row-reverse");
    });

    it("uses muted color for assistant message bubble", () => {
      const { container } = render(<ChatMessage message={assistantMessage} />);

      const bubble = container.querySelector(".bg-muted");
      expect(bubble).toBeInTheDocument();
    });

    it('shows "Thinking..." when content is empty and no tool calls', () => {
      const thinkingMessage: ChatMessageType = {
        id: "msg-3",
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };

      render(<ChatMessage message={thinkingMessage} />);

      expect(screen.getByText("Thinking...")).toBeInTheDocument();
    });

    it("does not show thinking when there are tool calls", () => {
      const toolCallMessage: ChatMessageType = {
        id: "msg-4",
        role: "assistant",
        content: "",
        createdAt: new Date(),
        toolCalls: [
          { id: "call-1", name: "list_trips", arguments: {} },
        ],
      };

      render(<ChatMessage message={toolCallMessage} />);

      expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
    });
  });

  describe("tool calls", () => {
    it("renders tool call list for assistant messages with tool calls", () => {
      const messageWithToolCalls: ChatMessageType = {
        id: "msg-5",
        role: "assistant",
        content: "Let me check your trips.",
        createdAt: new Date(),
        toolCalls: [
          { id: "call-1", name: "list_trips", arguments: {} },
        ],
      };

      render(<ChatMessage message={messageWithToolCalls} />);

      expect(screen.getByText("List Trips")).toBeInTheDocument();
    });

    it("renders multiple tool calls", () => {
      const messageWithMultipleToolCalls: ChatMessageType = {
        id: "msg-6",
        role: "assistant",
        content: "",
        createdAt: new Date(),
        toolCalls: [
          { id: "call-1", name: "list_trips", arguments: {} },
          { id: "call-2", name: "get_trip_details", arguments: { trip_id: "123" } },
        ],
      };

      render(<ChatMessage message={messageWithMultipleToolCalls} />);

      expect(screen.getByText("List Trips")).toBeInTheDocument();
      expect(screen.getByText("Get Trip Details")).toBeInTheDocument();
    });
  });

  describe("tool messages", () => {
    it("returns null for tool messages", () => {
      const toolMessage: ChatMessageType = {
        id: "msg-7",
        role: "tool",
        content: "",
        createdAt: new Date(),
        toolResult: {
          toolCallId: "call-1",
          name: "list_trips",
          result: { trips: [] },
        },
      };

      const { container } = render(<ChatMessage message={toolMessage} />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("timestamp", () => {
    it("displays formatted time on hover", () => {
      const message: ChatMessageType = {
        id: "msg-8",
        role: "user",
        content: "Test",
        createdAt: new Date("2024-01-15T14:30:00"),
      };

      render(<ChatMessage message={message} />);

      // Time should be present but with opacity-0 by default
      expect(screen.getByText("2:30 PM")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <ChatMessage message={baseMessage} className="custom-class" />
      );

      const messageWrapper = container.querySelector('[role="listitem"]');
      expect(messageWrapper).toHaveClass("custom-class");
    });

    it("preserves whitespace in content", () => {
      const multilineMessage: ChatMessageType = {
        id: "msg-9",
        role: "user",
        content: "Line 1\n\nLine 2",
        createdAt: new Date(),
      };

      render(<ChatMessage message={multilineMessage} />);

      const content = screen.getByText(/Line 1/);
      expect(content).toHaveClass("whitespace-pre-wrap");
    });
  });
});

describe("ChatMessageList", () => {
  describe("empty state", () => {
    it("shows empty state when no messages", () => {
      render(<ChatMessageList messages={[]} />);

      expect(screen.getByText("Start a conversation")).toBeInTheDocument();
      expect(
        screen.getByText(/Ask me to help you track vacation prices/)
      ).toBeInTheDocument();
    });
  });

  describe("message rendering", () => {
    it("renders all non-tool messages", () => {
      const messages: ChatMessageType[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          createdAt: new Date(),
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi there!",
          createdAt: new Date(),
        },
      ];

      render(<ChatMessageList messages={messages} />);

      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("Hi there!")).toBeInTheDocument();
    });

    it("filters out tool messages", () => {
      const messages: ChatMessageType[] = [
        {
          id: "msg-1",
          role: "user",
          content: "List my trips",
          createdAt: new Date(),
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "",
          createdAt: new Date(),
          toolCalls: [{ id: "call-1", name: "list_trips", arguments: {} }],
        },
        {
          id: "msg-3",
          role: "tool",
          content: "",
          createdAt: new Date(),
          toolResult: {
            toolCallId: "call-1",
            name: "list_trips",
            result: { trips: [] },
          },
        },
      ];

      render(<ChatMessageList messages={messages} />);

      // Should render user and assistant messages
      expect(screen.getByText("List my trips")).toBeInTheDocument();
      expect(screen.getByText("List Trips")).toBeInTheDocument();

      // Should not render tool message separately
      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(2); // Only user and assistant
    });

    it("renders messages in order", () => {
      const messages: ChatMessageType[] = [
        { id: "1", role: "user", content: "First", createdAt: new Date() },
        { id: "2", role: "assistant", content: "Second", createdAt: new Date() },
        { id: "3", role: "user", content: "Third", createdAt: new Date() },
      ];

      render(<ChatMessageList messages={messages} />);

      const listItems = screen.getAllByRole("listitem");
      expect(listItems[0]).toHaveTextContent("First");
      expect(listItems[1]).toHaveTextContent("Second");
      expect(listItems[2]).toHaveTextContent("Third");
    });
  });

  describe("accessibility", () => {
    it("has list role with accessible name", () => {
      const messages: ChatMessageType[] = [
        { id: "1", role: "user", content: "Test", createdAt: new Date() },
      ];

      render(<ChatMessageList messages={messages} />);

      expect(screen.getByRole("list", { name: /chat messages/i })).toBeInTheDocument();
    });

    it("each message has listitem role", () => {
      const messages: ChatMessageType[] = [
        { id: "1", role: "user", content: "Test 1", createdAt: new Date() },
        { id: "2", role: "assistant", content: "Test 2", createdAt: new Date() },
      ];

      render(<ChatMessageList messages={messages} />);

      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });
  });

  describe("styling", () => {
    it("applies custom className", () => {
      const messages: ChatMessageType[] = [
        { id: "1", role: "user", content: "Test", createdAt: new Date() },
      ];

      const { container } = render(
        <ChatMessageList messages={messages} className="custom-class" />
      );

      const list = container.querySelector('[role="list"]');
      expect(list).toHaveClass("custom-class");
    });
  });
});
