import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlightPrefsSection } from "../components/trip-form/flight-prefs-section";

function setup(trackEnabled = true) {
  const onTrackChange = jest.fn();
  const onToggle = jest.fn();
  render(
    <FlightPrefsSection
      isOpen
      trackEnabled={trackEnabled}
      cabin="economy"
      stopsMode="any"
      airlines={[]}
      onTrackEnabledChange={onTrackChange}
      onToggle={onToggle}
      onCabinChange={jest.fn()}
      onStopsModeChange={jest.fn()}
      onAirlinesChange={jest.fn()}
    />
  );
  return { onTrackChange };
}

describe("FlightPrefsSection tracking checkbox", () => {
  it("renders a Track Flight Prices checkbox at the top", () => {
    setup(true);
    expect(
      screen.getByRole("checkbox", { name: /track flight prices/i })
    ).toBeInTheDocument();
  });

  it("calls onTrackEnabledChange when toggled", async () => {
    const user = userEvent.setup();
    const { onTrackChange } = setup(true);
    await user.click(screen.getByRole("checkbox", { name: /track flight prices/i }));
    expect(onTrackChange).toHaveBeenCalledWith(false);
  });

  it("disables inner selects when track is off", () => {
    setup(false);
    // The shadcn Select uses a button[role=combobox] for its trigger
    const triggers = screen.getAllByRole("combobox");
    for (const trigger of triggers) {
      expect(trigger).toBeDisabled();
    }
  });
});
