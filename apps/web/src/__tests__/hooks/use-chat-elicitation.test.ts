import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "../../hooks/use-chat";
import type { ElicitationData } from "../../lib/chat-types";

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

/**
 * Helper to create mock SSE stream with elicitation chunks
 */
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

describe("useChat elicitation handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe("elicitation chunk processing", () => {
    it("calls onElicitation when elicitation chunk is received", async () => {
      const elicitationData: ElicitationData = {
        tool_call_id: "call_abc123",
        tool_name: "create_trip",
        component: "create-trip-form",
        prefilled: {
          destination_code: "SEA",
        },
        missing_fields: ["name", "origin_airport", "depart_date", "return_date"],
      };

      const mockStream = createMockSSEStream([
        {
          type: "tool_call",
          tool_call: {
            id: "call_abc123",
            name: "create_trip",
            arguments: '{"destination_code":"SEA"}',
          },
        },
        {
          type: "elicitation",
          elicitation: elicitationData,
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onElicitation = jest.fn();
      const { result } = renderHook(() => useChat({ onElicitation }));

      await act(async () => {
        await result.current.sendMessage("Create a trip to Seattle");
      });

      expect(onElicitation).toHaveBeenCalledTimes(1);
      expect(onElicitation).toHaveBeenCalledWith(elicitationData);
    });

    it("passes prefilled data from conversation context", async () => {
      const elicitationData: ElicitationData = {
        tool_call_id: "call_xyz789",
        tool_name: "create_trip",
        component: "create-trip-form",
        prefilled: {
          name: "Seattle Adventure",
          destination_code: "SEA",
          adults: 2,
        },
        missing_fields: ["origin_airport", "depart_date", "return_date"],
      };

      const mockStream = createMockSSEStream([
        {
          type: "elicitation",
          elicitation: elicitationData,
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onElicitation = jest.fn();
      const { result } = renderHook(() => useChat({ onElicitation }));

      await act(async () => {
        await result.current.sendMessage("Create a trip to Seattle for 2 adults");
      });

      expect(onElicitation).toHaveBeenCalledWith(
        expect.objectContaining({
          prefilled: expect.objectContaining({
            name: "Seattle Adventure",
            destination_code: "SEA",
            adults: 2,
          }),
        })
      );
    });

    it("handles elicitation chunk without missing_fields", async () => {
      const elicitationData: ElicitationData = {
        tool_call_id: "call_no_missing",
        tool_name: "create_trip",
        component: "create-trip-form",
        prefilled: { destination_code: "LAX" },
      };

      const mockStream = createMockSSEStream([
        {
          type: "elicitation",
          elicitation: elicitationData,
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onElicitation = jest.fn();
      const { result } = renderHook(() => useChat({ onElicitation }));

      await act(async () => {
        await result.current.sendMessage("Create a trip");
      });

      expect(onElicitation).toHaveBeenCalledWith(elicitationData);
    });

    it("does not call onElicitation if not provided", async () => {
      const mockStream = createMockSSEStream([
        {
          type: "elicitation",
          elicitation: {
            tool_call_id: "call_test",
            tool_name: "create_trip",
            component: "create-trip-form",
            prefilled: {},
          },
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      // No onElicitation callback provided
      const { result } = renderHook(() => useChat());

      // Should not throw
      await act(async () => {
        await result.current.sendMessage("Test");
      });

      // Test passes if no error is thrown
      expect(result.current.error).toBeNull();
    });

    it("handles elicitation chunk followed by content chunks", async () => {
      const mockStream = createMockSSEStream([
        {
          type: "elicitation",
          elicitation: {
            tool_call_id: "call_mixed",
            tool_name: "create_trip",
            component: "create-trip-form",
            prefilled: {},
          },
        },
        {
          type: "content",
          content: "I'll need some more details to create your trip.",
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onElicitation = jest.fn();
      const { result } = renderHook(() => useChat({ onElicitation }));

      await act(async () => {
        await result.current.sendMessage("Create a trip");
      });

      expect(onElicitation).toHaveBeenCalledTimes(1);

      // Assistant message should contain the content
      const assistantMessage = result.current.messages.find(
        (m) => m.role === "assistant"
      );
      expect(assistantMessage?.content).toBe(
        "I'll need some more details to create your trip."
      );
    });

    it("handles multiple elicitation chunks in sequence", async () => {
      const elicitation1: ElicitationData = {
        tool_call_id: "call_1",
        tool_name: "create_trip",
        component: "create-trip-form",
        prefilled: { destination_code: "SEA" },
      };

      const elicitation2: ElicitationData = {
        tool_call_id: "call_2",
        tool_name: "create_trip",
        component: "create-trip-form",
        prefilled: { destination_code: "NYC" },
      };

      const mockStream = createMockSSEStream([
        { type: "elicitation", elicitation: elicitation1 },
        { type: "elicitation", elicitation: elicitation2 },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onElicitation = jest.fn();
      const { result } = renderHook(() => useChat({ onElicitation }));

      await act(async () => {
        await result.current.sendMessage("Create trips to Seattle and NYC");
      });

      expect(onElicitation).toHaveBeenCalledTimes(2);
      expect(onElicitation).toHaveBeenNthCalledWith(1, elicitation1);
      expect(onElicitation).toHaveBeenNthCalledWith(2, elicitation2);
    });
  });

  describe("elicitation callback ref behavior", () => {
    it("uses the latest onElicitation callback during long streams", async () => {
      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const elicitationData: ElicitationData = {
        tool_call_id: "call_late",
        tool_name: "create_trip",
        component: "create-trip-form",
        prefilled: { destination_code: "SFO" },
      };

      // Create a stream that waits before returning the elicitation chunk
      let position = 0;
      const chunks = [
        { type: "content", content: "Let me help you create a trip." },
        { type: "elicitation", elicitation: elicitationData },
      ];
      const lines = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`);
      lines.push("data: [DONE]\n\n");
      const text = lines.join("");

      const mockStream = {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              // Wait before returning the second chunk (elicitation)
              if (position > 0 && position < text.length) {
                await streamPromise;
              }
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
      mockFetch.mockResolvedValueOnce(mockStream);

      const onElicitation1 = jest.fn();
      const onElicitation2 = jest.fn();

      const { result, rerender } = renderHook(
        ({ onElicitation }) => useChat({ onElicitation }),
        { initialProps: { onElicitation: onElicitation1 } }
      );

      // Start the message
      act(() => {
        void result.current.sendMessage("Create a trip to SFO");
      });

      // Wait for loading to start
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Change the callback mid-stream
      rerender({ onElicitation: onElicitation2 });

      // Allow the stream to complete
      await act(async () => {
        resolveStream?.();
      });

      // Wait for loading to finish
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The latest callback (onElicitation2) should have been called, not the original
      expect(onElicitation1).not.toHaveBeenCalled();
      expect(onElicitation2).toHaveBeenCalledWith(elicitationData);
    });
  });

  describe("elicitation with tool calls", () => {
    it("handles tool call followed by elicitation", async () => {
      const mockStream = createMockSSEStream([
        {
          type: "tool_call",
          tool_call: {
            id: "call_combo",
            name: "create_trip",
            arguments: '{"destination_code":"BOS"}',
          },
        },
        {
          type: "elicitation",
          elicitation: {
            tool_call_id: "call_combo",
            tool_name: "create_trip",
            component: "create-trip-form",
            prefilled: { destination_code: "BOS" },
          },
        },
      ]);
      mockFetch.mockResolvedValueOnce(mockStream);

      const onToolCall = jest.fn();
      const onElicitation = jest.fn();
      const { result } = renderHook(() =>
        useChat({ onToolCall, onElicitation })
      );

      await act(async () => {
        await result.current.sendMessage("Create a Boston trip");
      });

      expect(onToolCall).toHaveBeenCalledWith({
        id: "call_combo",
        name: "create_trip",
        arguments: { destination_code: "BOS" },
      });

      expect(onElicitation).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_call_id: "call_combo",
          tool_name: "create_trip",
        })
      );
    });
  });
});
