import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { Suspense } from "react";

// All jest.mock calls are hoisted

// Mock next/navigation
const mockRouterPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: jest.fn(),
  }),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock recharts
jest.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="chart-line" />,
  XAxis: () => null,
  YAxis: ({
    tickFormatter,
  }: {
    tickFormatter?: (value: number) => string;
  }) => {
    if (tickFormatter) tickFormatter(1200);
    return null;
  },
  CartesianGrid: () => null,
}));

// Mock chart component
jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

// Mock CSS modules
jest.mock("../app/trips/[tripId]/page.module.css", () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => prop,
    }
  )
);

// Mock format functions
jest.mock("@/lib/format", () => ({
  formatPrice: (price: string | number | null) => {
    if (price === null || price === undefined) return "—";
    const value = typeof price === "number" ? price : Number.parseFloat(price);
    return Number.isFinite(value) ? `$${value.toFixed(0)}` : "—";
  },
  formatShortDate: (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },
}));

// Mock API module
const mockGetDetails = jest.fn();
const mockUpdateStatus = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/lib/api", () => ({
  api: {
    trips: {
      getDetails: (...args: unknown[]) => mockGetDetails(...args),
      updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, message: string, detail?: string) {
      super(message);
      this.status = status;
      this.detail = detail || message;
    }
  },
}));

// Import after mocks
import TripDetailPage from "../app/trips/[tripId]/page";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

// Test fixtures
const baseTripData = {
  id: "test-trip-123",
  name: "Test Vacation",
  origin_airport: "SFO",
  destination_code: "LAX",
  depart_date: "2025-06-15",
  return_date: "2025-06-22",
  is_round_trip: true,
  adults: 2,
  status: "active",
  current_flight_price: "500.00",
  current_hotel_price: "700.00",
  total_price: "1200.00",
  last_refreshed: "2025-01-21T10:30:00Z",
  flight_prefs: {
    airlines: ["United", "Delta"],
    stops_mode: "any",
    max_stops: 1,
    cabin: "economy",
  },
  hotel_prefs: {
    rooms: 2,
    adults_per_room: 2,
    room_selection_mode: "cheapest",
    preferred_room_types: ["King", "Queen"],
    preferred_views: ["Ocean"],
  },
  notification_prefs: {
    threshold_type: "trip_total",
    threshold_value: "2000.00",
    email_enabled: true,
    sms_enabled: false,
  },
  created_at: "2025-01-15T08:00:00Z",
  updated_at: "2025-01-21T10:30:00Z",
};

const basePriceHistory = [
  {
    id: "ph1",
    flight_price: "550.00",
    hotel_price: "750.00",
    total_price: "1300.00",
    created_at: "2025-01-19T10:00:00Z",
  },
  {
    id: "ph2",
    flight_price: "500.00",
    hotel_price: "700.00",
    total_price: "1200.00",
    created_at: "2025-01-21T10:30:00Z",
  },
];

function TestWrapper({ tripId }: { tripId: string }) {
  const paramsPromise = Promise.resolve({ tripId });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TripDetailPage params={paramsPromise} />
    </Suspense>
  );
}

describe("TripDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDetails.mockReset();
    mockUpdateStatus.mockReset();
    mockDelete.mockReset();
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching", async () => {
      // Never resolve the promise to keep loading state
      mockGetDetails.mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // The Skeleton component renders divs with certain classes
      // Since we're in loading state, trip name should not be visible yet
      expect(screen.queryByText("Test Vacation")).not.toBeInTheDocument();
    });
  });

  describe("error states", () => {
    it("shows not found when API returns empty trip", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: null,
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="empty-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip not found")).toBeInTheDocument();
      });
    });

    it("shows error state for 404", async () => {
      mockGetDetails.mockRejectedValue(new ApiError(404, "Trip not found"));

      await act(async () => {
        render(<TestWrapper tripId="non-existent" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip not found")).toBeInTheDocument();
      });

      expect(screen.getByText(/Back to trips/)).toBeInTheDocument();
    });

    it("shows error detail from API error", async () => {
      mockGetDetails.mockRejectedValue(
        new ApiError(500, "Server Error", "Database connection failed")
      );

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Database connection failed")
        ).toBeInTheDocument();
      });
    });

    it("shows generic error for non-API errors", async () => {
      mockGetDetails.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Failed to load trip")).toBeInTheDocument();
      });
    });

    it("navigates back when back button clicked in error state", async () => {
      const user = userEvent.setup();
      mockGetDetails.mockRejectedValue(new ApiError(404, "Trip not found"));

      await act(async () => {
        render(<TestWrapper tripId="non-existent" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip not found")).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Back to trips/));
      expect(mockRouterPush).toHaveBeenCalledWith("/trips");
    });
  });

  describe("successful data display", () => {
    beforeEach(() => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: basePriceHistory,
        },
      });
    });

    it("renders trip details correctly", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      expect(screen.getByText(/SFO/)).toBeInTheDocument();
      expect(screen.getByText(/LAX/)).toBeInTheDocument();
    });

    it("shows ACTIVE badge for active trips", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });
    });

    it("displays prices in summary bar", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("$500")).toBeInTheDocument(); // Flight
        expect(screen.getByText("$700")).toBeInTheDocument(); // Hotel
        expect(screen.getByText("$1200")).toBeInTheDocument(); // Total
      });
    });

    it("displays trip details card", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip Details")).toBeInTheDocument();
        expect(screen.getByText("2 adults")).toBeInTheDocument();
        expect(screen.getByText("Round trip")).toBeInTheDocument();
        expect(screen.getByText("Economy")).toBeInTheDocument();
        expect(screen.getByText("United, Delta")).toBeInTheDocument();
      });
    });

    it("displays hotel preferences card", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Hotel Preferences")).toBeInTheDocument();
        expect(screen.getByText("Rooms")).toBeInTheDocument();
        expect(screen.getByText("Adults/Room")).toBeInTheDocument();
        expect(screen.getByText("King, Queen")).toBeInTheDocument();
        expect(screen.getByText("Ocean")).toBeInTheDocument();
      });
    });

    it("handles one-way trips", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, is_round_trip: false },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("One way")).toBeInTheDocument();
        expect(screen.getByText(/→/)).toBeInTheDocument();
      });
    });

    it("handles trip without hotel prefs", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, hotel_prefs: null },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip Details")).toBeInTheDocument();
      });

      // Hotel Preferences card should not be rendered
      expect(screen.queryByText("Hotel Preferences")).not.toBeInTheDocument();
    });

    it("handles trip without flight prefs", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, flight_prefs: null },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip Details")).toBeInTheDocument();
      });

      // Cabin row should not be rendered without flight prefs
      expect(screen.queryByText("Cabin")).not.toBeInTheDocument();
    });

    it("falls back to Economy when cabin is missing", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: {
            ...baseTripData,
            flight_prefs: { ...baseTripData.flight_prefs, cabin: "" },
          },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Economy")).toBeInTheDocument();
      });
    });

    it("handles single adult correctly", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, adults: 1 },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("1 adult")).toBeInTheDocument();
      });
    });
  });

  describe("status toggle", () => {
    beforeEach(() => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [],
        },
      });
    });

    afterEach(() => {
      (toast.success as jest.Mock).mockReset();
      (toast.error as jest.Mock).mockReset();
    });

    it("toggles status from active to paused", async () => {
      const user = userEvent.setup();
      mockUpdateStatus.mockResolvedValue(undefined);

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });

      const switchElement = screen.getByRole("switch");
      await user.click(switchElement);

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith("test-trip", "paused");
        expect(toast.success).toHaveBeenCalledWith("Tracking paused");
        expect(screen.getByText("PAUSED")).toBeInTheDocument();
      });
    });

    it("toggles status from paused to active", async () => {
      const user = userEvent.setup();
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, status: "paused" },
          price_history: [],
        },
      });
      mockUpdateStatus.mockResolvedValue(undefined);

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("PAUSED")).toBeInTheDocument();
      });

      const switchElement = screen.getByRole("switch");
      await user.click(switchElement);

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith("test-trip", "active");
        expect(toast.success).toHaveBeenCalledWith("Tracking resumed");
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });
    });

    it("shows error toast with detail on API error", async () => {
      const user = userEvent.setup();
      mockUpdateStatus.mockRejectedValue(
        new ApiError(400, "Bad Request", "Invalid status transition")
      );

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Invalid status transition");
      });
    });

    it("shows generic error toast on non-API error", async () => {
      const user = userEvent.setup();
      mockUpdateStatus.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("switch"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to update trip status"
        );
      });
    });
  });

  describe("delete flow", () => {
    beforeEach(() => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [],
        },
      });
    });

    afterEach(() => {
      (toast.success as jest.Mock).mockReset();
      (toast.error as jest.Mock).mockReset();
    });

    it("shows delete confirmation dialog", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null);

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
        expect(
          screen.getByText(/This will permanently delete/)
        ).toBeInTheDocument();
      });
    });

    it("deletes trip and navigates to trips list", async () => {
      const user = userEvent.setup();
      mockDelete.mockResolvedValue(undefined);

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null);

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith("test-trip");
        expect(toast.success).toHaveBeenCalledWith("Trip deleted");
        expect(mockRouterPush).toHaveBeenCalledWith("/trips");
      });
    });

    it("can cancel delete dialog", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null);

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(
          screen.queryByText("Delete this trip?")
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText("Test Vacation")).toBeInTheDocument();
    });

    it("shows error toast with detail on API error", async () => {
      const user = userEvent.setup();
      mockDelete.mockRejectedValue(
        new ApiError(403, "Forbidden", "Cannot delete active trip")
      );

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null);

      if (deleteButton) await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Cannot delete active trip");
      });
    });

    it("falls back to generic error when API error has no detail", async () => {
      const user = userEvent.setup();
      const error = new ApiError(500, "Server error");
      error.detail = "";
      mockDelete.mockRejectedValue(error);

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null);

      if (deleteButton) await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete trip");
      });
    });

    it("shows generic error toast on non-API error", async () => {
      const user = userEvent.setup();
      mockDelete.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null);

      if (deleteButton) await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete trip");
      });
    });
  });

  describe("delete guard", () => {
    it("does not call delete when tripId is empty", async () => {
      const user = userEvent.setup();
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-trash-2") !== null);

      if (deleteButton) await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockDelete).not.toHaveBeenCalled();
      });
    });
  });

  describe("navigation", () => {
    beforeEach(() => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [],
        },
      });
    });

    it("back button navigates to trips list", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const backButton = screen.getAllByRole("button")[0];
      await user.click(backButton);

      expect(mockRouterPush).toHaveBeenCalledWith("/trips");
    });

    it("edit button navigates to edit page", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const editButton = screen.getByTitle("Edit trip");
      await user.click(editButton);

      expect(mockRouterPush).toHaveBeenCalledWith("/trips/test-trip/edit");
    });
  });

  describe("price history chart", () => {
    it("renders price history chart when data available", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: basePriceHistory,
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("chart-container")).toBeInTheDocument();
      });
    });

    it("shows empty state when no price history", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("No price history yet")).toBeInTheDocument();
      });
    });

    it("shows chart legend", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: basePriceHistory,
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Total")).toBeInTheDocument();
        expect(screen.getAllByText("Flight").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Hotel").length).toBeGreaterThan(0);
      });
    });
  });

  describe("price trend", () => {
    it("shows negative trend when prices decrease", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: basePriceHistory, // Goes from 1300 to 1200
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        const trendElement = screen.queryByText(/-\d+\.\d+%/);
        expect(trendElement).toBeInTheDocument();
      });
    });

    it("shows positive trend when prices increase", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "450.00",
              hotel_price: "650.00",
              total_price: "1100.00",
              created_at: "2025-01-19T10:00:00Z",
            },
            {
              id: "ph2",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        const trendElement = screen.queryByText(/\+\d+\.\d+%/);
        expect(trendElement).toBeInTheDocument();
      });
    });

    it("does not show trend when only one data point", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [basePriceHistory[0]],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const trendElement = screen.queryByText(/[-+]\d+\.\d+%/);
      expect(trendElement).not.toBeInTheDocument();
    });

    it("does not show trend when previous price is zero", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "0.00",
              hotel_price: "0.00",
              total_price: "0.00",
              created_at: "2025-01-19T10:00:00Z",
            },
            {
              id: "ph2",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const trendElement = screen.queryByText(/[-+]\d+\.\d+%/);
      expect(trendElement).not.toBeInTheDocument();
    });

    it("does not show trend when current and previous are equal", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-19T10:00:00Z",
            },
            {
              id: "ph2",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const trendElement = screen.queryByText(/[-+]\d+\.\d+%/);
      expect(trendElement).not.toBeInTheDocument();
    });
  });

  describe("status variants", () => {
    it("shows PAUSED badge for paused trips", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, status: "paused" },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("PAUSED")).toBeInTheDocument();
      });
    });

    it("shows ERROR badge for error trips", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, status: "error" },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ERROR")).toBeInTheDocument();
      });
    });

    it("handles unknown status", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, status: "unknown" },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
      });
    });
  });

  describe("fallback handling", () => {
    it("handles null prices gracefully", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: {
            ...baseTripData,
            current_flight_price: null,
            current_hotel_price: null,
            total_price: null,
          },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
      });
    });

    it("handles empty return date for one-way", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: {
            ...baseTripData,
            is_round_trip: false,
            return_date: null,
          },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText(/SFO → LAX/)).toBeInTheDocument();
      });
    });

    it("handles empty airlines array", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: {
            ...baseTripData,
            flight_prefs: { ...baseTripData.flight_prefs, airlines: [] },
          },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip Details")).toBeInTheDocument();
      });

      // Airlines row should not be rendered
      expect(screen.queryByText("Airlines")).not.toBeInTheDocument();
    });

    it("handles empty room types and views arrays", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: {
            ...baseTripData,
            hotel_prefs: {
              ...baseTripData.hotel_prefs,
              preferred_room_types: [],
              preferred_views: [],
            },
          },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Hotel Preferences")).toBeInTheDocument();
      });

      // Room Types and Views rows should not be rendered
      expect(screen.queryByText("Room Types")).not.toBeInTheDocument();
      expect(screen.queryByText("Views")).not.toBeInTheDocument();
    });
  });
});
