"use client";

import { useState, useCallback, useRef, useEffect } from "react";

import { RefreshCw, MessageSquare, Plane, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { formatPrice, formatShortDate, formatTimestamp } from "@/lib/format";
import { api, ApiError, type TripResponse } from "@/lib/api";
import { TripRowContextMenu, TripRowKebab } from "@/components/trip-row-actions";
import styles from "./page.module.css";

const REFRESH_POLL_INTERVAL = 2000; // Poll every 2 seconds

type DisplayStatus = "ACTIVE" | "PAUSED" | "ERROR";

/**
 * Convert API trip data to display format.
 * The API returns prices as strings and status in lowercase.
 */
interface DisplayTrip {
  id: string;
  name: string;
  origin_airport: string;
  destination_code: string;
  depart_date: string;
  return_date: string | null;
  is_round_trip: boolean;
  status: DisplayStatus;
  flight_price: number | null;
  hotel_price: number | null;
  total_price: number | null;
  updated_at: string;
}

function mapApiTripToDisplayTrip(trip: TripResponse): DisplayTrip {
  // Infer is_round_trip from return_date: if return_date exists and is non-empty, it's a round trip
  const isRoundTrip = Boolean(trip.return_date && trip.return_date.trim() !== "");

  return {
    id: trip.id,
    name: trip.name,
    origin_airport: trip.origin_airport,
    destination_code: trip.destination_code,
    depart_date: trip.depart_date,
    return_date: trip.return_date || null,
    is_round_trip: isRoundTrip,
    status: trip.status.toUpperCase() as DisplayStatus,
    flight_price: trip.current_flight_price ? Number.parseFloat(trip.current_flight_price) : null,
    hotel_price: trip.current_hotel_price ? Number.parseFloat(trip.current_hotel_price) : null,
    total_price: trip.total_price ? Number.parseFloat(trip.total_price) : null,
    updated_at: trip.last_refreshed || new Date().toISOString(),
  };
}

function getStatusVariant(
  status: DisplayStatus
): "default" | "secondary" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "PAUSED":
      return "secondary";
    case "ERROR":
      return "outline";
    default:
      return "outline";
  }
}

function TripTableSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <TableRow key={i} className={styles.skeletonRow}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8 rounded" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <Plane className={styles.emptyIcon} />
      <h3 className={styles.emptyTitle}>No trips yet</h3>
      <p className={styles.emptyText}>
        Create your first trip to start tracking prices.
      </p>
    </div>
  );
}

interface FailedStateProps {
  onRetry: () => void;
}

function FailedState({ onRetry }: FailedStateProps) {
  return (
    <div className={styles.failedState}>
      <AlertCircle className={styles.failedIcon} />
      <h3 className={styles.failedTitle}>Failed to load trips</h3>
      <p className={styles.failedText}>
        We couldn&apos;t fetch your trips. Please try again.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

function ChatPlaceholder() {
  return (
    <div className={styles.chatPanel}>
      <MessageSquare className={styles.chatPlaceholderIcon} />
      <h3 className={styles.chatPlaceholderTitle}>AI Assistant</h3>
      <p className={styles.chatPlaceholderText}>
        Chat interface coming in Phase 2. You&apos;ll be able to create and
        manage trips using natural language.
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<DisplayTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.trips.list();
      const displayTrips = response.data.map(mapApiTripToDisplayTrip);
      setTrips(displayTrips);
    } catch (err) {
      console.error("Failed to fetch trips:", err);
      if (err instanceof ApiError) {
        setError(err.detail || err.message);
      } else {
        setError("Failed to load trips. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch trips on mount
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollRefreshStatus = useCallback(
    async (refreshGroupId: string) => {
      try {
        const response = await api.trips.getRefreshStatus(refreshGroupId);
        const status = response.data;

        setRefreshProgress({
          total: status.total,
          completed: status.completed,
          failed: status.failed,
        });

        // Check if refresh is complete
        if (
          status.status === "completed" ||
          status.status === "failed" ||
          status.completed + status.failed >= status.total
        ) {
          stopPolling();
          setIsRefreshing(false);
          setRefreshProgress(null);

          // Show appropriate toast based on results
          if (status.total === 0) {
            toast.info("No trips to refresh", {
              description: "Create a trip to start tracking prices.",
            });
          } else if (status.completed === 0 && status.failed > 0) {
            toast.error("Refresh failed", {
              description: `All ${status.failed} trips failed to update.`,
            });
          } else if (status.failed > 0) {
            toast.warning("Prices partially refreshed", {
              description: `${status.completed} trips updated, ${status.failed} failed.`,
            });
          } else if (status.completed > 0) {
            toast.success("Prices refreshed", {
              description:
                status.completed === 1
                  ? "Trip prices have been updated."
                  : `All ${status.completed} trip prices have been updated.`,
            });
          } else {
            // completed === 0, failed === 0, total > 0: unusual state
            toast.info("Refresh completed", {
              description: "No price updates were found.",
            });
          }

          // Reload trips data to get updated prices
          fetchTrips();
        }
      } catch (err) {
        // If we can't get status, stop polling but don't show error
        // (the refresh might still be running)
        console.error("Failed to poll refresh status:", err);
        stopPolling();
        setIsRefreshing(false);
        setRefreshProgress(null);
      }
    },
    [stopPolling, fetchTrips]
  );

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    setRefreshProgress(null);

    try {
      const response = await api.trips.refreshAll();
      const refreshGroupId = response.data.refresh_group_id;

      // Wait a moment for the workflow to start and set initial state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start polling for status
      pollIntervalRef.current = setInterval(() => {
        pollRefreshStatus(refreshGroupId);
      }, REFRESH_POLL_INTERVAL);

      // Do an immediate status check
      await pollRefreshStatus(refreshGroupId);
    } catch (err) {
      setIsRefreshing(false);
      setRefreshProgress(null);

      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error("Refresh already in progress", {
            description: "Please wait for the current refresh to complete.",
          });
        } else {
          toast.error("Refresh failed", {
            description: err.detail || "Could not refresh prices. Please try again.",
          });
        }
      } else {
        toast.error("Refresh failed", {
          description: "Could not refresh prices. Please try again.",
        });
      }
    }
  };

  const handleTripDeleted = useCallback(
    (tripId: string) => {
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    },
    []
  );

  const handleRetry = () => {
    setError(null);
    fetchTrips();
  };

  return (
    <>
      {/* Page header with title and action buttons */}
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Your Trips</h1>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing
              ? refreshProgress
                ? `Refreshing ${refreshProgress.completed}/${refreshProgress.total}...`
                : "Starting refresh..."
              : "Refresh All"}
          </Button>
          <Button asChild size="sm">
            <Link href="/trips/new">
              <Plus className="h-4 w-4" />
              New Trip
            </Link>
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.columns}>
        {/* Trip table panel */}
        <div className={styles.tablePanel}>
          {error ? (
            <FailedState onRetry={handleRetry} />
          ) : isLoading ? (
            <div className={styles.tableWrapper}>
              <Table className={styles.tripTable}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip Name</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Flight</TableHead>
                    <TableHead className="text-right">Hotel</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TripTableSkeleton />
                </TableBody>
              </Table>
            </div>
          ) : trips.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={styles.tableWrapper}>
              <Table className={styles.tripTable}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trip Name</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Flight</TableHead>
                    <TableHead className="text-right">Hotel</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip) => (
                    <TripRowContextMenu
                      key={trip.id}
                      tripId={trip.id}
                      tripName={trip.name}
                      onRefresh={fetchTrips}
                      onDeleted={() => handleTripDeleted(trip.id)}
                    >
                      <TableRow className={styles.clickableRow}>
                        <TableCell className="font-medium">
                          <Link href={`/trips/${trip.id}`} className={styles.rowLink}>
                            {trip.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className={styles.route}>
                            <span>{trip.origin_airport}</span>
                            <span className={styles.routeArrow}>
                              {trip.is_round_trip ? "↔" : "→"}
                            </span>
                            <span>{trip.destination_code}</span>
                          </div>
                        </TableCell>
                        <TableCell className={styles.dates}>
                          {formatShortDate(trip.depart_date)}
                          {trip.return_date && ` – ${formatShortDate(trip.return_date)}`}
                        </TableCell>
                        <TableCell className={`text-right ${styles.price}`}>
                          {formatPrice(trip.flight_price)}
                        </TableCell>
                        <TableCell className={`text-right ${styles.price}`}>
                          {formatPrice(trip.hotel_price)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${styles.price} ${styles.priceTotal}`}
                        >
                          {formatPrice(trip.total_price)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(trip.status)}>
                            {trip.status}
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.timestamp}>
                          {formatTimestamp(trip.updated_at)}
                        </TableCell>
                        <TripRowKebab
                          tripId={trip.id}
                          tripName={trip.name}
                          onRefresh={fetchTrips}
                          onDeleted={() => handleTripDeleted(trip.id)}
                        />
                      </TableRow>
                    </TripRowContextMenu>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Chat placeholder panel */}
        <ChatPlaceholder />
      </div>
    </>
  );
}
