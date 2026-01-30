"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8000";

/**
 * Update price updates state with a new or updated entry
 */
function updatePriceUpdatesState(
  prev: PriceUpdateEvent[],
  data: PriceUpdateEvent
): PriceUpdateEvent[] {
  const existing = prev.findIndex((u) => u.trip_id === data.trip_id);
  if (existing !== -1) {
    const updated = [...prev];
    updated[existing] = data;
    return updated;
  }
  return [...prev, data];
}

/**
 * Safely parse JSON event data
 */
function parseEventData<T>(eventData: string): T | null {
  try {
    return JSON.parse(eventData) as T;
  } catch {
    return null;
  }
}

/**
 * Event types emitted by the SSE endpoint
 */
export type SSEEventType = "connected" | "price_update" | "heartbeat" | "error";

/**
 * Connected event data
 */
export interface ConnectedEvent {
  status: "connected";
  user_id: string;
}

/**
 * Price update event data
 */
export interface PriceUpdateEvent {
  type: "price_update";
  trip_id: string;
  trip_name: string;
  flight_price: string | null;
  hotel_price: string | null;
  total_price: string | null;
  updated_at: string;
}

/**
 * Heartbeat event data
 */
export interface HeartbeatEvent {
  timestamp: string;
}

/**
 * Error event data
 */
export interface ErrorEvent {
  error: string;
}

/**
 * Connection state for SSE
 */
export type SSEConnectionState = "connecting" | "connected" | "disconnected" | "error";

/**
 * Options for the useSSE hook
 */
export interface UseSSEOptions {
  /**
   * Whether to automatically connect on mount
   * @default true
   */
  autoConnect?: boolean;
  /**
   * Heartbeat interval in seconds (5-60)
   * @default 30
   */
  heartbeatInterval?: number;
  /**
   * Poll interval in seconds (1-30)
   * @default 5
   */
  pollInterval?: number;
  /**
   * Maximum number of reconnect attempts
   * @default 5
   */
  maxReconnectAttempts?: number;
  /**
   * Base delay between reconnect attempts in milliseconds
   * @default 1000
   */
  reconnectDelay?: number;
  /**
   * Callback when connected
   */
  onConnected?: (data: ConnectedEvent) => void;
  /**
   * Callback when a price update is received
   */
  onPriceUpdate?: (data: PriceUpdateEvent) => void;
  /**
   * Callback when a heartbeat is received
   */
  onHeartbeat?: (data: HeartbeatEvent) => void;
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
  /**
   * Callback when connection state changes
   */
  onConnectionStateChange?: (state: SSEConnectionState) => void;
}

/**
 * Return type for the useSSE hook
 */
export interface UseSSEReturn {
  /**
   * Current connection state
   */
  connectionState: SSEConnectionState;
  /**
   * Whether currently connected
   */
  isConnected: boolean;
  /**
   * Recent price updates received
   */
  priceUpdates: PriceUpdateEvent[];
  /**
   * Last error encountered
   */
  error: Error | null;
  /**
   * Manually connect to SSE
   */
  connect: () => void;
  /**
   * Manually disconnect from SSE
   */
  disconnect: () => void;
  /**
   * Clear all stored price updates
   */
  clearUpdates: () => void;
}

/**
 * Custom hook for subscribing to Server-Sent Events (SSE) for real-time price updates.
 *
 * @example
 * ```tsx
 * const { isConnected, priceUpdates, connect, disconnect } = useSSE({
 *   onPriceUpdate: (update) => {
 *     console.log(`Price update for ${update.trip_name}: ${update.total_price}`);
 *   },
 * });
 * ```
 */
export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const {
    autoConnect = true,
    heartbeatInterval = 30,
    pollInterval = 5,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    onConnected,
    onPriceUpdate,
    onHeartbeat,
    onError,
    onConnectionStateChange,
  } = options;

  const [connectionState, setConnectionState] = useState<SSEConnectionState>("disconnected");
  const [priceUpdates, setPriceUpdates] = useState<PriceUpdateEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Store callbacks in refs to avoid recreating connect() on every render
  const callbacksRef = useRef({
    onConnected,
    onPriceUpdate,
    onHeartbeat,
    onError,
    onConnectionStateChange,
  });

  // Keep refs up to date
  useEffect(() => {
    callbacksRef.current = {
      onConnected,
      onPriceUpdate,
      onHeartbeat,
      onError,
      onConnectionStateChange,
    };
  });

  const updateConnectionState = useCallback((state: SSEConnectionState) => {
    if (isMountedRef.current) {
      setConnectionState(state);
      callbacksRef.current.onConnectionStateChange?.(state);
    }
  }, []);

  const handleError = useCallback((err: Error) => {
    if (isMountedRef.current) {
      setError(err);
      callbacksRef.current.onError?.(err);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
    updateConnectionState("disconnected");
  }, [updateConnectionState]);

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    updateConnectionState("connecting");
    setError(null);

    const url = new URL(`${API_BASE_URL}/v1/sse/updates`);
    url.searchParams.set("heartbeat_interval", heartbeatInterval.toString());
    url.searchParams.set("poll_interval", pollInterval.toString());

    // EventSource doesn't support credentials by default in all browsers
    // For cookie-based auth, we may need to use fetch with ReadableStream instead
    const eventSource = new EventSource(url.toString(), {
      withCredentials: true,
    });

    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = parseEventData<PriceUpdateEvent>(event.data);
      if (data?.type === "price_update" && isMountedRef.current) {
        setPriceUpdates((prev) => updatePriceUpdatesState(prev, data));
        callbacksRef.current.onPriceUpdate?.(data);
      }
    };

    eventSource.addEventListener("connected", (event: MessageEvent) => {
      reconnectAttemptsRef.current = 0;
      updateConnectionState("connected");
      const data = parseEventData<ConnectedEvent>(event.data);
      if (data) {
        callbacksRef.current.onConnected?.(data);
      }
    });

    eventSource.addEventListener("price_update", (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      const data = parseEventData<PriceUpdateEvent>(event.data);
      if (data) {
        setPriceUpdates((prev) => updatePriceUpdatesState(prev, data));
        callbacksRef.current.onPriceUpdate?.(data);
      }
    });

    eventSource.addEventListener("heartbeat", (event: MessageEvent) => {
      const data = parseEventData<HeartbeatEvent>(event.data);
      if (data) {
        callbacksRef.current.onHeartbeat?.(data);
      }
    });

    eventSource.addEventListener("error", (event: MessageEvent) => {
      const data = parseEventData<ErrorEvent>(event.data);
      if (data) {
        handleError(new Error(data.error));
      }
    });

    eventSource.onerror = () => {
      // Connection error or closed
      if (!isMountedRef.current) return;

      eventSource.close();
      eventSourceRef.current = null;

      // Attempt to reconnect with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        updateConnectionState("connecting");
        const delay = reconnectDelay * (2 ** reconnectAttemptsRef.current);
        reconnectAttemptsRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, delay);
      } else {
        updateConnectionState("error");
        handleError(new Error("Max reconnect attempts reached"));
      }
    };
  }, [
    heartbeatInterval,
    pollInterval,
    maxReconnectAttempts,
    reconnectDelay,
    updateConnectionState,
    handleError,
  ]);

  const clearUpdates = useCallback(() => {
    setPriceUpdates([]);
  }, []);

  // Auto-connect on mount (only runs once)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally run only on mount to prevent reconnect loops
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, []);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    priceUpdates,
    error,
    connect,
    disconnect,
    clearUpdates,
  };
}
