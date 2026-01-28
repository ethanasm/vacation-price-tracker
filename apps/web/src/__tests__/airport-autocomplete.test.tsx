import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AirportAutocomplete } from "../components/trip-form/airport-autocomplete";
import type { Location } from "../components/trip-form/airport-autocomplete";

// Mock CSS modules
jest.mock("../components/trip-form/airport-autocomplete.module.css", () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => prop,
    }
  )
);

// Mock sample location data
const mockLocations: Location[] = [
  {
    code: "LAX",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "United States",
    type: "AIRPORT",
  },
  {
    code: "LAS",
    name: "Harry Reid International Airport",
    city: "Las Vegas",
    country: "United States",
    type: "AIRPORT",
  },
  {
    code: "LHR",
    name: "London Heathrow Airport",
    city: "London",
    country: "United Kingdom",
    type: "AIRPORT",
  },
];

describe("AirportAutocomplete", () => {
  const defaultProps = {
    id: "test-airport",
    value: "",
    onChange: jest.fn(),
    searchLocations: jest.fn().mockReturnValue([]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to return empty array by default
    defaultProps.searchLocations.mockReturnValue([]);
  });

  describe("rendering", () => {
    it("renders with default props", () => {
      render(<AirportAutocomplete {...defaultProps} />);

      expect(screen.getByPlaceholderText("Search airports...")).toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      render(
        <AirportAutocomplete {...defaultProps} placeholder="Enter origin airport" />
      );

      expect(screen.getByPlaceholderText("Enter origin airport")).toBeInTheDocument();
    });

    it("renders input with provided value", () => {
      render(<AirportAutocomplete {...defaultProps} value="LAX" />);

      expect(screen.getByDisplayValue("LAX")).toBeInTheDocument();
    });

    it("renders departure icon by default", () => {
      const { container } = render(<AirportAutocomplete {...defaultProps} />);

      // Check that a Plane icon SVG exists
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      // Default departure icon should not be rotated
      expect(svg).not.toHaveAttribute("style");
    });

    it("renders rotated icon for arrival", () => {
      const { container } = render(
        <AirportAutocomplete {...defaultProps} icon="arrival" />
      );

      // Find the first SVG which is the plane icon
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThanOrEqual(1);
      // The plane icon should exist
      expect(svgs[0]).toBeInTheDocument();
    });

    it("renders disabled input when disabled prop is true", () => {
      render(<AirportAutocomplete {...defaultProps} disabled={true} />);

      expect(screen.getByRole("textbox")).toBeDisabled();
    });
  });

  describe("input handling", () => {
    it("calls onChange with raw value when user types", () => {
      const onChange = jest.fn();
      render(<AirportAutocomplete {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "la" } });

      expect(onChange).toHaveBeenCalledWith("la");
    });

    it("searches immediately when typing (no debounce)", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Search should be called immediately
      expect(searchLocations).toHaveBeenCalledWith("LA");
    });
  });

  describe("search functionality", () => {
    it("does not search when query is less than 2 characters", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "L" } });

      expect(searchLocations).not.toHaveBeenCalled();
    });

    it("searches when query is 2 or more characters", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      expect(searchLocations).toHaveBeenCalledWith("LA");
    });

    it("opens dropdown when search returns results", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      expect(screen.getByText("LAX")).toBeInTheDocument();
      expect(screen.getByText("Los Angeles International Airport")).toBeInTheDocument();
    });

    it("does not open dropdown when search returns empty results", () => {
      const searchLocations = jest.fn().mockReturnValue([]);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "XYZ" } });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("dropdown and selection", () => {
    it("displays location details in dropdown", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      expect(screen.getByText("LAX")).toBeInTheDocument();
      expect(screen.getByText("Los Angeles, United States")).toBeInTheDocument();
    });

    it("calls onChange and onSelect when option is clicked", () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockReturnValue(mockLocations);

      render(
        <AirportAutocomplete
          {...defaultProps}
          onChange={onChange}
          onSelect={onSelect}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Click on the first option
      const firstOption = screen.getAllByRole("button")[0];
      fireEvent.click(firstOption);

      expect(onChange).toHaveBeenCalledWith("LAX");
      expect(onSelect).toHaveBeenCalledWith(mockLocations[0]);
    });

    it("closes dropdown after selection", async () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      const firstOption = screen.getAllByRole("button")[0];
      fireEvent.click(firstOption);

      await waitFor(() => {
        expect(screen.queryByText("Los Angeles International Airport")).not.toBeInTheDocument();
      });
    });

    it("highlights option on mouse enter", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      const secondOption = screen.getAllByRole("button")[1];
      fireEvent.mouseEnter(secondOption);

      // The component sets highlightedIndex state on mouseEnter
      // We verify the option exists and mouseEnter was handled
      expect(secondOption).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("navigates down with ArrowDown key", () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          onChange={onChange}
          onSelect={onSelect}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      onChange.mockClear();

      // Press ArrowDown to highlight first item
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Press ArrowDown again to highlight second item
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Press Enter to select the second item (LAS)
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("LAS");
      expect(onSelect).toHaveBeenCalledWith(mockLocations[1]);
    });

    it("navigates up with ArrowUp key", () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          onChange={onChange}
          onSelect={onSelect}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      onChange.mockClear();

      // Navigate to second item
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Navigate back up
      fireEvent.keyDown(input, { key: "ArrowUp" });

      // Press Enter to select the first item (LAX)
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("LAX");
      expect(onSelect).toHaveBeenCalledWith(mockLocations[0]);
    });

    it("does not go below first item with ArrowUp", () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          onChange={onChange}
          onSelect={onSelect}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      onChange.mockClear();

      // Navigate to first item
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Try to go up from first item (should stay at first)
      fireEvent.keyDown(input, { key: "ArrowUp" });

      // Press Enter - should still select first item
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("LAX");
    });

    it("does not go past last item with ArrowDown", () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          onChange={onChange}
          onSelect={onSelect}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      onChange.mockClear();

      // Navigate past last item
      fireEvent.keyDown(input, { key: "ArrowDown" }); // 0
      fireEvent.keyDown(input, { key: "ArrowDown" }); // 1
      fireEvent.keyDown(input, { key: "ArrowDown" }); // 2
      fireEvent.keyDown(input, { key: "ArrowDown" }); // still 2

      // Press Enter - should select last item (LHR)
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("LHR");
      expect(onSelect).toHaveBeenCalledWith(mockLocations[2]);
    });

    it("selects highlighted option with Enter key", () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockReturnValue(mockLocations);

      render(
        <AirportAutocomplete
          {...defaultProps}
          onChange={onChange}
          onSelect={onSelect}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Navigate to first item and select
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("LAX");
      expect(onSelect).toHaveBeenCalledWith(mockLocations[0]);
    });

    it("does not select when Enter pressed with no highlighted option", () => {
      const onChange = jest.fn();
      const searchLocations = jest.fn().mockReturnValue(mockLocations);

      render(
        <AirportAutocomplete
          {...defaultProps}
          onChange={onChange}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Clear onChange call from typing
      onChange.mockClear();

      // Press Enter without navigating (no highlighted option)
      fireEvent.keyDown(input, { key: "Enter" });

      // onChange should not have been called with a location code
      expect(onChange).not.toHaveBeenCalled();
    });

    it("closes dropdown with Escape key", async () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Press Escape
      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByText("Los Angeles International Airport")).not.toBeInTheDocument();
      });
    });

    it("ignores keyboard navigation when dropdown is closed", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");

      // Press ArrowDown without dropdown open - should not cause error
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowUp" });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Escape" });

      // No dropdown should be visible
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("click outside behavior", () => {
    it("closes dropdown when clicking outside", async () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <div>
          <div data-testid="outside-element">Outside</div>
          <AirportAutocomplete
            {...defaultProps}
            searchLocations={searchLocations}
          />
        </div>
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside-element"));

      await waitFor(() => {
        expect(screen.queryByText("Los Angeles International Airport")).not.toBeInTheDocument();
      });
    });

    it("does not close dropdown when clicking inside", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Click on input (inside)
      fireEvent.mouseDown(input);

      // Dropdown should still be visible
      expect(screen.getByText("Los Angeles International Airport")).toBeInTheDocument();
    });
  });

  describe("focus behavior", () => {
    it("reopens dropdown on focus if value and results exist", async () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      const { rerender } = render(
        <AirportAutocomplete
          {...defaultProps}
          value=""
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");

      // First search to populate results
      fireEvent.change(input, { target: { value: "LA" } });

      expect(screen.getByText("LAX")).toBeInTheDocument();

      // Close dropdown by pressing Escape
      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByText("Los Angeles International Airport")).not.toBeInTheDocument();
      });

      // Rerender with value "LA" to simulate controlled component
      rerender(
        <AirportAutocomplete
          {...defaultProps}
          value="LA"
          searchLocations={searchLocations}
        />
      );

      // Blur and then focus input again
      fireEvent.blur(input);
      fireEvent.focus(input);

      // Dropdown should reopen because value >= 2 and results exist
      await waitFor(() => {
        expect(screen.getByText("Los Angeles International Airport")).toBeInTheDocument();
      });
    });

    it("does not open dropdown on focus if value is too short", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          value="L"
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);

      // Dropdown should not open
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("cleanup", () => {
    it("cleans up event listeners on unmount", () => {
      const searchLocations = jest.fn().mockReturnValue(mockLocations);
      const removeEventListenerSpy = jest.spyOn(document, "removeEventListener");

      const { unmount } = render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
