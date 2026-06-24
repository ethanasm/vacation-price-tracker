import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/trips/page";

// next/navigation router (used by trip-row-actions and elsewhere)
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// sonner toasts (avoid side effects)
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

// SSE hook — real module path is @/hooks/use-sse exporting useSSE returning { isConnected }
jest.mock("@/hooks/use-sse", () => ({
  useSSE: () => ({
    connectionState: "connected",
    isConnected: true,
    priceUpdates: [],
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    clearUpdates: jest.fn(),
  }),
}));

// Chat provider / panel — avoid network calls
jest.mock("@/lib/chat-provider", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useChatContext: () => ({
    threadId: "mock-thread-id",
    pendingElicitation: null,
    setPendingElicitation: jest.fn(),
    processElicitationResponse: jest.fn(),
    messages: [],
    isLoading: false,
    error: null,
    pendingRefreshIds: new Set(),
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
    retryLastMessage: jest.fn(),
    switchThread: jest.fn(),
    startNewThread: jest.fn(),
  }),
}));

jest.mock("@/components/chat/chat-panel", () => ({
  ChatPanel: () => <div data-testid="chat-panel">Assistant</div>,
}));

jest.mock("@/components/chat/elicitation-drawer", () => ({
  ElicitationDrawer: () => null,
}));

jest.mock("@/components/dashboard/chat-toggle", () => ({
  useChatExpanded: (defaultValue: boolean) => ({
    isExpanded: defaultValue,
    setExpanded: jest.fn(),
    isHydrated: true,
  }),
  ChatToggle: () => null,
  FloatingChatToggle: () => null,
}));

jest.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
    detail = "";
  },
  api: {
    trips: {
      list: jest.fn().mockResolvedValue({
        data: [
          {
            id: "1",
            name: "Test 2",
            origin_airport: "SFO",
            destination_code: "RDM",
            depart_date: "2025-08-22",
            return_date: "2025-08-26",
            status: "active",
            current_flight_price: "177",
            current_hotel_price: "612",
            total_price: "789",
            last_refreshed: "2025-08-01T00:00:00Z",
          },
          {
            id: "2",
            name: "Tokyo",
            origin_airport: "LAX",
            destination_code: "HND",
            depart_date: "2026-03-20",
            return_date: "2026-03-28",
            status: "paused",
            current_flight_price: "842",
            current_hotel_price: "1180",
            total_price: "2022",
            last_refreshed: "2025-08-01T00:00:00Z",
          },
        ],
      }),
    },
  },
}));

describe("Dashboard (Aurora)", () => {
  it("renders the trip columns, violet ACTIVE + amber PAUSED chips, and the pinned footer", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    for (const h of ["Trip", "Route", "Dates", "Flight", "Hotel", "Total", "Status"]) {
      expect(
        screen.getAllByText(new RegExp(`^${h}`, "i")).length,
      ).toBeGreaterThan(0);
    }
    expect(screen.getByText("ACTIVE")).toHaveClass("aurora-chip-active");
    expect(screen.getByText("PAUSED")).toHaveClass("aurora-chip-paused");
    expect(screen.getByText("$789")).toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 2 trips/i)).toBeInTheDocument();
    expect(screen.getByText(/refresh daily at 6:00 AM/i)).toBeInTheDocument();
  });

  describe("compact viewport (≤820px)", () => {
    beforeEach(() => {
      // The dashboard swaps the table for stacked trip cards below 820px,
      // driven by useMediaQuery -> window.matchMedia. jsdom has no matchMedia,
      // so emulate a matching (mobile) query for this branch.
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          addListener: jest.fn(),
          removeListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }),
      });
    });

    afterEach(() => {
      // Restore desktop default so the table-path test is unaffected by order.
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: undefined,
      });
    });

    it("renders stacked trip cards with status chips and Flight/Hotel/Total mini-stats", async () => {
      render(<DashboardPage />);
      await waitFor(() =>
        expect(screen.getByText("Test 2")).toBeInTheDocument(),
      );

      // Stacked cards, not the table: the Aurora status chips still render…
      expect(screen.getByText("ACTIVE")).toHaveClass("aurora-chip-active");
      expect(screen.getByText("PAUSED")).toHaveClass("aurora-chip-paused");
      // …each card shows the three mini-stats…
      expect(screen.getAllByText("Flight").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Hotel").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
      // …and the violet/bold per-trip total.
      expect(screen.getByText("$789")).toBeInTheDocument();
    });
  });
});
