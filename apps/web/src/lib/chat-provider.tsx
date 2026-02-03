"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useChat } from "../hooks/use-chat";
import type {
  ChatMessage,
  ElicitationData,
  ToolCall,
  ToolResult,
  UseChatOptions,
} from "./chat-types";

interface ChatContextValue {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  threadId: string | null;
  /** Tool call IDs that are waiting for async updates (e.g., price refresh via SSE) */
  pendingRefreshIds: Set<string>;
  /** Add a tool call ID to pending refresh set */
  addPendingRefresh: (toolCallId: string) => void;
  /** Remove a tool call ID from pending refresh set */
  removePendingRefresh: (toolCallId: string) => void;
  /** Pending elicitation request (form input needed from user) */
  pendingElicitation: ElicitationData | null;
  /** Set the pending elicitation (or null to clear) */
  setPendingElicitation: (elicitation: ElicitationData | null) => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  startNewThread: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export interface ChatProviderProps {
  children: ReactNode;
  api?: string;
  threadId?: string;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  /** Called when a tool needs additional user input via a form */
  onElicitation?: (elicitation: ElicitationData) => void;
  /** Tool call IDs that are waiting for async updates (e.g., price refresh via SSE) - controlled by parent */
  pendingRefreshIds?: Set<string>;
}

/**
 * ChatProvider wraps the useChat hook and provides chat state
 * to all child components via React context.
 */
export function ChatProvider({
  children,
  api = "/api/chat",
  threadId: initialThreadId,
  onError,
  onToolCall,
  onToolResult,
  onElicitation,
  pendingRefreshIds: controlledPendingIds,
}: ChatProviderProps) {
  // Track tool call IDs that are waiting for async updates (e.g., price refresh via SSE)
  // Use controlled prop if provided, otherwise use internal state
  const [internalPendingIds, setInternalPendingIds] = useState<Set<string>>(new Set());
  const pendingRefreshIds = controlledPendingIds ?? internalPendingIds;

  // Track pending elicitation (form input needed from user)
  const [pendingElicitation, setPendingElicitation] = useState<ElicitationData | null>(null);

  const addPendingRefresh = useCallback((toolCallId: string) => {
    if (!controlledPendingIds) {
      setInternalPendingIds((prev) => new Set(prev).add(toolCallId));
    }
  }, [controlledPendingIds]);

  const removePendingRefresh = useCallback((toolCallId: string) => {
    if (!controlledPendingIds) {
      setInternalPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(toolCallId);
        return next;
      });
    }
  }, [controlledPendingIds]);

  // Handle elicitation requests: set internal state and call external callback
  const handleElicitation = useCallback((elicitation: ElicitationData) => {
    setPendingElicitation(elicitation);
    onElicitation?.(elicitation);
  }, [onElicitation]);

  const options: UseChatOptions = useMemo(
    () => ({
      api,
      threadId: initialThreadId,
      onError,
      onToolCall,
      onToolResult,
      onElicitation: handleElicitation,
    }),
    [api, initialThreadId, onError, onToolCall, onToolResult, handleElicitation]
  );

  const chat = useChat(options);

  const value: ChatContextValue = useMemo(
    () => ({
      messages: chat.messages,
      isLoading: chat.isLoading,
      error: chat.error,
      threadId: chat.threadId,
      pendingRefreshIds,
      addPendingRefresh,
      removePendingRefresh,
      pendingElicitation,
      setPendingElicitation,
      sendMessage: chat.sendMessage,
      clearMessages: chat.clearMessages,
      retryLastMessage: chat.retryLastMessage,
      switchThread: chat.switchThread,
      startNewThread: chat.startNewThread,
    }),
    [
      chat.messages,
      chat.isLoading,
      chat.error,
      chat.threadId,
      pendingRefreshIds,
      addPendingRefresh,
      removePendingRefresh,
      pendingElicitation,
      chat.sendMessage,
      chat.clearMessages,
      chat.retryLastMessage,
      chat.switchThread,
      chat.startNewThread,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/**
 * Hook to access chat context. Must be used within a ChatProvider.
 */
export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);

  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }

  return context;
}
