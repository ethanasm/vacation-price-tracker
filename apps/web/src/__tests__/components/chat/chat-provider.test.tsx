import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatProvider, useChatContext } from "../../../lib/chat-provider";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Test component that uses the chat context
function TestConsumer() {
  const {
    messages,
    isLoading,
    error,
    threadId,
    pendingRefreshIds,
    addPendingRefresh,
    removePendingRefresh,
    pendingElicitation,
    setPendingElicitation,
    sendMessage,
    clearMessages,
    retryLastMessage,
  } = useChatContext();

  return (
    <div>
      <span data-testid="loading">{isLoading.toString()}</span>
      <span data-testid="error">{error?.message || "none"}</span>
      <span data-testid="threadId">{threadId || "none"}</span>
      <span data-testid="messageCount">{messages.length}</span>
      <span data-testid="pendingCount">{pendingRefreshIds.size}</span>
      <span data-testid="pendingIds">{Array.from(pendingRefreshIds).join(",") || "none"}</span>
      <ul data-testid="messages">
        {messages.map((msg) => (
          <li key={msg.id} data-testid={`message-${msg.role}`}>
            {msg.content}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => sendMessage("Hello")}
        data-testid="send"
      >
        Send
      </button>
      <button type="button" onClick={clearMessages} data-testid="clear">
        Clear
      </button>
      <button type="button" onClick={retryLastMessage} data-testid="retry">
        Retry
      </button>
      <button type="button" onClick={() => addPendingRefresh("test-id-1")} data-testid="addPending">
        Add Pending
      </button>
      <button type="button" onClick={() => removePendingRefresh("test-id-1")} data-testid="removePending">
        Remove Pending
      </button>
      <span data-testid="pendingElicitation">{pendingElicitation ? pendingElicitation.tool_call_id : "none"}</span>
      <button
        type="button"
        onClick={() => setPendingElicitation({
          tool_call_id: "test-elicitation",
          tool_name: "create_trip",
          component: "create-trip-form",
          prefilled: { name: "Test Trip" },
        })}
        data-testid="setElicitation"
      >
        Set Elicitation
      </button>
      <button type="button" onClick={() => setPendingElicitation(null)} data-testid="clearElicitation">
        Clear Elicitation
      </button>
    </div>
  );
}

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

describe("ChatProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("context provision", () => {
    it("provides chat context to children", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Hi there" }])
      );

      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );

      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("error")).toHaveTextContent("none");
      expect(screen.getByTestId("messageCount")).toHaveTextContent("0");
    });

    it("uses custom API endpoint", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Response" }])
      );

      const user = userEvent.setup();

      render(
        <ChatProvider api="/custom/chat">
          <TestConsumer />
        </ChatProvider>
      );

      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/custom/chat",
          expect.any(Object)
        );
      });
    });

    it("uses provided threadId", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Response" }])
      );

      render(
        <ChatProvider threadId="preset-thread-123">
          <TestConsumer />
        </ChatProvider>
      );

      expect(screen.getByTestId("threadId")).toHaveTextContent(
        "preset-thread-123"
      );
    });
  });

  describe("callback handling", () => {
    it("calls onError when error occurs", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const onError = jest.fn();
      const user = userEvent.setup();

      render(
        <ChatProvider onError={onError}>
          <TestConsumer />
        </ChatProvider>
      );

      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("calls onToolCall when tool is invoked", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([
          {
            type: "tool_call",
            tool_call: {
              id: "call_abc",
              name: "list_trips",
              arguments: "{}",
            },
          },
        ])
      );

      const onToolCall = jest.fn();
      const user = userEvent.setup();

      render(
        <ChatProvider onToolCall={onToolCall}>
          <TestConsumer />
        </ChatProvider>
      );

      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(onToolCall).toHaveBeenCalledWith({
          id: "call_abc",
          name: "list_trips",
          arguments: {},
        });
      });
    });

    it("calls onToolResult when tool completes", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([
          {
            type: "tool_call",
            tool_call: {
              id: "call_abc",
              name: "list_trips",
              arguments: "{}",
            },
          },
          {
            type: "tool_result",
            tool_result: {
              tool_call_id: "call_abc",
              name: "list_trips",
              result: { trips: [] },
              success: true,
            },
          },
        ])
      );

      const onToolResult = jest.fn();
      const user = userEvent.setup();

      render(
        <ChatProvider onToolResult={onToolResult}>
          <TestConsumer />
        </ChatProvider>
      );

      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(onToolResult).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "list_trips",
            result: { trips: [] },
          })
        );
      });
    });
  });

  describe("message flow", () => {
    it("adds user and assistant messages on send", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Hello back!" }])
      );

      const user = userEvent.setup();

      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );

      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(screen.getByTestId("messageCount")).toHaveTextContent("2");
      });

      expect(screen.getByTestId("message-user")).toHaveTextContent("Hello");
      expect(screen.getByTestId("message-assistant")).toHaveTextContent(
        "Hello back!"
      );
    });

    it("clears messages on clear", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSSEStream([{ type: "content", content: "Response" }])
      );

      const user = userEvent.setup();

      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );

      // Send a message first
      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(screen.getByTestId("messageCount")).toHaveTextContent("2");
      });

      // Clear messages
      await user.click(screen.getByTestId("clear"));

      expect(screen.getByTestId("messageCount")).toHaveTextContent("0");
    });

    it("updates loading state during request", async () => {
      let resolveStream: () => void;
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

      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );

      // Start request
      act(() => {
        void user.click(screen.getByTestId("send"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("true");
      });

      // Complete request
      await act(async () => {
        if (resolveStream) resolveStream();
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
      });
    });
  });

  describe("error handling", () => {
    it("displays error message on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection failed"));

      const user = userEvent.setup();

      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );

      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent(
          "Connection failed"
        );
      });
    });

    it("clears error on clear", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Failed"));

      const user = userEvent.setup();

      render(
        <ChatProvider>
          <TestConsumer />
        </ChatProvider>
      );

      await user.click(screen.getByTestId("send"));

      await waitFor(() => {
        expect(screen.getByTestId("error")).not.toHaveTextContent("none");
      });

      await user.click(screen.getByTestId("clear"));

      expect(screen.getByTestId("error")).toHaveTextContent("none");
    });
  });
});

describe("useChatContext", () => {
  it("throws error when used outside provider", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useChatContext must be used within a ChatProvider");

    consoleSpy.mockRestore();
  });
});

describe("pendingRefreshIds", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("provides empty pendingRefreshIds by default", () => {
    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.getByTestId("pendingCount")).toHaveTextContent("0");
    expect(screen.getByTestId("pendingIds")).toHaveTextContent("none");
  });

  it("uses controlled pendingRefreshIds when provided", () => {
    const controlledIds = new Set(["controlled-id-1", "controlled-id-2"]);

    render(
      <ChatProvider pendingRefreshIds={controlledIds}>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.getByTestId("pendingCount")).toHaveTextContent("2");
    expect(screen.getByTestId("pendingIds")).toHaveTextContent("controlled-id-1,controlled-id-2");
  });

  it("addPendingRefresh adds ID to internal state when uncontrolled", async () => {
    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.getByTestId("pendingCount")).toHaveTextContent("0");

    await user.click(screen.getByTestId("addPending"));

    expect(screen.getByTestId("pendingCount")).toHaveTextContent("1");
    expect(screen.getByTestId("pendingIds")).toHaveTextContent("test-id-1");
  });

  it("removePendingRefresh removes ID from internal state when uncontrolled", async () => {
    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    // Add first
    await user.click(screen.getByTestId("addPending"));
    expect(screen.getByTestId("pendingCount")).toHaveTextContent("1");

    // Then remove
    await user.click(screen.getByTestId("removePending"));
    expect(screen.getByTestId("pendingCount")).toHaveTextContent("0");
    expect(screen.getByTestId("pendingIds")).toHaveTextContent("none");
  });

  it("addPendingRefresh is a no-op when controlled", async () => {
    const controlledIds = new Set(["controlled-id"]);
    const user = userEvent.setup();

    render(
      <ChatProvider pendingRefreshIds={controlledIds}>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.getByTestId("pendingCount")).toHaveTextContent("1");

    // Try to add - should not change anything since it's controlled
    await user.click(screen.getByTestId("addPending"));

    // Still only 1 (the controlled one)
    expect(screen.getByTestId("pendingCount")).toHaveTextContent("1");
    expect(screen.getByTestId("pendingIds")).toHaveTextContent("controlled-id");
  });

  it("removePendingRefresh is a no-op when controlled", async () => {
    const controlledIds = new Set(["test-id-1"]);
    const user = userEvent.setup();

    render(
      <ChatProvider pendingRefreshIds={controlledIds}>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.getByTestId("pendingCount")).toHaveTextContent("1");

    // Try to remove - should not change anything since it's controlled
    await user.click(screen.getByTestId("removePending"));

    // Still 1 (the controlled one)
    expect(screen.getByTestId("pendingCount")).toHaveTextContent("1");
    expect(screen.getByTestId("pendingIds")).toHaveTextContent("test-id-1");
  });
});

describe("elicitation handling", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("provides null pendingElicitation by default", () => {
    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.getByTestId("pendingElicitation")).toHaveTextContent("none");
  });

  it("setPendingElicitation updates the pending elicitation state", async () => {
    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    expect(screen.getByTestId("pendingElicitation")).toHaveTextContent("none");

    await user.click(screen.getByTestId("setElicitation"));

    expect(screen.getByTestId("pendingElicitation")).toHaveTextContent("test-elicitation");
  });

  it("setPendingElicitation can clear the pending elicitation", async () => {
    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    // Set first
    await user.click(screen.getByTestId("setElicitation"));
    expect(screen.getByTestId("pendingElicitation")).toHaveTextContent("test-elicitation");

    // Then clear
    await user.click(screen.getByTestId("clearElicitation"));
    expect(screen.getByTestId("pendingElicitation")).toHaveTextContent("none");
  });

  it("calls onElicitation callback when elicitation chunk is received", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockSSEStream([
        {
          type: "elicitation",
          elicitation: {
            tool_call_id: "call-123",
            tool_name: "create_trip",
            component: "create-trip-form",
            prefilled: { destination_code: "SEA" },
            missing_fields: ["name"],
          },
        },
      ])
    );

    const onElicitation = jest.fn();
    const user = userEvent.setup();

    render(
      <ChatProvider onElicitation={onElicitation}>
        <TestConsumer />
      </ChatProvider>
    );

    await user.click(screen.getByTestId("send"));

    await waitFor(() => {
      expect(onElicitation).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_call_id: "call-123",
          tool_name: "create_trip",
          component: "create-trip-form",
        })
      );
    });

    // Also updates internal state
    expect(screen.getByTestId("pendingElicitation")).toHaveTextContent("call-123");
  });

  it("updates pendingElicitation state without onElicitation callback", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockSSEStream([
        {
          type: "elicitation",
          elicitation: {
            tool_call_id: "call-456",
            tool_name: "create_trip",
            component: "create-trip-form",
            prefilled: {},
          },
        },
      ])
    );

    const user = userEvent.setup();

    render(
      <ChatProvider>
        <TestConsumer />
      </ChatProvider>
    );

    await user.click(screen.getByTestId("send"));

    await waitFor(() => {
      expect(screen.getByTestId("pendingElicitation")).toHaveTextContent("call-456");
    });
  });
});
