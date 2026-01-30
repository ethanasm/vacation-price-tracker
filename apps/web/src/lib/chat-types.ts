/**
 * Chat types for the vacation price tracker chat interface.
 * These types align with the backend API and assistant-ui expectations.
 */

export type MessageRole = "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
}

export interface ChatThread {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SSE chunk types from the backend streaming endpoint
 */
export type ChatChunkType = "content" | "tool_call" | "tool_result" | "error";

export interface ContentChunk {
  type: "content";
  content: string;
}

export interface ToolCallChunk {
  type: "tool_call";
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResultChunk {
  type: "tool_result";
  name: string;
  result: unknown;
  isError?: boolean;
}

export interface ErrorChunk {
  type: "error";
  error: string;
}

export type ChatChunk = ContentChunk | ToolCallChunk | ToolResultChunk | ErrorChunk;

export interface SendMessageOptions {
  threadId?: string;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
}

export interface UseChatOptions {
  api?: string;
  threadId?: string;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  threadId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}
