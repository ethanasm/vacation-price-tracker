import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { HotelPrefsSection } from "../components/trip-form/hotel-prefs-section";
import { baseTripFormData } from "@/lib/fixtures/trip-form";

jest.mock("../components/trip-form/hotel-prefs-section.module.css", () => new Proxy({}, {
  get: (_target, prop) => prop,
}));

jest.mock("../components/trip-form/collapsible-section", () => ({
  CollapsibleSection: ({
    title,
    badge,
    isOpen,
    onToggle,
    children,
  }: {
    title: string;
    badge?: string;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
  }) => (
    <section data-testid="collapsible" data-open={isOpen} data-badge={badge}>
      <button type="button" onClick={onToggle}>
        {title}
      </button>
      {children}
    </section>
  ),
}));

jest.mock("../components/trip-form/tag-input", () => ({
  TagInput: ({
    tags,
    placeholder,
    id,
    disabled,
  }: {
    tags: string[];
    placeholder: string;
    id?: string;
    disabled?: boolean;
  }) => (
    <div data-testid={`tag-input-${id ?? "default"}`}>
      <span>{placeholder}</span>
      <span>{tags.join(",")}</span>
      {/* expose a combobox role so "disables all inner controls" test can find it */}
      <select disabled={disabled} aria-label={`tag-select-${id}`} />
    </div>
  ),
}));

jest.mock("../components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

jest.mock("../components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    disabled,
    placeholder,
  }: React.InputHTMLAttributes<HTMLInputElement> & { id?: string }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
    />
  ),
}));

jest.mock("../components/ui/select", () => ({
  Select: ({
    children,
    disabled,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    disabled?: boolean;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

describe("HotelPrefsSection", () => {
  it("renders hotel preference controls", () => {
    render(
      <HotelPrefsSection
        isOpen
        rooms={baseTripFormData.hotelPrefs.rooms}
        adultsPerRoom={baseTripFormData.hotelPrefs.adultsPerRoom}
        roomSelectionMode={baseTripFormData.hotelPrefs.roomSelectionMode}
        roomTypes={baseTripFormData.hotelPrefs.roomTypes}
        views={baseTripFormData.hotelPrefs.views}
        minStarRating={baseTripFormData.hotelPrefs.minStarRating}
        onToggle={jest.fn()}
        onRoomsChange={jest.fn()}
        onAdultsPerRoomChange={jest.fn()}
        onRoomSelectionModeChange={jest.fn()}
        onRoomTypesChange={jest.fn()}
        onViewsChange={jest.fn()}
        onMinStarRatingChange={jest.fn()}
      />
    );

    expect(screen.getByText("Hotel Preferences")).toBeInTheDocument();
    expect(screen.getByText("Rooms")).toBeInTheDocument();
    expect(screen.getByText("Adults per Room")).toBeInTheDocument();
    expect(screen.getByText("Room Selection")).toBeInTheDocument();
    expect(screen.getByText("Preferred Room Types")).toBeInTheDocument();
    expect(screen.getByText("Preferred Views")).toBeInTheDocument();
    expect(screen.getByTestId("tag-input-room-types")).toBeInTheDocument();
    expect(screen.getByTestId("tag-input-views")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// New tests: Track Hotel Prices checkbox + City field
// ---------------------------------------------------------------------------

function setup(trackEnabled = true, city = "Miami Beach") {
  const props = {
    isOpen: true,
    trackEnabled,
    rooms: "1",
    adultsPerRoom: "2",
    city,
    cityError: undefined as string | undefined,
    roomSelectionMode: "cheapest",
    roomTypes: [] as string[],
    views: [] as string[],
    minStarRating: "any",
    onToggle: jest.fn(),
    onTrackEnabledChange: jest.fn(),
    onRoomsChange: jest.fn(),
    onAdultsPerRoomChange: jest.fn(),
    onCityChange: jest.fn(),
    onRoomSelectionModeChange: jest.fn(),
    onRoomTypesChange: jest.fn(),
    onViewsChange: jest.fn(),
    onMinStarRatingChange: jest.fn(),
  };
  render(<HotelPrefsSection {...props} />);
  return props;
}

describe("HotelPrefsSection – Track Hotel Prices & City field", () => {
  it("renders Track Hotel Prices checkbox", () => {
    setup(true);
    expect(
      screen.getByRole("checkbox", { name: /track hotel prices/i })
    ).toBeInTheDocument();
  });

  it("renders a City text input with the current value", () => {
    setup(true, "Honolulu");
    const cityInput = screen.getByLabelText(/city/i) as HTMLInputElement;
    expect(cityInput.value).toBe("Honolulu");
  });

  it("calls onCityChange when the user types", async () => {
    const user = userEvent.setup();
    const props = setup(true, "");
    const cityInput = screen.getByLabelText(/city/i);
    await user.type(cityInput, "T");
    expect(props.onCityChange).toHaveBeenCalledWith("T");
  });

  it("disables all inner controls when trackEnabled is false", () => {
    setup(false);
    expect(screen.getByLabelText(/city/i)).toBeDisabled();
    const combos = screen.getAllByRole("combobox");
    for (const c of combos) expect(c).toBeDisabled();
  });

  it("calls onTrackEnabledChange when checkbox toggled", async () => {
    const user = userEvent.setup();
    const props = setup(true);
    await user.click(
      screen.getByRole("checkbox", { name: /track hotel prices/i })
    );
    expect(props.onTrackEnabledChange).toHaveBeenCalledWith(false);
  });
});
