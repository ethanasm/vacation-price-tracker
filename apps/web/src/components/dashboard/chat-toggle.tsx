"use client";

import { MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";

const STORAGE_KEY = "vacation-tracker-chat-expanded";

/**
 * Props for ChatToggle component
 */
export interface ChatToggleProps {
  /**
   * Whether the chat panel is currently expanded
   */
  isExpanded: boolean;
  /**
   * Callback when toggle is clicked
   */
  onToggle: (expanded: boolean) => void;
  /**
   * Optional class name
   */
  className?: string;
}

/**
 * Toggle button for expanding/collapsing the chat panel.
 * State is persisted to localStorage.
 */
export function ChatToggle({ isExpanded, onToggle, className }: ChatToggleProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onToggle(!isExpanded)}
      className={className}
      aria-label={isExpanded ? "Collapse chat panel" : "Expand chat panel"}
      aria-expanded={isExpanded}
    >
      {isExpanded ? (
        <>
          <PanelRightClose className="h-4 w-4" />
          <span className="sr-only md:not-sr-only md:ml-2">Hide Chat</span>
        </>
      ) : (
        <>
          <PanelRightOpen className="h-4 w-4" />
          <span className="sr-only md:not-sr-only md:ml-2">Show Chat</span>
        </>
      )}
    </Button>
  );
}

/**
 * Hook to manage chat panel expansion state with localStorage persistence.
 *
 * @example
 * ```tsx
 * const { isExpanded, toggle, setExpanded } = useChatExpanded();
 *
 * return (
 *   <>
 *     <ChatToggle isExpanded={isExpanded} onToggle={toggle} />
 *     {isExpanded && <ChatPanel />}
 *   </>
 * );
 * ```
 */
export function useChatExpanded(defaultExpanded = true) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load initial state from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
    setIsHydrated(true);
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, String(isExpanded));
    }
  }, [isExpanded, isHydrated]);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
  }, []);

  return {
    isExpanded,
    isHydrated,
    toggle,
    setExpanded,
  };
}

/**
 * Floating chat toggle button for mobile/collapsed views.
 * Fixed position at bottom right of screen.
 */
export function FloatingChatToggle({
  isExpanded,
  onToggle,
  unreadCount = 0,
}: ChatToggleProps & { unreadCount?: number }) {
  if (isExpanded) {
    return null; // Don't show floating button when panel is expanded
  }

  return (
    <Button
      variant="default"
      size="icon"
      onClick={() => onToggle(true)}
      className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
      aria-label="Open chat"
    >
      <MessageSquare className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
