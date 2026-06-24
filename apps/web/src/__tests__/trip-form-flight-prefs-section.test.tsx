import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { FlightPrefsSection } from "../components/trip-form/flight-prefs-section";

jest.mock("../components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <button type="button" data-testid={`select-${value}`} onClick={() => onValueChange(value)}>
      {children}
    </button>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>Select</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("../components/trip-form/flight-prefs-section.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

jest.mock("../components/trip-form/tag-input.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

describe("FlightPrefsSection", () => {
  it("renders cabin and airline inputs", async () => {
    const user = userEvent.setup();
    const onCabinChange = jest.fn();
    const onStopsModeChange = jest.fn();
    const onAirlinesChange = jest.fn();

    render(
      <FlightPrefsSection
        isOpen
        trackEnabled={true}
        cabin="economy"
        stopsMode="any"
        airlines={[]}
        onToggle={jest.fn()}
        onTrackEnabledChange={jest.fn()}
        onCabinChange={onCabinChange}
        onStopsModeChange={onStopsModeChange}
        onAirlinesChange={onAirlinesChange}
      />
    );

    expect(screen.getByText("Flight Preferences")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type airline codes (e.g., UA, AA, DL)")).toBeInTheDocument();

    // Cabin class is rendered as pill chip buttons (aria-pressed marks selection).
    const economyChip = screen.getByRole("button", { name: /^Economy$/i });
    expect(economyChip).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /Premium Economy/i }));
    expect(onCabinChange).toHaveBeenCalledWith("premium_economy");

    await user.click(screen.getByTestId("select-any"));
    expect(onStopsModeChange).toHaveBeenCalledWith("any");
  });
});
