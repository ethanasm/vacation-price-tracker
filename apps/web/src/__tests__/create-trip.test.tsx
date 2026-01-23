import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TripFormSetters } from "../components/trip-form/types";
import CreateTripPage from "../app/trips/new/page";
import {
  baseTripFormData,
  emptyTripFormErrors,
  tripPayloadFixture,
} from "@/lib/fixtures/trip-form";

// Mock crypto.randomUUID for test environment
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => "test-uuid-1234",
  },
});

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockCreate = jest.fn();
const mockSearchLocations = jest.fn();

jest.mock("../lib/api", () => ({
  api: {
    trips: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    locations: {
      search: (...args: unknown[]) => mockSearchLocations(...args),
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

const mockUseTripForm = jest.fn();

jest.mock("../lib/hooks/use-trip-form", () => ({
  useTripForm: () => mockUseTripForm(),
}));

// Capture props passed to sections for testing callbacks
let capturedFlightPrefsProps: { onToggle?: () => void } = {};
let capturedHotelPrefsProps: { onToggle?: () => void } = {};
let capturedTripDetailsProps: { searchLocations?: (query: string) => Promise<unknown[]> } = {};

jest.mock("../components/trip-form", () => ({
  TripDetailsSection: (props: { searchLocations?: (query: string) => Promise<unknown[]> }) => {
    capturedTripDetailsProps = props;
    return <div data-testid="trip-details-section" />;
  },
  FlightPrefsSection: (props: { onToggle?: () => void }) => {
    capturedFlightPrefsProps = props;
    return <div data-testid="flight-prefs-section" />;
  },
  HotelPrefsSection: (props: { onToggle?: () => void }) => {
    capturedHotelPrefsProps = props;
    return <div data-testid="hotel-prefs-section" />;
  },
  NotificationSection: () => <div data-testid="notification-section" />,
}));

jest.mock("../app/trips/new/page.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

const createTripFormSetters = (): TripFormSetters => ({
  setName: jest.fn(),
  setOriginAirport: jest.fn(),
  setDestinationCode: jest.fn(),
  setIsRoundTrip: jest.fn(),
  setDepartDate: jest.fn(),
  setReturnDate: jest.fn(),
  setAdults: jest.fn(),
  setCabin: jest.fn(),
  setStopsMode: jest.fn(),
  setAirlines: jest.fn(),
  setRooms: jest.fn(),
  setAdultsPerRoom: jest.fn(),
  setRoomSelectionMode: jest.fn(),
  setRoomTypes: jest.fn(),
  setViews: jest.fn(),
  setThresholdType: jest.fn(),
  setThresholdValue: jest.fn(),
  setEmailEnabled: jest.fn(),
  setSmsEnabled: jest.fn(),
  setFlightPrefsOpen: jest.fn(),
  setHotelPrefsOpen: jest.fn(),
});

const createHookReturn = (overrides?: Partial<ReturnType<typeof mockUseTripForm>>) => ({
  formData: baseTripFormData,
  setters: createTripFormSetters(),
  errors: emptyTripFormErrors,
  validate: jest.fn().mockReturnValue(true),
  getPayload: jest.fn().mockReturnValue(tripPayloadFixture),
  ...overrides,
});

describe("CreateTripPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReset();
    mockSearchLocations.mockReset();
  });

  it("renders the trip form sections", () => {
    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    expect(screen.getByTestId("trip-details-section")).toBeInTheDocument();
    expect(screen.getByTestId("flight-prefs-section")).toBeInTheDocument();
    expect(screen.getByTestId("hotel-prefs-section")).toBeInTheDocument();
    expect(screen.getByTestId("notification-section")).toBeInTheDocument();
  });

  it("navigates back when the header button is clicked", async () => {
    const user = userEvent.setup();
    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    const backButton = screen.getAllByRole("button")[0];
    expect(backButton).toBeInTheDocument();

    await user.click(backButton);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("navigates back when cancel is clicked", async () => {
    const user = userEvent.setup();
    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("shows validation error when form is invalid", async () => {
    const user = userEvent.setup();
    const validate = jest.fn().mockReturnValue(false);
    const getPayload = jest.fn();

    mockUseTripForm.mockReturnValue(
      createHookReturn({
        validate,
        getPayload,
      })
    );

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    const { toast } = jest.requireMock("sonner");
    expect(toast.error).toHaveBeenCalledWith("Please fix the errors before submitting");
    expect(getPayload).not.toHaveBeenCalled();
  });

  it("submits and navigates on success", async () => {
    const user = userEvent.setup();
    const getPayload = jest.fn().mockReturnValue(tripPayloadFixture);
    mockCreate.mockResolvedValue({ data: { id: "test-trip-id" } });

    mockUseTripForm.mockReturnValue(
      createHookReturn({
        getPayload,
      })
    );

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    const { toast } = jest.requireMock("sonner");
    expect(getPayload).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(tripPayloadFixture, expect.any(String));
    expect(toast.success).toHaveBeenCalledWith("Trip created successfully!");
    expect(mockPush).toHaveBeenCalledWith("/trips");
  });

  it("shows an error toast when submission fails", async () => {
    const user = userEvent.setup();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockCreate.mockRejectedValue(new Error("API error"));

    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    const { toast } = jest.requireMock("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to create trip. Please try again.");
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("shows specific error for 409 ApiError (duplicate request)", async () => {
    const user = userEvent.setup();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { ApiError } = jest.requireMock("../lib/api");
    mockCreate.mockRejectedValue(new ApiError(409, "Duplicate", "Already processed"));

    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    const { toast } = jest.requireMock("sonner");
    expect(toast.error).toHaveBeenCalledWith("This request was already processed. Please try again.");
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("shows error detail for non-409 ApiError", async () => {
    const user = userEvent.setup();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { ApiError } = jest.requireMock("../lib/api");
    mockCreate.mockRejectedValue(new ApiError(400, "Bad Request", "Name is required"));

    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    const { toast } = jest.requireMock("sonner");
    expect(toast.error).toHaveBeenCalledWith("Name is required");
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("shows fallback message for ApiError without detail", async () => {
    const user = userEvent.setup();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    // Create a custom error object that mimics ApiError with empty detail
    const error = new Error("Server Error");
    Object.assign(error, { status: 500, detail: "", name: "ApiError" });
    // Manually set up the mock's ApiError check
    const { ApiError } = jest.requireMock("../lib/api");
    const errorWithEmptyDetail = Object.create(ApiError.prototype);
    Object.assign(errorWithEmptyDetail, { message: "Server Error", status: 500, detail: "" });
    mockCreate.mockRejectedValue(errorWithEmptyDetail);

    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    const { toast } = jest.requireMock("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to create trip. Please try again.");
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("calls setFlightPrefsOpen when flight prefs section is toggled", () => {
    const setFlightPrefsOpen = jest.fn();
    mockUseTripForm.mockReturnValue(
      createHookReturn({
        formData: { ...baseTripFormData, flightPrefsOpen: false },
        setters: { ...createTripFormSetters(), setFlightPrefsOpen },
      })
    );

    render(<CreateTripPage />);

    // Call the captured onToggle callback
    capturedFlightPrefsProps.onToggle?.();

    expect(setFlightPrefsOpen).toHaveBeenCalledWith(true);
  });

  it("calls setFlightPrefsOpen with false when already open", () => {
    const setFlightPrefsOpen = jest.fn();
    mockUseTripForm.mockReturnValue(
      createHookReturn({
        formData: { ...baseTripFormData, flightPrefsOpen: true },
        setters: { ...createTripFormSetters(), setFlightPrefsOpen },
      })
    );

    render(<CreateTripPage />);

    capturedFlightPrefsProps.onToggle?.();

    expect(setFlightPrefsOpen).toHaveBeenCalledWith(false);
  });

  it("calls setHotelPrefsOpen when hotel prefs section is toggled", () => {
    const setHotelPrefsOpen = jest.fn();
    mockUseTripForm.mockReturnValue(
      createHookReturn({
        formData: { ...baseTripFormData, hotelPrefsOpen: false },
        setters: { ...createTripFormSetters(), setHotelPrefsOpen },
      })
    );

    render(<CreateTripPage />);

    capturedHotelPrefsProps.onToggle?.();

    expect(setHotelPrefsOpen).toHaveBeenCalledWith(true);
  });

  it("calls setHotelPrefsOpen with false when already open", () => {
    const setHotelPrefsOpen = jest.fn();
    mockUseTripForm.mockReturnValue(
      createHookReturn({
        formData: { ...baseTripFormData, hotelPrefsOpen: true },
        setters: { ...createTripFormSetters(), setHotelPrefsOpen },
      })
    );

    render(<CreateTripPage />);

    capturedHotelPrefsProps.onToggle?.();

    expect(setHotelPrefsOpen).toHaveBeenCalledWith(false);
  });

  it("passes searchLocations function to TripDetailsSection", async () => {
    mockUseTripForm.mockReturnValue(createHookReturn());
    mockSearchLocations.mockResolvedValue([{ code: "SFO", name: "San Francisco" }]);

    render(<CreateTripPage />);

    expect(capturedTripDetailsProps.searchLocations).toBeDefined();

    const results = await capturedTripDetailsProps.searchLocations?.("SFO");

    expect(mockSearchLocations).toHaveBeenCalledWith("SFO");
    expect(results).toEqual([{ code: "SFO", name: "San Francisco" }]);
  });

});
