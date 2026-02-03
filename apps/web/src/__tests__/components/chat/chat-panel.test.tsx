import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "../../../components/chat/chat-panel";
import { ChatProvider } from "../../../lib/chat-provider";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the api module for ThreadHistoryDropdown
const mockListConversations = jest.fn();
jest.mock("../../../lib/api", () => ({
  api: {
    chat: {
      listConversations: (...args: unknown[]) => mockListConversations(...args),
    },
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock scrollIntoView as jsdom doesn't support it
Element.prototype.scrollIntoView = jest.fn();

// Helper to create mock SSE stream
function createMockSSEStream(
  chunks: Array<{ type: string; [key: string]: unknown }>
) {
  const lines = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`);
  lines.push("data: [DONE]\n\n");
  const text = lines.join("");

  let position = 0;

  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (position >= text.length) {
            return { done: true, value: undefined };
          }
          const chunk = text.slice(position, position + 100);
          position += 100;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      }),
    },
  };
}

// Wrapper component with provider
function renderWithProvider(
  ui: React.ReactElement,
  { api = "/api/chat" } = {}
) {
  return render(<ChatProvider api={api}>{ui}</ChatProvider>);
}

describe("ChatPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for conversations list
    mockListConversations.mockResolvedValue({ data: [] });
  });

  describe("rendering", () => {
    it("renders header with title", () => {
      renderWithProvider(<ChatPanel />);

      expect(screen.getByText("Travel Assistant")).toBeInTheDocument();
    });

    it("renders chat input", () => {
      renderWithProvider(<ChatPanel />);

      expect(
        screen.getByRole("textbox", { name: /message input/i })
      ).toBeInTheDocument();
    });

    it("renders empty state when no messages", () => {
      renderWithProvider(<ChatPanel />);

      expect(screen.getByText("Start a conversation")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = renderWithProvider(
        <ChatPanel className="custom-panel-class" />
      );

      expect(container.firstChild).toHaveClass("custom-panel-class");
    });
  });

  describe("close button", () => {
    it("does not show close button by default", () => {
      renderWithProvider(<ChatPanel />);

      expect(
        screen.queryByRole("button", { name: /close chat/i })
      ).not.toBeInTheDocument();
    });

    it("shows close button when showCloseButton is true", () => {
      renderWithProvider(<ChatPanel showCloseButton onClose={() => {}} />);

      expect(
        screen.getByRole("button", { name: /close chat/i })
      ).toBeInTheDocument();
    });

    it("calls onClose when close button clicked", async () => {
      const onClose = jest.fn();
      const user = userEvent.setup();

      renderWithProvider(<ChatPanel showCloseButton onClose={onClose} />);

      await user.click(screen.getByRole("button", { name: /close chat/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it("does not show close button if onClose is not provided", () => {
      renderWithProvider(<ChatPanel showCloseButton />);

      expect(
        screen.queryByRole("button", { name: /close chat/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("clear button", () => {
    it("does not show clear button when no messages", () => {
      renderWithProvider(<ChatPanel />);

      expect(
        screen.queryByRole("button", { name: /clear chat/i })
      ).not.toBeInTheDocument();
    });

    it("shows clear button when there are messages", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Hello!" }])
      );

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hi{Enter}");

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /clear chat/i })
        ).toBeInTheDocument();
      });
    });

    it("clears messages when clear button clicked", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Hello!" }])
      );

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hi{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Hello!")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /clear chat/i }));

      expect(screen.getByText("Start a conversation")).toBeInTheDocument();
    });
  });

  describe("message flow", () => {
    it("displays sent message", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Hi there!" }])
      );

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello world{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Hello world")).toBeInTheDocument();
      });
    });

    it("displays assistant response", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([
          { type: "content", content: "How can I " },
          { type: "content", content: "help you?" },
        ])
      );

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(screen.getByText("How can I help you?")).toBeInTheDocument();
      });
    });

    it("displays tool calls", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([
          {
            type: "tool_call",
            tool_call: {
              id: "call-1",
              name: "list_trips",
              arguments: "{}",
            },
          },
          { type: "content", content: "Here are your trips." },
        ])
      );

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Show my trips{Enter}");

      await waitFor(() => {
        expect(screen.getByText("List Trips")).toBeInTheDocument();
        expect(screen.getByText("Here are your trips.")).toBeInTheDocument();
      });
    });
  });

  describe("loading state", () => {
    it("shows thinking indicator while loading", async () => {
      let resolveStream: () => void = () => {};
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await streamPromise;
              return { done: true, value: undefined };
            },
          }),
        },
      };
      mockFetch.mockResolvedValueOnce(mockStream);

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });

      // Start typing and sending
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Thinking")).toBeInTheDocument();
      });

      // Clean up
      if (resolveStream) resolveStream();
    });

    it("disables input while loading", async () => {
      let resolveStream: () => void = () => {};
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await streamPromise;
              return { done: true, value: undefined };
            },
          }),
        },
      };
      mockFetch.mockResolvedValueOnce(mockStream);

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(input).toBeDisabled();
      });

      // Clean up
      if (resolveStream) resolveStream();
    });
  });

  describe("error handling", () => {
    it("displays error message on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("shows retry button on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection failed"));

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /try again/i })
        ).toBeInTheDocument();
      });
    });

    it("retries on retry button click", async () => {
      mockFetch.mockRejectedValueOnce(new Error("First failure"));
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Success!" }])
      );

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /try again/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("thread history button", () => {
    it("renders thread history button", () => {
      renderWithProvider(<ChatPanel />);

      expect(
        screen.getByRole("button", { name: /chat history/i })
      ).toBeInTheDocument();
    });

    it("opens dropdown and shows conversations on click", async () => {
      mockListConversations.mockResolvedValue({
        data: [
          {
            id: "thread-1",
            title: "Paris Trip Planning",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
      });

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText("Paris Trip Planning")).toBeInTheDocument();
      });
    });

    it("shows 'Untitled conversation' for conversations without title", async () => {
      mockListConversations.mockResolvedValue({
        data: [
          {
            id: "thread-1",
            title: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
      });

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText("Untitled conversation")).toBeInTheDocument();
      });
    });

    it("shows empty state when no conversations", async () => {
      mockListConversations.mockResolvedValue({ data: [] });

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText("No conversations yet")).toBeInTheDocument();
      });
    });

    it("disables history button while loading", async () => {
      let resolveStream: () => void = () => {};
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await streamPromise;
              return { done: true, value: undefined };
            },
          }),
        },
      };
      mockFetch.mockResolvedValueOnce(mockStream);

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /chat history/i })
        ).toBeDisabled();
      });

      // Clean up
      resolveStream();
    });
  });

  describe("new thread button", () => {
    it("renders new thread button", () => {
      renderWithProvider(<ChatPanel />);

      expect(
        screen.getByRole("button", { name: /new thread/i })
      ).toBeInTheDocument();
    });

    it("clears messages and starts new thread when clicked", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Hello!" }])
      );

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      // Send a message first
      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hi{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Hello!")).toBeInTheDocument();
      });

      // Click new thread button
      await user.click(screen.getByRole("button", { name: /new thread/i }));

      // Messages should be cleared
      expect(screen.getByText("Start a conversation")).toBeInTheDocument();
    });

    it("disables new thread button while loading", async () => {
      let resolveStream: () => void = () => {};
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              await streamPromise;
              return { done: true, value: undefined };
            },
          }),
        },
      };
      mockFetch.mockResolvedValueOnce(mockStream);

      const user = userEvent.setup();
      renderWithProvider(<ChatPanel />);

      const input = screen.getByRole("textbox", { name: /message input/i });
      await user.type(input, "Hello{Enter}");

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /new thread/i })
        ).toBeDisabled();
      });

      // Clean up
      resolveStream();
    });
  });

  describe("without provider", () => {
    it("throws error when used outside ChatProvider", () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<ChatPanel />);
      }).toThrow("useChatContext must be used within a ChatProvider");

      consoleSpy.mockRestore();
    });
  });
});
