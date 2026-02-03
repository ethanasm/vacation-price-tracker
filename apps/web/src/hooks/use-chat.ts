"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiChatMessageResponse,
  ChatChunk,
  ChatMessage,
  ConversationDetailResponse,
  ElicitationData,
  ToolCall,
  ToolResult,
  UseChatOptions,
  UseChatReturn,
} from "../lib/chat-types";
import { fetchWithAuth } from "../lib/api";

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
 * Transform API message response to frontend ChatMessage format.
 * Handles tool_calls array and tool_call_id fields.
 */
function transformApiMessage(apiMsg: ApiChatMessageResponse): ChatMessage {
  const message: ChatMessage = {
    id: apiMsg.id,
    role: apiMsg.role as "user" | "assistant" | "tool",
    content: apiMsg.content,
    createdAt: new Date(apiMsg.created_at),
  };

  // Transform tool_calls if present (assistant messages)
  // Backend stores tool_calls in Groq API format: { id, type, function: { name, arguments } }
  if (apiMsg.tool_calls && apiMsg.tool_calls.length > 0) {
    message.toolCalls = apiMsg.tool_calls.map((tc) => {
      // Handle Groq API format where tool info is nested under function
      const name = tc.function?.name ?? tc.name;
      const args = tc.function?.arguments ?? tc.arguments;
      return {
        id: tc.id,
        name: name ?? "",
        arguments: typeof args === "string" ? JSON.parse(args) : (args ?? {}),
      };
    });
  }

  // Transform tool result if this is a tool message
  if (apiMsg.role === "tool" && apiMsg.tool_call_id) {
    message.toolResult = {
      toolCallId: apiMsg.tool_call_id,
      name: apiMsg.name || "",
      result: apiMsg.content ? JSON.parse(apiMsg.content) : null,
      isError: false,
    };
  }

  return message;
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
  onElicitation?: (elicitation: ElicitationData) => void;
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
  console.log("[use-chat] tool_result received:", result.name, "calling onToolResult:", !!ctx.onToolResult);
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
 * Process an elicitation chunk (request for user input via form)
 */
function handleElicitationChunk(chunk: ChatChunk, ctx: ChunkProcessingContext): void {
  if (chunk.type !== "elicitation") return;
  ctx.onElicitation?.(chunk.elicitation);
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
    case "elicitation":
      handleElicitationChunk(chunk, ctx);
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
      console.log("[use-chat] SSE chunk received:", chunk.type, chunk);
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
    onElicitation,
  } = options;

  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);

  // Use refs for callbacks to avoid stale closures during streaming
  // The callbacks might change during a long-running stream, and we want
  // to always call the latest version when a tool result arrives
  const onToolCallRef = useRef(onToolCall);
  const onToolResultRef = useRef(onToolResult);
  const onErrorRef = useRef(onError);
  const onElicitationRef = useRef(onElicitation);

  // Keep refs in sync with props
  onToolCallRef.current = onToolCall;
  onToolResultRef.current = onToolResult;
  onErrorRef.current = onError;
  onElicitationRef.current = onElicitation;

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
          // Use refs to always get the latest callbacks, avoiding stale closures
          // during long-running streams where the parent component may re-render
          onToolCall: (tc) => onToolCallRef.current?.(tc),
          onToolResult: (tr) => onToolResultRef.current?.(tr),
          onElicitation: (el) => onElicitationRef.current?.(el),
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
        onErrorRef.current?.(error);

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
    [api, threadId, router]
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

  /**
   * Load a thread by fetching its messages from the API.
   * Transforms API ChatMessageResponse[] to frontend ChatMessage[] format.
   */
  const loadThread = useCallback(async (targetThreadId: string) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`/v1/chat/conversations/${targetThreadId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Conversation not found");
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to load conversation: ${response.status}`);
      }

      const data: ConversationDetailResponse = await response.json();

      // Transform API messages to frontend format
      const transformedMessages = data.data.messages.map(transformApiMessage);

      setMessages(transformedMessages);
      setThreadId(targetThreadId);
      lastUserMessageRef.current = null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load conversation");
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  /**
   * Switch to a different thread by loading it.
   * Updates currentThreadId and loads messages.
   */
  const switchThread = useCallback(async (targetThreadId: string) => {
    await loadThread(targetThreadId);
  }, [loadThread]);

  /**
   * Start a new thread by clearing messages and resetting threadId.
   */
  const startNewThread = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setThreadId(null);
    lastUserMessageRef.current = null;
  }, []);

  return {
    messages,
    isLoading,
    error,
    threadId,
    sendMessage,
    clearMessages,
    retryLastMessage,
    loadThread,
    switchThread,
    startNewThread,
  };
}
