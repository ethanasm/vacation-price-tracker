"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ChatChunk,
  ChatMessage,
  ToolCall,
  ToolResult,
  UseChatOptions,
  UseChatReturn,
} from "../lib/chat-types";

const DEFAULT_API_ENDPOINT = "/api/chat";

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse SSE data from the streaming response
 */
function parseSSEData(data: string): ChatChunk | null {
  if (data === "[DONE]") {
    return null;
  }
  try {
    return JSON.parse(data) as ChatChunk;
  } catch {
    return null;
  }
}

/**
 * Custom hook for managing chat state and API communication.
 * Wraps the streaming chat API and provides a simple interface for
 * sending messages and receiving responses.
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    api = DEFAULT_API_ENDPOINT,
    threadId: initialThreadId,
    onError,
    onToolCall,
    onToolResult,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        return;
      }

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const currentThreadId = threadId ?? generateThreadId();
      if (!threadId) {
        setThreadId(currentThreadId);
      }

      lastUserMessageRef.current = content;
      setError(null);
      setIsLoading(true);

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Create placeholder for assistant response
      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: content,
            thread_id: currentThreadId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || `Request failed with status ${response.status}`
          );
        }

        if (!response.body) {
          throw new Error("Response body is empty");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedContent = "";
        const pendingToolCalls: ToolCall[] = [];
        const toolResults: ToolResult[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              const chunk = parseSSEData(data);

              if (!chunk) continue;

              switch (chunk.type) {
                case "content":
                  accumulatedContent += chunk.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                  break;

                case "tool_call": {
                  const toolCall: ToolCall = {
                    id: chunk.id,
                    name: chunk.name,
                    arguments: JSON.parse(chunk.arguments),
                  };
                  pendingToolCalls.push(toolCall);
                  onToolCall?.(toolCall);

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, toolCalls: [...(msg.toolCalls ?? []), toolCall] }
                        : msg
                    )
                  );
                  break;
                }

                case "tool_result": {
                  const result: ToolResult = {
                    toolCallId: pendingToolCalls[toolResults.length]?.id ?? "",
                    name: chunk.name,
                    result: chunk.result,
                    isError: chunk.isError,
                  };
                  toolResults.push(result);
                  onToolResult?.(result);

                  // Add tool result as separate message
                  const toolMessage: ChatMessage = {
                    id: generateId(),
                    role: "tool",
                    content: "",
                    createdAt: new Date(),
                    toolResult: result,
                  };
                  setMessages((prev) => [...prev, toolMessage]);
                  break;
                }

                case "error":
                  throw new Error(chunk.error);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled, don't update state
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error occurred");
        setError(error);
        onError?.(error);

        // Update assistant message to show error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${error.message}` }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [api, threadId, onError, onToolCall, onToolResult]
  );

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setThreadId(null);
    lastUserMessageRef.current = null;
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current) {
      return;
    }

    // Remove the last user message and any following messages
    setMessages((prev) => {
      const lastUserIndex = [...prev]
        .reverse()
        .findIndex((msg) => msg.role === "user");
      if (lastUserIndex === -1) return prev;
      const actualIndex = prev.length - 1 - lastUserIndex;
      return prev.slice(0, actualIndex);
    });

    await sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  return {
    messages,
    isLoading,
    error,
    threadId,
    sendMessage,
    clearMessages,
    retryLastMessage,
  };
}
