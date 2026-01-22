import { render, screen } from "@testing-library/react";
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
  }: {
    tags: string[];
    placeholder: string;
    id?: string;
  }) => (
    <div data-testid={`tag-input-${id ?? "default"}`}>
      <span>{placeholder}</span>
      <span>{tags.join(",")}</span>
    </div>
  ),
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
        onToggle={jest.fn()}
        onRoomsChange={jest.fn()}
        onAdultsPerRoomChange={jest.fn()}
        onRoomSelectionModeChange={jest.fn()}
        onRoomTypesChange={jest.fn()}
        onViewsChange={jest.fn()}
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
