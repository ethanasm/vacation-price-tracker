import type React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import DashboardPage from "./page";
import { api, ApiError, type TripResponse } from "@/lib/api";

// Mock chat components
jest.mock("@/components/chat/chat-panel", () => ({
  ChatPanel: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="chat-panel">
      <span>Travel Assistant</span>
      {onClose && <button onClick={onClose} type="button">Close</button>}
    </div>
  ),
}));

// Track tool result callback
let capturedOnToolResult: ((result: unknown) => void) | null = null;

jest.mock("@/lib/chat-provider", () => ({
  ChatProvider: ({ children, onToolResult }: { children: React.ReactNode; onToolResult?: (result: unknown) => void }) => {
    capturedOnToolResult = onToolResult || null;
    return <>{children}</>;
  },
  useChatContext: () => ({
    threadId: "mock-thread-id",
    pendingElicitation: null,
    setPendingElicitation: jest.fn(),
    messages: [],
    isLoading: false,
    error: null,
    pendingRefreshIds: new Set(),
    addPendingRefresh: jest.fn(),
    removePendingRefresh: jest.fn(),
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
    retryLastMessage: jest.fn(),
    switchThread: jest.fn(),
    startNewThread: jest.fn(),
  }),
}));

// Mock elicitation drawer
jest.mock("@/components/chat/elicitation-drawer", () => ({
  ElicitationDrawer: () => null,
}));

// Track SSE callback for tests
let capturedOnPriceUpdate: ((update: unknown) => void) | null = null;
let capturedOnError: ((error: Error) => void) | null = null;

// Mock SSE hook
jest.mock("@/hooks/use-sse", () => ({
  useSSE: (options: { onPriceUpdate?: (update: unknown) => void; onError?: (error: Error) => void }) => {
    capturedOnPriceUpdate = options.onPriceUpdate || null;
    capturedOnError = options.onError || null;
    return {
      connectionState: "connected",
      isConnected: true,
      priceUpdates: [],
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      clearUpdates: jest.fn(),
    };
  },
}));

// Mock chat toggle with localStorage simulation
jest.mock("@/components/dashboard/chat-toggle", () => ({
  useChatExpanded: (defaultValue: boolean) => ({
    isExpanded: defaultValue,
    setExpanded: jest.fn(),
    isHydrated: true,
  }),
  ChatToggle: ({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: (v: boolean) => void }) => (
    <button onClick={() => onToggle(!isExpanded)} type="button" data-testid="chat-toggle">
      {isExpanded ? "Hide Chat" : "Show Chat"}
    </button>
  ),
  FloatingChatToggle: () => null,
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock the API module
jest.mock("@/lib/api", () => ({
  api: {
    trips: {
      list: jest.fn(),
      refreshAll: jest.fn(),
      getRefreshStatus: jest.fn(),
      delete: jest.fn(),
      deleteAll: jest.fn(),
      updateStatus: jest.fn(),
      refresh: jest.fn(),
    },
  },
  ApiError: class ApiError extends Error {
    status: number;
    detail?: string;
    constructor(status: number, message: string, detail?: string) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));

jest.mock("./page.module.css", () => ({
  pageHeader: "pageHeader",
  title: "title",
  columns: "columns",
  tablePanel: "tablePanel",
  tableWrapper: "tableWrapper",
  tripTable: "tripTable",
  clickableRow: "clickableRow",
  route: "route",
  routeArrow: "routeArrow",
  dates: "dates",
  price: "price",
  priceTotal: "priceTotal",
  timestamp: "timestamp",
  chatPanel: "chatPanel",
  chatPlaceholderIcon: "chatPlaceholderIcon",
  chatPlaceholderTitle: "chatPlaceholderTitle",
  chatPlaceholderText: "chatPlaceholderText",
  emptyState: "emptyState",
  emptyIcon: "emptyIcon",
  emptyTitle: "emptyTitle",
  emptyText: "emptyText",
  failedState: "failedState",
  failedIcon: "failedIcon",
  failedTitle: "failedTitle",
  failedText: "failedText",
  skeletonRow: "skeletonRow",
  headerActions: "headerActions",
  rowLink: "rowLink",
}));

// Mock trip data that mimics the API response
const mockApiTrips: TripResponse[] = [
  {
    id: "1",
    name: "Orlando Family Vacation",
    origin_airport: "SFO",
    destination_code: "MCO",
    depart_date: "2025-06-15",
    return_date: "2025-06-22",
    status: "active",
    current_flight_price: "892.50",
    current_hotel_price: "1245.00",
    total_price: "2137.50",
    last_refreshed: "2025-01-21T10:30:00Z",
  },
  {
    id: "2",
    name: "Hawaii Honeymoon",
    origin_airport: "LAX",
    destination_code: "HNL",
    depart_date: "2025-08-01",
    return_date: "2025-08-10",
    status: "active",
    current_flight_price: "654.00",
    current_hotel_price: "2100.00",
    total_price: "2754.00",
    last_refreshed: "2025-01-21T09:15:00Z",
  },
  {
    id: "3",
    name: "NYC Weekend",
    origin_airport: "SFO",
    destination_code: "JFK",
    depart_date: "2025-03-14",
    return_date: "2025-03-16",
    status: "paused",
    current_flight_price: "425.00",
    current_hotel_price: "890.00",
    total_price: "1315.00",
    last_refreshed: "2025-01-20T14:00:00Z",
  },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.clearAllMocks();
    // Reset API mocks with default success response
    (api.trips.list as jest.Mock).mockResolvedValue({
      data: mockApiTrips,
      meta: { page: 1, total: 3 },
    });
    (api.trips.refreshAll as jest.Mock).mockReset();
    (api.trips.getRefreshStatus as jest.Mock).mockReset();
  });

  describe("Initial loading and data display", () => {
    it("renders the trips heading", async () => {
      render(<DashboardPage />);
      expect(screen.getByRole("heading", { name: "Your Trips" })).toBeInTheDocument();
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalledTimes(1);
      });
    });

    it("renders the refresh button", async () => {
      render(<DashboardPage />);
      expect(screen.getByRole("button", { name: "Refresh All" })).toBeInTheDocument();
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("renders the New Trip button", async () => {
      render(<DashboardPage />);
      expect(screen.getByRole("link", { name: /New Trip/i })).toBeInTheDocument();
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("fetches trips from API on mount", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalledTimes(1);
      });

      // Check for trip names from API
      expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      expect(screen.getByText("Hawaii Honeymoon")).toBeInTheDocument();
      expect(screen.getByText("NYC Weekend")).toBeInTheDocument();
    });

    it("renders the chat panel", async () => {
      render(<DashboardPage />);

      expect(screen.getByText("Travel Assistant")).toBeInTheDocument();
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("renders trip routes correctly", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });

      // Check airport codes are displayed (SFO appears twice - for Orlando and NYC trips)
      expect(screen.getAllByText("SFO")).toHaveLength(2);
      expect(screen.getByText("MCO")).toBeInTheDocument();
      expect(screen.getByText("LAX")).toBeInTheDocument();
    });

    it("renders trip status badges with uppercase display", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });

      // Check for status badges (API returns lowercase, displayed as uppercase)
      expect(screen.getAllByText("ACTIVE")).toHaveLength(2);
      expect(screen.getByText("PAUSED")).toBeInTheDocument();
    });

    it("renders table headers", async () => {
      render(<DashboardPage />);

      expect(screen.getByText("Trip Name")).toBeInTheDocument();
      expect(screen.getByText("Route")).toBeInTheDocument();
      expect(screen.getByText("Dates")).toBeInTheDocument();
      expect(screen.getByText("Flight")).toBeInTheDocument();
      expect(screen.getByText("Hotel")).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Updated")).toBeInTheDocument();

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("has links to individual trip pages", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });

      const tripLink = screen.getByRole("link", { name: "Orlando Family Vacation" });
      expect(tripLink).toHaveAttribute("href", "/trips/1");
    });

    it("displays round trip indicator for trips with return dates", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });

      // All mock trips have return dates, so they show bidirectional arrow
      const arrows = screen.getAllByText("↔");
      expect(arrows.length).toBe(3);
    });

    it("renders the New Trip link with correct href", async () => {
      render(<DashboardPage />);

      const newTripLink = screen.getByRole("link", { name: /New Trip/i });
      expect(newTripLink).toHaveAttribute("href", "/trips/new");

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("renders prices formatted correctly", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });

      // Check for formatted prices
      expect(screen.getByText("$893")).toBeInTheDocument();
      expect(screen.getByText("$1,245")).toBeInTheDocument();
      expect(screen.getByText("$2,138")).toBeInTheDocument();
    });

    it("renders a table with proper structure after loading", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });

      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Check that we have expected number of rows (header + 3 trips)
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(4); // 1 header + 3 data rows
    });

    it("renders trip dates formatted correctly", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });

      // Check for date formatting
      expect(screen.getByText(/Jun 15/)).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("shows loading skeleton while fetching trips", async () => {
      // Make the API call hang
      let resolveList: (value: unknown) => void;
      (api.trips.list as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveList = resolve;
        })
      );

      render(<DashboardPage />);

      // Should show skeleton rows during loading
      const skeletonRows = document.querySelectorAll(".skeletonRow");
      expect(skeletonRows.length).toBeGreaterThan(0);

      // Resolve the promise to cleanup
      await act(async () => {
        resolveList?.({ data: [], meta: { page: 1, total: 0 } });
      });
    });
  });

  describe("Empty state", () => {
    it("renders the empty state when there are no trips", async () => {
      (api.trips.list as jest.Mock).mockResolvedValue({
        data: [],
        meta: { page: 1, total: 0 },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "No trips yet" })).toBeInTheDocument();
      });
    });

    it("shows create trip message in empty state", async () => {
      (api.trips.list as jest.Mock).mockResolvedValue({
        data: [],
        meta: { page: 1, total: 0 },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Create your first trip to start tracking prices.")).toBeInTheDocument();
      });
    });
  });

  describe("Error state", () => {
    it("renders the failed state on API error", async () => {
      const MockApiError = jest.requireMock("@/lib/api").ApiError;
      (api.trips.list as jest.Mock).mockRejectedValue(
        new MockApiError(500, "Server error", "Internal server error")
      );

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Failed to load trips" })).toBeInTheDocument();
      });
    });

    it("handles network errors gracefully", async () => {
      (api.trips.list as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Failed to load trips" })).toBeInTheDocument();
      });
      expect(screen.getByText("We couldn't fetch your trips. Please try again.")).toBeInTheDocument();
    });

    it("retries fetching trips when retry button is clicked", async () => {
      const MockApiError = jest.requireMock("@/lib/api").ApiError;
      (api.trips.list as jest.Mock)
        .mockRejectedValueOnce(new MockApiError(500, "Server error"))
        .mockResolvedValueOnce({ data: mockApiTrips, meta: { page: 1, total: 3 } });

      render(<DashboardPage />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Failed to load trips" })).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByRole("button", { name: "Retry" });
      await userEvent.click(retryButton);

      // Should fetch again and show trips
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });
    });
  });

  describe("Refresh functionality", () => {
    it("refreshes all trips and shows a success toast", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      const mockGetRefreshStatus = api.trips.getRefreshStatus as jest.Mock;

      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "test-group-id" },
      });

      // Poll returns completed immediately
      mockGetRefreshStatus.mockResolvedValue({
        data: { status: "completed", total: 3, completed: 3, failed: 0 },
      });

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      // Button should show "Starting refresh..." initially
      expect(screen.getByRole("button", { name: /Starting refresh/ })).toBeInTheDocument();

      // Advance past the 500ms initial delay and then trigger the immediate status check
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Prices refreshed", {
          description: "All 3 trip prices have been updated.",
        });
      });

      // Should refetch trips after refresh completes
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalledTimes(2);
      });

      jest.useRealTimers();
    });

    it("shows an error toast when refresh fails", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      mockRefreshAll.mockRejectedValue(new Error("Network error"));

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Refresh failed", {
          description: "Could not refresh prices. Please try again.",
        });
      });

      jest.useRealTimers();
    });

    it("shows specific error toast when refresh already in progress", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      const MockApiError = jest.requireMock("@/lib/api").ApiError;
      mockRefreshAll.mockRejectedValue(new MockApiError(409, "Conflict", "Refresh already in progress"));

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Refresh already in progress", {
          description: "Please wait for the current refresh to complete.",
        });
      });

      jest.useRealTimers();
    });

    it("disables refresh button while refreshing", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      const mockGetRefreshStatus = api.trips.getRefreshStatus as jest.Mock;

      // Keep the promise pending to test the disabled state
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "test-group-id" },
      });
      // Make getRefreshStatus hang to keep the refresh in progress
      mockGetRefreshStatus.mockImplementation(() => new Promise(() => {}));

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      const refreshingButton = screen.getByRole("button", { name: /Starting refresh|Refreshing/ });
      expect(refreshingButton).toBeDisabled();

      jest.useRealTimers();
    });

    it("re-enables refresh button after refresh completes", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      const mockGetRefreshStatus = api.trips.getRefreshStatus as jest.Mock;

      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "test-group-id" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: { status: "completed", total: 3, completed: 3, failed: 0 },
      });

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      // Advance past the 500ms delay
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Refresh All" })).not.toBeDisabled();
      });

      jest.useRealTimers();
    });

    it("shows toast with failure count when some refreshes fail", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      const mockGetRefreshStatus = api.trips.getRefreshStatus as jest.Mock;

      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "test-group-id" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: { status: "completed", total: 3, completed: 2, failed: 1 },
      });

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      // Advance past 500ms delay
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith("Prices partially refreshed", {
          description: "2 trips updated, 1 failed.",
        });
      });

      jest.useRealTimers();
    });

    it("handles refresh status polling error gracefully", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      const mockGetRefreshStatus = api.trips.getRefreshStatus as jest.Mock;

      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "test-group-id" },
      });
      mockGetRefreshStatus.mockRejectedValue(new Error("Polling error"));

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      // Advance past 500ms delay
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Should log the error
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to poll refresh status:",
          expect.any(Error)
        );
      });

      // Button should be re-enabled
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Refresh All" })).not.toBeDisabled();
      });

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    });

    it("shows refresh progress during polling", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const mockRefreshAll = api.trips.refreshAll as jest.Mock;
      const mockGetRefreshStatus = api.trips.getRefreshStatus as jest.Mock;

      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "test-group-id" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: { status: "in_progress", total: 3, completed: 1, failed: 0 },
      });

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      // Advance past 500ms delay to trigger the immediate status check
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Wait for the first status poll to complete
      await waitFor(() => {
        expect(mockGetRefreshStatus).toHaveBeenCalled();
      });

      // Should show progress
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Refreshing 1\/3/ })).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("shows error toast with detail from ApiError", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const MockApiError = jest.requireMock("@/lib/api").ApiError;
      (api.trips.refreshAll as jest.Mock).mockRejectedValue(
        new MockApiError(500, "Server Error", "Database connection failed")
      );

      render(<DashboardPage />);

      // Wait for trips to render
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Refresh All" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Refresh failed", {
          description: "Database connection failed",
        });
      });

      jest.useRealTimers();
    });
  });

  describe("Status handling", () => {
    it("handles error status from API", async () => {
      (api.trips.list as jest.Mock).mockResolvedValue({
        data: [
          {
            id: "4",
            name: "Error Trip",
            origin_airport: "AAA",
            destination_code: "BBB",
            depart_date: "2025-10-01",
            return_date: "2025-10-05",
            status: "error",
            current_flight_price: "100.00",
            current_hotel_price: "200.00",
            total_price: "300.00",
            last_refreshed: new Date().toISOString(),
          },
        ],
        meta: { page: 1, total: 1 },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("ERROR")).toBeInTheDocument();
      });
    });

    it("handles unknown status from API with default styling", async () => {
      (api.trips.list as jest.Mock).mockResolvedValue({
        data: [
          {
            id: "7",
            name: "Unknown Status Trip",
            origin_airport: "GGG",
            destination_code: "HHH",
            depart_date: "2025-12-01",
            return_date: "2025-12-05",
            status: "unknown",
            current_flight_price: "100.00",
            current_hotel_price: "200.00",
            total_price: "300.00",
            last_refreshed: new Date().toISOString(),
          },
        ],
        meta: { page: 1, total: 1 },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
      });
    });
  });

  describe("Price handling", () => {
    it("handles null prices gracefully", async () => {
      (api.trips.list as jest.Mock).mockResolvedValue({
        data: [
          {
            id: "5",
            name: "No Price Trip",
            origin_airport: "CCC",
            destination_code: "DDD",
            depart_date: "2025-11-01",
            return_date: "2025-11-05",
            status: "active",
            current_flight_price: null,
            current_hotel_price: null,
            total_price: null,
            last_refreshed: null,
          },
        ],
        meta: { page: 1, total: 1 },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("No Price Trip")).toBeInTheDocument();
      });

      // Should display "—" (em dash) for null prices
      const dashCells = screen.getAllByText("—");
      expect(dashCells.length).toBeGreaterThan(0);
    });

    it("handles trips without return date", async () => {
      (api.trips.list as jest.Mock).mockResolvedValue({
        data: [
          {
            id: "6",
            name: "One Way Trip",
            origin_airport: "EEE",
            destination_code: "FFF",
            depart_date: "2025-12-01",
            return_date: "", // Empty string for one-way
            status: "active",
            current_flight_price: "150.00",
            current_hotel_price: null,
            total_price: "150.00",
            last_refreshed: "2025-01-22T12:00:00Z",
          },
        ],
        meta: { page: 1, total: 1 },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("One Way Trip")).toBeInTheDocument();
      });

      // Should show one-way arrow
      expect(screen.getByText("→")).toBeInTheDocument();
    });
  });

  describe("API error detail handling", () => {
    it("displays API error detail in error state", async () => {
      const MockApiError = jest.requireMock("@/lib/api").ApiError;
      (api.trips.list as jest.Mock).mockRejectedValue(
        new MockApiError(403, "Forbidden", "You do not have access to this resource")
      );

      // Spy on console.error to prevent test output noise
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Failed to load trips" })).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Tool result handling", () => {
    it("refetches trips when create_trip tool result is received", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Clear previous calls
      (api.trips.list as jest.Mock).mockClear();

      // Simulate create_trip tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "create_trip",
            toolCallId: "call-1",
            isError: false,
            result: { name: "New Trip" },
          });
        }
      });

      // Should show success toast and refetch
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Trip "New Trip" created', {
          description: "Fetching initial prices...",
        });
      });

      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("refetches trips when delete_trip tool result is received", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Clear previous calls
      (api.trips.list as jest.Mock).mockClear();

      // Simulate delete_trip tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "delete_trip",
            toolCallId: "call-2",
            isError: false,
            result: {},
          });
        }
      });

      // Should refetch trips
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("handles trigger_refresh tool result by starting polling", async () => {
      jest.useFakeTimers();

      (api.trips.getRefreshStatus as jest.Mock).mockResolvedValue({
        data: { status: "completed", total: 3, completed: 3, failed: 0 },
      });

      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Simulate trigger_refresh tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "trigger_refresh",
            toolCallId: "call-3",
            isError: false,
            result: { workflow_id: "workflow-123" },
          });
        }
      });

      // Advance timer to trigger polling
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      // Should start polling
      await waitFor(() => {
        expect(api.trips.getRefreshStatus).toHaveBeenCalledWith("workflow-123");
      });

      jest.useRealTimers();
    });

    it("tracks pending refresh for trigger_refresh_trip tool result", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Simulate trigger_refresh_trip tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "trigger_refresh_trip",
            toolCallId: "call-4",
            isError: false,
            result: { trip_id: "1" },
          });
        }
      });

      // The pending refresh should be tracked (tested via SSE clearing it)
      // Simulate SSE price update that clears the pending refresh
      await act(async () => {
        if (capturedOnPriceUpdate) {
          capturedOnPriceUpdate({
            trip_id: "1",
            flight_price: "750.00",
            hotel_price: "1100.00",
            total_price: "1850.00",
            updated_at: "2025-01-22T12:00:00Z",
          });
        }
      });

      // Price should be updated
      await waitFor(() => {
        expect(screen.getByText("$750")).toBeInTheDocument();
      });
    });

    it("refetches trips for pause_trip tool result", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Clear previous calls
      (api.trips.list as jest.Mock).mockClear();

      // Simulate pause_trip tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "pause_trip",
            toolCallId: "call-5",
            isError: false,
            result: {},
          });
        }
      });

      // Should refetch trips
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("refetches trips for resume_trip tool result", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Clear previous calls
      (api.trips.list as jest.Mock).mockClear();

      // Simulate resume_trip tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "resume_trip",
            toolCallId: "call-6",
            isError: false,
            result: {},
          });
        }
      });

      // Should refetch trips
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("refetches trips for set_notification tool result", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Clear previous calls
      (api.trips.list as jest.Mock).mockClear();

      // Simulate set_notification tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "set_notification",
            toolCallId: "call-7",
            isError: false,
            result: {},
          });
        }
      });

      // Should refetch trips
      await waitFor(() => {
        expect(api.trips.list).toHaveBeenCalled();
      });
    });

    it("does not refetch for non-mutating tool results", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Clear previous calls
      (api.trips.list as jest.Mock).mockClear();

      // Simulate a non-mutating tool result
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "list_trips",
            toolCallId: "call-8",
            isError: false,
            result: {},
          });
        }
      });

      // Should NOT refetch trips
      expect(api.trips.list).not.toHaveBeenCalled();
    });

    it("shows default toast message when create_trip result has no name", async () => {
      render(<DashboardPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Simulate create_trip tool result without name
      await act(async () => {
        if (capturedOnToolResult) {
          capturedOnToolResult({
            name: "create_trip",
            toolCallId: "call-9",
            isError: false,
            result: {}, // No name property
          });
        }
      });

      // Should show success toast with default name
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Trip "New trip" created', {
          description: "Fetching initial prices...",
        });
      });
    });
  });

  describe("SSE price updates", () => {
    it("updates trip prices when SSE price update is received", async () => {
      render(<DashboardPage />);

      // Wait for trips to load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Initial price should be displayed
      expect(screen.getByText("$893")).toBeInTheDocument();

      // Simulate SSE price update
      await act(async () => {
        if (capturedOnPriceUpdate) {
          capturedOnPriceUpdate({
            trip_id: "1",
            flight_price: "999.00",
            hotel_price: "1500.00",
            total_price: "2499.00",
            updated_at: "2025-01-22T10:00:00Z",
          });
        }
      });

      // New price should be displayed
      await waitFor(() => {
        expect(screen.getByText("$999")).toBeInTheDocument();
      });
    });

    it("handles SSE errors gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      render(<DashboardPage />);

      // Wait for trips to load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Simulate SSE error
      await act(async () => {
        if (capturedOnError) {
          capturedOnError(new Error("SSE connection failed"));
        }
      });

      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith("SSE error:", expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it("clears pending refresh for trip when price update is received", async () => {
      render(<DashboardPage />);

      // Wait for trips to load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Simulate SSE price update that clears pending refresh
      await act(async () => {
        if (capturedOnPriceUpdate) {
          capturedOnPriceUpdate({
            trip_id: "1",
            flight_price: "800.00",
            hotel_price: "1000.00",
            total_price: "1800.00",
            updated_at: "2025-01-22T11:00:00Z",
          });
        }
      });

      // Price should be updated
      await waitFor(() => {
        expect(screen.getByText("$800")).toBeInTheDocument();
      });
    });
  });

  describe("Delete all functionality", () => {
    it("deletes all trips successfully", async () => {
      const user = userEvent.setup();
      (api.trips.deleteAll as jest.Mock).mockResolvedValue({
        data: { deleted_count: 3 },
      });

      render(<DashboardPage />);

      // Wait for trips to load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Find and click the Delete All button to open dialog
      const deleteAllButton = screen.getByRole("button", { name: /Delete All/i });
      await user.click(deleteAllButton);

      // Confirm in the dialog
      const confirmButton = screen.getByRole("button", { name: /^Delete All$/i });
      await user.click(confirmButton);

      // Check toast message
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("3 trips deleted");
      });
    });

    it("shows singular message when deleting 1 trip", async () => {
      (api.trips.list as jest.Mock).mockResolvedValue({
        data: [mockApiTrips[0]],
        meta: { page: 1, total: 1 },
      });
      (api.trips.deleteAll as jest.Mock).mockResolvedValue({
        data: { deleted_count: 1 },
      });

      const user = userEvent.setup();

      render(<DashboardPage />);

      // Wait for trips to load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Find and click the Delete All button to open dialog
      const deleteAllButton = screen.getByRole("button", { name: /Delete All/i });
      await user.click(deleteAllButton);

      // Confirm in the dialog
      const confirmButton = screen.getByRole("button", { name: /^Delete All$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("1 trip deleted");
      });
    });

    it("shows error toast when delete all fails with ApiError", async () => {
      const user = userEvent.setup();
      const MockApiError = jest.requireMock("@/lib/api").ApiError;
      (api.trips.deleteAll as jest.Mock).mockRejectedValue(
        new MockApiError(500, "Server Error", "Database connection failed")
      );

      render(<DashboardPage />);

      // Wait for trips to load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Open and confirm delete all dialog
      const deleteAllButton = screen.getByRole("button", { name: /Delete All/i });
      await user.click(deleteAllButton);
      const confirmButton = screen.getByRole("button", { name: /^Delete All$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Database connection failed");
      });
    });

    it("shows generic error toast when delete all fails with non-ApiError", async () => {
      const user = userEvent.setup();
      (api.trips.deleteAll as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<DashboardPage />);

      // Wait for trips to load
      await waitFor(() => {
        expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
      });

      // Open and confirm delete all dialog
      const deleteAllButton = screen.getByRole("button", { name: /Delete All/i });
      await user.click(deleteAllButton);
      const confirmButton = screen.getByRole("button", { name: /^Delete All$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete trips");
      });
    });
  });
});
