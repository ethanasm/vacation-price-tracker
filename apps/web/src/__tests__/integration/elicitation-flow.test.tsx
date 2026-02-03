import type React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

const mockToastSuccess = toast.success as jest.Mock;
const mockToastError = toast.error as jest.Mock;

// Mock CSS modules
jest.mock("../../components/trip-form/trip-details-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../components/trip-form/flight-prefs-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../components/trip-form/hotel-prefs-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../components/trip-form/collapsible-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../components/trip-form/airport-autocomplete.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../components/trip-form/tag-input.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);

// Mock DatePicker to simplify testing
jest.mock("../../components/ui/date-picker", () => ({
  DatePicker: ({
    placeholder,
    date,
    onSelect,
  }: {
    placeholder?: string;
    date?: Date;
    onSelect: (date: Date | undefined) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        onSelect(futureDate);
      }}
      data-testid={placeholder?.toLowerCase().replace(/\s/g, "-")}
    >
      {date ? date.toISOString().split("T")[0] : placeholder}
    </button>
  ),
}));

// Mock API
const mockSubmitElicitation = jest.fn();
const mockListConversations = jest.fn();
const mockLocationSearch = jest.fn();

jest.mock("../../lib/api", () => {
  class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, message: string, detail?: string) {
      super(message);
      this.status = status;
      this.detail = detail || message;
    }
  }
  return {
    api: {
      locations: {
        search: () => mockLocationSearch(),
      },
      chat: {
        submitElicitation: (...args: unknown[]) => mockSubmitElicitation(...args),
        listConversations: () => mockListConversations(),
      },
    },
    ApiError,
    fetchWithAuth: jest.fn(),
  };
});

import { ApiError } from "../../lib/api";

// Import after mocks
import { ChatProvider, useChatContext } from "../../lib/chat-provider";
import { ElicitationDrawer } from "../../components/chat/elicitation-drawer";
import type { ElicitationData } from "../../lib/chat-types";
import type { TripPayload } from "../../components/trip-form";

// Test helper component that simulates the ChatPanelWithElicitation behavior
interface TestWrapperProps {
  onTripCreated: () => void;
  children?: React.ReactNode;
}

function TestWrapper({ onTripCreated, children }: TestWrapperProps) {
  const {
    threadId,
    pendingElicitation,
    setPendingElicitation,
  } = useChatContext();

  const handleElicitationComplete = async (
    toolCallId: string,
    data: TripPayload
  ) => {
    if (!threadId || !pendingElicitation) {
      toast.error("Cannot complete form", {
        description: "Chat session not found. Please try again.",
      });
      setPendingElicitation(null);
      return;
    }

    try {
      const response = await (await import("../../lib/api")).api.chat.submitElicitation(
        toolCallId,
        threadId,
        pendingElicitation.tool_name,
        data as unknown as Record<string, unknown>
      );

      setPendingElicitation(null);

      toast.success(`Trip "${data.name}" created`, {
        description: "Fetching initial prices...",
      });

      onTripCreated();

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Failed to create trip", {
          description: err.detail,
        });
      } else {
        toast.error("Failed to create trip", {
          description: "An unexpected error occurred. Please try again.",
        });
      }
    }
  };

  const handleElicitationCancel = () => {
    setPendingElicitation(null);
  };

  return (
    <>
      {children}
      <ElicitationDrawer
        elicitation={pendingElicitation}
        onComplete={handleElicitationComplete}
        onCancel={handleElicitationCancel}
      />
    </>
  );
}

// Component to trigger elicitation for testing
interface ElicitationTriggerProps {
  elicitation: ElicitationData;
}

function ElicitationTrigger({ elicitation }: ElicitationTriggerProps) {
  const { setPendingElicitation } = useChatContext();

  return (
    <button
      type="button"
      onClick={() => setPendingElicitation(elicitation)}
      data-testid="trigger-elicitation"
    >
      Trigger Elicitation
    </button>
  );
}

// Test component with threadId (simulates active conversation)
interface TestContextProps {
  children: React.ReactNode;
  threadId?: string;
}

function TestContext({ children, threadId: testThreadId }: TestContextProps) {
  return (
    <ChatProvider
      api="http://localhost:8000/v1/chat/messages"
      threadId={testThreadId}
    >
      {children}
    </ChatProvider>
  );
}

describe("Elicitation Flow Integration", () => {
  const mockOnTripCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationSearch.mockReturnValue([
      { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", country: "USA", type: "AIRPORT" },
      { code: "SFO", name: "San Francisco International", city: "San Francisco", country: "USA", type: "AIRPORT" },
    ]);
    mockListConversations.mockResolvedValue({ data: [] });
  });

  const createElicitation = (
    overrides: Partial<ElicitationData> = {}
  ): ElicitationData => ({
    tool_call_id: "call-123",
    tool_name: "create_trip",
    component: "create-trip-form",
    prefilled: {},
    missing_fields: ["name", "origin_airport", "depart_date", "return_date"],
    ...overrides,
  });

  describe("elicitation drawer integration", () => {
    it("opens drawer when elicitation is triggered", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation({
        prefilled: { destination_code: "SEA" },
      });

      render(
        <TestContext threadId="thread-123">
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      });
    });

    it("prefills form with elicitation data", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation({
        prefilled: {
          destination_code: "SEA",
          name: "Seattle Adventure",
        },
      });

      render(
        <TestContext threadId="thread-123">
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByLabelText("Trip Name")).toHaveValue("Seattle Adventure");
        expect(screen.getByLabelText("To (Airport)")).toHaveValue("SEA");
      });
    });

    it("closes drawer when cancelled", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation();

      render(
        <TestContext threadId="thread-123">
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText("Complete Trip Details")).not.toBeInTheDocument();
      });
    });
  });

  describe("elicitation submission", () => {
    it("submits elicitation and shows success toast", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation({
        prefilled: {
          name: "Seattle Trip",
          origin_airport: "SFO",
          destination_code: "SEA",
        },
      });

      // Mock successful response
      mockSubmitElicitation.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true }),
          }),
        },
      });

      render(
        <TestContext threadId="thread-123">
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      });

      // Select dates
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      await waitFor(() => {
        expect(mockSubmitElicitation).toHaveBeenCalledWith(
          "call-123",
          "thread-123",
          "create_trip",
          expect.objectContaining({
            name: "Seattle Trip",
            origin_airport: "SFO",
            destination_code: "SEA",
          })
        );
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Trip "Seattle Trip" created',
          { description: "Fetching initial prices..." }
        );
      });

      await waitFor(() => {
        expect(mockOnTripCreated).toHaveBeenCalled();
      });
    }, 10000);

    it("shows error toast when submission fails with ApiError", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation({
        prefilled: {
          name: "Seattle Trip",
          origin_airport: "SFO",
          destination_code: "SEA",
        },
      });

      // Mock failed response
      mockSubmitElicitation.mockRejectedValue(
        new ApiError(400, "Invalid data", "Origin and destination cannot be the same")
      );

      render(
        <TestContext threadId="thread-123">
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      });

      // Select dates
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Failed to create trip",
          { description: "Origin and destination cannot be the same" }
        );
      });
    }, 10000);

    it("shows generic error toast when submission fails with non-ApiError", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation({
        prefilled: {
          name: "Seattle Trip",
          origin_airport: "SFO",
          destination_code: "SEA",
        },
      });

      // Mock failed response with generic error
      mockSubmitElicitation.mockRejectedValue(new Error("Network error"));

      render(
        <TestContext threadId="thread-123">
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      });

      // Select dates
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Failed to create trip",
          { description: "An unexpected error occurred. Please try again." }
        );
      });
    }, 10000);

    it("shows error when no thread ID is available", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation({
        prefilled: {
          name: "Seattle Trip",
          origin_airport: "SFO",
          destination_code: "SEA",
        },
      });

      // Render without threadId
      render(
        <TestContext>
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      });

      // Select dates
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Cannot complete form",
          { description: "Chat session not found. Please try again." }
        );
      });

      // Drawer should be closed
      await waitFor(() => {
        expect(screen.queryByText("Complete Trip Details")).not.toBeInTheDocument();
      });
    }, 10000);
  });

  describe("drawer closes after successful submission", () => {
    it("closes drawer after successful form submission", async () => {
      const user = userEvent.setup();
      const elicitation = createElicitation({
        prefilled: {
          name: "Seattle Trip",
          origin_airport: "SFO",
          destination_code: "SEA",
        },
      });

      mockSubmitElicitation.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true }),
          }),
        },
      });

      render(
        <TestContext threadId="thread-123">
          <TestWrapper onTripCreated={mockOnTripCreated}>
            <ElicitationTrigger elicitation={elicitation} />
          </TestWrapper>
        </TestContext>
      );

      await user.click(screen.getByTestId("trigger-elicitation"));

      await waitFor(() => {
        expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      });

      // Select dates
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      await waitFor(() => {
        expect(screen.queryByText("Complete Trip Details")).not.toBeInTheDocument();
      });
    }, 10000);
  });
});
