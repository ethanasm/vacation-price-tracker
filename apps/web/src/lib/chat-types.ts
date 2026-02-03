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
export type ChatChunkType = "content" | "tool_call" | "tool_result" | "rate_limited" | "error" | "done" | "elicitation";

export interface ContentChunk {
  type: "content";
  content: string;
  thread_id?: string;
}

export interface ToolCallData {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResultData {
  tool_call_id: string;
  name: string;
  result: unknown;
  success: boolean;
}

export interface ToolCallChunk {
  type: "tool_call";
  tool_call: ToolCallData;
}

export interface ToolResultChunk {
  type: "tool_result";
  tool_result: ToolResultData;
}

export interface ErrorChunk {
  type: "error";
  error: string;
}

export interface RateLimitData {
  attempt: number;
  max_attempts: number;
  retry_after: number;
}

export interface RateLimitChunk {
  type: "rate_limited";
  rate_limit: RateLimitData;
}

export interface DoneChunk {
  type: "done";
  thread_id?: string;
}

/**
 * Elicitation data for requesting user input via forms.
 * The backend sends this when a tool requires additional user input
 * before it can complete execution.
 */
export interface ElicitationData {
  /** ID of the tool call that needs elicitation */
  tool_call_id: string;
  /** Name of the tool being called */
  tool_name: string;
  /** Component to render (e.g., "create-trip-form") */
  component: string;
  /** Values already captured from the conversation */
  prefilled: Record<string, unknown>;
  /** Fields that are missing and need to be filled */
  missing_fields?: string[];
}

export interface ElicitationChunk {
  type: "elicitation";
  elicitation: ElicitationData;
}

export type ChatChunk = ContentChunk | ToolCallChunk | ToolResultChunk | RateLimitChunk | ErrorChunk | DoneChunk | ElicitationChunk;

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
  /** Called when a tool needs additional user input via a form */
  onElicitation?: (elicitation: ElicitationData) => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  threadId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  loadThread: (threadId: string) => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  startNewThread: () => void;
}

/**
 * Conversation summary for list responses.
 * Matches backend ConversationResponse schema.
 */
export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * API message response format from backend.
 * Used when loading conversation history.
 * Tool calls are stored in Groq API format with nested function object.
 */
export interface ApiChatMessageResponse {
  id: string;
  role: string;
  content: string;
  tool_calls: Array<{
    id: string;
    type?: string;
    function?: {
      name: string;
      arguments: string;
    };
    // Fallback for legacy format
    name?: string;
    arguments?: string;
  }> | null;
  tool_call_id: string | null;
  name: string | null;
  created_at: string;
}

/**
 * Response format for listing conversations.
 */
export interface ConversationListResponse {
  data: ConversationSummary[];
}

/**
 * Response format for getting a single conversation with messages.
 */
export interface ConversationDetailResponse {
  data: {
    conversation: ConversationSummary;
    messages: ApiChatMessageResponse[];
  };
}
