import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TripFormSetters } from "../components/trip-form/types";
import CreateTripPage from "../app/trips/new/page";
import {
  baseTripFormData,
  emptyTripFormErrors,
  tripPayloadFixture,
} from "@/lib/fixtures/trip-form";

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

const mockUseTripForm = jest.fn();

jest.mock("../lib/hooks/use-trip-form", () => ({
  useTripForm: () => mockUseTripForm(),
}));

jest.mock("../components/trip-form", () => ({
  TripDetailsSection: () => <div data-testid="trip-details-section" />,
  FlightPrefsSection: () => <div data-testid="flight-prefs-section" />,
  HotelPrefsSection: () => <div data-testid="hotel-prefs-section" />,
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
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const getPayload = jest.fn().mockReturnValue(tripPayloadFixture);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);

    mockUseTripForm.mockReturnValue(
      createHookReturn({
        getPayload,
      })
    );

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    await act(async () => {
      jest.runAllTimers();
    });

    const { toast } = jest.requireMock("sonner");
    expect(getPayload).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Creating trip with payload:", tripPayloadFixture);
    expect(toast.success).toHaveBeenCalledWith("Trip created successfully!");
    expect(mockPush).toHaveBeenCalledWith("/trips");

    logSpy.mockRestore();
    jest.useRealTimers();
  });

  it("shows an error toast when submission fails", async () => {
    const user = userEvent.setup();
    const logSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {
        throw new Error("log failed");
      });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    mockUseTripForm.mockReturnValue(createHookReturn());

    render(<CreateTripPage />);

    await user.click(screen.getByRole("button", { name: "Create Trip" }));

    const { toast } = jest.requireMock("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to create trip. Please try again.");
    expect(errorSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

});
