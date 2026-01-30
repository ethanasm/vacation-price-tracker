"use client";

import { useRef, useCallback, useLayoutEffect } from "react";
import { RefreshCw, X, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useChatContext } from "../../lib/chat-provider";
import { ChatMessageList } from "./chat-message";
import { ChatInput } from "./chat-input";

interface ChatPanelProps {
  className?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

/**
 * ChatPanel is the main chat interface component.
 * It displays the message list, input field, and handles auto-scrolling.
 */
export function ChatPanel({
  className,
  onClose,
  showCloseButton = false,
}: ChatPanelProps) {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  } = useChatContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to bottom when message count changes
  useLayoutEffect(() => {
    const currentCount = messages.length;
    if (currentCount !== prevMessageCountRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      prevMessageCountRef.current = currentCount;
    }
  });

  const handleSend = useCallback(
    async (content: string) => {
      await sendMessage(content);
    },
    [sendMessage]
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background dark:bg-[rgb(18,18,28)]",
        "border-l border-border/60 dark:border-white/10",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 dark:border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Travel Assistant</h2>
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Thinking
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearMessages}
              aria-label="Clear chat"
              title="Clear chat"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {showCloseButton && onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close chat"
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <ChatMessageList messages={messages} />

        {/* Error state */}
        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Something went wrong</p>
              <p className="text-xs mt-1 opacity-80">{error.message}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={retryLastMessage}
                className="mt-2 h-7 px-2 text-destructive hover:text-destructive"
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        placeholder="Ask me to track a trip..."
      />
    </div>
  );
}

/**
 * Standalone chat panel that includes its own provider.
 * Use this when you need a self-contained chat component.
 */
export { ChatProvider } from "../../lib/chat-provider";
