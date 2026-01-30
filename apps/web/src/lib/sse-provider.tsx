"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  useSSE,
  type PriceUpdateEvent,
  type SSEConnectionState,
  type UseSSEOptions,
} from "../hooks/use-sse";

/**
 * Context value for SSE provider
 */
export interface SSEContextValue {
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
  /**
   * Get the latest price update for a specific trip
   */
  getPriceUpdate: (tripId: string) => PriceUpdateEvent | undefined;
}

const SSEContext = createContext<SSEContextValue | null>(null);

/**
 * Props for SSEProvider component
 */
export interface SSEProviderProps {
  children: ReactNode;
  /**
   * Whether to show toast notifications for price updates
   * @default true
   */
  showToasts?: boolean;
  /**
   * Callback when a price update is received (after toast)
   */
  onPriceUpdate?: (update: PriceUpdateEvent) => void;
  /**
   * Callback when connection state changes
   */
  onConnectionStateChange?: (state: SSEConnectionState) => void;
  /**
   * Whether to auto-connect on mount
   * @default true
   */
  autoConnect?: boolean;
}

/**
 * Provider component for SSE real-time price updates.
 * Wraps the application to provide SSE connection state and price updates.
 *
 * @example
 * ```tsx
 * // In layout or providers
 * <SSEProvider showToasts onPriceUpdate={handleUpdate}>
 *   <App />
 * </SSEProvider>
 *
 * // In components
 * const { isConnected, priceUpdates } = useSSEContext();
 * ```
 */
export function SSEProvider({
  children,
  showToasts = true,
  onPriceUpdate,
  onConnectionStateChange,
  autoConnect = true,
}: SSEProviderProps) {
  const handlePriceUpdate = useCallback(
    (update: PriceUpdateEvent) => {
      if (showToasts) {
        const price = update.total_price || update.flight_price || "N/A";
        toast.success(`Price updated for ${update.trip_name}`, {
          description: `New total: $${price}`,
          duration: 4000,
        });
      }
      onPriceUpdate?.(update);
    },
    [showToasts, onPriceUpdate]
  );

  const handleConnectionStateChange = useCallback(
    (state: SSEConnectionState) => {
      if (state === "error" && showToasts) {
        toast.error("Real-time updates disconnected", {
          description: "Price updates may be delayed",
          duration: 5000,
        });
      }
      onConnectionStateChange?.(state);
    },
    [showToasts, onConnectionStateChange]
  );

  const sseOptions: UseSSEOptions = useMemo(
    () => ({
      autoConnect,
      onPriceUpdate: handlePriceUpdate,
      onConnectionStateChange: handleConnectionStateChange,
    }),
    [autoConnect, handlePriceUpdate, handleConnectionStateChange]
  );

  const {
    connectionState,
    isConnected,
    priceUpdates,
    error,
    connect,
    disconnect,
    clearUpdates,
  } = useSSE(sseOptions);

  const getPriceUpdate = useCallback(
    (tripId: string) => {
      return priceUpdates.find((u) => u.trip_id === tripId);
    },
    [priceUpdates]
  );

  const contextValue = useMemo<SSEContextValue>(
    () => ({
      connectionState,
      isConnected,
      priceUpdates,
      error,
      connect,
      disconnect,
      clearUpdates,
      getPriceUpdate,
    }),
    [
      connectionState,
      isConnected,
      priceUpdates,
      error,
      connect,
      disconnect,
      clearUpdates,
      getPriceUpdate,
    ]
  );

  return <SSEContext.Provider value={contextValue}>{children}</SSEContext.Provider>;
}

/**
 * Hook to access SSE context.
 * Must be used within an SSEProvider.
 *
 * @example
 * ```tsx
 * const { isConnected, priceUpdates, getPriceUpdate } = useSSEContext();
 *
 * // Get latest price for a specific trip
 * const tripPrice = getPriceUpdate(tripId);
 * ```
 */
export function useSSEContext(): SSEContextValue {
  const context = useContext(SSEContext);

  if (!context) {
    throw new Error("useSSEContext must be used within an SSEProvider");
  }

  return context;
}

/**
 * Optional hook that returns null if used outside provider.
 * Useful for components that may or may not be within a provider.
 */
export function useSSEContextOptional(): SSEContextValue | null {
  return useContext(SSEContext);
}
