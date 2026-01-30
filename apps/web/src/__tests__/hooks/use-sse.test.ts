import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useSSE,
  type PriceUpdateEvent,
  type SSEConnectionState,
} from "../../hooks/use-sse";

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private eventListeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  readyState = 0;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(
        (l) => l !== listener
      );
    }
  }

  dispatchEvent(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });
    if (this.eventListeners[type]) {
      for (const listener of this.eventListeners[type]) {
        listener(event);
      }
    }
    // Also dispatch to onmessage for generic messages
    if (type === "message" && this.onmessage) {
      this.onmessage(event);
    }
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen();
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror();
    }
  }

  close() {
    this.readyState = 2;
  }

  static reset() {
    MockEventSource.instances = [];
  }

  static getLatest(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

// Mock global EventSource
const originalEventSource = global.EventSource;
beforeEach(() => {
  // @ts-expect-error - Mocking EventSource
  global.EventSource = MockEventSource;
  MockEventSource.reset();
  jest.useFakeTimers();
});

afterEach(() => {
  global.EventSource = originalEventSource;
  jest.useRealTimers();
});

describe("useSSE", () => {
  describe("initialization", () => {
    it("initializes with disconnected state", () => {
      const { result } = renderHook(() => useSSE({ autoConnect: false }));

      expect(result.current.connectionState).toBe("disconnected");
      expect(result.current.isConnected).toBe(false);
      expect(result.current.priceUpdates).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("auto-connects by default", () => {
      renderHook(() => useSSE());

      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("does not auto-connect when autoConnect is false", () => {
      renderHook(() => useSSE({ autoConnect: false }));

      expect(MockEventSource.instances).toHaveLength(0);
    });

    it("uses correct URL with query parameters", () => {
      renderHook(() =>
        useSSE({
          heartbeatInterval: 15,
          pollInterval: 3,
        })
      );

      const instance = MockEventSource.getLatest();
      expect(instance?.url).toContain("heartbeat_interval=15");
      expect(instance?.url).toContain("poll_interval=3");
    });

    it("sets withCredentials for cookie auth", () => {
      renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();
      expect(instance?.withCredentials).toBe(true);
    });
  });

  describe("connection state", () => {
    it("transitions to connecting on connect", () => {
      const { result } = renderHook(() => useSSE({ autoConnect: false }));

      act(() => {
        result.current.connect();
      });

      expect(result.current.connectionState).toBe("connecting");
    });

    it("transitions to connected on connected event", async () => {
      const onConnected = jest.fn();
      const { result } = renderHook(() =>
        useSSE({ onConnected })
      );

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("connected", {
          status: "connected",
          user_id: "test-user-123",
        });
      });

      expect(result.current.connectionState).toBe("connected");
      expect(result.current.isConnected).toBe(true);
      expect(onConnected).toHaveBeenCalledWith({
        status: "connected",
        user_id: "test-user-123",
      });
    });

    it("transitions to disconnected on disconnect", () => {
      const { result } = renderHook(() => useSSE());

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.connectionState).toBe("disconnected");
      expect(result.current.isConnected).toBe(false);
    });

    it("calls onConnectionStateChange callback", () => {
      const onConnectionStateChange = jest.fn();
      const { result } = renderHook(() =>
        useSSE({ onConnectionStateChange, autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");
    });
  });

  describe("price updates", () => {
    it("stores price updates from events", () => {
      const { result } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("price_update", {
          type: "price_update",
          trip_id: "trip-1",
          trip_name: "Hawaii Trip",
          flight_price: "500.00",
          hotel_price: "300.00",
          total_price: "800.00",
          updated_at: "2024-01-01T12:00:00Z",
        });
      });

      expect(result.current.priceUpdates).toHaveLength(1);
      expect(result.current.priceUpdates[0]).toMatchObject({
        trip_id: "trip-1",
        trip_name: "Hawaii Trip",
        total_price: "800.00",
      });
    });

    it("calls onPriceUpdate callback", () => {
      const onPriceUpdate = jest.fn();
      renderHook(() => useSSE({ onPriceUpdate }));

      const instance = MockEventSource.getLatest();
      const update: PriceUpdateEvent = {
        type: "price_update",
        trip_id: "trip-1",
        trip_name: "Test Trip",
        flight_price: "100.00",
        hotel_price: null,
        total_price: "100.00",
        updated_at: "2024-01-01T12:00:00Z",
      };

      act(() => {
        instance?.dispatchEvent("price_update", update);
      });

      expect(onPriceUpdate).toHaveBeenCalledWith(update);
    });

    it("updates existing price for same trip", () => {
      const { result } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("price_update", {
          type: "price_update",
          trip_id: "trip-1",
          trip_name: "Hawaii Trip",
          flight_price: "500.00",
          hotel_price: "300.00",
          total_price: "800.00",
          updated_at: "2024-01-01T12:00:00Z",
        });
      });

      act(() => {
        instance?.dispatchEvent("price_update", {
          type: "price_update",
          trip_id: "trip-1",
          trip_name: "Hawaii Trip",
          flight_price: "450.00",
          hotel_price: "300.00",
          total_price: "750.00",
          updated_at: "2024-01-01T13:00:00Z",
        });
      });

      expect(result.current.priceUpdates).toHaveLength(1);
      expect(result.current.priceUpdates[0].total_price).toBe("750.00");
    });

    it("stores multiple trips", () => {
      const { result } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("price_update", {
          type: "price_update",
          trip_id: "trip-1",
          trip_name: "Hawaii Trip",
          flight_price: "500.00",
          hotel_price: null,
          total_price: "500.00",
          updated_at: "2024-01-01T12:00:00Z",
        });
      });

      act(() => {
        instance?.dispatchEvent("price_update", {
          type: "price_update",
          trip_id: "trip-2",
          trip_name: "Europe Trip",
          flight_price: "1000.00",
          hotel_price: null,
          total_price: "1000.00",
          updated_at: "2024-01-01T12:00:00Z",
        });
      });

      expect(result.current.priceUpdates).toHaveLength(2);
    });

    it("handles price updates from generic message event", () => {
      const onPriceUpdate = jest.fn();
      const { result } = renderHook(() => useSSE({ onPriceUpdate }));

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("message", {
          type: "price_update",
          trip_id: "trip-1",
          trip_name: "Hawaii Trip",
          flight_price: "500.00",
          hotel_price: "300.00",
          total_price: "800.00",
          updated_at: "2024-01-01T12:00:00Z",
        });
      });

      expect(result.current.priceUpdates).toHaveLength(1);
      expect(result.current.priceUpdates[0]).toMatchObject({
        trip_id: "trip-1",
        trip_name: "Hawaii Trip",
      });
      expect(onPriceUpdate).toHaveBeenCalled();
    });

    it("ignores generic messages without price_update type", () => {
      const { result } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("message", {
          type: "other_event",
          data: "some data",
        });
      });

      expect(result.current.priceUpdates).toHaveLength(0);
    });

    it("ignores invalid JSON in generic messages", () => {
      const { result } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();

      // Dispatch with invalid JSON - use a custom event with raw invalid data
      const event = new MessageEvent("message", {
        data: "not json",
      });
      act(() => {
        if (instance?.onmessage) {
          instance.onmessage(event);
        }
      });

      expect(result.current.priceUpdates).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("clears updates when clearUpdates is called", () => {
      const { result } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("price_update", {
          type: "price_update",
          trip_id: "trip-1",
          trip_name: "Test Trip",
          flight_price: "100.00",
          hotel_price: null,
          total_price: "100.00",
          updated_at: "2024-01-01T12:00:00Z",
        });
      });

      expect(result.current.priceUpdates).toHaveLength(1);

      act(() => {
        result.current.clearUpdates();
      });

      expect(result.current.priceUpdates).toHaveLength(0);
    });
  });

  describe("heartbeat", () => {
    it("calls onHeartbeat callback", () => {
      const onHeartbeat = jest.fn();
      renderHook(() => useSSE({ onHeartbeat }));

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("heartbeat", {
          timestamp: "2024-01-01T12:00:00Z",
        });
      });

      expect(onHeartbeat).toHaveBeenCalledWith({
        timestamp: "2024-01-01T12:00:00Z",
      });
    });
  });

  describe("error handling", () => {
    it("handles error events from server", () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useSSE({ onError }));

      const instance = MockEventSource.getLatest();

      act(() => {
        instance?.dispatchEvent("error", {
          error: "Internal server error",
        });
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Internal server error");
      expect(onError).toHaveBeenCalled();
    });

    it("attempts reconnect on connection error", async () => {
      const { result } = renderHook(() =>
        useSSE({
          maxReconnectAttempts: 3,
          reconnectDelay: 1000,
        })
      );

      const firstInstance = MockEventSource.getLatest();

      act(() => {
        firstInstance?.simulateError();
      });

      expect(result.current.connectionState).toBe("connecting");

      // Fast-forward through reconnect delay
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should have created a new connection
      expect(MockEventSource.instances).toHaveLength(2);
    });

    it("uses exponential backoff for reconnects", () => {
      renderHook(() =>
        useSSE({
          maxReconnectAttempts: 3,
          reconnectDelay: 1000,
        })
      );

      // First error
      let instance = MockEventSource.getLatest();
      act(() => {
        instance?.simulateError();
      });

      // First reconnect at 1000ms (1000 * 2^0)
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(MockEventSource.instances).toHaveLength(2);

      // Second error
      instance = MockEventSource.getLatest();
      act(() => {
        instance?.simulateError();
      });

      // Second reconnect at 2000ms (1000 * 2^1)
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(MockEventSource.instances).toHaveLength(2); // Not yet

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(MockEventSource.instances).toHaveLength(3); // Now connected
    });

    it("transitions to error state after max reconnect attempts", () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useSSE({
          maxReconnectAttempts: 2,
          reconnectDelay: 100,
          onError,
        })
      );

      // First error and reconnect
      act(() => {
        MockEventSource.getLatest()?.simulateError();
        jest.advanceTimersByTime(100);
      });

      // Second error and reconnect
      act(() => {
        MockEventSource.getLatest()?.simulateError();
        jest.advanceTimersByTime(200);
      });

      // Third error - max attempts reached
      act(() => {
        MockEventSource.getLatest()?.simulateError();
        jest.advanceTimersByTime(400);
      });

      expect(result.current.connectionState).toBe("error");
      expect(result.current.error?.message).toBe("Max reconnect attempts reached");
    });

    it("resets reconnect attempts on successful connection", () => {
      const { result } = renderHook(() =>
        useSSE({
          maxReconnectAttempts: 3,
          reconnectDelay: 100,
        })
      );

      // Fail and reconnect
      act(() => {
        MockEventSource.getLatest()?.simulateError();
        jest.advanceTimersByTime(100);
      });

      // Successfully connect
      act(() => {
        MockEventSource.getLatest()?.dispatchEvent("connected", {
          status: "connected",
          user_id: "test",
        });
      });

      expect(result.current.connectionState).toBe("connected");

      // Fail again - should have fresh reconnect attempts
      act(() => {
        MockEventSource.getLatest()?.simulateError();
        jest.advanceTimersByTime(100);
      });

      expect(result.current.connectionState).toBe("connecting");
    });
  });

  describe("cleanup", () => {
    it("closes connection on unmount", () => {
      const { unmount } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();
      expect(instance?.readyState).not.toBe(2); // Not closed

      unmount();

      expect(instance?.readyState).toBe(2); // Closed
    });

    it("clears reconnect timeout on unmount", () => {
      const { unmount } = renderHook(() =>
        useSSE({
          maxReconnectAttempts: 3,
          reconnectDelay: 1000,
        })
      );

      // Trigger error to start reconnect timer
      act(() => {
        MockEventSource.getLatest()?.simulateError();
      });

      unmount();

      // Fast-forward timer - should not create new connection
      const instanceCount = MockEventSource.instances.length;
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(MockEventSource.instances).toHaveLength(instanceCount);
    });

    it("clears reconnect timeout on disconnect", () => {
      const { result } = renderHook(() =>
        useSSE({
          maxReconnectAttempts: 3,
          reconnectDelay: 1000,
        })
      );

      // Trigger error to start reconnect timer
      act(() => {
        MockEventSource.getLatest()?.simulateError();
      });

      // Disconnect
      act(() => {
        result.current.disconnect();
      });

      // Fast-forward timer - should not create new connection
      const instanceCount = MockEventSource.instances.length;
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(MockEventSource.instances).toHaveLength(instanceCount);
    });
  });

  describe("manual connection control", () => {
    it("connect creates new connection", () => {
      const { result } = renderHook(() => useSSE({ autoConnect: false }));

      expect(MockEventSource.instances).toHaveLength(0);

      act(() => {
        result.current.connect();
      });

      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("disconnect closes connection and resets state", () => {
      const { result } = renderHook(() => useSSE());

      const instance = MockEventSource.getLatest();

      act(() => {
        result.current.disconnect();
      });

      expect(instance?.readyState).toBe(2);
      expect(result.current.connectionState).toBe("disconnected");
    });

    it("connect replaces existing connection", () => {
      const { result } = renderHook(() => useSSE());

      const firstInstance = MockEventSource.getLatest();

      act(() => {
        result.current.connect();
      });

      const secondInstance = MockEventSource.getLatest();

      expect(firstInstance).not.toBe(secondInstance);
      expect(firstInstance?.readyState).toBe(2); // First closed
    });
  });
});
