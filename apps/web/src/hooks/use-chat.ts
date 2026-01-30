"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ChatChunk,
  ChatMessage,
  ToolCall,
  ToolResult,
  UseChatOptions,
  UseChatReturn,
} from "../lib/chat-types";

const DEFAULT_API_ENDPOINT = "/api/chat";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

/**
 * Custom error class for authentication failures
 */
export class ChatAuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "ChatAuthError";
  }
}

/**
 * Format rate limit message for display
 */
function formatRateLimitMessage(attempt: number, maxAttempts: number, retryAfter: number): string {
  const seconds = Math.ceil(retryAfter);
  return `⏳ Rate limited by AI service. Retrying in ${seconds}s... (attempt ${attempt}/${maxAttempts})`;
}

/**
 * Get a cookie value by name
 */
function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function generateId(): string {
  // Use crypto.randomUUID() for better uniqueness guarantees.
  // While message IDs are only used for client-side display (React keys),
  // crypto provides better randomness than Math.random().
  return `msg_${crypto.randomUUID()}`;
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
 * Build request headers with optional CSRF token
 */
function buildRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }
  return headers;
}

/**
 * Context for chunk processing callbacks
 */
interface ChunkProcessingContext {
  assistantMessageId: string;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onThreadId?: (threadId: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

/**
 * Process a content chunk
 */
function handleContentChunk(
  chunk: ChatChunk,
  accumulatedContent: { value: string },
  ctx: ChunkProcessingContext
): void {
  if (chunk.type !== "content") return;
  accumulatedContent.value += chunk.content;
  ctx.setMessages((prev) =>
    prev.map((msg) =>
      msg.id === ctx.assistantMessageId
        ? { ...msg, content: accumulatedContent.value }
        : msg
    )
  );

  // Extract thread_id from first content chunk (backend includes it)
  if (chunk.thread_id) {
    ctx.onThreadId?.(chunk.thread_id);
  }
}

/**
 * Process a tool call chunk
 */
function handleToolCallChunk(chunk: ChatChunk, ctx: ChunkProcessingContext): void {
  if (chunk.type !== "tool_call") return;
  const tc = chunk.tool_call;

  const toolCall: ToolCall = {
    id: tc.id,
    name: tc.name,
    arguments: JSON.parse(tc.arguments),
  };
  ctx.onToolCall?.(toolCall);

  ctx.setMessages((prev) =>
    prev.map((msg) =>
      msg.id === ctx.assistantMessageId
        ? { ...msg, toolCalls: [...(msg.toolCalls ?? []), toolCall] }
        : msg
    )
  );
}

/**
 * Process a tool result chunk
 */
function handleToolResultChunk(chunk: ChatChunk, ctx: ChunkProcessingContext): void {
  if (chunk.type !== "tool_result") return;
  const tr = chunk.tool_result;

  const result: ToolResult = {
    toolCallId: tr.tool_call_id,
    name: tr.name,
    result: tr.result,
    isError: !tr.success,
  };
  ctx.onToolResult?.(result);

  const toolMessage: ChatMessage = {
    id: generateId(),
    role: "tool",
    content: "",
    createdAt: new Date(),
    toolResult: result,
  };
  ctx.setMessages((prev) => [...prev, toolMessage]);
}

/**
 * Process a rate limit chunk
 */
function handleRateLimitChunk(chunk: ChatChunk, ctx: ChunkProcessingContext): void {
  if (chunk.type !== "rate_limited") return;
  const rl = chunk.rate_limit;

  const rateLimitMsg = formatRateLimitMessage(rl.attempt, rl.max_attempts, rl.retry_after);
  ctx.setMessages((prev) =>
    prev.map((msg) =>
      msg.id === ctx.assistantMessageId
        ? { ...msg, content: rateLimitMsg }
        : msg
    )
  );
}

/**
 * Process a single SSE chunk
 */
function processChunk(
  chunk: ChatChunk,
  accumulatedContent: { value: string },
  ctx: ChunkProcessingContext
): void {
  switch (chunk.type) {
    case "content":
      handleContentChunk(chunk, accumulatedContent, ctx);
      break;
    case "tool_call":
      handleToolCallChunk(chunk, ctx);
      break;
    case "tool_result":
      handleToolResultChunk(chunk, ctx);
      break;
    case "rate_limited":
      handleRateLimitChunk(chunk, ctx);
      break;
    case "done":
      // Extract thread_id from done chunk (backend sends final thread_id here)
      if (chunk.thread_id) {
        ctx.onThreadId?.(chunk.thread_id);
      }
      break;
    case "error":
      throw new Error(chunk.error);
  }
}

/**
 * Process SSE stream lines
 */
function processStreamLines(
  lines: string[],
  accumulatedContent: { value: string },
  ctx: ChunkProcessingContext
): void {
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;

    const data = line.slice(6);
    const chunk = parseSSEData(data);
    if (chunk) {
      processChunk(chunk, accumulatedContent, ctx);
    }
  }
}

/**
 * Read and process the SSE stream
 */
async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ctx: ChunkProcessingContext
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  const accumulatedContent = { value: "" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    processStreamLines(lines, accumulatedContent, ctx);
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

  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Cancel any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Use existing threadId or let backend create a new conversation
      // Don't generate local threadId - let the backend be the source of truth
      const currentThreadId = threadId;

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
          headers: buildRequestHeaders(),
          credentials: "include",
          body: JSON.stringify({ message: content, thread_id: currentThreadId }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Session expired or not authenticated - redirect to home
            router.push("/");
            throw new ChatAuthError("Session expired. Please sign in again.");
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Request failed with status ${response.status}`);
        }

        if (!response.body) {
          throw new Error("Response body is empty");
        }

        const ctx: ChunkProcessingContext = {
          assistantMessageId,
          onToolCall,
          onToolResult,
          setMessages,
          // Update threadId from backend response (backend is source of truth for conversation ID)
          onThreadId: (serverThreadId: string) => {
            setThreadId(serverThreadId);
          },
        };

        await processStream(response.body.getReader(), ctx);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        const error = err instanceof Error ? err : new Error("Unknown error occurred");
        setError(error);
        onError?.(error);

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
    [api, threadId, onError, onToolCall, onToolResult, router]
  );

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setThreadId(null);
    lastUserMessageRef.current = null;
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current) return;

    // Remove the last user message and any following messages
    setMessages((prev) => {
      const lastUserIndex = [...prev].reverse().findIndex((msg) => msg.role === "user");
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
