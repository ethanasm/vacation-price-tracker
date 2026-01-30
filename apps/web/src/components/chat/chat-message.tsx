"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "../../lib/utils";
import type { ChatMessage as ChatMessageType } from "../../lib/chat-types";
import { ToolCallList } from "./tool-call-display";

interface ChatMessageProps {
  message: ChatMessageType;
  className?: string;
}

/**
 * Formats a date to a human-readable time string
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * ChatMessage renders a single message in the chat interface.
 * Supports user, assistant, and tool message types.
 */
export function ChatMessage({ message, className }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isTool = message.role === "tool";

  // Tool messages are rendered inline with tool call display
  if (isTool && message.toolResult) {
    return null; // Tool results are shown within the ToolCallList
  }

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser && "flex-row-reverse",
        className
      )}
      role="listitem"
      aria-label={`${message.role} message`}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col max-w-[80%] space-y-2",
          isUser && "items-end"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted dark:bg-white/10 rounded-tl-sm"
          )}
        >
          {message.content ? (
            isUser ? (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
            ) : (
              <div className="text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 max-w-none break-words">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )
          ) : isAssistant && !message.toolCalls?.length ? (
            <span className="text-sm text-muted-foreground italic">
              Thinking...
            </span>
          ) : null}
        </div>

        {/* Tool calls */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallList
            toolCalls={message.toolCalls}
            className="w-full"
          />
        )}

        {/* Timestamp */}
        <span
          className={cn(
            "text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity",
            isUser && "text-right"
          )}
        >
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

interface ChatMessageListProps {
  messages: ChatMessageType[];
  className?: string;
}

/**
 * ChatMessageList renders a list of chat messages.
 */
export function ChatMessageList({ messages, className }: ChatMessageListProps) {
  // Filter out tool messages as they're rendered inline with tool calls
  const visibleMessages = messages.filter((msg) => msg.role !== "tool");

  if (visibleMessages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-center p-8",
          className
        )}
      >
        <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-lg mb-2">Start a conversation</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ask me to help you track vacation prices, create trips, or manage your
          travel alerts.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} role="list" aria-label="Chat messages">
      {visibleMessages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  );
}
