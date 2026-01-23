"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Plane,
  Hotel,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TripDetail, PriceSnapshot } from "@/lib/api";
import { api, ApiError } from "@/lib/api";
import { formatPrice, formatShortDate } from "@/lib/format";
import styles from "./page.module.css";

const parsePrice = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "active":
      return "default";
    case "paused":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

function PriceHistoryChart({
  priceHistory,
}: {
  priceHistory: PriceSnapshot[];
}) {
  if (priceHistory.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <TrendingUp className={styles.emptyChartIcon} />
        <p>No price history yet</p>
      </div>
    );
  }

  const chartData = priceHistory.map((snapshot) => ({
    date: formatShortDate(snapshot.created_at),
    total: parsePrice(snapshot.total_price) ?? 0,
    flight: parsePrice(snapshot.flight_price) ?? 0,
    hotel: parsePrice(snapshot.hotel_price) ?? 0,
  }));

  const chartConfig = {
    total: { label: "Total", color: "hsl(var(--chart-1))" },
    flight: { label: "Flight", color: "hsl(var(--chart-2))" },
    hotel: { label: "Hotel", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className={styles.chartContainer}>
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tickFormatter={(v) => `$${v}`}
          fontSize={11}
          width={45}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span>
                  {chartConfig[name as keyof typeof chartConfig]?.label}:{" "}
                  <strong>${Number(value).toLocaleString()}</strong>
                </span>
              )}
            />
          }
        />
        <Line
          dataKey="total"
          type="monotone"
          stroke="var(--color-total)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          dataKey="flight"
          type="monotone"
          stroke="var(--color-flight)"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 4"
        />
        <Line
          dataKey="hotel"
          type="monotone"
          stroke="var(--color-hotel)"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 4"
        />
      </LineChart>
    </ChartContainer>
  );
}

function PriceTrend({
  currentPrice,
  previousPrice,
}: {
  currentPrice: number;
  previousPrice: number;
}) {
  if (
    !Number.isFinite(previousPrice) ||
    previousPrice <= 0 ||
    !Number.isFinite(currentPrice)
  ) {
    return null;
  }
  const diff = currentPrice - previousPrice;
  const percentChange = ((diff / previousPrice) * 100).toFixed(1);
  const isDown = diff < 0;

  return (
    <span
      className={`${styles.trendInline} ${isDown ? styles.trendDown : styles.trendUp}`}
    >
      {isDown ? (
        <TrendingDown className="h-3 w-3" />
      ) : (
        <TrendingUp className="h-3 w-3" />
      )}
      {isDown ? "" : "+"}
      {percentChange}%
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.containerCompact}>
      <div className={styles.headerCompact}>
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className={styles.headerInfo}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
        <div className={styles.headerActions}>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <div className={styles.priceSummaryBar}>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className={styles.gridCompact}>
        <Card className={styles.chartCard}>
          <CardContent className={styles.chartCardContent}>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onBack,
}: {
  error: string;
  onBack: () => void;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.errorState}>
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2>{error}</h2>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to trips
        </Button>
      </div>
    </div>
  );
}

export default function TripDetailPage({
  params,
}: Readonly<{
  params: Promise<{ tripId: string }>;
}>) {
  const router = useRouter();
  const { tripId } = use(params);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTripDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.trips.getDetails(tripId);
      setTrip(response.data.trip);
      setPriceHistory(response.data.price_history);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError("Trip not found");
        } else {
          setError(err.detail || "Failed to load trip");
        }
      } else {
        setError("Failed to load trip");
      }
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTripDetails();
  }, [fetchTripDetails]);

  const handleStatusToggle = async (checked: boolean) => {
    if (!tripId || !trip) return;
    setIsUpdatingStatus(true);
    const newStatus = checked ? "active" : "paused";
    try {
      await api.trips.updateStatus(tripId, newStatus);
      setTrip({ ...trip, status: newStatus });
      toast.success(newStatus === "active" ? "Tracking resumed" : "Tracking paused");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail || "Failed to update trip status");
      } else {
        toast.error("Failed to update trip status");
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!tripId) return;
    setIsDeleting(true);
    try {
      await api.trips.delete(tripId);
      toast.success("Trip deleted");
      router.push("/trips");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail || "Failed to delete trip");
      } else {
        toast.error("Failed to delete trip");
      }
      setIsDeleting(false);
    }
  };

  const handleBack = useCallback(() => {
    router.push("/trips");
  }, [router]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error} onBack={handleBack} />;
  }

  if (!trip) {
    return <ErrorState error="Trip not found" onBack={handleBack} />;
  }

  const flightPriceValue = parsePrice(trip.current_flight_price);
  const hotelPriceValue = parsePrice(trip.current_hotel_price);
  const totalPriceValue = parsePrice(trip.total_price);

  const isActive = trip.status.toLowerCase() === "active";

  // Calculate trend from price history
  const hasTrend = priceHistory.length >= 2;
  const currentTotal = totalPriceValue ?? 0;
  const previousTotal = hasTrend
    ? parsePrice(priceHistory[priceHistory.length - 2]?.total_price)
    : null;

  return (
    <div className={styles.containerCompact}>
      {/* Header */}
      <div className={styles.headerCompact}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className={styles.backButton}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className={styles.headerInfo}>
          <h1 className={styles.titleCompact}>{trip.name}</h1>
          <span className={styles.routeCompact}>
            {trip.origin_airport} {trip.is_round_trip ? "↔" : "→"}{" "}
            {trip.destination_code} · {formatShortDate(trip.depart_date)}–
            {trip.return_date ? formatShortDate(trip.return_date) : ""}
          </span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.trackingToggle}>
            <Switch
              id="tracking"
              checked={isActive}
              onCheckedChange={handleStatusToggle}
              disabled={isUpdatingStatus}
            />
            <Badge variant={getStatusVariant(trip.status)}>
              {trip.status.toUpperCase()}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/trips/${tripId}/edit`)}
            title="Edit trip"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{trip.name}&quot; and all
                  price history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Price Summary Bar */}
      <div className={styles.priceSummaryBar}>
        <div className={styles.priceItem}>
          <Plane className="h-4 w-4" />
          <span className={styles.priceItemLabel}>Flight</span>
          <span className={styles.priceItemValue}>
            {formatPrice(flightPriceValue)}
          </span>
        </div>
        <span className={styles.pricePlus}>+</span>
        <div className={styles.priceItem}>
          <Hotel className="h-4 w-4" />
          <span className={styles.priceItemLabel}>Hotel</span>
          <span className={styles.priceItemValue}>
            {formatPrice(hotelPriceValue)}
          </span>
        </div>
        <span className={styles.priceEquals}>=</span>
        <div className={styles.priceTotal}>
          <span className={styles.priceTotalValue}>
            {formatPrice(totalPriceValue)}
          </span>
          {hasTrend &&
            previousTotal !== null &&
            currentTotal !== previousTotal && (
              <PriceTrend
                currentPrice={currentTotal}
                previousPrice={previousTotal}
              />
            )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={styles.gridCompact}>
        {/* Chart */}
        <Card className={styles.chartCard}>
          <CardContent className={styles.chartCardContent}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTitle}>Price History</span>
              <div className={styles.chartLegendCompact}>
                <span>
                  <span
                    className={styles.legendDot}
                    style={{ background: "hsl(var(--chart-1))" }}
                  />{" "}
                  Total
                </span>
                <span>
                  <span
                    className={styles.legendDot}
                    style={{ background: "hsl(var(--chart-2))" }}
                  />{" "}
                  Flight
                </span>
                <span>
                  <span
                    className={styles.legendDot}
                    style={{ background: "hsl(var(--chart-3))" }}
                  />{" "}
                  Hotel
                </span>
              </div>
            </div>
            <PriceHistoryChart priceHistory={priceHistory} />
          </CardContent>
        </Card>

        {/* Trip Details Card */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            <div className={styles.listHeader}>
              <Plane className="h-4 w-4" />
              <span>Trip Details</span>
            </div>
            <div className={styles.detailsList}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Travelers</span>
                <span className={styles.detailValue}>
                  {trip.adults} adult{trip.adults !== 1 ? "s" : ""}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Trip Type</span>
                <span className={styles.detailValue}>
                  {trip.is_round_trip ? "Round trip" : "One way"}
                </span>
              </div>
              {trip.flight_prefs && (
                <>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Cabin</span>
                    <span className={styles.detailValue}>
                      {trip.flight_prefs.cabin
                        ? trip.flight_prefs.cabin.charAt(0).toUpperCase() +
                          trip.flight_prefs.cabin.slice(1)
                        : "Economy"}
                    </span>
                  </div>
                  {trip.flight_prefs.airlines &&
                    trip.flight_prefs.airlines.length > 0 && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Airlines</span>
                        <span className={styles.detailValue}>
                          {trip.flight_prefs.airlines.join(", ")}
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Hotel Preferences Card */}
        {trip.hotel_prefs && (
          <Card className={styles.listCard}>
            <CardContent className={styles.listCardContent}>
              <div className={styles.listHeader}>
                <Hotel className="h-4 w-4" />
                <span>Hotel Preferences</span>
              </div>
              <div className={styles.detailsList}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Rooms</span>
                  <span className={styles.detailValue}>
                    {trip.hotel_prefs.rooms}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Adults/Room</span>
                  <span className={styles.detailValue}>
                    {trip.hotel_prefs.adults_per_room}
                  </span>
                </div>
                {trip.hotel_prefs.preferred_room_types &&
                  trip.hotel_prefs.preferred_room_types.length > 0 && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Room Types</span>
                      <span className={styles.detailValue}>
                        {trip.hotel_prefs.preferred_room_types.join(", ")}
                      </span>
                    </div>
                  )}
                {trip.hotel_prefs.preferred_views &&
                  trip.hotel_prefs.preferred_views.length > 0 && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Views</span>
                      <span className={styles.detailValue}>
                        {trip.hotel_prefs.preferred_views.join(", ")}
                      </span>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
