import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ToolCallDisplay,
  ToolCallList,
} from "../../../components/chat/tool-call-display";
import type { ToolCall, ToolResult } from "../../../lib/chat-types";

describe("ToolCallDisplay", () => {
  const baseToolCall: ToolCall = {
    id: "call-123",
    name: "list_trips",
    arguments: {},
  };

  describe("rendering", () => {
    it("renders tool name in title case", () => {
      render(<ToolCallDisplay toolCall={baseToolCall} />);

      expect(screen.getByText("List Trips")).toBeInTheDocument();
    });

    it("formats snake_case names correctly", () => {
      const toolCall: ToolCall = {
        id: "call-456",
        name: "get_trip_details",
        arguments: {},
      };

      render(<ToolCallDisplay toolCall={toolCall} />);

      expect(screen.getByText("Get Trip Details")).toBeInTheDocument();
    });

    it("shows wrench icon", () => {
      const { container } = render(<ToolCallDisplay toolCall={baseToolCall} />);

      // Lucide icons are rendered as SVGs
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <ToolCallDisplay toolCall={baseToolCall} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("expansion", () => {
    const toolCallWithArgs: ToolCall = {
      id: "call-123",
      name: "list_trips",
      arguments: { filter: "active" },
    };

    it("is collapsed by default", () => {
      render(<ToolCallDisplay toolCall={toolCallWithArgs} />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("expands on click", async () => {
      const user = userEvent.setup();

      render(<ToolCallDisplay toolCall={toolCallWithArgs} />);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("collapses on second click", async () => {
      const user = userEvent.setup();

      render(<ToolCallDisplay toolCall={toolCallWithArgs} />);

      const button = screen.getByRole("button");
      await user.click(button);
      await user.click(button);

      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("shows arguments when expanded", async () => {
      const user = userEvent.setup();
      const toolCall: ToolCall = {
        id: "call-789",
        name: "create_trip",
        arguments: { name: "Hawaii", destination: "HNL" },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Arguments")).toBeInTheDocument();
      expect(screen.getByText(/"name": "Hawaii"/)).toBeInTheDocument();
      expect(screen.getByText(/"destination": "HNL"/)).toBeInTheDocument();
    });

    it("hides arguments when collapsed", () => {
      const toolCall: ToolCall = {
        id: "call-789",
        name: "create_trip",
        arguments: { name: "Hawaii" },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);

      expect(screen.queryByText("Arguments")).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows loading spinner when executing", () => {
      render(<ToolCallDisplay toolCall={baseToolCall} isExecuting />);

      expect(screen.getByLabelText("Executing tool")).toBeInTheDocument();
    });

    it("does not show loading spinner when not executing", () => {
      render(<ToolCallDisplay toolCall={baseToolCall} />);

      expect(screen.queryByLabelText("Executing tool")).not.toBeInTheDocument();
    });
  });

  describe("result display", () => {
    it("shows success icon when result is present", () => {
      const result: ToolResult = {
        toolCallId: "call-123",
        name: "list_trips",
        result: { trips: [] },
      };

      render(<ToolCallDisplay toolCall={baseToolCall} result={result} />);

      expect(screen.getByLabelText("Tool completed successfully")).toBeInTheDocument();
    });

    it("shows error icon when result has error", () => {
      const result: ToolResult = {
        toolCallId: "call-123",
        name: "list_trips",
        result: "Something went wrong",
        isError: true,
      };

      render(<ToolCallDisplay toolCall={baseToolCall} result={result} />);

      expect(screen.getByLabelText("Tool failed")).toBeInTheDocument();
    });

    it("shows result when expanded", async () => {
      const user = userEvent.setup();
      const result: ToolResult = {
        toolCallId: "call-123",
        name: "list_trips",
        result: { trips: [{ id: "trip-1", name: "Hawaii" }] },
      };

      render(<ToolCallDisplay toolCall={baseToolCall} result={result} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Result")).toBeInTheDocument();
      expect(screen.getByText(/"name": "Hawaii"/)).toBeInTheDocument();
    });

    it("shows error label when result is error", async () => {
      const user = userEvent.setup();
      const result: ToolResult = {
        toolCallId: "call-123",
        name: "list_trips",
        result: "Database connection failed",
        isError: true,
      };

      render(<ToolCallDisplay toolCall={baseToolCall} result={result} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Database connection failed")).toBeInTheDocument();
    });

    it("handles string results", async () => {
      const user = userEvent.setup();
      const result: ToolResult = {
        toolCallId: "call-123",
        name: "some_tool",
        result: "Simple string result",
      };

      render(<ToolCallDisplay toolCall={baseToolCall} result={result} />);

      await user.click(screen.getByRole("button"));

      expect(screen.getByText("Simple string result")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has accessible button with aria-expanded when there are arguments", () => {
      const toolCallWithArgs: ToolCall = {
        id: "call-123",
        name: "list_trips",
        arguments: { filter: "active" },
      };
      render(<ToolCallDisplay toolCall={toolCallWithArgs} />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-expanded");
    });

    it("has aria-controls linking to details", async () => {
      const user = userEvent.setup();
      const toolCallWithArgs: ToolCall = {
        id: "call-123",
        name: "list_trips",
        arguments: { filter: "active" },
      };

      render(<ToolCallDisplay toolCall={toolCallWithArgs} />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-controls", `tool-details-${toolCallWithArgs.id}`);

      await user.click(button);

      const details = document.getElementById(`tool-details-${toolCallWithArgs.id}`);
      expect(details).toBeInTheDocument();
    });

    it("does not have button role when no expandable content", () => {
      render(<ToolCallDisplay toolCall={baseToolCall} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("can be toggled with Enter key", async () => {
      const user = userEvent.setup();
      const toolCallWithArgs: ToolCall = {
        id: "call-123",
        name: "list_trips",
        arguments: { filter: "active" },
      };

      render(<ToolCallDisplay toolCall={toolCallWithArgs} />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");

      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("can be toggled with Space key", async () => {
      const user = userEvent.setup();
      const toolCallWithArgs: ToolCall = {
        id: "call-123",
        name: "list_trips",
        arguments: { filter: "active" },
      };

      render(<ToolCallDisplay toolCall={toolCallWithArgs} />);

      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");

      expect(button).toHaveAttribute("aria-expanded", "true");
    });
  });
});

describe("ToolCallList", () => {
  describe("rendering", () => {
    it("returns null when no tool calls", () => {
      const { container } = render(<ToolCallList toolCalls={[]} />);

      expect(container).toBeEmptyDOMElement();
    });

    it("renders single tool call", () => {
      const toolCalls: ToolCall[] = [
        { id: "call-1", name: "list_trips", arguments: {} },
      ];

      render(<ToolCallList toolCalls={toolCalls} />);

      expect(screen.getByText("List Trips")).toBeInTheDocument();
    });

    it("renders multiple tool calls", () => {
      const toolCalls: ToolCall[] = [
        { id: "call-1", name: "list_trips", arguments: {} },
        { id: "call-2", name: "get_trip_details", arguments: {} },
        { id: "call-3", name: "create_trip", arguments: {} },
      ];

      render(<ToolCallList toolCalls={toolCalls} />);

      expect(screen.getByText("List Trips")).toBeInTheDocument();
      expect(screen.getByText("Get Trip Details")).toBeInTheDocument();
      expect(screen.getByText("Create Trip")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const toolCalls: ToolCall[] = [
        { id: "call-1", name: "list_trips", arguments: {} },
      ];

      const { container } = render(
        <ToolCallList toolCalls={toolCalls} className="custom-list-class" />
      );

      expect(container.firstChild).toHaveClass("custom-list-class");
    });
  });

  describe("results matching", () => {
    it("matches results to tool calls by id", async () => {
      const user = userEvent.setup();
      const toolCalls: ToolCall[] = [
        { id: "call-1", name: "list_trips", arguments: {} },
        { id: "call-2", name: "get_trip_details", arguments: {} },
      ];
      const results: ToolResult[] = [
        { toolCallId: "call-1", name: "list_trips", result: { trips: [] } },
        { toolCallId: "call-2", name: "get_trip_details", result: { name: "Hawaii" } },
      ];

      render(<ToolCallList toolCalls={toolCalls} results={results} />);

      // Both should show success icons
      expect(screen.getAllByLabelText("Tool completed successfully")).toHaveLength(2);

      // Expand first tool call
      const buttons = screen.getAllByRole("button");
      await user.click(buttons[0]);

      expect(screen.getByText(/"trips": \[\]/)).toBeInTheDocument();
    });

    it("shows executing state for specific tool calls", () => {
      const toolCalls: ToolCall[] = [
        { id: "call-1", name: "list_trips", arguments: {} },
        { id: "call-2", name: "get_trip_details", arguments: {} },
      ];
      const executingIds = new Set(["call-2"]);

      render(<ToolCallList toolCalls={toolCalls} executingIds={executingIds} />);

      expect(screen.getByLabelText("Executing tool")).toBeInTheDocument();
    });

    it("handles missing results gracefully", () => {
      const toolCalls: ToolCall[] = [
        { id: "call-1", name: "list_trips", arguments: {} },
      ];
      const results: ToolResult[] = [
        { toolCallId: "call-999", name: "other_tool", result: {} },
      ];

      render(<ToolCallList toolCalls={toolCalls} results={results} />);

      // Should not crash, and should not show success/error icon
      expect(screen.queryByLabelText("Tool completed successfully")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Tool failed")).not.toBeInTheDocument();
    });
  });

  describe("empty executing set", () => {
    it("handles empty executing set", () => {
      const toolCalls: ToolCall[] = [
        { id: "call-1", name: "list_trips", arguments: {} },
      ];

      render(<ToolCallList toolCalls={toolCalls} executingIds={new Set()} />);

      expect(screen.queryByLabelText("Executing tool")).not.toBeInTheDocument();
    });
  });
});
