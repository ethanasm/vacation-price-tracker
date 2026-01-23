import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { TripDetailsSection } from "../components/trip-form/trip-details-section";
import type { TripFormErrors } from "../components/trip-form/types";
import {
  baseTripFormData,
  emptyTripFormErrors,
  tripFormErrorsFixture,
} from "@/lib/fixtures/trip-form";

jest.mock("../components/trip-form/trip-details-section.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

jest.mock("../components/ui/date-picker", () => ({
  DatePicker: ({
    placeholder,
    onSelect: _onSelect,
  }: {
    placeholder?: string;
    onSelect: (date: Date | undefined) => void;
  }) => <button type="button">{placeholder}</button>,
}));

jest.mock("../components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => <div data-value={value}>{children}</div>,
}));

const mockSearchLocations = jest.fn().mockResolvedValue([]);

const renderTripDetails = (errors: TripFormErrors) => {
  const handlers = {
    onNameChange: jest.fn(),
    onOriginAirportChange: jest.fn(),
    onDestinationCodeChange: jest.fn(),
    onIsRoundTripChange: jest.fn(),
    onDepartDateChange: jest.fn(),
    onReturnDateChange: jest.fn(),
    onAdultsChange: jest.fn(),
  };

  render(
    <TripDetailsSection
      name={baseTripFormData.name}
      originAirport={baseTripFormData.originAirport}
      destinationCode={baseTripFormData.destinationCode}
      isRoundTrip={baseTripFormData.isRoundTrip}
      departDate={baseTripFormData.departDate}
      returnDate={baseTripFormData.returnDate}
      adults={baseTripFormData.adults}
      errors={errors}
      onNameChange={handlers.onNameChange}
      onOriginAirportChange={handlers.onOriginAirportChange}
      onDestinationCodeChange={handlers.onDestinationCodeChange}
      onIsRoundTripChange={handlers.onIsRoundTripChange}
      onDepartDateChange={handlers.onDepartDateChange}
      onReturnDateChange={handlers.onReturnDateChange}
      onAdultsChange={handlers.onAdultsChange}
      searchLocations={mockSearchLocations}
    />
  );

  return handlers;
};

describe("TripDetailsSection", () => {
  it("renders trip details fields", () => {
    renderTripDetails(emptyTripFormErrors);

    expect(screen.getByText("Trip Details")).toBeInTheDocument();
    expect(screen.getByLabelText("Trip Name")).toBeInTheDocument();
    expect(screen.getByLabelText("From (Airport)")).toBeInTheDocument();
    expect(screen.getByLabelText("To (Airport)")).toBeInTheDocument();
    expect(screen.getByText("Departure Date")).toBeInTheDocument();
    expect(screen.getByText("Return Date")).toBeInTheDocument();
    expect(screen.getByText("Number of Travelers")).toBeInTheDocument();
    expect(screen.getByText("Trip Type")).toBeInTheDocument();
  });

  it("shows validation errors when provided", () => {
    renderTripDetails(tripFormErrorsFixture);

    expect(screen.getByText(tripFormErrorsFixture.name as string)).toBeInTheDocument();
    expect(
      screen.getAllByText(tripFormErrorsFixture.originAirport as string)
    ).toHaveLength(2);
    expect(
      screen.getByText(tripFormErrorsFixture.departDate as string)
    ).toBeInTheDocument();
    expect(
      screen.getByText(tripFormErrorsFixture.returnDate as string)
    ).toBeInTheDocument();
  });

  it("normalizes airport codes on change", () => {
    const handlers = renderTripDetails(emptyTripFormErrors);

    fireEvent.change(screen.getByLabelText("From (Airport)"), {
      target: { value: "sfo" },
    });
    fireEvent.change(screen.getByLabelText("To (Airport)"), {
      target: { value: "hnl" },
    });

    // The autocomplete component converts to uppercase
    expect(handlers.onOriginAirportChange).toHaveBeenCalledWith("SFO");
    expect(handlers.onDestinationCodeChange).toHaveBeenCalledWith("HNL");
  });

  it("updates the trip name", () => {
    const handlers = renderTripDetails(emptyTripFormErrors);

    fireEvent.change(screen.getByLabelText("Trip Name"), {
      target: { value: "Updated Trip" },
    });

    expect(handlers.onNameChange).toHaveBeenCalledWith("Updated Trip");
  });
});
