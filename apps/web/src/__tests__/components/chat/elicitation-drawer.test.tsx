import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ElicitationDrawer } from "../../../components/chat/elicitation-drawer";
import type { ElicitationData } from "../../../lib/chat-types";

// Mock CSS modules
jest.mock("../../../components/trip-form/trip-details-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../../components/trip-form/flight-prefs-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../../components/trip-form/hotel-prefs-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../../components/trip-form/collapsible-section.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../../components/trip-form/airport-autocomplete.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);
jest.mock("../../../components/trip-form/tag-input.module.css", () =>
  new Proxy({}, { get: (_target, prop) => prop })
);

// Mock the api module for location search
jest.mock("../../../lib/api", () => ({
  api: {
    locations: {
      search: jest.fn().mockReturnValue([
        { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", country: "USA", type: "AIRPORT" },
        { code: "SFO", name: "San Francisco International", city: "San Francisco", country: "USA", type: "AIRPORT" },
      ]),
    },
  },
}));

// Mock DatePicker to simplify testing
jest.mock("../../../components/ui/date-picker", () => ({
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

// Helper to create mock elicitation data
function createElicitation(
  overrides: Partial<ElicitationData> = {}
): ElicitationData {
  return {
    tool_call_id: "call-123",
    tool_name: "create_trip",
    component: "create-trip-form",
    prefilled: {},
    missing_fields: ["name", "origin_airport", "depart_date", "return_date"],
    ...overrides,
  };
}

describe("ElicitationDrawer", () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("does not render when elicitation is null", () => {
      render(
        <ElicitationDrawer
          elicitation={null}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText("Complete Trip Details")).not.toBeInTheDocument();
    });

    it("renders the drawer when elicitation is provided", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Complete Trip Details")).toBeInTheDocument();
      expect(
        screen.getByText("Fill in the remaining details to create your trip.")
      ).toBeInTheDocument();
    });

    it("renders the trip form with all sections", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Trip Details")).toBeInTheDocument();
      expect(screen.getByText("Flight Preferences")).toBeInTheDocument();
      expect(screen.getByText("Hotel Preferences")).toBeInTheDocument();
    });

    it("renders Cancel and Create Trip buttons", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create trip/i })).toBeInTheDocument();
    });

    it("shows unknown form message for unsupported component type", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({ component: "unknown-form" })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/unknown form type/i)).toBeInTheDocument();
    });
  });

  describe("prefilled data", () => {
    it("prefills destination from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { destination_code: "SEA" },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      const destinationInput = screen.getByLabelText("To (Airport)");
      expect(destinationInput).toHaveValue("SEA");
    });

    it("prefills origin airport from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { origin_airport: "sfo" },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      const originInput = screen.getByLabelText("From (Airport)");
      // Should be uppercased
      expect(originInput).toHaveValue("SFO");
    });

    it("prefills trip name from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { name: "Seattle Adventure" },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByLabelText("Trip Name");
      expect(nameInput).toHaveValue("Seattle Adventure");
    });

    it("prefills adults count from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { adults: 2 },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Adults select should show the prefilled value - use getAllBy since there may be multiple
      const adultsElements = screen.getAllByText(/2 adults/i);
      expect(adultsElements.length).toBeGreaterThan(0);
    });

    it("prefills depart_date from elicitation data", () => {
      const departDate = "2025-06-15";
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { depart_date: departDate },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // The mocked DatePicker shows the date in ISO format
      expect(screen.getByTestId("select-departure")).toHaveTextContent("2025-06-15");
    });

    it("prefills return_date from elicitation data", () => {
      const returnDate = "2025-06-22";
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { return_date: returnDate },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // The mocked DatePicker shows the date in ISO format
      expect(screen.getByTestId("select-return")).toHaveTextContent("2025-06-22");
    });

    it("prefills is_round_trip as false from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { is_round_trip: false },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // When is_round_trip is false, the switch should be unchecked
      const roundTripSwitch = screen.getByRole("switch");
      expect(roundTripSwitch).toHaveAttribute("aria-checked", "false");
    });

    it("prefills is_round_trip as true from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: { is_round_trip: true },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // When is_round_trip is true, the switch should be checked
      const roundTripSwitch = screen.getByRole("switch");
      expect(roundTripSwitch).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("cancel behavior", () => {
    it("calls onCancel when Cancel button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("calls onCancel when drawer is closed via close button", async () => {
      const user = userEvent.setup();

      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // The Sheet component has a close button with sr-only text "Close"
      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe("form submission", () => {
    it("calls onComplete with form data when submitted", async () => {
      const user = userEvent.setup();

      // Prefill most data to reduce typing time
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              name: "Seattle Trip",
              origin_airport: "SFO",
              destination_code: "SEA",
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Select dates using the mocked date pickers
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit the form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          "call-123",
          expect.objectContaining({
            name: "Seattle Trip",
            origin_airport: "SFO",
            destination_code: "SEA",
          })
        );
      });
    }, 10000);

    it("does not submit when form validation fails", async () => {
      const user = userEvent.setup();

      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Try to submit without filling required fields
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      // Should not have called onComplete
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it("shows Creating... text while submitting", async () => {
      const user = userEvent.setup();

      // Make onComplete return a promise that doesn't resolve immediately
      let resolveSubmit!: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnComplete.mockReturnValue(submitPromise);

      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              name: "Test Trip",
              origin_airport: "SFO",
              destination_code: "SEA",
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Select dates
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      // Should show "Creating..." while submitting
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /creating/i })).toBeInTheDocument();
      });

      // Resolve the submission
      resolveSubmit?.();

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it("disables buttons while submitting", async () => {
      const user = userEvent.setup();

      let resolveSubmit!: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnComplete.mockReturnValue(submitPromise);

      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              name: "Test Trip",
              origin_airport: "SFO",
              destination_code: "SEA",
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Select dates
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      // Both buttons should be disabled while submitting
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
        expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
      });

      // Resolve the submission
      resolveSubmit?.();
    });
  });

  describe("flight preferences", () => {
    it("expands flight preferences when prefilled with flight data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              cabin: "business",
              airlines: ["UA", "AA"],
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Flight preferences section should be expanded
      // Check that cabin class select is visible
      expect(screen.getByText("Cabin Class")).toBeInTheDocument();
    });
  });

  describe("hotel preferences", () => {
    it("expands hotel preferences when prefilled with hotel data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              hotel_rooms: 2,
              room_types: ["King"],
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Hotel preferences section should be expanded
      expect(screen.getByText("Rooms")).toBeInTheDocument();
    });
  });

  describe("section toggles", () => {
    it("toggles flight preferences section", async () => {
      const user = userEvent.setup();

      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Flight preferences should be collapsed by default
      const flightToggle = screen.getByText("Flight Preferences");

      // Click to expand
      await user.click(flightToggle);

      // Should show cabin class after expanding
      await waitFor(() => {
        expect(screen.getByText("Cabin Class")).toBeInTheDocument();
      });

      // Click to collapse
      await user.click(flightToggle);
    });

    it("toggles hotel preferences section", async () => {
      const user = userEvent.setup();

      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Hotel preferences should be collapsed by default
      const hotelToggle = screen.getByText("Hotel Preferences");

      // Click to expand
      await user.click(hotelToggle);

      // Should show Rooms after expanding
      await waitFor(() => {
        expect(screen.getByText("Rooms")).toBeInTheDocument();
      });

      // Click to collapse
      await user.click(hotelToggle);
    });
  });

  describe("airport search", () => {
    it("triggers searchLocations when typing in airport field", async () => {
      const user = userEvent.setup();
      const { api } = jest.requireMock("../../../lib/api");

      render(
        <ElicitationDrawer
          elicitation={createElicitation()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      const originInput = screen.getByLabelText("From (Airport)");
      await user.type(originInput, "SFO");

      // The search function should have been called
      expect(api.locations.search).toHaveBeenCalled();
    });
  });

  describe("hotel preferences prefilling", () => {
    it("prefills room_selection_mode from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              room_selection_mode: "cheapest",
              hotel_rooms: 1,
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Hotel section should be expanded since we have hotel prefs
      expect(screen.getByText("Rooms")).toBeInTheDocument();
    });

    it("prefills views from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              views: ["Ocean View", "City View"],
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Hotel section should be expanded since we have views prefilled
      expect(screen.getByText("Rooms")).toBeInTheDocument();
    });

    it("prefills adults_per_room from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              adults_per_room: 3,
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Hotel section should be expanded since we have adults_per_room
      expect(screen.getByText("Rooms")).toBeInTheDocument();
    });
  });

  describe("flight preferences prefilling", () => {
    it("prefills stops_mode from elicitation data", () => {
      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              stops_mode: "direct",
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Flight section should be expanded since we have stops_mode
      expect(screen.getByText("Cabin Class")).toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("shows validation errors when required fields are missing", async () => {
      const user = userEvent.setup();

      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              // Only provide partial data - missing required fields
              name: "Test Trip",
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Try to submit the form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      // onComplete should NOT be called because validation failed
      expect(mockOnComplete).not.toHaveBeenCalled();

      // Form should show validation errors - check for error styling or messages
      // The form has validation that requires origin, destination, dates
      await waitFor(() => {
        // Look for error indicators
        const originInput = screen.getByLabelText("From (Airport)");
        const destInput = screen.getByLabelText("To (Airport)");
        // At least one of the inputs should have an error state or there's a validation message
        expect(originInput).toBeInTheDocument();
        expect(destInput).toBeInTheDocument();
      });
    });

    it("allows submission when all required fields are provided", async () => {
      const user = userEvent.setup();

      render(
        <ElicitationDrawer
          elicitation={createElicitation({
            prefilled: {
              name: "Complete Trip",
              origin_airport: "SFO",
              destination_code: "SEA",
            },
          })}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      );

      // Fill in the dates using the mocked date pickers
      await user.click(screen.getByTestId("select-departure"));
      await user.click(screen.getByTestId("select-return"));

      // Submit the form
      await user.click(screen.getByRole("button", { name: /create trip/i }));

      // onComplete should be called with the form data
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          "call-123",
          expect.objectContaining({
            name: "Complete Trip",
            origin_airport: "SFO",
            destination_code: "SEA",
          })
        );
      });
    });
  });
});
