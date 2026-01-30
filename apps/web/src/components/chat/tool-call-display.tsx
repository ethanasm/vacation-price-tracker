"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ToolCall, ToolResult } from "../../lib/chat-types";

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  result?: ToolResult;
  isExecuting?: boolean;
  className?: string;
}

/**
 * Formats a tool name for display by converting snake_case to Title Case
 */
function formatToolName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Status icon component for tool execution state
 */
function StatusIcon({ isExecuting, hasResult, isError }: {
  isExecuting: boolean;
  hasResult: boolean;
  isError: boolean;
}) {
  if (isExecuting) {
    return <Loader2 className="h-4 w-4 text-primary animate-spin" aria-label="Executing tool" />;
  }
  if (hasResult && !isError) {
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-label="Tool completed successfully" />;
  }
  if (hasResult && isError) {
    return <XCircle className="h-4 w-4 text-destructive" aria-label="Tool failed" />;
  }
  return null;
}

/**
 * Expandable content for arguments and results
 */
function ToolDetails({ toolCall, result, isError }: {
  toolCall: ToolCall;
  result?: ToolResult;
  isError: boolean;
}) {
  const hasArguments = toolCall.arguments && Object.keys(toolCall.arguments).length > 0;
  const hasResult = result !== undefined;

  return (
    <div
      id={`tool-details-${toolCall.id}`}
      className="px-3 pb-3 space-y-3 border-t border-border/40 dark:border-white/10"
    >
      {hasArguments && (
        <div className="pt-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Arguments
          </h4>
          <pre className="text-xs bg-background dark:bg-black/20 rounded-md p-2 overflow-x-auto">
            <code>{JSON.stringify(toolCall.arguments, null, 2)}</code>
          </pre>
        </div>
      )}

      {hasResult && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {isError ? "Error" : "Result"}
          </h4>
          <pre
            className={cn(
              "text-xs rounded-md p-2 overflow-x-auto",
              isError ? "bg-destructive/10 text-destructive" : "bg-background dark:bg-black/20"
            )}
          >
            <code>
              {typeof result.result === "string"
                ? result.result
                : JSON.stringify(result.result, null, 2)}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Chevron icon for expand/collapse state
 */
function ExpandChevron({ isExpanded }: { isExpanded: boolean }) {
  const Icon = isExpanded ? ChevronDown : ChevronRight;
  return (
    <span className="flex-shrink-0 text-muted-foreground">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/**
 * Header button/row for the tool call display
 */
function ToolCallHeader({
  toolCall,
  isExpanded,
  hasExpandableContent,
  isExecuting,
  hasResult,
  isError,
  onToggle,
}: {
  toolCall: ToolCall;
  isExpanded: boolean;
  hasExpandableContent: boolean;
  isExecuting: boolean;
  hasResult: boolean;
  isError: boolean;
  onToggle: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-left",
        hasExpandableContent && "hover:bg-muted/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
      )}
      onClick={hasExpandableContent ? onToggle : undefined}
      onKeyDown={hasExpandableContent ? handleKeyDown : undefined}
      role={hasExpandableContent ? "button" : undefined}
      tabIndex={hasExpandableContent ? 0 : undefined}
      aria-expanded={hasExpandableContent ? isExpanded : undefined}
      aria-controls={hasExpandableContent ? `tool-details-${toolCall.id}` : undefined}
    >
      {hasExpandableContent && <ExpandChevron isExpanded={isExpanded} />}
      <Wrench className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
      <span className="font-medium text-sm truncate">{formatToolName(toolCall.name)}</span>
      <span className="ml-auto flex-shrink-0">
        <StatusIcon isExecuting={isExecuting} hasResult={hasResult} isError={isError} />
      </span>
    </div>
  );
}

/**
 * ToolCallDisplay shows tool invocation details with collapsible arguments
 * and results. Supports loading state during execution.
 */
export function ToolCallDisplay({
  toolCall,
  result,
  isExecuting = false,
  className,
}: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasResult = result !== undefined;
  const isError = result?.isError === true;
  const hasArguments = toolCall.arguments && Object.keys(toolCall.arguments).length > 0;
  const hasExpandableContent = hasArguments || hasResult;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 dark:border-white/20 bg-muted/30 dark:bg-white/5 overflow-hidden",
        className
      )}
    >
      <ToolCallHeader
        toolCall={toolCall}
        isExpanded={isExpanded}
        hasExpandableContent={hasExpandableContent}
        isExecuting={isExecuting}
        hasResult={hasResult}
        isError={isError}
        onToggle={() => setIsExpanded(!isExpanded)}
      />
      {isExpanded && hasExpandableContent && (
        <ToolDetails toolCall={toolCall} result={result} isError={isError} />
      )}
    </div>
  );
}

interface ToolCallListProps {
  toolCalls: ToolCall[];
  results?: ToolResult[];
  executingIds?: Set<string>;
  className?: string;
}

/**
 * ToolCallList displays multiple tool calls with their results.
 */
export function ToolCallList({
  toolCalls,
  results = [],
  executingIds = new Set(),
  className,
}: ToolCallListProps) {
  const resultsByToolCallId = new Map(
    results.map((r) => [r.toolCallId, r])
  );

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {toolCalls.map((toolCall) => (
        <ToolCallDisplay
          key={toolCall.id}
          toolCall={toolCall}
          result={resultsByToolCallId.get(toolCall.id)}
          isExecuting={executingIds.has(toolCall.id)}
        />
      ))}
    </div>
  );
}
