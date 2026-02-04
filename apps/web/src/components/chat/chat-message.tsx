"use client";

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "../../lib/utils";
import type { ChatMessage as ChatMessageType, ToolResult } from "../../lib/chat-types";
import { ToolCallList } from "./tool-call-display";

interface ChatMessageProps {
  message: ChatMessageType;
  /** Tool results to display with this message's tool calls */
  toolResults?: ChatMessageType["toolResult"][];
  /** Tool call IDs that are waiting for async updates (e.g., price refresh) */
  pendingUpdateIds?: Set<string>;
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
export function ChatMessage({ message, toolResults = [], pendingUpdateIds, className }: ChatMessageProps) {
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
        {/* Only render the bubble if there's content OR if we're showing "Thinking..." */}
        {(message.content || (isAssistant && !message.toolCalls?.length)) && (
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
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Thinking...
              </span>
            )}
          </div>
        )}

        {/* Tool calls */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallList
            toolCalls={message.toolCalls}
            results={toolResults.filter((r): r is NonNullable<typeof r> => r !== undefined)}
            pendingUpdateIds={pendingUpdateIds}
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
  /** Tool call IDs that are waiting for async updates (e.g., price refresh) */
  pendingUpdateIds?: Set<string>;
  className?: string;
}

/**
 * ChatMessageList renders a list of chat messages.
 */
export function ChatMessageList({ messages, pendingUpdateIds, className }: ChatMessageListProps) {
  // Filter out tool messages as they're rendered inline with tool calls
  // Also filter out empty assistant messages that are NOT the last message
  // (the last empty assistant message shows "Thinking..." while waiting for response)
  // Empty assistant messages earlier in the list occur when elicitation is triggered -
  // the placeholder message never gets content because the response goes to elicitation
  const visibleMessages = messages.filter((msg, index) => {
    if (msg.role === "tool") return false;
    // Keep empty assistant messages only if they're the last message (still loading)
    if (msg.role === "assistant" && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)) {
      const isLastMessage = index === messages.length - 1;
      return isLastMessage;
    }
    return true;
  });

  // Collect all tool results from tool messages
  const toolResultsByCallId = new Map<string, ChatMessageType["toolResult"]>();
  for (const msg of messages) {
    if (msg.role === "tool" && msg.toolResult) {
      toolResultsByCallId.set(msg.toolResult.toolCallId, msg.toolResult);
    }
  }

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
      {visibleMessages.map((message) => {
        // Get tool results for this message's tool calls
        const messageToolResults = message.toolCalls
          ?.map((tc) => toolResultsByCallId.get(tc.id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined) ?? [];

        return (
          <ChatMessage
            key={message.id}
            message={message}
            toolResults={messageToolResults}
            pendingUpdateIds={pendingUpdateIds}
          />
        );
      })}
    </div>
  );
}
