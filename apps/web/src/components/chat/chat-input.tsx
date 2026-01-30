"use client";

import { useState, useRef, useCallback, type KeyboardEvent, type FormEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * ChatInput provides a text input with send button for the chat interface.
 * Supports multi-line input with Shift+Enter and submit on Enter.
 */
export function ChatInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = "Ask me to track a trip...",
  className,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDisabled = disabled || isLoading;
  const canSubmit = value.trim().length > 0 && !isDisabled;

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();

      if (!canSubmit) {
        return;
      }

      const message = value.trim();
      setValue("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      await onSend(message);
    },
    [canSubmit, value, onSend]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter, but allow Shift+Enter for new lines
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);

      // Auto-resize textarea
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    },
    []
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-center gap-2 p-4 border-t border-border/60 dark:border-white/10 bg-background/80 dark:bg-[rgb(18,18,28)]/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          placeholder={placeholder}
          rows={1}
          aria-label="Message input"
          className={cn(
            "w-full resize-none rounded-xl border border-border/60 dark:border-white/30",
            "bg-white/60 dark:bg-white/10 backdrop-blur-sm",
            "px-4 py-3 pr-12 text-sm",
            "text-gray-900 dark:text-white",
            "placeholder:text-gray-400 dark:placeholder:text-white/50",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "focus:border-border dark:focus:border-white/50",
            "focus:bg-white/80 dark:focus:bg-white/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all"
          )}
        />
      </div>

      <Button
        type="submit"
        size="icon"
        disabled={!canSubmit}
        aria-label={isLoading ? "Sending message" : "Send message"}
        className="flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </form>
  );
}
