import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import DashboardPage from "./page";

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

describe("DashboardPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.clearAllMocks();
  });

  it("renders the trips heading", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: "Your Trips" })).toBeInTheDocument();
  });

  it("renders the refresh button", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: "Refresh All" })).toBeInTheDocument();
  });

  it("renders the New Trip button", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("link", { name: /New Trip/i })).toBeInTheDocument();
  });

  it("renders the trip table with mock data", () => {
    render(<DashboardPage />);

    // Check for mock trip names
    expect(screen.getByText("Orlando Family Vacation")).toBeInTheDocument();
    expect(screen.getByText("Hawaii Honeymoon")).toBeInTheDocument();
    expect(screen.getByText("NYC Weekend")).toBeInTheDocument();
  });

  it("renders the AI assistant placeholder", () => {
    render(<DashboardPage />);

    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByText(/Chat interface coming in Phase 2/)).toBeInTheDocument();
  });

  it("renders trip routes correctly", () => {
    render(<DashboardPage />);

    // Check airport codes are displayed (SFO appears twice - for Orlando and NYC trips)
    expect(screen.getAllByText("SFO")).toHaveLength(2);
    expect(screen.getByText("MCO")).toBeInTheDocument();
    expect(screen.getByText("LAX")).toBeInTheDocument();
  });

  it("renders trip status badges", () => {
    render(<DashboardPage />);

    // Check for status badges
    expect(screen.getAllByText("ACTIVE")).toHaveLength(2);
    expect(screen.getByText("PAUSED")).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Trip Name")).toBeInTheDocument();
    expect(screen.getByText("Route")).toBeInTheDocument();
    expect(screen.getByText("Dates")).toBeInTheDocument();
    expect(screen.getByText("Flight")).toBeInTheDocument();
    expect(screen.getByText("Hotel")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("refreshes all trips and shows a success toast", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<DashboardPage />);

    await user.click(screen.getByRole("button", { name: "Refresh All" }));

    expect(screen.getByRole("button", { name: /Refreshing/ })).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Prices refreshed", {
        description: "All trip prices have been updated.",
      });
    });

    jest.useRealTimers();
  });

  it("shows an error toast when refresh fails", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const toastSuccess = toast.success as jest.Mock;

    toastSuccess.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    render(<DashboardPage />);

    await user.click(screen.getByRole("button", { name: "Refresh All" }));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Refresh failed", {
        description: "Could not refresh prices. Please try again.",
      });
    });

    jest.useRealTimers();
  });

  it("has links to individual trip pages", () => {
    render(<DashboardPage />);

    const tripLink = screen.getByRole("link", { name: "Orlando Family Vacation" });
    expect(tripLink).toHaveAttribute("href", "/trips/1");
  });

  it("displays round trip indicator for round trips", () => {
    render(<DashboardPage />);

    // Round trips should show bidirectional arrow
    const arrows = screen.getAllByText("↔");
    expect(arrows.length).toBeGreaterThan(0);
  });

  it("renders the New Trip link with correct href", () => {
    render(<DashboardPage />);

    const newTripLink = screen.getByRole("link", { name: /New Trip/i });
    expect(newTripLink).toHaveAttribute("href", "/trips/new");
  });

  it("renders prices formatted correctly", () => {
    render(<DashboardPage />);

    // Check for formatted prices
    expect(screen.getByText("$893")).toBeInTheDocument();
    expect(screen.getByText("$1,245")).toBeInTheDocument();
    expect(screen.getByText("$2,138")).toBeInTheDocument();
  });

  it("disables refresh button while refreshing", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<DashboardPage />);

    await user.click(screen.getByRole("button", { name: "Refresh All" }));

    const refreshingButton = screen.getByRole("button", { name: /Refreshing/ });
    expect(refreshingButton).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    jest.useRealTimers();
  });

  it("re-enables refresh button after refresh completes", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(<DashboardPage />);

    await user.click(screen.getByRole("button", { name: "Refresh All" }));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh All" })).not.toBeDisabled();
    });

    jest.useRealTimers();
  });

  it("renders trip dates formatted correctly", () => {
    render(<DashboardPage />);

    // Check for date formatting
    expect(screen.getByText(/Jun 15/)).toBeInTheDocument();
  });

  it("renders a table with proper structure", () => {
    render(<DashboardPage />);

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    // Check that we have expected number of rows (header + 3 trips)
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(4); // 1 header + 3 data rows
  });

  it("renders the empty state when there are no trips", () => {
    jest.spyOn(require("react"), "useState")
      .mockImplementationOnce(() => [[], jest.fn()]) // trips
      .mockImplementationOnce(() => [false, jest.fn()]) // isLoading
      .mockImplementationOnce(() => [false, jest.fn()]) // isRefreshing
      .mockImplementationOnce(() => [null, jest.fn()]); // error

    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: "No trips yet" })).toBeInTheDocument();
  });

  it("renders the skeleton when loading", () => {
    jest.spyOn(require("react"), "useState")
      .mockImplementationOnce(() => [[], jest.fn()]) // trips
      .mockImplementationOnce(() => [true, jest.fn()]) // isLoading
      .mockImplementationOnce(() => [false, jest.fn()]) // isRefreshing
      .mockImplementationOnce(() => [null, jest.fn()]); // error

    render(<DashboardPage />);
    expect(screen.getAllByRole("row")[1]).toHaveClass("skeletonRow");
  });

  it("renders the failed state on error and handles retry", async () => {
    const setError = jest.fn();
    jest.spyOn(require("react"), "useState")
      .mockImplementationOnce(() => [[], jest.fn()]) // trips
      .mockImplementationOnce(() => [false, jest.fn()]) // isLoading
      .mockImplementationOnce(() => [false, jest.fn()]) // isRefreshing
      .mockImplementationOnce(() => ["Failed to fetch", setError]); // error

    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Failed to load trips" })).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Retry" });
    await userEvent.click(retryButton);

    expect(setError).toHaveBeenCalledWith(null);
  });

  it("defaults to outline variant for unknown trip status", () => {
    const mockUnknownStatusTrip = [
      {
        id: "4",
        name: "Mystery Trip",
        origin_airport: "AAA",
        destination_code: "BBB",
        depart_date: "2024-10-01",
        return_date: "2024-10-05",
        is_round_trip: true,
        flight_price: 100,
        hotel_price: 200,
        total_price: 300,
        status: "UNKNOWN_STATUS",
        updated_at: new Date().toISOString(),
      },
    ];

    jest.spyOn(require("react"), "useState")
      .mockImplementationOnce(() => [mockUnknownStatusTrip, jest.fn()]) // trips
      .mockImplementationOnce(() => [false, jest.fn()]) // isLoading
      .mockImplementationOnce(() => [false, jest.fn()]) // isRefreshing
      .mockImplementationOnce(() => [null, jest.fn()]); // error

    render(<DashboardPage />);
    expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
  });

  it("handles one-way and no-return-date trips", () => {
    const mockTrips = [
      {
        id: "5",
        name: "One-Way Ticket",
        origin_airport: "CCC",
        destination_code: "DDD",
        depart_date: "2024-11-01",
        is_round_trip: false,
        flight_price: 150,
        hotel_price: 0,
        total_price: 150,
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      },
      {
        id: "6",
        name: "Flexible Return",
        origin_airport: "EEE",
        destination_code: "FFF",
        depart_date: "2024-12-01",
        return_date: null,
        is_round_trip: true,
        flight_price: 250,
        hotel_price: 300,
        total_price: 550,
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      },
    ];

    jest.spyOn(require("react"), "useState")
      .mockImplementationOnce(() => [mockTrips, jest.fn()]) // trips
      .mockImplementationOnce(() => [false, jest.fn()]) // isLoading
      .mockImplementationOnce(() => [false, jest.fn()]) // isRefreshing
      .mockImplementationOnce(() => [null, jest.fn()]); // error

    render(<DashboardPage />);

    expect(screen.getByText("→")).toBeInTheDocument();
    expect(screen.getByText("Nov 1")).toBeInTheDocument();
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });
});
