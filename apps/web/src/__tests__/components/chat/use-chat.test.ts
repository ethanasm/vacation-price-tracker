import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat, ChatAuthError } from "../../../hooks/use-chat";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe("initialization", () => {
    it("initializes with empty messages", () => {
      const { result } = renderHook(() => useChat());

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.threadId).toBeNull();
    });

    it("uses provided threadId", () => {
      const { result } = renderHook(() =>
        useChat({ threadId: "test-thread-123" })
      );

      expect(result.current.threadId).toBe("test-thread-123");
    });

    it("uses default API endpoint", () => {
      renderHook(() => useChat());
      // Default endpoint is /api/chat, verified when sendMessage is called
    });

    it("uses custom API endpoint", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "Hello" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat({ api: "/custom/endpoint" }));

      await act(async () => {
        await result.current.sendMessage("Hi");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/custom/endpoint",
        expect.any(Object)
      );
    });
  });

  describe("sendMessage", () => {
    it("does not send empty messages", async () => {
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("");
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.messages).toEqual([]);
    });

    it("does not send whitespace-only messages", async () => {
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("   ");
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.messages).toEqual([]);
    });

    it("adds user message immediately", async () => {
      const mockStream = createMockSSEStream([]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.messages[0]).toMatchObject({
        role: "user",
        content: "Hello",
      });
    });

    it("sets isLoading during request", async () => {
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const mockStream = createMockSSEStream([], streamPromise);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      act(() => {
        // Don't await - we want to check loading state
        void result.current.sendMessage("Hello");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        if (resolveStream) resolveStream();
        await streamPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("receives threadId from server on first message", async () => {
      const serverThreadId = "550e8400-e29b-41d4-a716-446655440000";
      const mockStream = createMockSSEStream([
        { type: "content", content: "Hi", thread_id: serverThreadId },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      expect(result.current.threadId).toBeNull();

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      // Thread ID should come from server response
      expect(result.current.threadId).toBe(serverThreadId);
    });

    it("sends null thread_id on first message", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "Response" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Test message");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: "Test message",
          thread_id: null,
        }),
        signal: expect.any(AbortSignal),
      });
    });

    it("sends correct request body", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "Response" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() =>
        useChat({ threadId: "existing-thread" })
      );

      await act(async () => {
        await result.current.sendMessage("Test message");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: "Test message",
          thread_id: "existing-thread",
        }),
        signal: expect.any(AbortSignal),
      });
    });

    it("handles content chunks", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "Hello " },
        { type: "content", content: "world!" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hi");
      });

      // Find assistant message
      const assistantMessage = result.current.messages.find(
        (m) => m.role === "assistant"
      );
      expect(assistantMessage?.content).toBe("Hello world!");
    });

    it("handles tool_call chunks", async () => {
      const mockStream = createMockSSEStream([
        {
          type: "tool_call",
          tool_call: {
            id: "call_123",
            name: "list_trips",
            arguments: "{}",
          },
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onToolCall = jest.fn();
      const { result } = renderHook(() => useChat({ onToolCall }));

      await act(async () => {
        await result.current.sendMessage("List my trips");
      });

      expect(onToolCall).toHaveBeenCalledWith({
        id: "call_123",
        name: "list_trips",
        arguments: {},
      });

      const assistantMessage = result.current.messages.find(
        (m) => m.role === "assistant"
      );
      expect(assistantMessage?.toolCalls).toEqual([
        { id: "call_123", name: "list_trips", arguments: {} },
      ]);
    });

    it("handles tool_result chunks", async () => {
      const mockStream = createMockSSEStream([
        {
          type: "tool_call",
          tool_call: {
            id: "call_123",
            name: "list_trips",
            arguments: "{}",
          },
        },
        {
          type: "tool_result",
          tool_result: {
            tool_call_id: "call_123",
            name: "list_trips",
            result: { trips: [] },
            success: true,
          },
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onToolResult = jest.fn();
      const { result } = renderHook(() => useChat({ onToolResult }));

      await act(async () => {
        await result.current.sendMessage("List my trips");
      });

      expect(onToolResult).toHaveBeenCalledWith({
        toolCallId: "call_123",
        name: "list_trips",
        result: { trips: [] },
        isError: false,
      });

      const toolMessage = result.current.messages.find(
        (m) => m.role === "tool"
      );
      expect(toolMessage?.toolResult).toBeDefined();
    });

    it("handles rate_limited chunks by showing status message", async () => {
      const mockStream = createMockSSEStream([
        {
          type: "rate_limited",
          rate_limit: { attempt: 1, max_attempts: 4, retry_after: 60 },
        },
        { type: "content", content: "Finally worked!" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      // After rate limit, the final content should be shown
      const assistantMessage = result.current.messages.find(
        (m) => m.role === "assistant"
      );
      expect(assistantMessage?.content).toBe("Finally worked!");
    });

    it("handles error chunks", async () => {
      const mockStream = createMockSSEStream([
        { type: "error", error: "Server error" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onError = jest.fn();
      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.sendMessage("Test");
      });

      expect(result.current.error).toEqual(new Error("Server error"));
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("handles elicitation chunks", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "I need more info" },
        {
          type: "elicitation",
          elicitation: {
            tool_call_id: "call_elicit_123",
            tool_name: "create_trip",
            component: "create-trip-form",
            prefilled: { name: "Test Trip" },
            missing_fields: ["origin_airport"],
          },
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onElicitation = jest.fn();
      const { result } = renderHook(() => useChat({ onElicitation }));

      await act(async () => {
        await result.current.sendMessage("Create a trip");
      });

      expect(onElicitation).toHaveBeenCalledWith({
        tool_call_id: "call_elicit_123",
        tool_name: "create_trip",
        component: "create-trip-form",
        prefilled: { name: "Test Trip" },
        missing_fields: ["origin_airport"],
      });
    });

    it("handles done chunks with thread_id", async () => {
      const serverThreadId = "done-chunk-thread-id";
      const mockStream = createMockSSEStreamWithDoneThreadId(serverThreadId);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      // Thread ID should be set from the done chunk
      expect(result.current.threadId).toBe(serverThreadId);
    });

    it("handles HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: "Internal server error" }),
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.sendMessage("Test");
      });

      expect(result.current.error?.message).toBe("Internal server error");
      expect(onError).toHaveBeenCalled();
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const onError = jest.fn();
      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.sendMessage("Test");
      });

      expect(result.current.error?.message).toBe("Network error");
      expect(onError).toHaveBeenCalled();
    });

    it("handles 401 errors by redirecting to home page", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: "Unauthorized" }),
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.sendMessage("Test");
      });

      expect(mockPush).toHaveBeenCalledWith("/");
      expect(result.current.error).toBeInstanceOf(ChatAuthError);
      expect(result.current.error?.message).toBe("Session expired. Please sign in again.");
      expect(onError).toHaveBeenCalled();
    });

    it("throws ChatAuthError with correct name for 401 responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Test");
      });

      expect(result.current.error?.name).toBe("ChatAuthError");
    });

    it("handles empty response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Test");
      });

      expect(result.current.error?.message).toBe("Response body is empty");
    });

    it("aborts previous request on new message", async () => {
      const abortController1 = { abort: jest.fn(), signal: new AbortController().signal };
      const abortController2 = { abort: jest.fn(), signal: new AbortController().signal };

      let abortControllerIndex = 0;
      const mockAbortController = jest.fn().mockImplementation(() => {
        return abortControllerIndex++ === 0 ? abortController1 : abortController2;
      });
      global.AbortController = mockAbortController as unknown as typeof AbortController;

      const mockStream1 = createMockSSEStream([{ type: "content", content: "First" }]);
      const mockStream2 = createMockSSEStream([{ type: "content", content: "Second" }]);

      mockFetch.mockResolvedValueOnce(mockStream1);
      mockFetch.mockResolvedValueOnce(mockStream2);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        // Send two messages quickly
        void result.current.sendMessage("First");
        await result.current.sendMessage("Second");
      });

      expect(abortController1.abort).toHaveBeenCalled();
    });
  });

  describe("clearMessages", () => {
    it("clears all messages", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "Response" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.messages.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });

    it("clears error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Test error"));

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.error).toBeNull();
    });

    it("clears threadId", async () => {
      const serverThreadId = "550e8400-e29b-41d4-a716-446655440000";
      const mockStream = createMockSSEStream([
        { type: "content", content: "Response", thread_id: serverThreadId },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.threadId).toBe(serverThreadId);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.threadId).toBeNull();
    });
  });

  describe("retryLastMessage", () => {
    it("does nothing if no previous message", async () => {
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.retryLastMessage();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("retries the last user message", async () => {
      const mockStream1 = createMockSSEStream([
        { type: "error", error: "First error" },
      ]);
      const mockStream2 = createMockSSEStream([
        { type: "content", content: "Success" },
      ]);

      mockFetch.mockResolvedValueOnce(mockStream1);
      mockFetch.mockResolvedValueOnce(mockStream2);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Test message");
      });

      expect(result.current.error).not.toBeNull();

      await act(async () => {
        await result.current.retryLastMessage();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Both calls should have the same message
      const firstCall = JSON.parse(mockFetch.mock.calls[0][1].body);
      const secondCall = JSON.parse(mockFetch.mock.calls[1][1].body);

      expect(firstCall.message).toBe("Test message");
      expect(secondCall.message).toBe("Test message");
    });

    it("removes failed messages before retry", async () => {
      const mockStream1 = createMockSSEStream([
        { type: "content", content: "Partial" },
        { type: "error", error: "Error occurred" },
      ]);
      const mockStream2 = createMockSSEStream([
        { type: "content", content: "Complete" },
      ]);

      mockFetch.mockResolvedValueOnce(mockStream1);
      mockFetch.mockResolvedValueOnce(mockStream2);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Test");
      });

      const messageCountAfterError = result.current.messages.length;

      await act(async () => {
        await result.current.retryLastMessage();
      });

      // Should have same or fewer messages (removed old user/assistant, added new ones)
      expect(result.current.messages.length).toBeLessThanOrEqual(
        messageCountAfterError
      );
    });
  });
});

// Helper to create mock SSE stream
function createMockSSEStream(
  chunks: Array<{ type: string; [key: string]: unknown }>,
  waitPromise?: Promise<void>
) {
  const lines = chunks.map(
    (chunk) => `data: ${JSON.stringify(chunk)}\n\n`
  );
  lines.push("data: [DONE]\n\n");
  const text = lines.join("");

  let position = 0;

  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (waitPromise) {
            await waitPromise;
          }
          if (position >= text.length) {
            return { done: true, value: undefined };
          }
          // Return chunks of the text
          const chunk = text.slice(position, position + 50);
          position += 50;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      }),
    },
  };
}

// Helper to create mock SSE stream with invalid JSON
function createMockSSEStreamWithInvalidJSON() {
  const lines = [
    "data: {invalid json\n\n",
    "data: [DONE]\n\n",
  ];
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
          const chunk = text.slice(position, position + 50);
          position += 50;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      }),
    },
  };
}

function createMockSSEStreamWithDoneThreadId(threadId: string) {
  const lines = [
    `data: {"type":"content","content":"Hello"}\n\n`,
    `data: {"type":"done","thread_id":"${threadId}"}\n\n`,
    "data: [DONE]\n\n",
  ];
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

describe("useChat edge cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any cookies
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  it("includes CSRF token in headers when available", async () => {
    // Set a mock CSRF cookie
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "csrf_token=test-csrf-token-123",
    });

    const mockStream = createMockSSEStream([
      { type: "content", content: "Response" },
    ]);
    mockFetch.mockResolvedValueOnce(mockStream);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-CSRF-Token": "test-csrf-token-123",
        }),
      })
    );
  });

  it("handles invalid JSON in SSE stream gracefully", async () => {
    const mockStream = createMockSSEStreamWithInvalidJSON();
    mockFetch.mockResolvedValueOnce(mockStream);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    // Should not crash, assistant message should exist but be empty
    const assistantMessage = result.current.messages.find(
      (m) => m.role === "assistant"
    );
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage?.content).toBe("");
  });

  it("handles SSE lines that don't start with 'data: '", async () => {
    const text = "event: something\ndata: {\"type\":\"content\",\"content\":\"Hi\"}\n\ndata: [DONE]\n\n";
    let position = 0;

    const mockStream = {
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

    mockFetch.mockResolvedValueOnce(mockStream);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    // Should process the content chunk despite the event: line
    const assistantMessage = result.current.messages.find(
      (m) => m.role === "assistant"
    );
    expect(assistantMessage?.content).toBe("Hi");
  });
});

describe("useChat thread management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe("loadThread", () => {
    it("fetches and loads conversation history", async () => {
      const threadId = "test-thread-123";
      const mockConversation = {
        data: {
          conversation: {
            id: threadId,
            title: "Test Thread",
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Hello",
              tool_calls: null,
              tool_call_id: null,
              name: null,
              created_at: "2024-01-15T10:00:00Z",
            },
            {
              id: "msg-2",
              role: "assistant",
              content: "Hi there!",
              tool_calls: null,
              tool_call_id: null,
              name: null,
              created_at: "2024-01-15T10:00:01Z",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.loadThread(threadId);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/chat/conversations/${threadId}`),
        expect.any(Object)
      );

      expect(result.current.threadId).toBe(threadId);
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("Hello");
      expect(result.current.messages[1].role).toBe("assistant");
      expect(result.current.messages[1].content).toBe("Hi there!");
    });

    it("transforms tool_calls in messages", async () => {
      const threadId = "test-thread-456";
      const mockConversation = {
        data: {
          conversation: {
            id: threadId,
            title: null,
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          messages: [
            {
              id: "msg-1",
              role: "assistant",
              content: "",
              tool_calls: [
                { id: "call_1", name: "list_trips", arguments: "{}" },
              ],
              tool_call_id: null,
              name: null,
              created_at: "2024-01-15T10:00:00Z",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.loadThread(threadId);
      });

      expect(result.current.messages[0].toolCalls).toEqual([
        { id: "call_1", name: "list_trips", arguments: {} },
      ]);
    });

    it("transforms tool_calls in Groq API format (nested under function)", async () => {
      const threadId = "test-thread-groq";
      const mockConversation = {
        data: {
          conversation: {
            id: threadId,
            title: null,
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          messages: [
            {
              id: "msg-1",
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call_groq",
                  type: "function",
                  function: {
                    name: "create_trip",
                    arguments: '{"name":"Test Trip"}',
                  },
                },
              ],
              tool_call_id: null,
              name: null,
              created_at: "2024-01-15T10:00:00Z",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.loadThread(threadId);
      });

      expect(result.current.messages[0].toolCalls).toEqual([
        { id: "call_groq", name: "create_trip", arguments: { name: "Test Trip" } },
      ]);
    });

    it("handles tool_calls with pre-parsed object arguments", async () => {
      const threadId = "test-thread-parsed";
      const mockConversation = {
        data: {
          conversation: {
            id: threadId,
            title: null,
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          messages: [
            {
              id: "msg-1",
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call_parsed",
                  name: "get_trip",
                  arguments: { trip_id: "123" }, // Already an object, not a string
                },
              ],
              tool_call_id: null,
              name: null,
              created_at: "2024-01-15T10:00:00Z",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.loadThread(threadId);
      });

      expect(result.current.messages[0].toolCalls).toEqual([
        { id: "call_parsed", name: "get_trip", arguments: { trip_id: "123" } },
      ]);
    });

    it("handles tool_calls with missing name/arguments gracefully", async () => {
      const threadId = "test-thread-minimal";
      const mockConversation = {
        data: {
          conversation: {
            id: threadId,
            title: null,
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          messages: [
            {
              id: "msg-1",
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call_minimal",
                  // Missing name and arguments
                },
              ],
              tool_call_id: null,
              name: null,
              created_at: "2024-01-15T10:00:00Z",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.loadThread(threadId);
      });

      expect(result.current.messages[0].toolCalls).toEqual([
        { id: "call_minimal", name: "", arguments: {} },
      ]);
    });

    it("transforms tool result messages", async () => {
      const threadId = "test-thread-789";
      const mockConversation = {
        data: {
          conversation: {
            id: threadId,
            title: null,
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          messages: [
            {
              id: "msg-1",
              role: "tool",
              content: '{"trips":[]}',
              tool_calls: null,
              tool_call_id: "call_123",
              name: "list_trips",
              created_at: "2024-01-15T10:00:00Z",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.loadThread(threadId);
      });

      expect(result.current.messages[0].role).toBe("tool");
      expect(result.current.messages[0].toolResult).toEqual({
        toolCallId: "call_123",
        name: "list_trips",
        result: { trips: [] },
        isError: false,
      });
    });

    it("handles 404 error", async () => {
      const onError = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.loadThread("nonexistent-thread");
      });

      expect(result.current.error?.message).toBe("Conversation not found");
      expect(onError).toHaveBeenCalled();
    });

    it("handles network error", async () => {
      const onError = jest.fn();
      mockFetch.mockRejectedValueOnce(new Error("Unable to connect to server"));

      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.loadThread("test-thread");
      });

      expect(result.current.error?.message).toBe("Unable to connect to server");
      expect(onError).toHaveBeenCalled();
    });

    it("handles non-404 error with detail from response", async () => {
      const onError = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: "Database connection failed" }),
      });

      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.loadThread("test-thread");
      });

      expect(result.current.error?.message).toBe("Database connection failed");
      expect(onError).toHaveBeenCalled();
    });

    it("handles non-404 error without detail in response", async () => {
      const onError = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.loadThread("test-thread");
      });

      expect(result.current.error?.message).toBe("Failed to load conversation: 500");
      expect(onError).toHaveBeenCalled();
    });

    it("handles JSON parse error in non-404 response", async () => {
      const onError = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("JSON parse error")),
      });

      const { result } = renderHook(() => useChat({ onError }));

      await act(async () => {
        await result.current.loadThread("test-thread");
      });

      expect(result.current.error?.message).toBe("Failed to load conversation: 500");
      expect(onError).toHaveBeenCalled();
    });

    it("sets isLoading during fetch", async () => {
      let resolvePromise: () => void;
      const fetchPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockImplementationOnce(async () => {
        await fetchPromise;
        return {
          ok: true,
          json: () => Promise.resolve({
            data: {
              conversation: { id: "test", title: null, created_at: "", updated_at: "" },
              messages: [],
            },
          }),
        };
      });

      const { result } = renderHook(() => useChat());

      act(() => {
        void result.current.loadThread("test-thread");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolvePromise?.();
        await fetchPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("switchThread", () => {
    it("calls loadThread with the threadId", async () => {
      const threadId = "switch-thread-123";
      const mockConversation = {
        data: {
          conversation: {
            id: threadId,
            title: "Switched Thread",
            created_at: "2024-01-15T10:00:00Z",
            updated_at: "2024-01-15T11:00:00Z",
          },
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Switched message",
              tool_calls: null,
              tool_call_id: null,
              name: null,
              created_at: "2024-01-15T10:00:00Z",
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConversation),
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.switchThread(threadId);
      });

      expect(result.current.threadId).toBe(threadId);
      expect(result.current.messages[0].content).toBe("Switched message");
    });
  });

  describe("startNewThread", () => {
    it("clears messages and resets threadId", async () => {
      // First, send a message to establish state
      const serverThreadId = "existing-thread-123";
      const mockStream = createMockSSEStream([
        { type: "content", content: "Response", thread_id: serverThreadId },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.messages.length).toBeGreaterThan(0);
      expect(result.current.threadId).toBe(serverThreadId);

      // Now start a new thread
      act(() => {
        result.current.startNewThread();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.threadId).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("clears error state", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Test error"));

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.startNewThread();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("processElicitationResponse", () => {
    it("throws error if response body is empty", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = {
        ok: true,
        body: null,
      } as unknown as Response;

      await expect(
        act(async () => {
          await result.current.processElicitationResponse(mockResponse);
        })
      ).rejects.toThrow("Response body is empty");
    });

    it("processes tool_result chunks and extracts trip_id", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        {
          type: "tool_result",
          tool_result: {
            tool_call_id: "call_123",
            name: "create_trip",
            result: { trip_id: "trip-456", success: true },
            success: true,
          },
        },
        { type: "done", thread_id: "thread-789" },
      ]);

      let tripResult: { tripId: string | null } | undefined;
      await act(async () => {
        tripResult = await result.current.processElicitationResponse(mockResponse);
      });

      expect(tripResult?.tripId).toBe("trip-456");

      // Check that tool message was added
      const toolMessage = result.current.messages.find(m => m.role === "tool");
      expect(toolMessage).toBeDefined();
      expect(toolMessage?.toolResult?.name).toBe("create_trip");
    });

    it("processes content chunks and creates assistant message lazily", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        { type: "content", content: "Trip created " },
        { type: "content", content: "successfully!" },
        { type: "done", thread_id: "thread-789" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      // Assistant message should be created with accumulated content
      const assistantMessage = result.current.messages.find(m => m.role === "assistant");
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBe("Trip created successfully!");
    });

    it("processes tool_call chunks and adds to assistant message", async () => {
      const onToolCall = jest.fn();
      const { result } = renderHook(() => useChat({ onToolCall }));

      const mockResponse = createMockElicitationResponse([
        {
          type: "tool_call",
          tool_call: {
            id: "call_refresh",
            name: "trigger_refresh",
            arguments: '{"trip_id":"trip-456"}',
          },
        },
        { type: "done", thread_id: "thread-789" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      expect(onToolCall).toHaveBeenCalledWith({
        id: "call_refresh",
        name: "trigger_refresh",
        arguments: { trip_id: "trip-456" },
      });

      // Assistant message should have the tool call
      const assistantMessage = result.current.messages.find(m => m.role === "assistant");
      expect(assistantMessage?.toolCalls).toContainEqual({
        id: "call_refresh",
        name: "trigger_refresh",
        arguments: { trip_id: "trip-456" },
      });
    });

    it("calls onToolResult callback for tool results", async () => {
      const onToolResult = jest.fn();
      const { result } = renderHook(() => useChat({ onToolResult }));

      const mockResponse = createMockElicitationResponse([
        {
          type: "tool_result",
          tool_result: {
            tool_call_id: "call_123",
            name: "create_trip",
            result: { trip_id: "trip-456" },
            success: true,
          },
        },
        { type: "done" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      expect(onToolResult).toHaveBeenCalledWith({
        toolCallId: "call_123",
        name: "create_trip",
        result: { trip_id: "trip-456" },
        isError: false,
      });
    });

    it("sets threadId from done chunk", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        { type: "content", content: "Done" },
        { type: "done", thread_id: "new-thread-id" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      expect(result.current.threadId).toBe("new-thread-id");
    });

    it("sets threadId from content chunk", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        { type: "content", content: "Response", thread_id: "content-thread-id" },
        { type: "done" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      expect(result.current.threadId).toBe("content-thread-id");
    });

    it("throws error on error chunk", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        { type: "error", error: "Something went wrong" },
      ]);

      await expect(
        act(async () => {
          await result.current.processElicitationResponse(mockResponse);
        })
      ).rejects.toThrow("Something went wrong");
    });

    it("handles tool_result without trip_id", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        {
          type: "tool_result",
          tool_result: {
            tool_call_id: "call_123",
            name: "trigger_refresh",
            result: { status: "refreshed" },
            success: true,
          },
        },
        { type: "done" },
      ]);

      let tripResult: { tripId: string | null } | undefined;
      await act(async () => {
        tripResult = await result.current.processElicitationResponse(mockResponse);
      });

      // tripId should be null since it wasn't in the result
      expect(tripResult?.tripId).toBeNull();
    });

    it("handles failed tool results with isError flag", async () => {
      const onToolResult = jest.fn();
      const { result } = renderHook(() => useChat({ onToolResult }));

      const mockResponse = createMockElicitationResponse([
        {
          type: "tool_result",
          tool_result: {
            tool_call_id: "call_123",
            name: "create_trip",
            result: { error: "Failed to create trip" },
            success: false,
          },
        },
        { type: "done" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      expect(onToolResult).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: true,
        })
      );
    });

    it("removes tool call from previous assistant message during elicitation processing", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "I'll help you create a trip." },
        {
          type: "tool_call",
          tool_call: {
            id: "call_elicit",
            name: "create_trip",
            arguments: "{}",
          },
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      // First, send a message that results in an elicitation tool call
      await act(async () => {
        await result.current.sendMessage("Create a trip");
      });

      // Verify the assistant message has the tool call before processing elicitation
      const assistantBefore = result.current.messages.find(m => m.role === "assistant");
      expect(assistantBefore?.toolCalls).toHaveLength(1);
      expect(assistantBefore?.toolCalls?.[0].name).toBe("create_trip");

      // Now process the elicitation response
      const mockResponse = createMockElicitationResponse([
        {
          type: "tool_result",
          tool_result: {
            tool_call_id: "call_elicit",
            name: "create_trip",
            result: { trip_id: "trip-new" },
            success: true,
          },
        },
        { type: "content", content: "Trip created!" },
        { type: "done" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      // The original assistant message should have its tool call removed
      const assistantMessages = result.current.messages.filter(m => m.role === "assistant");
      const firstAssistant = assistantMessages[0];
      // Tool call should be removed (toolCalls becomes undefined when empty)
      expect(firstAssistant?.toolCalls).toBeUndefined();

      // A new assistant message with content should be created
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      expect(lastAssistant?.content).toBe("Trip created!");
    });

    it("skips invalid JSON in stream", async () => {
      const { result } = renderHook(() => useChat());

      // Create a response with invalid JSON that should be skipped
      const text = 'data: {invalid json}\n\ndata: {"type":"content","content":"Valid"}\n\ndata: {"type":"done"}\n\ndata: [DONE]\n\n';
      let position = 0;

      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (position >= text.length) {
                return { done: true, value: undefined };
              }
              const chunk = text.slice(position, position + 200);
              position += 200;
              return {
                done: false,
                value: new TextEncoder().encode(chunk),
              };
            },
          }),
        },
      } as unknown as Response;

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      // Should have processed the valid content chunk
      const assistantMessage = result.current.messages.find(m => m.role === "assistant");
      expect(assistantMessage?.content).toBe("Valid");
    });

    it("handles tool_call without prior assistant message", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        {
          type: "tool_call",
          tool_call: {
            id: "call_1",
            name: "refresh",
            arguments: "{}",
          },
        },
        { type: "done" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      // Should create assistant message for tool call
      const assistantMessage = result.current.messages.find(m => m.role === "assistant");
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.toolCalls).toHaveLength(1);
    });

    it("skips [DONE] SSE marker", async () => {
      const { result } = renderHook(() => useChat());

      const mockResponse = createMockElicitationResponse([
        { type: "content", content: "Test" },
        { type: "done" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      // Should complete without error
      const assistantMessage = result.current.messages.find(m => m.role === "assistant");
      expect(assistantMessage?.content).toBe("Test");
    });

    it("handles multiple tool calls in sequence", async () => {
      const onToolCall = jest.fn();
      const { result } = renderHook(() => useChat({ onToolCall }));

      const mockResponse = createMockElicitationResponse([
        { type: "content", content: "Processing..." },
        {
          type: "tool_call",
          tool_call: {
            id: "call_1",
            name: "create_trip",
            arguments: "{}",
          },
        },
        {
          type: "tool_call",
          tool_call: {
            id: "call_2",
            name: "trigger_refresh",
            arguments: '{"trip_id":"123"}',
          },
        },
        { type: "done" },
      ]);

      await act(async () => {
        await result.current.processElicitationResponse(mockResponse);
      });

      expect(onToolCall).toHaveBeenCalledTimes(2);

      const assistantMessage = result.current.messages.find(m => m.role === "assistant");
      expect(assistantMessage?.toolCalls).toHaveLength(2);
    });
  });
});

// Helper to create mock elicitation response stream
function createMockElicitationResponse(
  chunks: Array<{ type: string; [key: string]: unknown }>
): Response {
  const lines = chunks.map(
    (chunk) => `data: ${JSON.stringify(chunk)}\n\n`
  );
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
          const chunk = text.slice(position, position + 200);
          position += 200;
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        },
      }),
    },
  } as unknown as Response;
}

