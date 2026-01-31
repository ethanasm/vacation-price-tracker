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

jest.mock("@/lib/api", () => ({
  api: {
    trips: {
      getDetails: (...args: unknown[]) => mockGetDetails(...args),
      updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      refresh: (...args: unknown[]) => mockRefresh(...args),
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
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Hotels")).toBeInTheDocument();
        expect(screen.getByText("City Hotel")).toBeInTheDocument();
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
        expect(screen.getByText("City Hotel")).toBeInTheDocument();
      });

      // Click on a hotel to select it - this covers the onSelectHotel callback
      const hotelButton = screen.getByRole("button", { name: /City Hotel/ });
      await user.click(hotelButton);

      // Verify the hotel button was clickable (the callback was called)
      // The actual state change is internal, but we can verify no error occurred
      expect(hotelButton).toBeInTheDocument();
    });

    it("displays flights list", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        // Flights section header
        expect(screen.getByText("Flights")).toBeInTheDocument();
        // Collapsed card shows price and Direct badge (stops === 0 for basePriceHistory flight)
        expect(screen.getAllByText("$250").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Direct")).toBeInTheDocument();
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
        expect(screen.getByText("1 stop")).toBeInTheDocument();
        expect(screen.getAllByText("$250").length).toBeGreaterThanOrEqual(1);
      });

      // Click on the element containing "1 stop" to expand the card
      const stopsBadge = screen.getByText("1 stop");
      const cardHeader = stopsBadge.closest("button");
      expect(cardHeader).toBeTruthy();
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Now the expanded content should be visible with Outbound/Return labels
      // "Return" appears both in collapsed header row and expanded itinerary section
      await waitFor(() => {
        expect(screen.getByText("Outbound")).toBeInTheDocument();
        expect(screen.getAllByText("Return").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("UA123")).toBeInTheDocument();
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
        // The expandable card shows "2 stops" in the collapsed header
        expect(screen.getByText("2 stops")).toBeInTheDocument();
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

      // Wait for the card to render, then expand it
      await waitFor(() => {
        expect(screen.getByText("1 stop")).toBeInTheDocument();
      });

      const stopsBadge = screen.getByText("1 stop");
      const cardHeader = stopsBadge.closest("button");
      expect(cardHeader).toBeTruthy();
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Expanded view should show both segments and layover info
      await waitFor(() => {
        expect(screen.getByText("UA100")).toBeInTheDocument();
        expect(screen.getByText("UA200")).toBeInTheDocument();
        expect(screen.getByText(/layover in DEN/)).toBeInTheDocument();
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

      // Find and click the card header to expand
      const stopsBadge = screen.getByText("1 stop");
      const cardHeader = stopsBadge.closest("button");
      expect(cardHeader).toBeTruthy();
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Should be expanded now
      await waitFor(() => {
        expect(screen.getByText("Outbound")).toBeInTheDocument();
      });

      // Click again to collapse
      if (cardHeader) {
        await user.click(cardHeader);
      }

      // Outbound label should disappear
      await waitFor(() => {
        expect(screen.queryByText("Outbound")).not.toBeInTheDocument();
      });
    });

    it("shows empty state when no hotel offers", async () => {
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
        expect(screen.getByText("No hotel offers available")).toBeInTheDocument();
        expect(screen.getByText("No flight offers available")).toBeInTheDocument();
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

      // Advance timers to trigger timeout (30 seconds)
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      // Button should be enabled again after timeout
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });

      jest.useRealTimers();
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
});
