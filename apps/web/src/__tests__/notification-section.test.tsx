import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { NotificationSection } from "../components/trip-form/notification-section";
import type { TripFormErrors } from "../components/trip-form/types";
import {
  baseTripFormData,
  emptyTripFormErrors,
  tripFormErrorsFixture,
} from "@/lib/fixtures/trip-form";

jest.mock("../components/trip-form/notification-section.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
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

const renderNotification = (errors: TripFormErrors) => {
  const handlers = {
    onThresholdTypeChange: jest.fn(),
    onThresholdValueChange: jest.fn(),
    onEmailEnabledChange: jest.fn(),
    onSmsEnabledChange: jest.fn(),
  };

  render(
    <NotificationSection
      thresholdType={baseTripFormData.notificationPrefs.thresholdType}
      thresholdValue={baseTripFormData.notificationPrefs.thresholdValue}
      emailEnabled={baseTripFormData.notificationPrefs.emailEnabled}
      smsEnabled={baseTripFormData.notificationPrefs.smsEnabled}
      errors={errors}
      onThresholdTypeChange={handlers.onThresholdTypeChange}
      onThresholdValueChange={handlers.onThresholdValueChange}
      onEmailEnabledChange={handlers.onEmailEnabledChange}
      onSmsEnabledChange={handlers.onSmsEnabledChange}
    />
  );

  return handlers;
};

describe("NotificationSection", () => {
  it("renders the alert controls", () => {
    renderNotification(emptyTripFormErrors);

    expect(screen.getByText("Price Alerts")).toBeInTheDocument();
    expect(screen.getByText("Alert me when")).toBeInTheDocument();
    expect(screen.getByText("Drops below")).toBeInTheDocument();
    expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    expect(screen.getByText("SMS Notifications")).toBeInTheDocument();
  });

  it("shows threshold validation errors", () => {
    renderNotification(tripFormErrorsFixture);

    expect(
      screen.getByText(tripFormErrorsFixture.thresholdValue as string)
    ).toBeInTheDocument();
  });

  it("updates the threshold value", () => {
    const handlers = renderNotification(emptyTripFormErrors);

    fireEvent.change(screen.getByPlaceholderText("2000"), {
      target: { value: "2500" },
    });

    expect(handlers.onThresholdValueChange).toHaveBeenCalledWith("2500");
  });
});
