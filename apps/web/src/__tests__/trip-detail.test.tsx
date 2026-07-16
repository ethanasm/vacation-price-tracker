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
    info: jest.fn(),
  },
}));

// Mock SSE provider (uses useRouter which can cause issues in tests)
const mockSSEContext = { priceUpdates: [] as Array<{ trip_id: string; updated_at: string }> };
jest.mock("@/lib/sse-provider", () => ({
  useSSEContextOptional: () => mockSSEContext,
}));

// Mock recharts. Line invokes a function-valued `dot` prop the way recharts
// would (per-point, including a point with no coordinates yet) so the
// provider-marker dot renderer is exercised.
jest.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: ({ dot }: { dot?: unknown }) => {
    if (typeof dot === "function") {
      const renderDot = dot as (props: unknown) => React.ReactNode;
      return (
        <div data-testid="chart-line">
          {renderDot({ key: "d1", cx: 10, cy: 20, payload: { day: "2026-07-14", provider: "skiplagged" } })}
          {renderDot({ key: "d2", cx: 30, cy: 25, payload: { day: "2026-07-15", provider: "kiwi" } })}
          {renderDot({ key: "d3", cx: 50, cy: 15, payload: { day: "2026-07-16", provider: "fast_flights" } })}
          {renderDot({ key: "d4", cx: 70, cy: 18, payload: { day: "2026-07-17", provider: null } })}
          {renderDot({ payload: { day: "2026-07-18" } })}
        </div>
      );
    }
    return <div data-testid="chart-line" />;
  },
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

// Mock chart component. ChartTooltip renders its `content` element and
// ChartTooltipContent runs the injected formatter (hero row with a provider,
// hero row without one, and a non-hero row) so the tooltip's provider hint is
// exercised.
jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: ({ content }: { content?: React.ReactNode }) => content ?? null,
  ChartTooltipContent: ({
    formatter,
  }: {
    formatter?: (value: unknown, name: unknown, item: unknown) => React.ReactNode;
  }) => (
    <div data-testid="chart-tooltip-content">
      {formatter?.(1200, "total", { payload: { provider: "fast_flights" } })}
      {formatter?.(1100, "total", { payload: {} })}
      {formatter?.(500, "minFlight", { payload: { provider: "skiplagged" } })}
    </div>
  ),
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
  formatDuration: (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },
  formatFlightTime: (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  },
  renderStars: (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating),
  formatCompactDate: (dateString: string) => {
    if (!dateString) return "—";
    const datePart = dateString.split("T")[0];
    const [, month, day] = datePart.split("-").map(Number);
    if (!month || !day) return "—";
    return `${month}/${day}`;
  },
  formatDateRange: (departDate: string, returnDate: string | null) => {
    const formatCompact = (d: string) => {
      if (!d) return "—";
      const datePart = d.split("T")[0];
      const [, month, day] = datePart.split("-").map(Number);
      if (!month || !day) return "—";
      return `${month}/${day}`;
    };
    const depart = formatCompact(departDate);
    if (!returnDate) return depart;
    return `${depart} → ${formatCompact(returnDate)}`;
  },
  formatDateTime: (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  },
  getAirlineName: (carrierCode: string | null | undefined) => {
    if (!carrierCode) return "—";
    const names: Record<string, string> = { UA: "United", AA: "American", DL: "Delta" };
    return names[carrierCode.toUpperCase()] || carrierCode;
  },
}));

// Mock API module
const mockGetDetails = jest.fn();
const mockUpdateStatus = jest.fn();
const mockDelete = jest.fn();
const mockRefresh = jest.fn();
const mockGetRefreshStatus = jest.fn();

jest.mock("@/lib/api", () => ({
  api: {
    trips: {
      getDetails: (...args: unknown[]) => mockGetDetails(...args),
      updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      refresh: (...args: unknown[]) => mockRefresh(...args),
      getRefreshStatus: (...args: unknown[]) => mockGetRefreshStatus(...args),
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

// Latest snapshot is first (index 0) - matches API response order
const basePriceHistory = [
  {
    id: "ph2",
    flight_price: "500.00",
    hotel_price: "700.00",
    total_price: "1200.00",
    created_at: "2025-01-21T10:30:00Z",
    flight_offers: [
      {
        id: "f2",
        airline_code: "DL",
        airline_name: "Delta",
        price: "250.00",
        departure_time: "2025-06-15T09:00:00Z",
        arrival_time: "2025-06-15T11:30:00Z",
        duration_minutes: 150,
        stops: 0,
      },
    ],
    hotel_offers: [
      {
        id: "h2",
        name: "City Hotel",
        price: "700.00",
        rating: 3,
        address: "456 Downtown St",
        description: "Standard room",
      },
    ],
  },
  {
    id: "ph1",
    flight_price: "550.00",
    hotel_price: "750.00",
    total_price: "1300.00",
    created_at: "2025-01-19T10:00:00Z",
    flight_offers: [
      {
        id: "f1",
        airline_code: "UA",
        airline_name: "United",
        price: "275.00",
        departure_time: "2025-06-15T08:00:00Z",
        arrival_time: "2025-06-15T10:30:00Z",
        duration_minutes: 150,
        stops: 0,
      },
    ],
    hotel_offers: [
      {
        id: "h1",
        name: "Beach Resort",
        price: "750.00",
        rating: 4,
        address: "123 Ocean Ave",
        description: "Oceanfront suite",
      },
    ],
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
    mockRefresh.mockReset();
    mockGetRefreshStatus.mockReset();
    // Default: refresh-status polling reports completion so tests that don't
    // care about polling don't hang waiting for the 60s deadline.
    mockGetRefreshStatus.mockResolvedValue({
      data: {
        refresh_group_id: "refresh-123",
        status: "completed",
        total: 1,
        completed: 1,
        failed: 0,
        in_progress: 0,
        error: null,
      },
    });
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
        // $250 appears in both price summary (pre-selected cheapest flight) and flight card
        expect(screen.getAllByText("$250").length).toBeGreaterThanOrEqual(1);
        // $700 appears in both price summary and hotel list
        expect(screen.getAllByText("$700").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("$950")).toBeInTheDocument(); // Total (250 + 700)
      });
    });

    it("displays hotels list", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Hotels/ })).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /Hotels/ }));

      await waitFor(() => {
        // "City Hotel" now appears in both the hotel list and the chart legend
        // (preselected cheapest hotel surfaces as the "Selected Hotel" line label)
        expect(screen.getAllByText("City Hotel").length).toBeGreaterThanOrEqual(1);
        // $700 appears in both price summary and hotel list
        expect(screen.getAllByText("$700").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("allows selecting a hotel and updates selection state", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^Hotels$/ })).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /^Hotels$/ }));

      await waitFor(() => {
        expect(screen.getAllByText("City Hotel").length).toBeGreaterThanOrEqual(1);
      });

      // Click on a hotel to select it - this covers the onSelectHotel callback.
      // Hotel rows are now radio controls (single-select).
      const hotelButton = screen.getByRole("radio", { name: /City Hotel/ });
      await user.click(hotelButton);

      // The selected hotel radio reflects the selection state.
      await waitFor(() => {
        expect(hotelButton).toHaveAttribute("aria-checked", "true");
      });
    });

    it("displays flights list", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // Flights section header
        expect(screen.getByText("Flights")).toBeInTheDocument();
        // Collapsed card shows price and a NON-STOP badge (stops === 0 for basePriceHistory flight)
        expect(screen.getAllByText("$250").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("NON-STOP")).toBeInTheDocument();
      });
    });

    it("shows outbound and return times in collapsed flight card", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
              flight_offers: [
                {
                  id: "f1",
                  airline_code: "UA",
                  airline_name: "United",
                  price: "250.00",
                  departure_time: "2025-06-15T08:00:00",
                  arrival_time: "2025-06-15T10:30:00",
                  duration_minutes: 150,
                  stops: 0,
                  itineraries: [
                    {
                      segments: [
                        {
                          flight_number: "UA123",
                          carrier_code: "UA",
                          departure_airport: "SFO",
                          arrival_airport: "LAX",
                          departure_time: "2025-06-15T08:00:00",
                          arrival_time: "2025-06-15T10:30:00",
                          duration_minutes: 150,
                        },
                      ],
                      total_duration_minutes: 150,
                    },
                    {
                      segments: [
                        {
                          flight_number: "UA456",
                          carrier_code: "UA",
                          departure_airport: "LAX",
                          arrival_airport: "SFO",
                          departure_time: "2025-06-22T14:00:00",
                          arrival_time: "2025-06-22T16:30:00",
                          duration_minutes: 150,
                        },
                      ],
                      total_duration_minutes: 150,
                    },
                  ],
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Collapsed card should show outbound dep → arr times
      await waitFor(() => {
        // Outbound times visible in collapsed header
        expect(screen.getByText(/8:00\s*AM/)).toBeInTheDocument();
        expect(screen.getByText(/10:30\s*AM/)).toBeInTheDocument();
      });

      // Return row should be visible in collapsed state (not expanded)
      expect(screen.getByText("Return")).toBeInTheDocument();
      // Return times
      expect(screen.getByText(/2:00\s*PM/)).toBeInTheDocument();
      expect(screen.getByText(/4:30\s*PM/)).toBeInTheDocument();
    });

    it("does not show return row for one-way flights", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, is_round_trip: false, return_date: null },
          price_history: [
            {
              id: "ph1",
              flight_price: "250.00",
              hotel_price: "0",
              total_price: "250.00",
              created_at: "2025-01-21T10:30:00Z",
              flight_offers: [
                {
                  id: "f1",
                  airline_code: "UA",
                  airline_name: "United",
                  price: "250.00",
                  departure_time: "2025-06-15T08:00:00",
                  arrival_time: "2025-06-15T10:30:00",
                  duration_minutes: 150,
                  stops: 0,
                  itineraries: [
                    {
                      segments: [
                        {
                          flight_number: "UA123",
                          carrier_code: "UA",
                          departure_airport: "SFO",
                          arrival_airport: "LAX",
                          departure_time: "2025-06-15T08:00:00",
                          arrival_time: "2025-06-15T10:30:00",
                          duration_minutes: 150,
                        },
                      ],
                      total_duration_minutes: 150,
                    },
                  ],
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getAllByText("$250").length).toBeGreaterThanOrEqual(1);
      });

      // No return row should be shown
      expect(screen.queryByText("Return")).not.toBeInTheDocument();
    });

    it("displays round trip flights with return leg", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
              flight_offers: [
                {
                  id: "f1",
                  airline_code: "UA",
                  airline_name: "United",
                  flight_number: "UA123",
                  price: "250.00",
                  departure_time: "2025-06-15T08:00:00Z",
                  arrival_time: "2025-06-15T10:30:00Z",
                  duration_minutes: 150,
                  stops: 1,
                  itineraries: [
                    {
                      segments: [
                        {
                          flight_number: "UA123",
                          carrier_code: "UA",
                          departure_airport: "SFO",
                          arrival_airport: "LAX",
                          departure_time: "2025-06-15T08:00:00",
                          arrival_time: "2025-06-15T10:30:00",
                          duration_minutes: 150,
                        },
                      ],
                      total_duration_minutes: 150,
                    },
                    {
                      segments: [
                        {
                          flight_number: "UA456",
                          carrier_code: "UA",
                          departure_airport: "LAX",
                          arrival_airport: "SFO",
                          departure_time: "2025-06-22T14:00:00",
                          arrival_time: "2025-06-22T16:30:00",
                          duration_minutes: 150,
                        },
                      ],
                      total_duration_minutes: 150,
                    },
                  ],
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Wait for the flight card to render - collapsed view shows stops and price
      await waitFor(() => {
        expect(screen.getByText("1 STOP")).toBeInTheDocument();
        expect(screen.getAllByText("$250").length).toBeGreaterThanOrEqual(1);
      });

      // Clicking the flight row (a radio) selects it and toggles its expansion.
      const cardHeader = screen.getByText("1 STOP").closest("button");
      expect(cardHeader).toBeTruthy();
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Now the expanded content should be visible with Outbound/Return labels
      // "Return" appears both in collapsed header row and expanded itinerary section
      await waitFor(() => {
        expect(screen.getByText("Outbound")).toBeInTheDocument();
        expect(screen.getAllByText("Return").length).toBeGreaterThanOrEqual(1);
        // UA123 may also appear in the chart legend (selected flight label),
        // so match at least one occurrence inside the expanded itinerary.
        expect(screen.getAllByText("UA123").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("UA456")).toBeInTheDocument();
      });
    });

    it("handles one-way trips", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, is_round_trip: false },
          price_history: basePriceHistory,
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // Find the route span that shows "SFO → LAX" (one-way) instead of "SFO ↔ LAX" (round-trip)
        expect(screen.getByText(/SFO.*→.*LAX/)).toBeInTheDocument();
      });
    });

    it("displays flights with multiple stops correctly", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "400.00",
              hotel_price: "600.00",
              total_price: "1000.00",
              created_at: "2025-01-21T10:30:00Z",
              flight_offers: [
                {
                  id: "f1",
                  airline_code: "AA",
                  airline_name: "American",
                  price: "200.00",
                  departure_time: "2025-06-15T06:00:00Z",
                  arrival_time: "2025-06-15T14:00:00Z",
                  duration_minutes: 480,
                  stops: 2,
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // The expandable card shows "2 STOPS" in the collapsed header
        expect(screen.getByText("2 STOPS")).toBeInTheDocument();
        // Duration is shown when expanded, price is shown in collapsed view
        expect(screen.getAllByText("$200").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("displays layover information for connecting flights", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "350.00",
              hotel_price: "600.00",
              total_price: "950.00",
              created_at: "2025-01-21T10:30:00Z",
              flight_offers: [
                {
                  id: "f1",
                  airline_code: "UA",
                  airline_name: "United",
                  price: "350.00",
                  departure_time: "2025-06-15T08:00:00",
                  arrival_time: "2025-06-15T16:00:00",
                  duration_minutes: 480,
                  stops: 1,
                  itineraries: [
                    {
                      segments: [
                        {
                          flight_number: "UA100",
                          carrier_code: "UA",
                          departure_airport: "SFO",
                          arrival_airport: "DEN",
                          departure_time: "2025-06-15T08:00:00",
                          arrival_time: "2025-06-15T11:30:00",
                          duration_minutes: 210,
                        },
                        {
                          flight_number: "UA200",
                          carrier_code: "UA",
                          departure_airport: "DEN",
                          arrival_airport: "LAX",
                          departure_time: "2025-06-15T13:00:00",
                          arrival_time: "2025-06-15T16:00:00",
                          duration_minutes: 180,
                        },
                      ],
                      total_duration_minutes: 480,
                    },
                  ],
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Wait for the card to render, then expand it. With a 2-segment outbound
      // the stops badge names the connecting airport: "1 STOP · DEN".
      await waitFor(() => {
        expect(screen.getByText("1 STOP · DEN")).toBeInTheDocument();
      });

      const cardHeader = screen.getByText("1 STOP · DEN").closest("button");
      expect(cardHeader).toBeTruthy();
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Expanded view should show both segments and layover info (city + code).
      await waitFor(() => {
        expect(screen.getByText("UA100")).toBeInTheDocument();
        expect(screen.getByText("UA200")).toBeInTheDocument();
        expect(screen.getByText(/layover in Denver \(DEN\)/)).toBeInTheDocument();
      });
    });

    it("collapses an expanded flight card on second click", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph1",
              flight_price: "250.00",
              hotel_price: "0",
              total_price: "250.00",
              created_at: "2025-01-21T10:30:00Z",
              flight_offers: [
                {
                  id: "f1",
                  airline_code: "UA",
                  airline_name: "United",
                  price: "250.00",
                  departure_time: "2025-06-15T08:00:00",
                  arrival_time: "2025-06-15T10:30:00",
                  duration_minutes: 150,
                  stops: 1,
                  itineraries: [
                    {
                      segments: [
                        {
                          flight_number: "UA123",
                          carrier_code: "UA",
                          departure_airport: "SFO",
                          arrival_airport: "LAX",
                          departure_time: "2025-06-15T08:00:00",
                          arrival_time: "2025-06-15T10:30:00",
                          duration_minutes: 150,
                        },
                      ],
                      total_duration_minutes: 150,
                    },
                    {
                      segments: [
                        {
                          flight_number: "UA456",
                          carrier_code: "UA",
                          departure_airport: "LAX",
                          arrival_airport: "SFO",
                          departure_time: "2025-06-22T14:00:00",
                          arrival_time: "2025-06-22T16:30:00",
                          duration_minutes: 150,
                        },
                      ],
                      total_duration_minutes: 150,
                    },
                  ],
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getAllByText("$250").length).toBeGreaterThanOrEqual(1);
      });

      // Find and click the flight row (radio) to select + expand it.
      const cardHeader = screen.getByText("1 STOP").closest("button");
      expect(cardHeader).toBeTruthy();
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Should be expanded now
      await waitFor(() => {
        expect(screen.getByText("Outbound")).toBeInTheDocument();
      });

      // Click again to collapse — selection is retained, only expansion toggles.
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Outbound label should disappear, but the row stays selected.
      await waitFor(() => {
        expect(screen.queryByText("Outbound")).not.toBeInTheDocument();
      });
      expect(cardHeader).toHaveAttribute("aria-checked", "true");
    });

    it("shows empty state when no hotel offers", async () => {
      const user = userEvent.setup();
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              ...basePriceHistory[0],
              hotel_offers: [],
              flight_offers: basePriceHistory[0].flight_offers,
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^Hotels$/ })).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /^Hotels$/ }));

      await waitFor(() => {
        expect(screen.getByText("No hotel offers available")).toBeInTheDocument();
      });
    });

    it("shows empty state when no flight offers", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              ...basePriceHistory[0],
              flight_offers: [],
              hotel_offers: basePriceHistory[0].hotel_offers,
            },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("No flight offers available")).toBeInTheDocument();
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

    it("shows a Source legend naming each provider present in the history", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            { ...basePriceHistory[0], provider: "fast_flights" },
            { ...basePriceHistory[1], provider: "skiplagged" },
          ],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        const legend = screen.getByTestId("provider-legend");
        expect(legend).toHaveTextContent("Source");
        expect(legend).toHaveTextContent("Skiplagged");
        expect(legend).toHaveTextContent("Fast Flights");
        expect(legend).not.toHaveTextContent("Kiwi");
      });
    });

    it("omits the Source legend when no snapshot carries a provider marker", async () => {
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
      expect(screen.queryByTestId("provider-legend")).not.toBeInTheDocument();
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
      // Price history in descending order (newest first)
      // Current total from trip = 1200, previous (index 1) = 1100
      // diff = 1200 - 1100 = +100 = +9.1% (positive trend)
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData, // total_price: "1200.00"
          price_history: [
            {
              id: "ph2",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
            },
            {
              id: "ph1",
              flight_price: "450.00",
              hotel_price: "650.00",
              total_price: "1100.00",
              created_at: "2025-01-19T10:00:00Z",
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
      // Price history in descending order (newest first)
      // Previous (index 1) = 0.00, which should not calculate a trend
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph2",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
            },
            {
              id: "ph1",
              flight_price: "0.00",
              hotel_price: "0.00",
              total_price: "0.00",
              created_at: "2025-01-19T10:00:00Z",
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
      // Price history in descending order (newest first)
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: [
            {
              id: "ph2",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-21T10:30:00Z",
            },
            {
              id: "ph1",
              flight_price: "500.00",
              hotel_price: "700.00",
              total_price: "1200.00",
              created_at: "2025-01-19T10:00:00Z",
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

    it("handles empty price history", async () => {
      const user = userEvent.setup();
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
        expect(screen.getByText("No flight offers available")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /^Hotels$/ }));
      await waitFor(() => {
        expect(screen.getByText("No hotel offers available")).toBeInTheDocument();
      });
    });
  });

  describe("refresh flow", () => {
    beforeEach(() => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: basePriceHistory,
        },
      });
    });

    afterEach(() => {
      (toast.success as jest.Mock).mockReset();
      (toast.error as jest.Mock).mockReset();
    });

    it("triggers refresh when refresh button clicked", async () => {
      const user = userEvent.setup();
      mockRefresh.mockResolvedValue({ data: { refresh_group_id: "refresh-123" } });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle("Refresh prices");
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledWith("test-trip");
        expect(toast.success).toHaveBeenCalledWith("Refresh started - prices will update automatically");
      });
    });

    it("shows error toast with detail on API error", async () => {
      const user = userEvent.setup();
      mockRefresh.mockRejectedValue(
        new ApiError(502, "Bad Gateway", "Workflow service unavailable")
      );

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Refresh prices"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Workflow service unavailable");
      });
    });

    it("shows generic error toast on non-API error", async () => {
      const user = userEvent.setup();
      mockRefresh.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Refresh prices"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to refresh trip");
      });
    });

    it("falls back to generic error when API error has no detail", async () => {
      const user = userEvent.setup();
      const error = new ApiError(502, "Bad Gateway");
      error.detail = "";
      mockRefresh.mockRejectedValue(error);

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Refresh prices"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to refresh trip");
      });
    });

    it("does not call refresh when tripId is empty", async () => {
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

      await user.click(screen.getByTitle("Refresh prices"));

      await waitFor(() => {
        expect(mockRefresh).not.toHaveBeenCalled();
      });
    });

    it("shows loading spinner while refreshing", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockRefresh.mockResolvedValue({ data: { refresh_group_id: "refresh-123" } });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle("Refresh prices");

      // Button should not be disabled initially
      expect(refreshButton).not.toBeDisabled();

      // Start the refresh
      await user.click(refreshButton);

      // Button should be disabled while refreshing
      await waitFor(() => {
        expect(refreshButton).toBeDisabled();
      });

      // Poll deadline is 60s — advancing past it should re-enable the button.
      await act(async () => {
        jest.advanceTimersByTime(65000);
      });

      // Button should be enabled again after polling settles.
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });

      jest.useRealTimers();
    });

    it("stops polling after the 60s deadline when the workflow never settles", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockRefresh.mockResolvedValue({ data: { refresh_group_id: "refresh-123" } });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          refresh_group_id: "refresh-123",
          status: "running",
          total: 1,
          completed: 0,
          failed: 0,
          in_progress: 1,
          error: null,
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle("Refresh prices");
      await user.click(refreshButton);
      await waitFor(() => {
        expect(refreshButton).toBeDisabled();
      });

      // Never completes — the deadline stops the spinner quietly.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(65_000);
      });
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
      const { toast } = jest.requireMock("sonner");
      expect(toast.error).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("gives up after three consecutive 404s from the status endpoint", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockRefresh.mockResolvedValue({ data: { refresh_group_id: "refresh-123" } });
      mockGetRefreshStatus.mockRejectedValue(new ApiError(404, "Refresh group not found"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle("Refresh prices");
      await user.click(refreshButton);
      await waitFor(() => {
        expect(refreshButton).toBeDisabled();
      });

      // Polls at 0.5s, 2.5s, 4.5s — the third consecutive 404 stops the loop
      // well before the 60s deadline.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000);
      });
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
      expect(mockGetRefreshStatus).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it("stops polling when the page unmounts", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      mockRefresh.mockResolvedValue({ data: { refresh_group_id: "refresh-123" } });
      mockGetRefreshStatus.mockResolvedValue({
        data: {
          refresh_group_id: "refresh-123",
          status: "running",
          total: 1,
          completed: 0,
          failed: 0,
          in_progress: 1,
          error: null,
        },
      });

      let view: ReturnType<typeof render> | undefined;
      await act(async () => {
        view = render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      await user.click(screen.getByTitle("Refresh prices"));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000);
      });
      const callsBeforeUnmount = mockGetRefreshStatus.mock.calls.length;
      expect(callsBeforeUnmount).toBeGreaterThan(0);

      view?.unmount();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20_000);
      });
      // The in-flight loop aborts on the next tick — no further status calls.
      expect(mockGetRefreshStatus.mock.calls).toHaveLength(callsBeforeUnmount);

      jest.useRealTimers();
    });

    it("shows error toast when refresh workflow reports a failure", async () => {
      mockRefresh.mockResolvedValue({ data: { refresh_group_id: "refresh-fail" } });
      mockGetRefreshStatus.mockResolvedValueOnce({
        data: {
          refresh_group_id: "refresh-fail",
          status: "failed",
          total: 1,
          completed: 1,
          failed: 1,
          in_progress: 0,
          error: "Upstream fetch failed: hotels: MCP request failed with status 502",
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTitle("Refresh prices"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("MCP request failed with status 502"),
        );
      });
    });
  });

  describe("initial price fetch (just-created trip)", () => {
    it("auto-polls the creation workflow and shows the fetching state", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, created_at: new Date().toISOString() },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // The in-flight initial fetch is surfaced instead of a bare empty state.
      await waitFor(() => {
        expect(screen.getByTestId("flights-fetching")).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(mockGetRefreshStatus).toHaveBeenCalledWith("price-check-test-trip");
        },
        { timeout: 3000 }
      );

      // Poll reports completed → details are refetched (the completion path
      // awaits the refetch before clearing the fetching state, so the spinner
      // disappearing proves the refetch ran — no SSE dependency).
      await waitFor(
        () => {
          expect(screen.queryByTestId("flights-fetching")).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it("does not auto-poll an old snapshot-less trip", async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData },
          price_history: [],
        },
      });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("No flight offers available")).toBeInTheDocument();
      });
      expect(mockGetRefreshStatus).not.toHaveBeenCalled();
    });
  });

  describe("SSE real-time updates", () => {
    beforeEach(() => {
      mockSSEContext.priceUpdates = [];
      mockGetDetails.mockResolvedValue({
        data: {
          trip: baseTripData,
          price_history: basePriceHistory,
        },
      });
    });

    afterEach(() => {
      mockSSEContext.priceUpdates = [];
    });

    it("renders correctly when SSE context has no updates", async () => {
      mockSSEContext.priceUpdates = [];

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });
    });

    it("handles SSE context with updates for different trips", async () => {
      // SSE update for a different trip should not affect this trip's display
      mockSSEContext.priceUpdates = [
        { trip_id: "other-trip", updated_at: "2025-01-22T12:00:00Z" },
      ];

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });
    });

    it("handles SSE context with updates for this trip", async () => {
      mockSSEContext.priceUpdates = [
        { trip_id: "test-trip", updated_at: "2025-01-22T12:00:00Z" },
      ];

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      // Verify the component rendered successfully with SSE data
      expect(mockGetDetails).toHaveBeenCalled();
    });

    it("renders when SSE context has null priceUpdates", async () => {
      // Test the case where priceUpdates is undefined/null
      const originalUpdates = mockSSEContext.priceUpdates;
      // @ts-expect-error Testing null case
      mockSSEContext.priceUpdates = null;

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });

      mockSSEContext.priceUpdates = originalUpdates;
    });

    it("handles empty tripId gracefully with SSE updates", async () => {
      mockSSEContext.priceUpdates = [
        { trip_id: "test-trip", updated_at: "2025-01-22T12:00:00Z" },
      ];

      await act(async () => {
        render(<TestWrapper tripId="" />);
      });

      // Component should still render (even with empty tripId)
      await waitFor(() => {
        expect(screen.getByText("Test Vacation")).toBeInTheDocument();
      });
    });

  });

  describe("flights list sorting and selection", () => {
    // Covers SortHeader onClick, all four sort keys, the comparator branches,
    // the flight-radio onSelectFlight path, and the lastKnownSelectedFlight
    // carry-forward in PriceHistoryChart (selected flight only in one snapshot).
    const sortFixtureHistory = [
      {
        id: "ph-now",
        flight_price: "150.00",
        hotel_price: null,
        total_price: "150.00",
        created_at: "2025-01-22T10:00:00Z",
        flight_offers: [
          {
            id: "f-ua",
            airline_code: "UA",
            airline_name: "United",
            flight_number: "100",
            price: "300.00",
            departure_time: "2025-06-15T14:00:00",
            arrival_time: "2025-06-15T16:30:00",
            duration_minutes: 150,
            stops: 1,
            itineraries: [
              {
                segments: [
                  {
                    flight_number: "100",
                    carrier_code: "UA",
                    departure_airport: "SFO",
                    arrival_airport: "DEN",
                    departure_time: "2025-06-15T14:00:00",
                    arrival_time: "2025-06-15T15:00:00",
                    duration_minutes: 60,
                  },
                ],
                total_duration_minutes: 60,
              },
            ],
          },
          {
            id: "f-dl",
            airline_code: "DL",
            airline_name: "Delta",
            flight_number: "200",
            price: "150.00",
            departure_time: "2025-06-15T08:00:00",
            arrival_time: "2025-06-15T10:30:00",
            duration_minutes: 150,
            stops: 0,
            itineraries: [
              {
                segments: [
                  {
                    flight_number: "200",
                    carrier_code: "DL",
                    departure_airport: "SFO",
                    arrival_airport: "LAX",
                    departure_time: "2025-06-15T08:00:00",
                    arrival_time: "2025-06-15T10:30:00",
                    duration_minutes: 150,
                  },
                ],
                total_duration_minutes: 150,
              },
            ],
          },
        ],
        hotel_offers: [],
      },
      {
        // Older snapshot without the selected flight — exercises the carry-
        // forward path in PriceHistoryChart when selectedFlight is absent.
        id: "ph-old",
        flight_price: "175.00",
        hotel_price: null,
        total_price: "175.00",
        created_at: "2025-01-20T10:00:00Z",
        flight_offers: [],
        hotel_offers: [],
      },
    ];

    const renderSortFixture = async () => {
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, hotel_prefs: null },
          price_history: sortFixtureHistory,
        },
      });
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => {
        expect(screen.getByText("Flights")).toBeInTheDocument();
      });
    };

    it("cycles sort direction when the active column is clicked twice", async () => {
      const user = userEvent.setup({ delay: null });
      await renderSortFixture();

      const priceHeader = screen.getByRole("button", { name: "Price" });
      // First click: already sort-by-price (default asc); dir flips to desc.
      await user.click(priceHeader);
      // Second click on same header: dir flips back to asc.
      await user.click(priceHeader);
      expect(priceHeader).toBeInTheDocument();
    });

    it("switches sort key to airline / time / stops", async () => {
      const user = userEvent.setup({ delay: null });
      await renderSortFixture();

      await user.click(screen.getByRole("button", { name: "Airline" }));
      await user.click(screen.getByRole("button", { name: "Time" }));
      await user.click(screen.getByRole("button", { name: "Stops" }));

      // All four sort keys exercised (price is the default); list is still rendered.
      expect(screen.getByText("United")).toBeInTheDocument();
      expect(screen.getByText("Delta")).toBeInTheDocument();
    });

    it("says the return is included for round-trip totals without an itemized return", async () => {
      const user = userEvent.setup({ delay: null });
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, hotel_prefs: null },
          price_history: [
            {
              id: "ph-ff",
              flight_price: "1585.00",
              hotel_price: null,
              total_price: "1585.00",
              created_at: "2026-07-16T10:30:00Z",
              provider: "fast_flights",
              flight_offers: [
                {
                  id: "0",
                  airline_code: "AS",
                  airline_name: "Alaska",
                  price: "1585.00",
                  departure_time: "2026-12-11T08:23:00",
                  arrival_time: "2026-12-11T11:48:00",
                  duration_minutes: 325,
                  stops: 0,
                  round_trip_total: true,
                  itineraries: [
                    {
                      direction: "outbound",
                      stops: 0,
                      segments: [
                        {
                          carrier_code: "AS",
                          flight_number: null,
                          departure_airport: "SFO",
                          arrival_airport: "OGG",
                          departure_time: "2026-12-11T08:23:00",
                          arrival_time: "2026-12-11T11:48:00",
                          duration_minutes: 325,
                        },
                      ],
                    },
                  ],
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => {
        expect(screen.getByText("Flights")).toBeInTheDocument();
      });

      // Collapsed header: the return row says the price already covers it.
      expect(screen.getByText("Included in price")).toBeInTheDocument();

      // Expanding shows the explanatory RETURN note instead of silence.
      await user.click(screen.getAllByRole("radio")[0]);
      await waitFor(() => {
        expect(screen.getByTestId("return-included-note")).toBeInTheDocument();
      });
      expect(
        screen.getByText(/included in the round-trip price/i)
      ).toBeInTheDocument();
    });

    it("renders the return option with a qualifier when a round-trip total carries return segments", async () => {
      const user = userEvent.setup({ delay: null });
      mockGetDetails.mockResolvedValue({
        data: {
          trip: { ...baseTripData, hotel_prefs: null },
          price_history: [
            {
              id: "ph-ff-ret",
              flight_price: "1585.00",
              hotel_price: null,
              total_price: "1585.00",
              created_at: "2026-07-16T10:30:00Z",
              provider: "fast_flights",
              flight_offers: [
                {
                  id: "0",
                  airline_code: "AS",
                  airline_name: "Alaska",
                  flight_number: "AS943",
                  price: "1585.00",
                  departure_time: "2026-12-11T08:23:00",
                  arrival_time: "2026-12-11T11:48:00",
                  duration_minutes: 325,
                  stops: 0,
                  round_trip_total: true,
                  return_flight: {
                    flight_number: "AS942",
                    departure_time: "2026-12-18T11:54:00",
                    arrival_time: "2026-12-18T19:05:00",
                    duration_minutes: 311,
                    stops: 0,
                  },
                  itineraries: [
                    {
                      direction: "outbound",
                      stops: 0,
                      segments: [
                        {
                          carrier_code: "AS",
                          flight_number: "AS943",
                          departure_airport: "SFO",
                          arrival_airport: "OGG",
                          departure_time: "2026-12-11T08:23:00",
                          arrival_time: "2026-12-11T11:48:00",
                          duration_minutes: 325,
                        },
                      ],
                    },
                    {
                      direction: "return",
                      stops: 0,
                      segments: [
                        {
                          carrier_code: "AS",
                          flight_number: "AS942",
                          departure_airport: "OGG",
                          arrival_airport: "SFO",
                          departure_time: "2026-12-18T11:54:00",
                          arrival_time: "2026-12-18T19:05:00",
                          duration_minutes: 311,
                        },
                      ],
                    },
                  ],
                },
              ],
              hotel_offers: [],
            },
          ],
        },
      });
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });
      await waitFor(() => {
        expect(screen.getByText("Flights")).toBeInTheDocument();
      });

      // With a real return itinerary the "included" placeholder is gone…
      expect(screen.queryByText("Included in price")).not.toBeInTheDocument();

      // …and expanding shows the return leg plus the pairing qualifier.
      await user.click(screen.getAllByRole("radio")[0]);
      await waitFor(() => {
        expect(screen.getByTestId("return-option-qualifier")).toBeInTheDocument();
      });
      expect(screen.getByText("AS942")).toBeInTheDocument();
      expect(screen.queryByTestId("return-included-note")).not.toBeInTheDocument();
    });

    it("shows no return-included row for offers with an itemized return or one-ways", async () => {
      const user = userEvent.setup({ delay: null });
      await renderSortFixture();

      // The sort fixture's offers are one-way/itemized shapes — no note anywhere.
      expect(screen.queryByText("Included in price")).not.toBeInTheDocument();
      await user.click(screen.getAllByRole("radio")[0]);
      expect(screen.queryByTestId("return-included-note")).not.toBeInTheDocument();
    });

    it("updates the selected flight when a radio row is clicked", async () => {
      const user = userEvent.setup({ delay: null });
      await renderSortFixture();

      // The cheapest flight (Delta, $150) is pre-selected; click United to switch.
      const radios = screen.getAllByRole("radio");
      expect(radios.length).toBeGreaterThanOrEqual(2);
      const unitedRadio = radios.find((r) => r.getAttribute("aria-checked") === "false");
      expect(unitedRadio).toBeDefined();
      await user.click(unitedRadio as HTMLElement);

      await waitFor(() => {
        // After selection flips, the previously-unchecked radio becomes checked.
        expect(unitedRadio).toHaveAttribute("aria-checked", "true");
      });
    });
  });
});
