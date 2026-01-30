"use client";

import React, { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Pencil,
  Plane,
  Hotel,
  RefreshCw,
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
import type { TripDetail, PriceSnapshot, ApiFlightOffer, ApiHotelOffer } from "@/lib/api";
import { api, ApiError } from "@/lib/api";
import { formatPrice, formatShortDate, formatDateTime, formatDuration, formatFlightTime, renderStars, formatDateRange, getAirlineName } from "@/lib/format";
import type { ApiFlightItinerary, ApiFlightSegment } from "@/lib/api";
import styles from "./page.module.css";

/** Build a stable flight signature from itinerary segments: e.g. "B6-100+B6-200" */
const flightSignature = (flight: ApiFlightOffer): string => {
  const segments = (flight.itineraries ?? []).flatMap((it) => it.segments ?? []);
  if (segments.length === 0) {
    // Fallback for flat structure
    const code = flight.airline_code ?? "";
    const num = flight.flight_number ?? "";
    return code && num ? `${code}-${num}` : flight.id;
  }
  return segments
    .map((s) => `${s.carrier_code ?? ""}-${s.flight_number ?? ""}`)
    .join("+");
};

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
  selectedHotelId,
  selectedFlightSignature,
}: {
  priceHistory: PriceSnapshot[];
  selectedHotelId: string | null;
  selectedFlightSignature: string | null;
}) {
  if (priceHistory.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <TrendingUp className={styles.emptyChartIcon} />
        <p>No price history yet</p>
      </div>
    );
  }

  const chartData = [...priceHistory].reverse().map((snapshot) => {
    const defaultFlight = parsePrice(snapshot.flight_price) ?? 0;
    const defaultHotel = parsePrice(snapshot.hotel_price) ?? 0;

    // Look up selected hotel price in this snapshot
    let hotel = defaultHotel;
    if (selectedHotelId && snapshot.hotel_offers) {
      const match = (snapshot.hotel_offers as ApiHotelOffer[]).find(
        (h) => h.id === selectedHotelId
      );
      if (match) hotel = parsePrice(match.price) ?? defaultHotel;
    }

    // Look up selected flight price in this snapshot
    let flight = defaultFlight;
    if (selectedFlightSignature && snapshot.flight_offers) {
      const match = (snapshot.flight_offers as ApiFlightOffer[]).find(
        (f) => flightSignature(f) === selectedFlightSignature
      );
      if (match) flight = parsePrice(match.price) ?? defaultFlight;
    }

    return {
      date: formatDateTime(snapshot.created_at),
      total: flight + hotel,
      flight,
      hotel,
    };
  });

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

/** Render a single flight segment */
function SegmentRow({
  segment,
}: {
  segment: ApiFlightSegment;
}) {
  const airlineName = getAirlineName(segment.carrier_code);
  const duration = segment.duration_minutes
    ? formatDuration(segment.duration_minutes)
    : null;
  const depTime = segment.departure_time ? formatFlightTime(segment.departure_time) : "—";
  const arrTime = segment.arrival_time ? formatFlightTime(segment.arrival_time) : "—";
  const flightNum = segment.flight_number || (segment.carrier_code ? `${segment.carrier_code}` : "—");

  return (
    <div className={styles.segmentRow}>
      <div className={styles.segmentAirlineCol}>
        <span className={styles.segmentAirline}>{airlineName}</span>
        <span className={styles.segmentFlightNum}>{flightNum}</span>
      </div>
      <div className={styles.segmentTimeCol}>
        <span className={styles.segmentTime}>{depTime}</span>
        <span className={styles.segmentAirport}>{segment.departure_airport || "—"}</span>
      </div>
      <div className={styles.segmentArrowCol}>
        <span className={styles.segmentArrow}>→</span>
      </div>
      <div className={styles.segmentTimeCol}>
        <span className={styles.segmentTime}>{arrTime}</span>
        <span className={styles.segmentAirport}>{segment.arrival_airport || "—"}</span>
      </div>
      <div className={styles.segmentMetaCol}>
        {duration && <span className={styles.segmentDuration}>{duration}</span>}
      </div>
    </div>
  );
}

/** Render an itinerary section (outbound or return) */
function ItinerarySection({
  itinerary,
  isReturn,
}: {
  itinerary: ApiFlightItinerary;
  isReturn?: boolean;
}) {
  const segments = itinerary.segments || [];
  if (segments.length === 0) return null;

  const totalDuration = itinerary.total_duration_minutes
    ? formatDuration(itinerary.total_duration_minutes)
    : null;

  return (
    <div className={styles.itinerarySection}>
      <div className={styles.itineraryHeader}>
        <span className={styles.itineraryLabel}>{isReturn ? "Return" : "Outbound"}</span>
        {totalDuration && <span className={styles.itineraryDuration}>{totalDuration} total</span>}
      </div>
      {segments.map((segment, idx) => {
        // Calculate layover time from previous segment
        let layover: string | null = null;
        if (idx > 0) {
          const prevArrival = segments[idx - 1].arrival_time;
          const curDeparture = segment.departure_time;
          if (prevArrival && curDeparture) {
            const arrDate = new Date(prevArrival);
            const depDate = new Date(curDeparture);
            const diffMs = depDate.getTime() - arrDate.getTime();
            if (diffMs > 0 && !Number.isNaN(diffMs)) {
              const diffMins = Math.round(diffMs / 60000);
              layover = formatDuration(diffMins);
            }
          }
        }
        return (
          <React.Fragment key={`${segment.flight_number || idx}`}>
            {layover && (
              <div className={styles.layoverRow}>
                <span className={styles.layoverText}>{layover} layover in {segments[idx - 1].arrival_airport || "—"}</span>
              </div>
            )}
            <SegmentRow segment={segment} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Extract display data from a flight offer for rendering
 */
function extractFlightDisplayData(flight: ApiFlightOffer) {
  const outbound = flight.itineraries?.[0];
  const returnItinerary = flight.itineraries?.[1];
  const firstSegment = outbound?.segments?.[0];
  const returnFirstSegment = returnItinerary?.segments?.[0];
  const returnLastSegment = returnItinerary?.segments?.length
    ? returnItinerary.segments[returnItinerary.segments.length - 1]
    : null;
  const outboundLastSegment = outbound?.segments?.length
    ? outbound.segments[outbound.segments.length - 1]
    : null;

  return {
    outbound,
    returnItinerary,
    firstSegment,
    returnFirstSegment,
    returnLastSegment,
    outboundLastSegment,
    airlineName: firstSegment?.carrier_code
      ? getAirlineName(firstSegment.carrier_code)
      : (flight.airline_name ?? "Unknown"),
    outboundDepTime: firstSegment?.departure_time
      ? formatFlightTime(firstSegment.departure_time)
      : null,
    outboundArrTime: outboundLastSegment?.arrival_time
      ? formatFlightTime(outboundLastSegment.arrival_time)
      : null,
    returnDepTime: returnFirstSegment?.departure_time
      ? formatFlightTime(returnFirstSegment.departure_time)
      : null,
    returnArrTime: returnLastSegment?.arrival_time
      ? formatFlightTime(returnLastSegment.arrival_time)
      : null,
  };
}

function FlightsList({
  flights,
  departDate,
  returnDate,
  selectedFlightSignature,
  onSelectFlight,
}: {
  flights: ApiFlightOffer[];
  departDate: string;
  returnDate: string | null;
  selectedFlightSignature: string | null;
  onSelectFlight: (signature: string) => void;
}) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  if (flights.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <Plane className={styles.emptyChartIcon} />
        <p>No flight offers available</p>
      </div>
    );
  }

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={styles.flightsList}>
      {flights.map((flight) => {
        const sig = flightSignature(flight);
        const isSelected = sig === selectedFlightSignature;
        const isExpanded = expandedCards.has(flight.id);
        const isDirect = flight.stops === 0;
        const displayData = extractFlightDisplayData(flight);
        const {
          airlineName,
          outboundDepTime,
          outboundArrTime,
          returnDepTime,
          returnArrTime,
          returnFirstSegment,
          outbound,
          returnItinerary,
        } = displayData;

        return (
          <div
            key={flight.id}
            className={`${styles.flightCardExpandable} ${isSelected ? styles.flightCardBest : ""}`}
          >
            {/* Collapsed Header - Two-row layout showing outbound + return */}
            <button
              type="button"
              className={styles.cardHeader}
              onClick={() => toggleCard(flight.id)}
              aria-expanded={isExpanded}
            >
              {/* Row 1: Outbound */}
              <div className={styles.cardHeaderRow}>
                <div
                  className={styles.flightRadio}
                  onClick={(e) => { e.stopPropagation(); onSelectFlight(sig); }}
                  onKeyDown={() => {}}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={-1}
                >
                  <div className={`${styles.radioOuter} ${isSelected ? styles.radioSelected : ""}`}>
                    {isSelected && <div className={styles.radioInner} />}
                  </div>
                </div>
                <span className={styles.headerAirline}>{airlineName}</span>
                {outboundDepTime && (
                  <span className={styles.headerTimes}>
                    {outboundDepTime}{outboundArrTime ? ` → ${outboundArrTime}` : ""}
                  </span>
                )}
                <span className={`${styles.directBadge} ${isDirect ? styles.directBadgeGreen : ""}`}>
                  <Plane className="h-3 w-3" />
                  {isDirect ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                </span>
                <span className={styles.cardPrice}>
                  {formatPrice(flight.price)}
                </span>
                <ChevronDown className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ""}`} />
              </div>
              {/* Row 2: Return (if round trip) */}
              {returnFirstSegment && (
                <div className={`${styles.cardHeaderRow} ${styles.cardHeaderRowReturn}`}>
                  <span className={styles.headerReturnLabel}>Return</span>
                  <span className={styles.headerTimes}>
                    {returnDepTime}{returnArrTime ? ` → ${returnArrTime}` : ""}
                  </span>
                </div>
              )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className={styles.cardContent}>
                {outbound && <ItinerarySection itinerary={outbound} />}
                {returnItinerary && (
                  <>
                    <div className={styles.itineraryDivider} />
                    <ItinerarySection itinerary={returnItinerary} isReturn />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HotelsList({
  hotels,
  selectedHotelId,
  onSelectHotel,
  nights,
}: {
  hotels: ApiHotelOffer[];
  selectedHotelId: string | null;
  onSelectHotel: (hotelId: string) => void;
  nights: number;
}) {
  if (hotels.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <Hotel className={styles.emptyChartIcon} />
        <p>No hotel offers available</p>
      </div>
    );
  }

  return (
    <div className={styles.hotelsListCompact}>
      {hotels.map((hotel) => {
        const isSelected = hotel.id === selectedHotelId;
        return (
          <button
            key={hotel.id}
            type="button"
            className={`${styles.hotelCardCompact} ${isSelected ? styles.hotelSelected : ""}`}
            onClick={() => onSelectHotel(hotel.id)}
          >
            <div className={styles.hotelRadioCompact}>
              <div
                className={`${styles.radioOuter} ${isSelected ? styles.radioSelected : ""}`}
              >
                {isSelected && <div className={styles.radioInner} />}
              </div>
            </div>
            <span className={styles.hotelNameCompact} title={hotel.name}>
              {hotel.name}
              {hotel.rating && (
                <span className={styles.hotelRating}>
                  {" "}
                  {renderStars(hotel.rating)}
                </span>
              )}
            </span>
            <span className={styles.hotelPriceCompact}>
              {nights > 0 ? (
                <>
                  <span className={styles.hotelPerNight}>{formatPrice((parsePrice(hotel.price) ?? 0) / nights)} / night</span>
                  <span className={styles.hotelTotalSub}>{formatPrice(hotel.price)}</span>
                </>
              ) : (
                formatPrice(hotel.price)
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.containerCompact}>
      <div className={styles.header}>
        <div className={styles.headerRow1}>
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className={styles.headerRow2}>
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [selectedFlightSignature, setSelectedFlightSignature] = useState<string | null>(null);

  const fetchTripDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.trips.getDetails(tripId);
      setTrip(response.data.trip);
      setPriceHistory(response.data.price_history);

      // Pre-select the cheapest flight and hotel from the latest snapshot
      const latest = response.data.price_history[0];
      if (latest) {
        const flights = (latest.flight_offers ?? []) as ApiFlightOffer[];
        const hotels = (latest.hotel_offers ?? []) as ApiHotelOffer[];

        if (flights.length > 0) {
          const cheapest = flights.reduce((best, f) =>
            (parsePrice(f.price) ?? Number.POSITIVE_INFINITY) < (parsePrice(best.price) ?? Number.POSITIVE_INFINITY) ? f : best
          , flights[0]);
          setSelectedFlightSignature(flightSignature(cheapest));
        }

        if (hotels.length > 0) {
          const cheapest = hotels.reduce((best, h) =>
            (parsePrice(h.price) ?? Number.POSITIVE_INFINITY) < (parsePrice(best.price) ?? Number.POSITIVE_INFINITY) ? h : best
          , hotels[0]);
          setSelectedHotelId(cheapest.id);
        }
      }
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

  const handleRefresh = async () => {
    if (!tripId) return;
    setIsRefreshing(true);
    const currentSnapshotCount = priceHistory.length;
    const currentLatestId = priceHistory[0]?.id;

    try {
      await api.trips.refresh(tripId);
      toast.success("Refresh started");

      // Poll for new snapshot (up to 30 seconds)
      const maxAttempts = 15;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls

        try {
          const response = await api.trips.getDetails(tripId);
          const newHistory = response.data.price_history;

          // Check if we have a new snapshot
          if (newHistory.length > currentSnapshotCount || (newHistory[0]?.id && newHistory[0].id !== currentLatestId)) {
            setTrip(response.data.trip);
            setPriceHistory(newHistory);
            toast.success("Prices updated");
            return;
          }
        } catch {
          // Ignore errors during polling, continue trying
        }
      }

      // If we get here, no new snapshot was detected - refresh anyway
      await fetchTripDetails();
      toast.info("Refresh complete");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail || "Failed to refresh trip");
      } else {
        toast.error("Failed to refresh trip");
      }
    } finally {
      setIsRefreshing(false);
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

  // Calculate nights from trip dates
  const nights = (() => {
    if (!trip.depart_date || !trip.return_date) return 0;
    const d = new Date(trip.depart_date);
    const r = new Date(trip.return_date);
    return Math.max(0, Math.round((r.getTime() - d.getTime()) / 86400000));
  })();

  const flightPriceValue = parsePrice(trip.current_flight_price);
  const hotelPriceValue = parsePrice(trip.current_hotel_price);

  // Get offers from the latest snapshot (moved up for price derivation)
  const latestSnapshot = priceHistory[0];
  const latestOffers = {
    flights: (latestSnapshot?.flight_offers ?? []) as ApiFlightOffer[],
    hotels: (latestSnapshot?.hotel_offers ?? []) as ApiHotelOffer[],
  };

  // Derive effective prices from selections (fall back to aggregate minimum)
  const selectedHotel = selectedHotelId
    ? latestOffers.hotels.find((h) => h.id === selectedHotelId)
    : null;
  const selectedFlight = selectedFlightSignature
    ? latestOffers.flights.find((f) => flightSignature(f) === selectedFlightSignature)
    : null;

  const effectiveHotelPrice = selectedHotel ? parsePrice(selectedHotel.price) : hotelPriceValue;
  const effectiveFlightPrice = selectedFlight ? parsePrice(selectedFlight.price) : flightPriceValue;
  const effectiveTotalPrice =
    effectiveFlightPrice != null && effectiveHotelPrice != null
      ? effectiveFlightPrice + effectiveHotelPrice
      : effectiveFlightPrice ?? effectiveHotelPrice;

  const isActive = trip.status.toLowerCase() === "active";

  // Calculate trend from price history (API returns descending order - newest first)
  const hasTrend = priceHistory.length >= 2;
  const currentTotal = effectiveTotalPrice ?? 0;
  const previousTotal = hasTrend
    ? parsePrice(priceHistory[1]?.total_price)
    : null;

  return (
    <div className={styles.containerCompact}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerRow1}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className={styles.backButton}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className={styles.titleCompact}>{trip.name}</h1>
          <span className={styles.headerDivider} />
          <span className={styles.routeCompact}>
            {trip.origin_airport} {trip.is_round_trip ? "↔" : "→"}{" "}
            {trip.destination_code}
          </span>
          <span className={styles.headerDivider} />
          <span className={styles.routeCompact}>
            {formatShortDate(trip.depart_date)}–{trip.return_date ? formatShortDate(trip.return_date) : ""}
          </span>
          {nights > 0 && (
            <>
              <span className={styles.headerDivider} />
              <span className={styles.nightsBadge}>{nights} nights</span>
            </>
          )}
        </div>
        <div className={styles.headerRow2}>
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
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh prices"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
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
            {formatPrice(effectiveFlightPrice)}
          </span>
        </div>
        <span className={styles.pricePlus}>+</span>
        <div className={styles.priceItem}>
          <Hotel className="h-4 w-4" />
          <span className={styles.priceItemLabel}>Hotel</span>
          <span className={styles.priceItemValue}>
            {formatPrice(effectiveHotelPrice)}
          </span>
        </div>
        <span className={styles.priceEquals}>=</span>
        <div className={styles.priceTotal}>
          <span className={styles.priceTotalValue}>
            {formatPrice(effectiveTotalPrice)}
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
            <PriceHistoryChart
              priceHistory={priceHistory}
              selectedHotelId={selectedHotelId}
              selectedFlightSignature={selectedFlightSignature}
            />
          </CardContent>
        </Card>

        {/* Hotels List */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            <div className={styles.listHeader}>
              <Hotel className="h-4 w-4" />
              <span>Hotels</span>
            </div>
            <HotelsList
              hotels={latestOffers.hotels}
              selectedHotelId={selectedHotelId}
              onSelectHotel={setSelectedHotelId}
              nights={nights}
            />
          </CardContent>
        </Card>

        {/* Flights List */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            <div className={styles.listHeader}>
              <Plane className="h-4 w-4" />
              <span>Flights</span>
            </div>
            <FlightsList
              flights={latestOffers.flights}
              departDate={trip.depart_date}
              returnDate={trip.return_date}
              selectedFlightSignature={selectedFlightSignature}
              onSelectFlight={setSelectedFlightSignature}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
