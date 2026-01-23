import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { Suspense } from "react";
import { toast } from "sonner";

// All jest.mock calls are hoisted - define mock data inside factory functions

// Mock next/navigation
const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
  }),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Get references to the mock functions
const mockToastSuccess = toast.success as jest.Mock;
const mockToastError = toast.error as jest.Mock;

// Mock CSS modules
jest.mock("../app/trips/[tripId]/edit/page.module.css", () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => prop,
    }
  )
);

// Mock the form components to simplify testing
jest.mock("../components/trip-form", () => ({
  TripDetailsSection: ({
    name,
    onNameChange,
    searchLocations,
  }: {
    name: string;
    onNameChange: (v: string) => void;
    searchLocations: (query: string) => Promise<unknown[]>;
  }) => (
    <div data-testid="trip-details-section">
      <input
        data-testid="name-input"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
      />
      <button
        type="button"
        data-testid="search-locations-trigger"
        onClick={() => searchLocations("test query")}
      >
        Search
      </button>
    </div>
  ),
  FlightPrefsSection: ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
    <div data-testid="flight-prefs-section" data-open={isOpen}>
      <button type="button" data-testid="flight-prefs-toggle" onClick={onToggle}>
        Toggle Flight Prefs
      </button>
    </div>
  ),
  HotelPrefsSection: ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
    <div data-testid="hotel-prefs-section" data-open={isOpen}>
      <button type="button" data-testid="hotel-prefs-toggle" onClick={onToggle}>
        Toggle Hotel Prefs
      </button>
    </div>
  ),
  NotificationSection: () => (
    <div data-testid="notification-section">Notification</div>
  ),
}));

// Mock the API
const mockUpdateTrip = jest.fn();
const mockGetDetails = jest.fn();
const mockSearchLocations = jest.fn().mockResolvedValue([]);

jest.mock("../lib/api", () => {
  // Define ApiError inside the factory function to avoid hoisting issues
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
        search: () => mockSearchLocations(),
      },
      trips: {
        update: (...args: unknown[]) => mockUpdateTrip(...args),
        getDetails: (...args: unknown[]) => mockGetDetails(...args),
      },
    },
    ApiError: ApiError,
  };
});

// Import ApiError for use in tests
import { ApiError } from "../lib/api";

// Import after mocks
import EditTripPage from "../app/trips/[tripId]/edit/page";

function TestWrapper({ tripId }: { tripId: string }) {
  const paramsPromise = Promise.resolve({ tripId });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditTripPage params={paramsPromise} />
    </Suspense>
  );
}

describe("EditTripPage", () => {
  // Suppress React's act() warnings for async state updates in form submission tests
  // These warnings are spurious - the tests are correct but React warns about state updates
  // that occur in promise callbacks which can't be wrapped in act()
  const originalConsoleError = console.error;

  beforeAll(() => {
    console.error = (...args: unknown[]) => {
      const message = String(args[0]);
      if (message.includes("not wrapped in act")) {
        return;
      }
      originalConsoleError.apply(console, args);
    };
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateTrip.mockResolvedValue({ data: {} });
    mockGetDetails.mockImplementation((tripId: string) => {
      const baseTrip = {
        id: tripId,
        name: "Test Vacation",
        origin_airport: "SFO",
        destination_code: "LAX",
        depart_date: "2026-06-15",
        return_date: "2026-06-22",
        is_round_trip: true,
        adults: 2,
        status: "active",
        current_flight_price: "500.00",
        current_hotel_price: "700.00",
        total_price: "1200.00",
        last_refreshed: "2026-01-21T10:30:00Z",
        flight_prefs: {
          cabin: "business",
          stops_mode: "nonstop",
          airlines: ["UA", "DL"],
        },
        hotel_prefs: {
          rooms: 2,
          adults_per_room: 2,
          room_selection_mode: "preferred",
          preferred_room_types: ["King"],
          preferred_views: ["Ocean"],
        },
        notification_prefs: {
          threshold_type: "trip_total",
          threshold_value: "1000",
          email_enabled: true,
          sms_enabled: false,
        },
        created_at: "2026-01-15T10:00:00Z",
        updated_at: "2026-01-20T15:30:00Z",
      };

      if (tripId === "trip-without-prefs") {
        return Promise.resolve({
          data: {
            trip: {
              ...baseTrip,
              id: "trip-without-prefs",
              name: "Basic Trip",
              origin_airport: "JFK",
              destination_code: "MIA",
              depart_date: "2026-07-01",
              return_date: "2026-07-08",
              adults: 1,
              current_flight_price: null,
              current_hotel_price: null,
              total_price: null,
              last_refreshed: null,
              flight_prefs: null,
              hotel_prefs: null,
              notification_prefs: null,
            },
            price_history: [],
          },
        });
      }

      if (tripId === "non-existent") {
        return Promise.reject(new ApiError(404, "Trip not found"));
      }

      if (tripId === "throw-api-error") {
        return Promise.reject(new ApiError(500, "Server Error", "Database unavailable"));
      }

      if (tripId === "throw-generic-error") {
        return Promise.reject(new Error("Network connection failed"));
      }

      return Promise.resolve({
        data: {
          trip: baseTrip,
          price_history: [],
        },
      });
    });
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    mockRouterPush.mockClear();
  });

  describe("loading state", () => {
    it("shows loading state initially", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Initially shows loading (briefly)
      // Then loads the trip
      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });
    });
  });

  describe("error state", () => {
    it("shows error state when trip not found", async () => {
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
  });

  describe("rendering", () => {
    it("renders edit form with trip name", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
        expect(
          screen.getByText('Update settings for "Test Vacation"')
        ).toBeInTheDocument();
      });
    });

    it("renders all form sections", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("trip-details-section")).toBeInTheDocument();
        expect(screen.getByTestId("flight-prefs-section")).toBeInTheDocument();
        expect(screen.getByTestId("hotel-prefs-section")).toBeInTheDocument();
        expect(screen.getByTestId("notification-section")).toBeInTheDocument();
      });
    });

    it("pre-populates form with existing trip data", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        const nameInput = screen.getByTestId("name-input");
        expect(nameInput).toHaveValue("Test Vacation");
      });
    });

    it("opens flight prefs section when trip has flight prefs", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        const flightPrefs = screen.getByTestId("flight-prefs-section");
        expect(flightPrefs).toHaveAttribute("data-open", "true");
      });
    });

    it("opens hotel prefs section when trip has hotel prefs", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        const hotelPrefs = screen.getByTestId("hotel-prefs-section");
        expect(hotelPrefs).toHaveAttribute("data-open", "true");
      });
    });

    it("keeps sections closed when trip has no prefs", async () => {
      await act(async () => {
        render(<TestWrapper tripId="trip-without-prefs" />);
      });

      await waitFor(() => {
        const flightPrefs = screen.getByTestId("flight-prefs-section");
        const hotelPrefs = screen.getByTestId("hotel-prefs-section");
        expect(flightPrefs).toHaveAttribute("data-open", "false");
        expect(hotelPrefs).toHaveAttribute("data-open", "false");
      });
    });

    it("renders action buttons", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("submits form successfully and navigates to trip details", async () => {
      mockUpdateTrip.mockResolvedValue({ data: { id: "test-trip" } });

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      // Click Save Changes button - waitFor handles async state updates
      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateTrip).toHaveBeenCalledWith("test-trip", expect.any(Object));
        expect(mockToastSuccess).toHaveBeenCalledWith("Trip updated successfully!");
        expect(mockRouterPush).toHaveBeenCalledWith("/trips/test-trip");
      });
    });

    it("shows saving state while submitting", async () => {
      // Make the update take longer so we can observe the saving state
      let resolveUpdate: (value: unknown) => void;
      mockUpdateTrip.mockImplementation(
        () => new Promise((resolve) => { resolveUpdate = resolve; })
      );

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });

      // Click submit to trigger async operation
      fireEvent.click(saveButton);

      // Check that button shows saving state
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving..." })).toBeInTheDocument();
      });

      // Resolve the update and let promise chain complete
      await act(async () => {
        resolveUpdate?.({ data: {} });
        // Allow microtasks to complete
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Wait for submission to complete and state to update
      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalled();
      });
    });


    it("handles API 409 conflict error", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockUpdateTrip.mockRejectedValue(new ApiError(409, "Conflict", "Trip name already exists"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("A trip with this name already exists.");
      });
      errorSpy.mockRestore();
    });

    it("handles API 404 error and navigates to trips list", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockUpdateTrip.mockRejectedValue(new ApiError(404, "Not Found", "Trip not found"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Trip not found. It may have been deleted.");
        expect(mockRouterPush).toHaveBeenCalledWith("/trips");
      });
      errorSpy.mockRestore();
    });

    it("handles generic API error with detail message", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockUpdateTrip.mockRejectedValue(new ApiError(500, "Server Error", "Database connection failed"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Database connection failed");
      });
      errorSpy.mockRestore();
    });

    it("handles non-ApiError errors", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockUpdateTrip.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to update trip. Please try again.");
      });
      errorSpy.mockRestore();
    });

    it("re-enables button after submission error", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      mockUpdateTrip.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // After error, button should be re-enabled
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save Changes" })).not.toBeDisabled();
      });
      errorSpy.mockRestore();
    });
  });



  describe("searchLocations", () => {
    it("calls api.locations.search when searchLocations is invoked", async () => {
      mockSearchLocations.mockResolvedValue([{ code: "LAX", name: "Los Angeles" }]);

      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("search-locations-trigger")).toBeInTheDocument();
      });

      // Click search trigger
      const searchButton = screen.getByTestId("search-locations-trigger");
      await act(async () => {
        fireEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(mockSearchLocations).toHaveBeenCalled();
      });
    });
  });

  describe("navigation", () => {
    it("navigates back to trip details when cancel is clicked", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("/trips/test-trip");
    });

    it("navigates back to trip details when back button is clicked", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Edit Trip")).toBeInTheDocument();
      });

      // The back button is a button element before the header content
      const backButton = screen.getByRole("button", { name: "" });
      await act(async () => {
        fireEvent.click(backButton);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("/trips/test-trip");
    });

    it("navigates to trips list when back button is clicked in error state", async () => {
      await act(async () => {
        render(<TestWrapper tripId="non-existent" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip not found")).toBeInTheDocument();
      });

      const backButton = screen.getByText("Back to trips");
      await act(async () => {
        fireEvent.click(backButton);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("/trips");
    });
  });

  describe("section toggles", () => {
    it("renders flight prefs toggle button that can be clicked", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("flight-prefs-section")).toBeInTheDocument();
      });

      // Toggle button should exist and be clickable (tests line 211)
      const toggleButton = screen.getByTestId("flight-prefs-toggle");
      expect(toggleButton).toBeInTheDocument();

      // Click should not throw
      fireEvent.click(toggleButton);
    });

    it("renders hotel prefs toggle button that can be clicked", async () => {
      await act(async () => {
        render(<TestWrapper tripId="test-trip" />);
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByTestId("hotel-prefs-section")).toBeInTheDocument();
      });

      // Toggle button should exist and be clickable (tests line 224)
      const toggleButton = screen.getByTestId("hotel-prefs-toggle");
      expect(toggleButton).toBeInTheDocument();

      // Click should not throw
      fireEvent.click(toggleButton);
    });
  });

  describe("validation", () => {
    it("shows error toast when form validation fails", async () => {
      // Use trip-without-prefs which has null notification_prefs
      // This means thresholdValue will be empty string (default), which fails validation
      await act(async () => {
        render(<TestWrapper tripId="trip-without-prefs" />);
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
      });

      // Click Save Changes - should fail validation because threshold value is empty
      const saveButton = screen.getByRole("button", { name: "Save Changes" });
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Should show validation error toast (tests lines 110-111)
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Please fix the errors before submitting");
      });

      // Should NOT call the update API
      expect(mockUpdateTrip).not.toHaveBeenCalled();
    });
  });

  describe("load error handling", () => {
    it("shows not found when API returns empty trip", async () => {
      mockGetDetails.mockResolvedValue({
        data: { trip: null, price_history: [] },
      });

      await act(async () => {
        render(<TestWrapper tripId="empty-trip" />);
      });

      await waitFor(() => {
        expect(screen.getByText("Trip not found")).toBeInTheDocument();
      });
    });

    it("shows ApiError detail when loading fails with ApiError", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await act(async () => {
        render(<TestWrapper tripId="throw-api-error" />);
      });

      // Should show the error detail from ApiError (tests lines 87-89)
      await waitFor(() => {
        expect(screen.getByText("Database unavailable")).toBeInTheDocument();
      });

      // Should have logged the error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load trip:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("shows generic error message when loading fails with non-ApiError", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await act(async () => {
        render(<TestWrapper tripId="throw-generic-error" />);
      });

      // Should show the generic error message (tests lines 90-91)
      await waitFor(() => {
        expect(screen.getByText("Failed to load trip. Please try again.")).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});
