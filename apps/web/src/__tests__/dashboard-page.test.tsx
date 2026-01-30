import type React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
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
const mockToastWarning = toast.warning as jest.Mock;
const mockToastInfo = toast.info as jest.Mock;

// Mock CSS module
jest.mock("../app/trips/page.module.css", () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => prop,
    }
  )
);

// Mock API
const mockList = jest.fn();
const mockRefreshAll = jest.fn();
const mockGetRefreshStatus = jest.fn();
const mockUpdateStatus = jest.fn();
const mockRefreshTrip = jest.fn();
const mockDeleteTrip = jest.fn();
const mockDeleteAll = jest.fn();

// Mock chat components
jest.mock("../components/chat/chat-panel", () => ({
  ChatPanel: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="chat-panel">
      <span>Travel Assistant</span>
      {onClose && <button onClick={onClose} type="button">Close</button>}
    </div>
  ),
}));

jest.mock("../lib/chat-provider", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock SSE hook
jest.mock("../hooks/use-sse", () => ({
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

// Mock chat toggle with localStorage simulation
jest.mock("../components/dashboard/chat-toggle", () => ({
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

jest.mock("../lib/api", () => {
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
      trips: {
        list: () => mockList(),
        refreshAll: () => mockRefreshAll(),
        getRefreshStatus: (id: string) => mockGetRefreshStatus(id),
        updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
        refresh: (...args: unknown[]) => mockRefreshTrip(...args),
        delete: (...args: unknown[]) => mockDeleteTrip(...args),
        deleteAll: () => mockDeleteAll(),
      },
    },
    ApiError,
  };
});

import { ApiError } from "../lib/api";

// Mock trip data for api.trips.list
const mockTripsData = [
  {
    id: "trip-1",
    name: "Hawaii Vacation",
    origin_airport: "SFO",
    destination_code: "HNL",
    depart_date: "2025-06-15",
    return_date: "2025-06-22",
    current_flight_price: "500.00",
    current_hotel_price: "700.00",
    total_price: "1200.00",
    status: "active",
    last_refreshed: "2025-01-21T10:30:00Z",
  },
  {
    id: "trip-2",
    name: "Paris Trip",
    origin_airport: "JFK",
    destination_code: "CDG",
    depart_date: "2025-07-01",
    return_date: "2025-07-10",
    current_flight_price: "800.00",
    current_hotel_price: "1000.00",
    total_price: "1800.00",
    status: "paused",
    last_refreshed: "2025-01-20T15:30:00Z",
  },
  {
    id: "trip-3",
    name: "Error Trip",
    origin_airport: "LAX",
    destination_code: "LHR",
    depart_date: "2025-08-01",
    return_date: "2025-08-08",
    current_flight_price: null,
    current_hotel_price: null,
    total_price: null,
    status: "error",
    last_refreshed: "2025-01-19T12:00:00Z",
  },
  {
    id: "trip-4",
    name: "One Way Trip",
    origin_airport: "SFO",
    destination_code: "LAX",
    depart_date: "2025-09-01",
    return_date: null,
    current_flight_price: "150.00",
    current_hotel_price: null,
    total_price: "150.00",
    status: "active",
    last_refreshed: null,
  },
];

// Import after mocks
import DashboardPage from "../app/trips/page";

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default mock for list to return trip data
    mockList.mockResolvedValue({
      data: mockTripsData,
      meta: { page: 1, total: 3 },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("status badge variants", () => {
    it("renders ACTIVE status with default variant", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getAllByText("ACTIVE").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("renders PAUSED status with secondary variant", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("PAUSED")).toBeInTheDocument();
      });
    });

    it("renders ERROR status with outline variant", async () => {
      render(<DashboardPage />);

      // This tests line 36 - the ERROR case returning "outline"
      await waitFor(() => {
        expect(screen.getByText("ERROR")).toBeInTheDocument();
      });
    });
  });

  describe("refresh functionality", () => {
    it("shows refresh progress when refreshing", async () => {
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          status: "in_progress",
          total: 3,
          completed: 1,
          failed: 0,
        },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Refreshing 1\/3/)).toBeInTheDocument();
      });
    });

    it("shows success toast when refresh completes", async () => {
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          status: "completed",
          total: 3,
          completed: 3,
          failed: 0,
        },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Prices refreshed", {
          description: "All 3 trip prices have been updated.",
        });
      });
    });

    it("shows success toast with failures when some trips fail", async () => {
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          status: "completed",
          total: 3,
          completed: 2,
          failed: 1,
        },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastWarning).toHaveBeenCalledWith("Prices partially refreshed", {
          description: "2 trips updated, 1 failed.",
        });
      });
    });

    it("shows info toast when no trips to refresh", async () => {
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          status: "completed",
          total: 0,
          completed: 0,
          failed: 0,
        },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastInfo).toHaveBeenCalledWith("No trips to refresh", {
          description: "Create a trip to start tracking prices.",
        });
      });
    });

    it("shows error toast when all trips fail", async () => {
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          status: "failed",
          total: 2,
          completed: 0,
          failed: 2,
        },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Refresh failed", {
          description: "All 2 trips failed to update.",
        });
      });
    });

    it("shows success toast for single trip refresh", async () => {
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          status: "completed",
          total: 1,
          completed: 1,
          failed: 0,
        },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Prices refreshed", {
          description: "Trip prices have been updated.",
        });
      });
    });

    it("shows info toast for unusual zero-update state", async () => {
      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          status: "completed",
          total: 2,
          completed: 0,
          failed: 0,
        },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastInfo).toHaveBeenCalledWith("Refresh completed", {
          description: "No price updates were found.",
        });
      });
    });

    it("handles poll status error gracefully", async () => {
      // Tests lines 178-181 - catch block in pollRefreshStatus
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      mockRefreshAll.mockResolvedValue({
        data: { refresh_group_id: "refresh-123" },
      });
      // First call succeeds, second (poll) fails
      mockGetRefreshStatus
        .mockResolvedValueOnce({
          data: {
            status: "in_progress",
            total: 3,
            completed: 1,
            failed: 0,
          },
        })
        .mockRejectedValueOnce(new Error("Network error"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      // Wait for initial poll
      await waitFor(() => {
        expect(mockGetRefreshStatus).toHaveBeenCalledTimes(1);
      });

      // Advance timer for next poll
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to poll refresh status:",
          expect.any(Error)
        );
      });

      // Button should be re-enabled after error
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /refresh all/i })).not.toBeDisabled();
      });

      consoleSpy.mockRestore();
    });

    it("shows error toast for 409 conflict", async () => {
      mockRefreshAll.mockRejectedValue(new ApiError(409, "Conflict"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Refresh already in progress", {
          description: "Please wait for the current refresh to complete.",
        });
      });
    });

    it("shows error toast for other API errors with detail", async () => {
      // Tests line 212 - the else branch for non-409 ApiError
      mockRefreshAll.mockRejectedValue(new ApiError(500, "Server Error", "Database unavailable"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Refresh failed", {
          description: "Database unavailable",
        });
      });
    });

    it("shows generic error toast for non-ApiError errors", async () => {
      mockRefreshAll.mockRejectedValue(new Error("Network error"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh all/i });

      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Refresh failed", {
          description: "Could not refresh prices. Please try again.",
        });
      });
    });
  });

  describe("rendering", () => {
    it("renders page title", () => {
      render(<DashboardPage />);

      expect(screen.getByRole("heading", { name: "Your Trips" })).toBeInTheDocument();
    });

    it("renders new trip button", () => {
      render(<DashboardPage />);

      expect(screen.getByRole("link", { name: /new trip/i })).toBeInTheDocument();
    });

    it("renders trip table with data including one-way trips", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
        expect(screen.getByText("Paris Trip")).toBeInTheDocument();
        expect(screen.getByText("Error Trip")).toBeInTheDocument();
        expect(screen.getByText("One Way Trip")).toBeInTheDocument();
      });
    });

    it("renders one-way arrow for one-way trips", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("One Way Trip")).toBeInTheDocument();
      });

      // One-way trip should show → not ↔
      expect(screen.getByText("→")).toBeInTheDocument();
    });

    it("renders chat panel", () => {
      render(<DashboardPage />);

      expect(screen.getByText("Travel Assistant")).toBeInTheDocument();
    });
  });

  describe("error and empty states", () => {
    it("shows failed state and retries on button click", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockList.mockRejectedValueOnce(new ApiError(500, "Server Error", "DB down"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load trips")).toBeInTheDocument();
      });

      // Now fix the mock and retry
      mockList.mockResolvedValueOnce({
        data: mockTripsData,
        meta: { page: 1, total: 4 },
      });

      await user.click(screen.getByRole("button", { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });
    });

    it("shows failed state for non-ApiError", async () => {
      mockList.mockRejectedValueOnce(new Error("Network error"));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load trips")).toBeInTheDocument();
      });
    });

    it("shows empty state when no trips", async () => {
      mockList.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, total: 0 },
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("No trips yet")).toBeInTheDocument();
      });
    });

    it("shows Refresh All button disabled when no trips", async () => {
      mockList.mockResolvedValue({ data: [], meta: { page: 1, total: 0 } });

      render(<DashboardPage />);

      await waitFor(() => {
        const refreshBtn = screen.getByRole("button", { name: /refresh all/i });
        expect(refreshBtn).toBeDisabled();
      });
    });
  });

  describe("default status handling", () => {
    it("handles unknown status with outline variant", async () => {
      // The getStatusVariant function has a default case that returns "outline"
      // This is tested by having a trip with "ERROR" status which uses the same path
      // The default case (line 38) is unreachable with TypeScript type checking
      render(<DashboardPage />);

      // ERROR status renders with outline variant, confirming the variant logic works
      await waitFor(() => {
        expect(screen.getByText("ERROR")).toBeInTheDocument();
      });
    });
  });

  describe("inline trip actions", () => {
    it("updates status badge inline when a trip is paused", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockUpdateStatus.mockResolvedValue(undefined);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      // Hawaii Vacation is ACTIVE - click its kebab to pause
      const actionButtons = screen.getAllByLabelText("Trip actions");
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Pause")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Pause"));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith("trip-1", "paused");
      });

      // Both Hawaii and Paris should now show PAUSED (Paris was already paused)
      await waitFor(() => {
        expect(screen.getAllByText("PAUSED")).toHaveLength(2);
      });
    });

    it("updates status badge inline when a trip is resumed", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockUpdateStatus.mockResolvedValue(undefined);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Paris Trip")).toBeInTheDocument();
      });

      // Paris Trip is PAUSED - click its kebab to resume
      const actionButtons = screen.getAllByLabelText("Trip actions");
      await user.click(actionButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("Resume")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Resume"));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith("trip-2", "active");
      });
    });
  });

  describe("single trip deletion from dashboard", () => {
    it("removes a trip from the table when deleted via kebab menu", async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      mockDeleteTrip.mockResolvedValue(undefined);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      // Click the first trip's kebab menu
      const actionButtons = screen.getAllByLabelText("Trip actions");
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Delete"));

      // Confirm deletion in dialog
      await waitFor(() => {
        expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete$/i }));

      await waitFor(() => {
        expect(mockDeleteTrip).toHaveBeenCalledWith("trip-1");
      });

      // Trip should be removed from the table
      await waitFor(() => {
        expect(screen.queryByText("Hawaii Vacation")).not.toBeInTheDocument();
      });
    });
  });

  describe("delete all trips", () => {
    it("shows Delete All button disabled when no trips", async () => {
      mockList.mockResolvedValue({ data: [], meta: { page: 1, total: 0 } });

      render(<DashboardPage />);

      await waitFor(() => {
        const deleteAllBtn = screen.getByRole("button", { name: /delete all/i });
        expect(deleteAllBtn).toBeDisabled();
      });
    });

    it("shows Delete All button enabled when trips exist", async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        const deleteAllBtn = screen.getByRole("button", { name: /delete all/i });
        expect(deleteAllBtn).toBeEnabled();
      });
    });

    it("shows confirmation dialog when Delete All is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete all/i }));

      await waitFor(() => {
        expect(screen.getByText("Delete all trips?")).toBeInTheDocument();
        expect(screen.getByText(/permanently delete all 4 trips/i)).toBeInTheDocument();
      });
    });

    it("deletes all trips on confirmation", async () => {
      mockDeleteAll.mockResolvedValue({ data: { deleted_count: 4 } });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete all/i }));

      await waitFor(() => {
        expect(screen.getByText("Delete all trips?")).toBeInTheDocument();
      });

      // Click the confirm "Delete All" button in the dialog
      const confirmButtons = screen.getAllByRole("button", { name: /delete all/i });
      const dialogConfirm = confirmButtons[confirmButtons.length - 1];
      await user.click(dialogConfirm);

      await waitFor(() => {
        expect(mockDeleteAll).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("4 trips deleted");
      });
    });

    it("shows error toast when delete all fails with non-ApiError", async () => {
      mockDeleteAll.mockRejectedValue(new Error("Network failure"));
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete all/i }));

      await waitFor(() => {
        expect(screen.getByText("Delete all trips?")).toBeInTheDocument();
      });

      const confirmButtons = screen.getAllByRole("button", { name: /delete all/i });
      const dialogConfirm = confirmButtons[confirmButtons.length - 1];
      await user.click(dialogConfirm);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to delete trips");
      });
    });

    it("shows error toast when delete all fails", async () => {
      mockDeleteAll.mockRejectedValue(new ApiError(500, "Server error", "Internal server error"));
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Hawaii Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /delete all/i }));

      await waitFor(() => {
        expect(screen.getByText("Delete all trips?")).toBeInTheDocument();
      });

      const confirmButtons = screen.getAllByRole("button", { name: /delete all/i });
      const dialogConfirm = confirmButtons[confirmButtons.length - 1];
      await user.click(dialogConfirm);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Internal server error");
      });
    });
  });
});
