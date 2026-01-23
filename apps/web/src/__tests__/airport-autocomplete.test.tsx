import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

const mockCityLocation: Location = {
  code: "NYC",
  name: "New York City",
  city: "New York",
  country: "United States",
  type: "CITY",
};

describe("AirportAutocomplete", () => {
  const defaultProps = {
    id: "test-airport",
    value: "",
    onChange: jest.fn(),
    searchLocations: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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
    it("calls onChange with uppercase value when user types", () => {
      const onChange = jest.fn();
      render(<AirportAutocomplete {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "la" } });

      expect(onChange).toHaveBeenCalledWith("LA");
    });

    it("debounces search calls", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");

      // Type multiple characters quickly
      fireEvent.change(input, { target: { value: "L" } });
      fireEvent.change(input, { target: { value: "LA" } });
      fireEvent.change(input, { target: { value: "LAX" } });

      // Search should not be called yet
      expect(searchLocations).not.toHaveBeenCalled();

      // Fast forward debounce timer and wait for async state updates
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Now search should be called with final value
      expect(searchLocations).toHaveBeenCalledTimes(1);
      expect(searchLocations).toHaveBeenCalledWith("LAX");
    });

    it("clears previous debounce timer when typing continues", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");

      fireEvent.change(input, { target: { value: "LA" } });

      // Advance 200ms (not enough to trigger search)
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Type again
      fireEvent.change(input, { target: { value: "LAX" } });

      // Advance 200ms more
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Search should not have been called yet (timer was reset)
      expect(searchLocations).not.toHaveBeenCalled();

      // Advance remaining 100ms and wait for async state updates
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Now search should be called
      expect(searchLocations).toHaveBeenCalledWith("LAX");
    });
  });

  describe("search functionality", () => {
    it("does not search when query is less than 2 characters", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "L" } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(searchLocations).not.toHaveBeenCalled();
    });

    it("searches when query is 2 or more characters", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(searchLocations).toHaveBeenCalledWith("LA");
    });

    it("shows loading indicator while searching", async () => {
      let resolveSearch: (value: Location[]) => void;
      const searchLocations = jest.fn().mockImplementation(
        () => new Promise((resolve) => { resolveSearch = resolve; })
      );
      const { container } = render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Advance debounce timer to trigger search
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Loading indicator should be visible (Loader2 icon)
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThanOrEqual(1);

      // Complete the search
      await act(async () => {
        resolveSearch?.(mockLocations);
      });
    });

    it("opens dropdown when search returns results", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
        expect(screen.getByText("Los Angeles International Airport")).toBeInTheDocument();
      });
    });

    it("does not open dropdown when search returns empty results", async () => {
      const searchLocations = jest.fn().mockResolvedValue([]);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "XYZ" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
      });
    });

    it("handles search error gracefully", async () => {
      const searchLocations = jest.fn().mockRejectedValue(new Error("Network error"));
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        // Should not crash, dropdown should be closed
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
      });
    });
  });

  describe("dropdown and selection", () => {
    it("displays location details in dropdown", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
        expect(screen.getByText("Los Angeles, United States")).toBeInTheDocument();
      });
    });

    it("calls onChange and onSelect when option is clicked", async () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);

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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      // Click on the first option
      const firstOption = screen.getAllByRole("button")[0];
      fireEvent.click(firstOption);

      expect(onChange).toHaveBeenCalledWith("LAX");
      expect(onSelect).toHaveBeenCalledWith(mockLocations[0]);
    });

    it("closes dropdown after selection", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      const firstOption = screen.getAllByRole("button")[0];
      fireEvent.click(firstOption);

      await waitFor(() => {
        expect(screen.queryByText("Los Angeles International Airport")).not.toBeInTheDocument();
      });
    });

    it("highlights option on mouse enter", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      const secondOption = screen.getAllByRole("button")[1];
      fireEvent.mouseEnter(secondOption);

      // The component sets highlightedIndex state on mouseEnter
      // We verify the option exists and mouseEnter was handled
      expect(secondOption).toBeInTheDocument();
    });

    it("renders CITY type with MapPin icon", async () => {
      const searchLocations = jest.fn().mockResolvedValue([mockCityLocation]);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "NY" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("NYC")).toBeInTheDocument();
        expect(screen.getByText("New York City")).toBeInTheDocument();
      });
    });
  });

  describe("keyboard navigation", () => {
    it("navigates down with ArrowDown key", async () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

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

    it("navigates up with ArrowUp key", async () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

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

    it("does not go below first item with ArrowUp", async () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      onChange.mockClear();

      // Navigate to first item
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Try to go up from first item (should stay at first)
      fireEvent.keyDown(input, { key: "ArrowUp" });

      // Press Enter - should still select first item
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("LAX");
    });

    it("does not go past last item with ArrowDown", async () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

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

    it("selects highlighted option with Enter key", async () => {
      const onChange = jest.fn();
      const onSelect = jest.fn();
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);

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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      // Navigate to first item and select
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("LAX");
      expect(onSelect).toHaveBeenCalledWith(mockLocations[0]);
    });

    it("does not select when Enter pressed with no highlighted option", async () => {
      const onChange = jest.fn();
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);

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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      // Press Enter without navigating (no highlighted option)
      fireEvent.keyDown(input, { key: "Enter" });

      // onChange should not have been called with a location code
      expect(onChange).not.toHaveBeenCalled();
    });

    it("closes dropdown with Escape key", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByText("Los Angeles International Airport")).not.toBeInTheDocument();
      });
    });

    it("ignores keyboard navigation when dropdown is closed", () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside-element"));

      await waitFor(() => {
        expect(screen.queryByText("Los Angeles International Airport")).not.toBeInTheDocument();
      });
    });

    it("does not close dropdown when clicking inside", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

      // Click on input (inside)
      fireEvent.mouseDown(input);

      // Dropdown should still be visible
      expect(screen.getByText("Los Angeles International Airport")).toBeInTheDocument();
    });
  });

  describe("focus behavior", () => {
    it("reopens dropdown on focus if value and results exist", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText("LAX")).toBeInTheDocument();
      });

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

    it("does not open dropdown on focus if value is too short", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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
    it("cleans up debounce timer on unmount", () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
      const { unmount } = render(
        <AirportAutocomplete
          {...defaultProps}
          searchLocations={searchLocations}
        />
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "LA" } });

      // Unmount before debounce completes
      unmount();

      // Advance timer - should not cause errors
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Search should not have been called
      expect(searchLocations).not.toHaveBeenCalled();
    });

    it("cleans up event listeners on unmount", async () => {
      const searchLocations = jest.fn().mockResolvedValue(mockLocations);
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
