import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "../../../hooks/use-chat";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it("generates threadId on first message", async () => {
      const mockStream = createMockSSEStream([
        { type: "content", content: "Hi" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      expect(result.current.threadId).toBeNull();

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      // Thread ID should be a valid UUID v4
      expect(result.current.threadId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
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
      const mockStream = createMockSSEStream([
        { type: "content", content: "Response" },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.threadId).not.toBeNull();

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

