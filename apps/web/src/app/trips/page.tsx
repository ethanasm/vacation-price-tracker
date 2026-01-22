"use client";

import { useState } from "react";
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
import { mockDashboardTrips, type DashboardTrip } from "@/lib/mock-data";
import styles from "./page.module.css";

type TripStatus = "ACTIVE" | "PAUSED" | "ERROR";

function getStatusVariant(
  status: TripStatus
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
  const [trips] = useState<DashboardTrip[]>(mockDashboardTrips);
  const [isLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      // TODO: Call POST /v1/trips/refresh-all
      // Simulating API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success("Prices refreshed", {
        description: "All trip prices have been updated.",
      });
    } catch {
      toast.error("Refresh failed", {
        description: "Could not refresh prices. Please try again.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    // TODO: Re-fetch trips from API
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
            {isRefreshing ? "Refreshing..." : "Refresh All"}
          </Button>
          <Button asChild size="sm">
            <Link href="/trips/create">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip) => (
                    <TableRow
                      key={trip.id}
                      className={styles.clickableRow}
                    >
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
                    </TableRow>
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
