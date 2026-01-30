"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useChat } from "../hooks/use-chat";
import type {
  ChatMessage,
  ToolCall,
  ToolResult,
  UseChatOptions,
} from "./chat-types";

interface ChatContextValue {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  threadId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export interface ChatProviderProps {
  children: ReactNode;
  api?: string;
  threadId?: string;
  onError?: (error: Error) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
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
}: ChatProviderProps) {
  const options: UseChatOptions = useMemo(
    () => ({
      api,
      threadId: initialThreadId,
      onError,
      onToolCall,
      onToolResult,
    }),
    [api, initialThreadId, onError, onToolCall, onToolResult]
  );

  const chat = useChat(options);

  const value: ChatContextValue = useMemo(
    () => ({
      messages: chat.messages,
      isLoading: chat.isLoading,
      error: chat.error,
      threadId: chat.threadId,
      sendMessage: chat.sendMessage,
      clearMessages: chat.clearMessages,
      retryLastMessage: chat.retryLastMessage,
    }),
    [
      chat.messages,
      chat.isLoading,
      chat.error,
      chat.threadId,
      chat.sendMessage,
      chat.clearMessages,
      chat.retryLastMessage,
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
