"use client";

import { useState, useCallback, useEffect } from "react";
import { History, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { api, type ConversationSummary } from "../../lib/api";

interface ThreadHistoryDropdownProps {
  onSelectThread: (threadId: string) => void;
  disabled?: boolean;
}

/**
 * ThreadHistoryDropdown displays a list of past conversations
 * that the user can select to load into the chat panel.
 */
export function ThreadHistoryDropdown({
  onSelectThread,
  disabled = false,
}: ThreadHistoryDropdownProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.chat.listConversations(20);
      setConversations(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch conversations when dropdown opens
  useEffect(() => {
    if (isOpen) {
      void fetchConversations();
    }
  }, [isOpen, fetchConversations]);

  const handleSelect = useCallback(
    (threadId: string) => {
      onSelectThread(threadId);
      setIsOpen(false);
    },
    [onSelectThread]
  );

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label="Chat history"
          title="Chat history"
        >
          <History className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Recent Conversations</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="px-2 py-3 text-sm text-destructive">{error}</div>
        ) : conversations.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {conversations.map((conversation) => (
              <DropdownMenuItem
                key={conversation.id}
                onClick={() => handleSelect(conversation.id)}
                className="flex flex-col items-start gap-0.5 cursor-pointer"
              >
                <span className="font-medium truncate w-full">
                  {conversation.title || "Untitled conversation"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(conversation.updated_at)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
