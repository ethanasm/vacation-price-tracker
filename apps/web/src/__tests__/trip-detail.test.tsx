import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { Suspense } from "react";

// All jest.mock calls are hoisted - define mock data inside factory functions

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
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="chart-line" />,
  XAxis: () => null,
  YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => {
    if (tickFormatter) tickFormatter(1200);
    return null;
  },
  CartesianGrid: () => null,
}));

// Mock chart component
jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

// Mock CSS modules
jest.mock("../app/trips/[tripId]/page.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

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
  formatDuration: (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`,
  formatFlightTime: (time: string) => {
    const d = new Date(time);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  },
}));

// Mock the mock-data module - data must be defined inside factory
jest.mock("@/lib/mock-data", () => {
  const { mockTripsData } = jest.requireActual("@/lib/fixtures/trips");
  const baseTripData = JSON.parse(JSON.stringify(mockTripsData["1"]));
  baseTripData.trip = {
    ...baseTripData.trip,
    id: "test-trip",
    name: "Test Vacation",
    origin_airport: "SFO",
    destination_code: "LAX",
    depart_date: "2025-06-15",
    return_date: "2025-06-22",
    adults: 2,
    status: "active",
    current_flight_price: "500.00",
    current_hotel_price: "700.00",
    total_price: "1200.00",
    last_refreshed: "2025-01-21T10:30:00Z",
  };
  baseTripData.top_flights = [
    {
      id: "fl1",
      airline: "United Airlines",
      airline_code: "UA",
      flight_number: "UA 123",
      departure_time: "2025-06-15T08:00:00",
      arrival_time: "2025-06-15T10:00:00",
      duration_minutes: 120,
      stops: 0,
      cabin: "economy",
      price: "500.00",
      return_flight: {
        flight_number: "UA 456",
        departure_time: "2025-06-22T14:00:00",
        arrival_time: "2025-06-22T16:00:00",
        duration_minutes: 120,
        stops: 0,
      },
    },
    {
      id: "fl2",
      airline: "Delta",
      airline_code: "DL",
      flight_number: "DL 789",
      departure_time: "2025-06-15T12:00:00",
      arrival_time: "2025-06-15T14:00:00",
      duration_minutes: 120,
      stops: 0,
      cabin: "economy",
      price: "550.00",
    },
  ];
  baseTripData.tracked_hotels = [
    {
      id: "h1",
      hotel_name: "Test Hotel One",
      hotel_id: "hotel-1",
      star_rating: 4,
      room_type: "King",
      room_description: "King room with view",
      price_per_night: "100.00",
      total_price: "700.00",
      amenities: ["Pool", "WiFi"],
    },
    {
      id: "h2",
      hotel_name: "Test Hotel Two",
      hotel_id: "hotel-2",
      star_rating: 3,
      room_type: "Double",
      room_description: "Double room",
      price_per_night: "80.00",
      total_price: "560.00",
      amenities: ["WiFi"],
    },
  ];
  baseTripData.price_history = [];
  baseTripData.hotel_price_histories = [
    {
      hotel_id: "hotel-1",
      snapshots: [
        { date: "2025-01-19", total_price: "720.00" },
        { date: "2025-01-20", total_price: "700.00" },
      ],
    },
  ];

  return {
    mockTripsData: {
      "": {
        ...baseTripData,
        trip: { ...baseTripData.trip, name: "Empty Trip" },
      },
      "test-trip": baseTripData,
      "paused-trip": {
        ...baseTripData,
        trip: { ...baseTripData.trip, status: "paused" },
      },
      "error-trip": {
        ...baseTripData,
        trip: { ...baseTripData.trip, status: "error" },
      },
      "unknown-status-trip": {
        ...baseTripData,
        trip: { ...baseTripData.trip, status: "unknown" },
      },
      "fallback-trip": {
        ...baseTripData,
        trip: {
          ...baseTripData.trip,
          name: "Fallback Trip",
          is_round_trip: false,
          return_date: null,
          current_flight_price: null,
          current_hotel_price: null,
          total_price: "not-a-number",
        },
        top_flights: [],
        tracked_hotels: [],
        hotel_price_histories: [
          {
            hotel_id: "hotel-1",
            snapshots: [{ date: "2025-01-19", total_price: "not-a-number" }],
          },
        ],
      },
      "space-hotel-trip": {
        ...baseTripData,
        tracked_hotels: [
          {
            ...baseTripData.tracked_hotels[0],
            hotel_name: " ",
          },
        ],
      },
      "increase-trip": {
        ...baseTripData,
        hotel_price_histories: [
          {
            hotel_id: "hotel-1",
            snapshots: [
              { date: "2025-01-19", total_price: "650.00" },
              { date: "2025-01-20", total_price: "700.00" },
            ],
          },
        ],
      },
      "missing-data-trip": {
        ...baseTripData,
        trip: { ...baseTripData.trip, status: "active" },
        tracked_hotels: [
          { ...baseTripData.tracked_hotels[0], hotel_name: null },
        ],
        top_flights: [
          { ...baseTripData.top_flights[0], airline: null, airline_code: null },
        ],
      },
      "no-history-trip": {
        ...baseTripData,
        hotel_price_histories: [],
      },
      "not-enough-history-trip": {
        ...baseTripData,
        hotel_price_histories: [
          {
            hotel_id: "hotel-1",
            snapshots: [{ date: "2025-01-20", total_price: "700.00" }],
          },
        ],
      },
      "zero-trend-trip": {
        ...baseTripData,
        trip: {
          ...baseTripData.trip,
          status: "active",
          current_flight_price: "0.00",
          current_hotel_price: "100.00",
          total_price: "100.00",
        },
        top_flights: [
          {
            ...baseTripData.top_flights[0],
            price: "0.00",
          },
        ],
        tracked_hotels: [
          {
            ...baseTripData.tracked_hotels[0],
            total_price: "100.00",
          },
        ],
        hotel_price_histories: [
          {
            hotel_id: "hotel-1",
            snapshots: [
              { date: "2025-01-19", total_price: "0.00" },
              { date: "2025-01-20", total_price: "100.00" },
            ],
          },
        ],
      },
    },
  };
});

// Import after mocks
import TripDetailPage from "../app/trips/[tripId]/page";
import { toast } from "sonner";

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
  });

  describe("rendering", () => {
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

    it("shows trip not found when trip doesn't exist", async () => {
      await act(async () => {
        render(<TestWrapper tripId="non-existent" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip not found")).toBeInTheDocument();
      });
    });

    it("shows back button in error state", async () => {
      await act(async () => {
        render(<TestWrapper tripId="non-existent" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Back to trips")).toBeInTheDocument();
      });
    });

    it("navigates back to trips when back button clicked in error state", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<TestWrapper tripId="non-existent" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Back to trips")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Back to trips"));

      expect(mockRouterPush).toHaveBeenCalledWith("/trips");
    });
  });

  describe("status variants", () => {
    it("shows ACTIVE badge for active trips", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });
    });

    it("shows PAUSED badge for paused trips", async () => {
      await act(async () => {
        render(<TestWrapper tripId="paused-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("PAUSED")).toBeInTheDocument();
      });
    });

    it("shows ERROR badge for error trips", async () => {
      await act(async () => {
        render(<TestWrapper tripId="error-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ERROR")).toBeInTheDocument();
      });
    });

    it("shows outline badge for unknown trips", async () => {
      await act(async () => {
        render(<TestWrapper tripId="unknown-status-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
      });
    });
  });

  describe("hotels", () => {
    it("renders all tracked hotels", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Hotel One")).toBeInTheDocument();
        expect(screen.getByText("Test Hotel Two")).toBeInTheDocument();
      });
    });

    it("shows hotel prices", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // Both hotel prices should be visible (may appear multiple times in UI)
        expect(screen.getAllByText("$700").length).toBeGreaterThan(0);
        expect(screen.getAllByText("$560").length).toBeGreaterThan(0);
      });
    });

    it("allows selecting a different hotel", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Hotel Two")).toBeInTheDocument();
      });

      // Click on second hotel
      await user.click(screen.getByText("Test Hotel Two"));

      // The price summary should update (Test Hotel Two is $560)
      await waitFor(() => {
        // Total should now be $500 (flight) + $560 (hotel) = $1060
        expect(screen.getByText("$1060")).toBeInTheDocument();
      });
    });
  });

  describe("flights", () => {
    it("renders flight options", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // UA appears for both outbound and return flights
        expect(screen.getAllByText("UA").length).toBeGreaterThan(0);
        expect(screen.getAllByText("DL").length).toBeGreaterThan(0);
      });
    });

    it("shows Best label for first flight", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Best")).toBeInTheDocument();
      });
    });

    it("shows flight prices", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // Flight prices appear in both the summary and flight list
        expect(screen.getAllByText("$500").length).toBeGreaterThan(0);
        expect(screen.getAllByText("$550").length).toBeGreaterThan(0);
      });
    });
  });

  describe("price summary", () => {
    it("displays flight price in summary", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // "Flight" appears in both summary bar and chart legend
        expect(screen.getAllByText("Flight").length).toBeGreaterThan(0);
      });
    });

    it("displays total price", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // $500 flight + $700 hotel = $1200
      await waitFor(() => {
        expect(screen.getByText("$1200")).toBeInTheDocument();
      });
    });
  });

  describe("status toggle", () => {
    afterEach(() => {
      jest.useRealTimers();
      (toast.success as jest.Mock).mockReset();
      (toast.error as jest.Mock).mockReset();
    });

    it("toggles status from active to paused", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });

      // Find and click the switch
      const switchElement = screen.getByRole("switch");
      await user.click(switchElement);

      // Advance timers for the setTimeout
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Tracking paused");
        expect(screen.getByText("PAUSED")).toBeInTheDocument();
      });

    });

    it("toggles status from paused to active", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await act(async () => {
        render(<TestWrapper tripId="paused-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("PAUSED")).toBeInTheDocument();
      });

      const switchElement = screen.getByRole("switch");
      await user.click(switchElement);

      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Tracking resumed");
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });

    });

    it("shows error toast on status toggle failure", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (toast.success as jest.Mock).mockImplementation(() => {
        throw new Error("API Error");
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => expect(screen.getByText("ACTIVE")).toBeInTheDocument());

      await user.click(screen.getByRole("switch"));

      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to update trip status");
      });

    });

    it("does nothing when tripId is missing", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await act(async () => {
        render(<TestWrapper tripId="" />);
      });
      await waitFor(() => expect(screen.getByText("Empty Trip")).toBeInTheDocument());

      await user.click(screen.getByRole("switch"));

      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("delete flow", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows delete confirmation dialog", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      // Find and click delete button (trash icon button)
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(btn => btn.querySelector('svg.lucide-trash-2') !== null);

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
        expect(screen.getByText(/This will permanently delete/)).toBeInTheDocument();
      });
    });

    it("deletes trip and navigates to trips list", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      // Open delete dialog
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(btn => btn.querySelector('svg.lucide-trash-2') !== null);

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      // Click confirm delete
      await user.click(screen.getByRole("button", { name: "Delete" }));

      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      await waitFor(() => {
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

      // Open delete dialog
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(btn => btn.querySelector('svg.lucide-trash-2') !== null);

      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete this trip?")).toBeInTheDocument();
      });

      // Click cancel
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByText("Delete this trip?")).not.toBeInTheDocument();
      });

      // Trip should still be visible
      expect(screen.getByText("Test Vacation")).toBeInTheDocument();
    });

    it("shows error toast on delete failure", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (toast.success as jest.Mock).mockImplementation(() => {
        throw new Error("API Error");
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => expect(screen.getByText("Test Vacation")).toBeInTheDocument());

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(btn => btn.querySelector('svg.lucide-trash-2') !== null);
      if (deleteButton) await user.click(deleteButton);

      await waitFor(() => expect(screen.getByText("Delete this trip?")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Delete" }));

      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete trip");
      });

    });

    it("does nothing when tripId is missing", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<TestWrapper tripId="" />);
      });
      await waitFor(() => expect(screen.getByText("Empty Trip")).toBeInTheDocument());

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(btn => btn.querySelector('svg.lucide-trash-2') !== null);
      if (deleteButton) await user.click(deleteButton);

      await waitFor(() => expect(screen.getByText("Delete this trip?")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(toast.success).not.toHaveBeenCalled();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  describe("navigation", () => {
    it("back button navigates to trips list", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      // Find back button (first button with arrow-left icon)
      const backButton = screen.getAllByRole("button")[0];
      await user.click(backButton);

      expect(mockRouterPush).toHaveBeenCalledWith("/trips");
    });
  });

  describe("chart", () => {
    it("renders price history chart", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("chart-container")).toBeInTheDocument();
      });
    });

    it("shows chart legend", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Total")).toBeInTheDocument();
        // Flight appears multiple times, just check one exists
        expect(screen.getAllByText("Flight").length).toBeGreaterThan(0);
      });
    });
  });

  describe("price trend", () => {
    it("shows price trend when history available", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // The hotel has price history with $720 -> $700, which is a decrease
      await waitFor(() => {
        // Check for percentage change display (negative trend)
        const trendElement = screen.queryByText(/-\d+\.\d+%/);
        expect(trendElement).toBeInTheDocument();
      });
    });

    it("shows positive trend when prices increase", async () => {
      await act(async () => {
        render(<TestWrapper tripId="increase-trip" />);
      });

      await waitFor(() => {
        const trendElement = screen.queryByText(/\+\d+\.\d+%/);
        expect(trendElement).toBeInTheDocument();
      });
    });
  });

  describe("fallbacks", () => {
    it("handles missing prices and one-way trips", async () => {
      await act(async () => {
        render(<TestWrapper tripId="fallback-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Fallback Trip")).toBeInTheDocument();
      });

      expect(screen.getByText(/→/)).toBeInTheDocument();
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
      expect(screen.getByTestId("chart-container")).toBeInTheDocument();
    });
  });

  describe("missing data", () => {
    it("handles missing hotel and airline names", async () => {
      await act(async () => {
        render(<TestWrapper tripId="missing-data-trip" />);
      });

      await waitFor(() => {
        // Find the hotel name display - it should default to "Hotel"
        expect(screen.getAllByText("Hotel").length).toBeGreaterThan(0);
        // Find the airline code display - it should default to "—"
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
      });
    });

    it("shows no history message when price history is empty", async () => {
      await act(async () => {
        render(<TestWrapper tripId="no-history-trip" />);
      });
      await waitFor(() => {
        expect(screen.getByText("No price history yet")).toBeInTheDocument();
      });
    });

    it("does not show trend when history is insufficient", async () => {
      await act(async () => {
        render(<TestWrapper tripId="not-enough-history-trip" />);
      });
      await waitFor(() => {
        const trendElement = screen.queryByText(/%\d+\.\d+%/);
        expect(trendElement).not.toBeInTheDocument();
      });
    });

    it("does not show trend when previous total is zero", async () => {
      await act(async () => {
        render(<TestWrapper tripId="zero-trend-trip" />);
      });
      await waitFor(() => {
        const trendElement = screen.queryByText(/[-+]\d+\.\d+%/);
        expect(trendElement).not.toBeInTheDocument();
      });
    });

    it("uses fallback hotel name when the name is blank", async () => {
      await act(async () => {
        render(<TestWrapper tripId="space-hotel-trip" />);
      });

      await waitFor(() => {
        expect(screen.getAllByText("Hotel").length).toBeGreaterThan(0);
      });
    });
  });
});
