import { render, renderHook, screen, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  SSEProvider,
  useSSEContext,
  useSSEContextOptional,
  type SSEProviderProps,
} from "../../lib/sse-provider";
import type { PriceUpdateEvent, SSEConnectionState } from "../../hooks/use-sse";

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock useSSE hook
const mockUseSSE = jest.fn();
jest.mock("../../hooks/use-sse", () => ({
  useSSE: (options: unknown) => mockUseSSE(options),
}));

const mockToastSuccess = toast.success as jest.Mock;
const mockToastError = toast.error as jest.Mock;

// Helper to store captured callbacks from useSSE
let capturedCallbacks: {
  onConnected?: () => void;
  onPriceUpdate?: (update: PriceUpdateEvent) => void;
  onConnectionStateChange?: (state: SSEConnectionState) => void;
} = {};

describe("SSEProvider", () => {
  const defaultMockReturn = {
    connectionState: "connected" as SSEConnectionState,
    isConnected: true,
    priceUpdates: [] as PriceUpdateEvent[],
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    clearUpdates: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedCallbacks = {};
    mockUseSSE.mockReturnValue(defaultMockReturn);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <SSEProvider>{children}</SSEProvider>;
  }

  describe("rendering", () => {
    it("renders children", () => {
      render(
        <SSEProvider>
          <div data-testid="child">Child content</div>
        </SSEProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("passes autoConnect option to useSSE", () => {
      render(
        <SSEProvider autoConnect={false}>
          <div>Content</div>
        </SSEProvider>
      );

      expect(mockUseSSE).toHaveBeenCalledWith(
        expect.objectContaining({ autoConnect: false })
      );
    });
  });

  describe("toast notifications", () => {
    it("shows success toast on price update after initial sync period", () => {
      const update: PriceUpdateEvent = {
        type: "price_update",
        trip_id: "trip-1",
        trip_name: "Hawaii Trip",
        flight_price: "500.00",
        hotel_price: "300.00",
        total_price: "800.00",
        updated_at: "2024-01-01T12:00:00Z",
      };

      mockUseSSE.mockImplementation((options) => {
        // Capture callbacks for later use
        capturedCallbacks = {
          onConnected: options.onConnected,
          onPriceUpdate: options.onPriceUpdate,
        };
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts>
          <div>Content</div>
        </SSEProvider>
      );

      // Simulate connection established
      act(() => {
        capturedCallbacks.onConnected?.();
      });

      // Wait for initial sync grace period (2 seconds)
      act(() => {
        jest.advanceTimersByTime(2100);
      });

      // Now price updates should show toasts
      act(() => {
        capturedCallbacks.onPriceUpdate?.(update);
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Price updated for Hawaii Trip",
        expect.objectContaining({
          description: "New total: $800.00",
        })
      );
    });

    it("does not show toast during initial sync period", () => {
      const update: PriceUpdateEvent = {
        type: "price_update",
        trip_id: "trip-1",
        trip_name: "Hawaii Trip",
        flight_price: "500.00",
        hotel_price: "300.00",
        total_price: "800.00",
        updated_at: "2024-01-01T12:00:00Z",
      };

      mockUseSSE.mockImplementation((options) => {
        capturedCallbacks = {
          onConnected: options.onConnected,
          onPriceUpdate: options.onPriceUpdate,
        };
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts>
          <div>Content</div>
        </SSEProvider>
      );

      // Simulate connection then immediate price update (initial sync)
      act(() => {
        capturedCallbacks.onConnected?.();
        capturedCallbacks.onPriceUpdate?.(update);
      });

      // Toast should NOT be shown during initial sync
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("uses flight_price when total_price is null", () => {
      const update: PriceUpdateEvent = {
        type: "price_update",
        trip_id: "trip-1",
        trip_name: "Test Trip",
        flight_price: "500.00",
        hotel_price: null,
        total_price: null,
        updated_at: "2024-01-01T12:00:00Z",
      };

      mockUseSSE.mockImplementation((options) => {
        capturedCallbacks = {
          onConnected: options.onConnected,
          onPriceUpdate: options.onPriceUpdate,
        };
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts>
          <div>Content</div>
        </SSEProvider>
      );

      // Simulate connection and wait for initial sync
      act(() => {
        capturedCallbacks.onConnected?.();
        jest.advanceTimersByTime(2100);
        capturedCallbacks.onPriceUpdate?.(update);
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Price updated for Test Trip",
        expect.objectContaining({
          description: "New total: $500.00",
        })
      );
    });

    it("uses N/A when all prices are null", () => {
      const update: PriceUpdateEvent = {
        type: "price_update",
        trip_id: "trip-1",
        trip_name: "Test Trip",
        flight_price: null,
        hotel_price: null,
        total_price: null,
        updated_at: "2024-01-01T12:00:00Z",
      };

      mockUseSSE.mockImplementation((options) => {
        capturedCallbacks = {
          onConnected: options.onConnected,
          onPriceUpdate: options.onPriceUpdate,
        };
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts>
          <div>Content</div>
        </SSEProvider>
      );

      // Simulate connection and wait for initial sync
      act(() => {
        capturedCallbacks.onConnected?.();
        jest.advanceTimersByTime(2100);
        capturedCallbacks.onPriceUpdate?.(update);
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Price updated for Test Trip",
        expect.objectContaining({
          description: "New total: $N/A",
        })
      );
    });

    it("does not show toast when showToasts is false", () => {
      const update: PriceUpdateEvent = {
        type: "price_update",
        trip_id: "trip-1",
        trip_name: "Hawaii Trip",
        flight_price: "500.00",
        hotel_price: null,
        total_price: "500.00",
        updated_at: "2024-01-01T12:00:00Z",
      };

      mockUseSSE.mockImplementation((options) => {
        if (options.onPriceUpdate) {
          options.onPriceUpdate(update);
        }
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts={false}>
          <div>Content</div>
        </SSEProvider>
      );

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it("shows error toast on connection error when showToasts is true", () => {
      mockUseSSE.mockImplementation((options) => {
        if (options.onConnectionStateChange) {
          options.onConnectionStateChange("error");
        }
        return { ...defaultMockReturn, connectionState: "error" };
      });

      render(
        <SSEProvider showToasts>
          <div>Content</div>
        </SSEProvider>
      );

      expect(mockToastError).toHaveBeenCalledWith(
        "Real-time updates disconnected",
        expect.objectContaining({
          description: "Price updates may be delayed",
        })
      );
    });

    it("does not show error toast when showToasts is false", () => {
      mockUseSSE.mockImplementation((options) => {
        if (options.onConnectionStateChange) {
          options.onConnectionStateChange("error");
        }
        return { ...defaultMockReturn, connectionState: "error" };
      });

      render(
        <SSEProvider showToasts={false}>
          <div>Content</div>
        </SSEProvider>
      );

      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("does not show error toast for non-error states", () => {
      mockUseSSE.mockImplementation((options) => {
        if (options.onConnectionStateChange) {
          options.onConnectionStateChange("connected");
        }
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts>
          <div>Content</div>
        </SSEProvider>
      );

      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe("callbacks", () => {
    it("calls onPriceUpdate callback", () => {
      const onPriceUpdate = jest.fn();
      const update: PriceUpdateEvent = {
        type: "price_update",
        trip_id: "trip-1",
        trip_name: "Test Trip",
        flight_price: "500.00",
        hotel_price: null,
        total_price: "500.00",
        updated_at: "2024-01-01T12:00:00Z",
      };

      mockUseSSE.mockImplementation((options) => {
        if (options.onPriceUpdate) {
          options.onPriceUpdate(update);
        }
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts={false} onPriceUpdate={onPriceUpdate}>
          <div>Content</div>
        </SSEProvider>
      );

      expect(onPriceUpdate).toHaveBeenCalledWith(update);
    });

    it("calls onConnectionStateChange callback", () => {
      const onConnectionStateChange = jest.fn();

      mockUseSSE.mockImplementation((options) => {
        if (options.onConnectionStateChange) {
          options.onConnectionStateChange("connected");
        }
        return defaultMockReturn;
      });

      render(
        <SSEProvider showToasts={false} onConnectionStateChange={onConnectionStateChange}>
          <div>Content</div>
        </SSEProvider>
      );

      expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
    });
  });

  describe("getPriceUpdate", () => {
    it("returns price update for specific trip", () => {
      const updates: PriceUpdateEvent[] = [
        {
          type: "price_update",
          trip_id: "trip-1",
          trip_name: "Trip 1",
          flight_price: "100.00",
          hotel_price: null,
          total_price: "100.00",
          updated_at: "2024-01-01T12:00:00Z",
        },
        {
          type: "price_update",
          trip_id: "trip-2",
          trip_name: "Trip 2",
          flight_price: "200.00",
          hotel_price: null,
          total_price: "200.00",
          updated_at: "2024-01-01T12:00:00Z",
        },
      ];

      mockUseSSE.mockReturnValue({
        ...defaultMockReturn,
        priceUpdates: updates,
      });

      const { result } = renderHook(() => useSSEContext(), { wrapper });

      expect(result.current.getPriceUpdate("trip-1")).toEqual(updates[0]);
      expect(result.current.getPriceUpdate("trip-2")).toEqual(updates[1]);
      expect(result.current.getPriceUpdate("trip-3")).toBeUndefined();
    });
  });
});

describe("useSSEContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSSE.mockReturnValue({
      connectionState: "connected" as SSEConnectionState,
      isConnected: true,
      priceUpdates: [],
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      clearUpdates: jest.fn(),
    });
  });

  it("throws error when used outside provider", () => {
    // Suppress console.error for this test
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useSSEContext());
    }).toThrow("useSSEContext must be used within an SSEProvider");

    consoleError.mockRestore();
  });

  it("returns context value when used inside provider", () => {
    function wrapper({ children }: { children: ReactNode }) {
      return <SSEProvider>{children}</SSEProvider>;
    }

    const { result } = renderHook(() => useSSEContext(), { wrapper });

    expect(result.current.connectionState).toBe("connected");
    expect(result.current.isConnected).toBe(true);
    expect(typeof result.current.connect).toBe("function");
    expect(typeof result.current.disconnect).toBe("function");
    expect(typeof result.current.clearUpdates).toBe("function");
    expect(typeof result.current.getPriceUpdate).toBe("function");
  });
});

describe("useSSEContextOptional", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSSE.mockReturnValue({
      connectionState: "connected" as SSEConnectionState,
      isConnected: true,
      priceUpdates: [],
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      clearUpdates: jest.fn(),
    });
  });

  it("returns null when used outside provider", () => {
    const { result } = renderHook(() => useSSEContextOptional());

    expect(result.current).toBeNull();
  });

  it("returns context value when used inside provider", () => {
    function wrapper({ children }: { children: ReactNode }) {
      return <SSEProvider>{children}</SSEProvider>;
    }

    const { result } = renderHook(() => useSSEContextOptional(), { wrapper });

    expect(result.current).not.toBeNull();
    expect(result.current?.connectionState).toBe("connected");
  });
});
