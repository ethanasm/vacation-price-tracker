import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "../../../components/chat/chat-input";

describe("ChatInput", () => {
  describe("rendering", () => {
    it("renders textarea with placeholder", () => {
      render(<ChatInput onSend={jest.fn()} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute("placeholder", "Ask me to track a trip...");
    });

    it("renders with custom placeholder", () => {
      render(<ChatInput onSend={jest.fn()} placeholder="Type here..." />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      expect(textarea).toHaveAttribute("placeholder", "Type here...");
    });

    it("renders send button", () => {
      render(<ChatInput onSend={jest.fn()} />);

      expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <ChatInput onSend={jest.fn()} className="custom-class" />
      );

      expect(container.querySelector("form")).toHaveClass("custom-class");
    });
  });

  describe("user input", () => {
    it("updates value on type", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={jest.fn()} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Hello world");

      expect(textarea).toHaveValue("Hello world");
    });

    it("allows multi-line input with Shift+Enter", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={jest.fn()} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Line 1{Shift>}{Enter}{/Shift}Line 2");

      expect(textarea).toHaveValue("Line 1\nLine 2");
    });
  });

  describe("submission", () => {
    it("calls onSend on Enter", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test message{Enter}");

      expect(onSend).toHaveBeenCalledWith("Test message");
    });

    it("calls onSend on button click", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test message");
      await user.click(screen.getByRole("button", { name: /send message/i }));

      expect(onSend).toHaveBeenCalledWith("Test message");
    });

    it("clears input after send", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={jest.fn()} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test{Enter}");

      expect(textarea).toHaveValue("");
    });

    it("trims whitespace before sending", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "  Test message  {Enter}");

      expect(onSend).toHaveBeenCalledWith("Test message");
    });

    it("does not send empty messages", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      render(<ChatInput onSend={onSend} />);

      await user.click(screen.getByRole("button", { name: /send message/i }));

      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not send whitespace-only messages", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "   {Enter}");

      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not submit on Shift+Enter", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test{Shift>}{Enter}{/Shift}");

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("disabled state", () => {
    it("disables textarea when disabled prop is true", () => {
      render(<ChatInput onSend={jest.fn()} disabled />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      expect(textarea).toBeDisabled();
    });

    it("disables textarea when isLoading is true", () => {
      render(<ChatInput onSend={jest.fn()} isLoading />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      expect(textarea).toBeDisabled();
    });

    it("disables button when input is empty", () => {
      render(<ChatInput onSend={jest.fn()} />);

      expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
    });

    it("enables button when input has content", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={jest.fn()} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Hello");

      expect(screen.getByRole("button", { name: /send message/i })).toBeEnabled();
    });

    it("disables button when disabled prop is true", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={jest.fn()} disabled />);

      // Button should be disabled even if we could type
      expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
    });

    it("prevents submission when disabled", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      const { rerender } = render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      // Now disable
      rerender(<ChatInput onSend={onSend} disabled />);

      await user.click(screen.getByRole("button", { name: /send message/i }));

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("shows loading spinner when isLoading is true", () => {
      render(<ChatInput onSend={jest.fn()} isLoading />);

      const button = screen.getByRole("button", { name: /sending message/i });
      expect(button).toBeInTheDocument();
    });

    it("shows send icon when not loading", () => {
      render(<ChatInput onSend={jest.fn()} />);

      const button = screen.getByRole("button", { name: /send message/i });
      expect(button).toBeInTheDocument();
    });

    it("prevents submission when loading", async () => {
      const onSend = jest.fn();
      const user = userEvent.setup();

      const { rerender } = render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      // Now set loading
      rerender(<ChatInput onSend={onSend} isLoading />);

      // Try to submit
      await user.keyboard("{Enter}");

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("async submission", () => {
    it("awaits async onSend", async () => {
      let resolved = false;
      const onSend = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        resolved = true;
      });

      const user = userEvent.setup();
      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test{Enter}");

      await waitFor(() => {
        expect(resolved).toBe(true);
      });
    });
  });

  describe("accessibility", () => {
    it("has accessible name for textarea", () => {
      render(<ChatInput onSend={jest.fn()} />);

      expect(screen.getByRole("textbox", { name: /message input/i })).toBeInTheDocument();
    });

    it("has accessible name for button", () => {
      render(<ChatInput onSend={jest.fn()} />);

      expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
    });

    it("updates button label when loading", () => {
      render(<ChatInput onSend={jest.fn()} isLoading />);

      expect(screen.getByRole("button", { name: /sending message/i })).toBeInTheDocument();
    });
  });
});
