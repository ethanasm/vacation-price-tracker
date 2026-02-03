import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadHistoryDropdown } from "../../../components/chat/thread-history-dropdown";
import { api } from "../../../lib/api";

// Mock the api module
jest.mock("../../../lib/api", () => ({
  api: {
    chat: {
      listConversations: jest.fn(),
    },
  },
}));

const mockListConversations = api.chat.listConversations as jest.Mock;

describe("ThreadHistoryDropdown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders history button", () => {
      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      expect(screen.getByRole("button", { name: /chat history/i })).toBeInTheDocument();
    });

    it("renders with disabled state", () => {
      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} disabled />);

      expect(screen.getByRole("button", { name: /chat history/i })).toBeDisabled();
    });
  });

  describe("dropdown behavior", () => {
    it("fetches conversations when dropdown opens", async () => {
      const user = userEvent.setup();
      mockListConversations.mockResolvedValue({ data: [] });

      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(mockListConversations).toHaveBeenCalledWith(20);
      });
    });

    it("shows loading state while fetching", async () => {
      const user = userEvent.setup();
      mockListConversations.mockImplementation(
        () => new Promise(() => {})
      );

      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });
    });

    it("shows empty state when no conversations", async () => {
      const user = userEvent.setup();
      mockListConversations.mockResolvedValue({ data: [] });

      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
      });
    });

    it("shows error message on fetch failure", async () => {
      const user = userEvent.setup();
      mockListConversations.mockRejectedValue(
        new Error("Network error")
      );

      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });

  describe("conversation list", () => {
    const mockConversations = [
      {
        id: "conv-1",
        title: "Planning a trip to Paris",
        created_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-01-15T12:30:00Z",
      },
      {
        id: "conv-2",
        title: null,
        created_at: "2024-01-14T08:00:00Z",
        updated_at: "2024-01-14T09:00:00Z",
      },
    ];

    it("displays conversation titles", async () => {
      const user = userEvent.setup();
      mockListConversations.mockResolvedValue({
        data: mockConversations,
      });

      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText("Planning a trip to Paris")).toBeInTheDocument();
      });
    });

    it("shows fallback for untitled conversations", async () => {
      const user = userEvent.setup();
      mockListConversations.mockResolvedValue({
        data: mockConversations,
      });

      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText("Untitled conversation")).toBeInTheDocument();
      });
    });

    it("calls onSelectThread when conversation is clicked", async () => {
      const user = userEvent.setup();
      const onSelectThread = jest.fn();
      mockListConversations.mockResolvedValue({
        data: mockConversations,
      });

      render(<ThreadHistoryDropdown onSelectThread={onSelectThread} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText("Planning a trip to Paris")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Planning a trip to Paris"));

      expect(onSelectThread).toHaveBeenCalledWith("conv-1");
    });

    it("closes dropdown after selecting a conversation", async () => {
      const user = userEvent.setup();
      mockListConversations.mockResolvedValue({
        data: mockConversations,
      });

      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      await user.click(screen.getByRole("button", { name: /chat history/i }));

      await waitFor(() => {
        expect(screen.getByText("Planning a trip to Paris")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Planning a trip to Paris"));

      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("has accessible name for history button", () => {
      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      expect(
        screen.getByRole("button", { name: /chat history/i })
      ).toBeInTheDocument();
    });

    it("has accessible title attribute", () => {
      render(<ThreadHistoryDropdown onSelectThread={jest.fn()} />);

      expect(
        screen.getByRole("button", { name: /chat history/i })
      ).toHaveAttribute("title", "Chat history");
    });
  });
});
