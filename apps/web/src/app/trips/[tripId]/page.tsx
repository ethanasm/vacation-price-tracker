"use client";

import React, { use, useReducer, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Hotel,
  Loader2,
  Pencil,
  Plane,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
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
import { formatPrice, formatShortDate, formatDuration, formatFlightTime, renderStars, formatDateRange, getAirlineName } from "@/lib/format";
import type { ApiFlightItinerary, ApiFlightSegment } from "@/lib/api";
import { useSSEContextOptional } from "@/lib/sse-provider";
import {
  aggregateDailyPriceHistory,
  flightStableKey,
  hotelStableKey,
  parsePrice,
} from "@/lib/price-history";
import {
  airlineChip,
  layoverLabel,
  multiCarrierSubtitle,
  operatingCarriers,
  stopsBadge,
} from "@/lib/aurora";
import { AirlineChip } from "@/components/aurora/airline-chip";
import { HotelPhoto } from "@/components/aurora/hotel-photo";
import styles from "./page.module.css";

/**
 * Single source of truth for which flight/hotel are selected and which (if any)
 * row is expanded. Selecting a row also toggles its expansion; selecting a
 * different row moves the expansion. This keeps the interactive screen's state
 * coherent so the selection -> total -> chart recompute stays consistent.
 */
type SelectionState = {
  selectedFlightId: string | null;
  expandedFlightId: string | null;
  selectedHotelId: string | null;
  expandedHotelId: string | null;
};
type SelectionAction =
  | { type: "selectFlight"; id: string }
  | { type: "selectHotel"; id: string }
  | { type: "preselect"; flightId: string | null; hotelId: string | null };

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "selectFlight":
      return {
        ...state,
        selectedFlightId: action.id,
        expandedFlightId: state.expandedFlightId === action.id ? null : action.id,
      };
    case "selectHotel":
      return {
        ...state,
        selectedHotelId: action.id,
        expandedHotelId: state.expandedHotelId === action.id ? null : action.id,
      };
    case "preselect":
      return {
        selectedFlightId: action.flightId,
        expandedFlightId: null,
        selectedHotelId: action.hotelId,
        expandedHotelId: null,
      };
  }
}

// Window after creation during which a snapshot-less trip is assumed to have
// its initial server-side price fetch still in flight (creation starts a
// PriceCheckWorkflow). Mirrors apps/mobile/lib/aurora.ts.
const INITIAL_FETCH_WINDOW_MS = 15 * 60_000;

const INITIAL_SELECTION: SelectionState = {
  selectedFlightId: null,
  expandedFlightId: null,
  selectedHotelId: null,
  expandedHotelId: null,
};

/**
 * Display label for a flight: all flight numbers across both itineraries.
 * For a typical round trip with no connections this looks like "UA1809 / UA1810".
 * Itineraries are separated by " / "; segments within an itinerary by "+".
 *
 * Note: segment.flight_number already includes the carrier prefix (e.g. "UA1809"),
 * so we use it directly rather than concatenating carrier_code + flight_number.
 */
const flightDisplayLabel = (flight: ApiFlightOffer): string | undefined => {
  const itineraries = flight.itineraries ?? [];
  const itinLabels = itineraries
    .map((it) => {
      const segs = it.segments ?? [];
      return segs
        .map((s) => s.flight_number ?? s.carrier_code ?? "")
        .filter(Boolean)
        .join("+");
    })
    .filter(Boolean);
  if (itinLabels.length > 0) return itinLabels.join(" / ");
  return flight.flight_number ?? flight.airline_code ?? undefined;
};

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "active":
      return "default";
    case "paused":
    case "expired":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

function PriceHistoryChart({
  priceHistory,
  selectedHotelKey,
  selectedHotelLabel,
  selectedFlightKey,
  selectedFlightLabel,
  showHotel = true,
  nowTotal,
}: {
  priceHistory: PriceSnapshot[];
  selectedHotelKey: string | null;
  selectedHotelLabel?: string;
  selectedFlightKey: string | null;
  selectedFlightLabel?: string;
  showHotel?: boolean;
  nowTotal?: number | null;
}) {
  // Collapse to one point per calendar day (cheapest total that day) so long
  // tracking windows stay readable. Carry-forward for selected offers is handled
  // inside aggregateDailyPriceHistory. Degraded snapshots (no priced offers) are
  // dropped here, so this can be empty even when priceHistory has rows.
  const chartData = aggregateDailyPriceHistory(priceHistory, {
    selectedFlightKey,
    selectedHotelKey,
  });

  if (chartData.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <TrendingUp className={styles.emptyChartIcon} />
        <p>No price history yet</p>
        {nowTotal != null && (
          <span data-testid="now-badge" className={styles.nowBadge}>
            Now {formatPrice(nowTotal)}
          </span>
        )}
      </div>
    );
  }

  const selectedFlightLineLabel = selectedFlightLabel ?? "Selected Flight";
  const selectedHotelLineLabel = selectedHotelLabel ?? "Selected Hotel";

  // Paired lines share a color; line style differentiates min vs. selected.
  const chartConfig = {
    total: { label: "Total", color: "hsl(var(--chart-1))" },
    minFlight: { label: "Flight (min)", color: "hsl(var(--chart-2))" },
    selectedFlight: { label: selectedFlightLineLabel, color: "hsl(var(--chart-2))" },
    minHotel: { label: "Hotel (min)", color: "hsl(var(--chart-3))" },
    selectedHotel: { label: selectedHotelLineLabel, color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig;

  return (
    <div className={styles.chartWrap}>
      {nowTotal != null && (
        <span data-testid="now-badge" className={styles.nowBadge}>
          Now {formatPrice(nowTotal)}
        </span>
      )}
      <ChartContainer config={chartConfig} className={styles.chartContainer}>
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
            interval="preserveStartEnd"
            minTickGap={32}
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
          {/* Total — bold solid line, stands out from the pairs */}
          {showHotel && (
            <Line
              dataKey="total"
              type="monotone"
              stroke="var(--color-total)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          )}
          {/* Mins (flight + hotel) — thin dashed lines, no dots */}
          <Line
            dataKey="minFlight"
            type="monotone"
            stroke="var(--color-minFlight)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
          {showHotel && (
            <Line
              dataKey="minHotel"
              type="monotone"
              stroke="var(--color-minHotel)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          )}
          {/* Selected (flight + hotel) — same color as min, but solid + dots */}
          {selectedFlightKey && (
            <Line
              dataKey="selectedFlight"
              type="monotone"
              stroke="var(--color-selectedFlight)"
              strokeWidth={1.5}
              dot={{ r: 2.5 }}
              connectNulls
            />
          )}
          {showHotel && selectedHotelKey && (
            <Line
              dataKey="selectedHotel"
              type="monotone"
              stroke="var(--color-selectedHotel)"
              strokeWidth={1.5}
              dot={{ r: 2.5 }}
              connectNulls
            />
          )}
        </LineChart>
      </ChartContainer>
    </div>
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
        // Calculate layover label from previous segment (city + code + duration).
        const layover = idx > 0 ? layoverLabel(segments[idx - 1], segment) : null;
        return (
          <React.Fragment key={`${segment.flight_number || idx}`}>
            {layover && (
              <div className={styles.layoverRow}>
                <span className={styles.auroraLayoverPill}>{layover}</span>
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
 * Render a "dep → arr" time range, falling back to a dash when empty.
 * Extracted so the component tree avoids nested template literals.
 */
function formatTimeRange(dep: string | null | undefined, arr: string | null | undefined): string {
  if (!dep && !arr) return "—";
  if (dep && arr) return `${dep} → ${arr}`;
  return dep ?? arr ?? "—";
}

function priceOrInfinity(value: string | null | undefined): number {
  return parsePrice(value) ?? Number.POSITIVE_INFINITY;
}

/** Compute the cheapest flight/hotel stable keys from the latest snapshot. */
function cheapestSelection(
  latest: PriceSnapshot | undefined,
): { flightId: string | null; hotelId: string | null } {
  if (!latest) return { flightId: null, hotelId: null };
  let flightId: string | null = null;
  const flights = (latest.flight_offers ?? []) as ApiFlightOffer[];
  if (flights.length > 0) {
    const cheapest = flights.reduce(
      (best, f) => (priceOrInfinity(f.price) < priceOrInfinity(best.price) ? f : best),
      flights[0],
    );
    flightId = flightStableKey(cheapest);
  }
  let hotelId: string | null = null;
  const hotels = (latest.hotel_offers ?? []) as ApiHotelOffer[];
  if (hotels.length > 0) {
    const cheapest = hotels.reduce(
      (best, h) => (priceOrInfinity(h.price) < priceOrInfinity(best.price) ? h : best),
      hotels[0],
    );
    hotelId = hotelStableKey(cheapest);
  }
  return { flightId, hotelId };
}

function resolveTripErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Trip not found";
    return err.detail || "Failed to load trip";
  }
  return "Failed to load trip";
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
      : (flight.airline_name ?? getAirlineName(flight.airline_code) ?? "Unknown"),
    outboundDepTime: (() => {
      const t = firstSegment?.departure_time ?? flight.departure_time;
      return t ? formatFlightTime(t) : null;
    })(),
    outboundArrTime: (() => {
      const t = outboundLastSegment?.arrival_time ?? flight.arrival_time;
      return t ? formatFlightTime(t) : null;
    })(),
    returnDepTime: returnFirstSegment?.departure_time
      ? formatFlightTime(returnFirstSegment.departure_time)
      : null,
    returnArrTime: returnLastSegment?.arrival_time
      ? formatFlightTime(returnLastSegment.arrival_time)
      : null,
  };
}

type FlightSortKey = "airline" | "time" | "stops" | "price";
type SortDir = "asc" | "desc";

type SortHeaderProps = Readonly<{
  label: string;
  sortKey: FlightSortKey;
  activeKey: FlightSortKey;
  direction: SortDir;
  align?: "left" | "right" | "center";
  className?: string;
  onSort: (key: FlightSortKey) => void;
}>;

function getSortAlignClass(align: SortHeaderProps["align"]): string {
  if (align === "right") return styles.sortButtonRight;
  if (align === "center") return styles.sortButtonCenter;
  return "";
}

function SortArrow({ isActive, direction }: Readonly<{ isActive: boolean; direction: SortDir }>) {
  if (!isActive) {
    return <ArrowUpDown className={`${styles.sortArrow} ${styles.sortArrowIdle}`} />;
  }
  return direction === "asc" ? (
    <ArrowUp className={styles.sortArrow} />
  ) : (
    <ArrowDown className={styles.sortArrow} />
  );
}

function SortHeader({ label, sortKey, activeKey, direction, align, className, onSort }: SortHeaderProps) {
  const isActive = activeKey === sortKey;
  const alignClass = getSortAlignClass(align);
  const buttonClass = [styles.sortButton, alignClass, isActive ? styles.sortButtonActive : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={buttonClass}
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      <SortArrow isActive={isActive} direction={direction} />
    </button>
  );
}

/** Secondary carrier code for the layered AirlineChip when a flight is multi-carrier. */
function secondaryCarrierCode(flight: ApiFlightOffer): string | null {
  if (multiCarrierSubtitle(flight) === null) return null;
  const segments = (flight.itineraries ?? []).flatMap((it) => it.segments ?? []);
  const primary = segments[0]?.carrier_code ?? null;
  for (const s of segments) {
    if (s.carrier_code && s.carrier_code !== primary) return s.carrier_code;
  }
  return null;
}

function FlightRow({
  flight,
  isSelected,
  isExpanded,
  onSelect,
}: {
  flight: ApiFlightOffer;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (stableKey: string) => void;
}) {
  const stableKey = flightStableKey(flight);
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

  const outboundTimes = formatTimeRange(outboundDepTime, outboundArrTime);
  const returnTimes = formatTimeRange(returnDepTime, returnArrTime);
  const badge = stopsBadge(flight);
  const subtitle = multiCarrierSubtitle(flight);
  const secondary = secondaryCarrierCode(flight);
  const primaryCode = outbound?.segments?.[0]?.carrier_code ?? flight.airline_code;

  return (
    <div
      className={`${styles.flightCardExpandable} ${isSelected ? styles.flightCardBest : ""} ${subtitle ? styles.flightCardMulti : ""}`}
    >
      {/* Collapsed header — the whole row is one radio control that both selects
          the offer and toggles its expanded itinerary. */}
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-expanded={isExpanded}
        className={styles.cardHeader}
        onClick={() => onSelect(stableKey)}
      >
        <div className={`${styles.cardHeaderRow} ${styles.cardHeaderRowMain}`}>
          <span className={styles.flightRadio} aria-hidden="true">
            <span className={`${styles.radioOuter} ${isSelected ? styles.radioSelected : ""}`}>
              {isSelected && <span className={styles.radioInner} />}
            </span>
          </span>
          <span className={styles.headerAirlineCell}>
            <AirlineChip carrierCode={primaryCode} secondaryCode={secondary} />
            <span className={styles.headerAirlineText}>
              <span className={styles.headerAirline}>{airlineName}</span>
              {subtitle && <span className={styles.headerSubtitle}>{subtitle}</span>}
            </span>
          </span>
          <span className={styles.headerTimes}>{outboundTimes}</span>
          <Badge variant={badge.tone === "success" ? "nonstop" : "stop"} className={styles.stopsBadge}>
            {badge.label}
          </Badge>
          <span className={`${styles.cardPrice} ${isSelected ? styles.cardPriceSelected : ""}`}>
            {formatPrice(flight.price)}
          </span>
          <ChevronDown className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ""}`} />
        </div>
        {returnFirstSegment && (
          <div className={`${styles.cardHeaderRowMain} ${styles.cardHeaderRowReturn}`}>
            <span />
            <span className={styles.headerReturnLabel}>Return</span>
            <span className={styles.headerTimes}>{returnTimes}</span>
            <span />
            <span />
            <span />
          </div>
        )}
      </button>

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
}

function FlightsList({
  flights,
  selectedFlightKey,
  expandedFlightKey,
  onSelectFlight,
  isFetching = false,
}: {
  flights: ApiFlightOffer[];
  selectedFlightKey: string | null;
  expandedFlightKey: string | null;
  onSelectFlight: (stableKey: string) => void;
  isFetching?: boolean;
}) {
  const [sortKey, setSortKey] = useState<FlightSortKey>("price");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: FlightSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedFlights = useMemo(() => {
    const getValue = (f: ApiFlightOffer): number | string => {
      const data = extractFlightDisplayData(f);
      switch (sortKey) {
        case "airline":
          return (data.airlineName || "").toLowerCase();
        case "time": {
          const first = data.outbound?.segments?.[0]?.departure_time;
          return first ?? "";
        }
        case "stops":
          return f.stops ?? 0;
        case "price":
          return parsePrice(f.price) ?? Number.POSITIVE_INFINITY;
      }
    };
    const arr = [...flights];
    arr.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [flights, sortKey, sortDir]);

  if (flights.length === 0) {
    if (isFetching) {
      return (
        <div className={styles.emptyChart} data-testid="flights-fetching">
          <Loader2 className={`${styles.emptyChartIcon} animate-spin`} />
          <p>Fetching latest flight prices…</p>
        </div>
      );
    }
    return (
      <div className={styles.emptyChart}>
        <Plane className={styles.emptyChartIcon} />
        <p>No flight offers available</p>
      </div>
    );
  }

  return (
    <div className={styles.flightsList}>
      <div className={styles.flightsHeaderRow}>
        <span aria-hidden /> {/* radio column */}
        <SortHeader label="Airline" sortKey="airline" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
        <SortHeader label="Time" sortKey="time" activeKey={sortKey} direction={sortDir} align="center" className={styles.timeSortHeader} onSort={handleSort} />
        <SortHeader label="Stops" sortKey="stops" activeKey={sortKey} direction={sortDir} align="center" onSort={handleSort} />
        <SortHeader label="Price" sortKey="price" activeKey={sortKey} direction={sortDir} align="right" onSort={handleSort} />
        <span aria-hidden /> {/* chevron column */}
      </div>
      {sortedFlights.map((flight) => {
        const stableKey = flightStableKey(flight);
        return (
          <FlightRow
            key={flight.id}
            flight={flight}
            isSelected={stableKey === selectedFlightKey}
            isExpanded={stableKey === expandedFlightKey}
            onSelect={onSelectFlight}
          />
        );
      })}
    </div>
  );
}

function HotelsList({
  hotels,
  selectedHotelKey,
  onSelectHotel,
  nights,
  isFetching = false,
}: {
  hotels: ApiHotelOffer[];
  selectedHotelKey: string | null;
  onSelectHotel: (stableKey: string) => void;
  nights: number;
  isFetching?: boolean;
}) {
  if (hotels.length === 0) {
    if (isFetching) {
      return (
        <div className={styles.emptyChart} data-testid="hotels-fetching">
          <Loader2 className={`${styles.emptyChartIcon} animate-spin`} />
          <p>Fetching latest hotel prices…</p>
        </div>
      );
    }
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
        const stableKey = hotelStableKey(hotel);
        const isSelected = stableKey === selectedHotelKey;
        return (
          <button
            key={hotel.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`${styles.hotelCardCompact} ${isSelected ? styles.hotelSelected : ""}`}
            onClick={() => onSelectHotel(stableKey)}
          >
            <span className={styles.hotelRadioCompact} aria-hidden="true">
              <span className={`${styles.radioOuter} ${isSelected ? styles.radioSelected : ""}`}>
                {isSelected && <span className={styles.radioInner} />}
              </span>
            </span>
            <HotelPhoto alt={hotel.name} />
            <span className={styles.hotelNameCompact} title={hotel.name}>
              {hotel.name}
              {hotel.rating && (
                <span className={styles.hotelRating}>
                  {" "}
                  {renderStars(hotel.rating)}
                </span>
              )}
            </span>
            <span className={`${styles.hotelPriceCompact} ${isSelected ? styles.hotelPriceSelected : ""}`}>
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
  const [selection, dispatchSelection] = useReducer(selectionReducer, INITIAL_SELECTION);
  const [offersTab, setOffersTab] = useState<"flights" | "hotels">("flights");

  const fetchTripDetails = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);
      const response = await api.trips.getDetails(tripId);
      setTrip(response.data.trip);
      setPriceHistory(response.data.price_history);
      const { flightId, hotelId } = cheapestSelection(response.data.price_history[0]);
      dispatchSelection({ type: "preselect", flightId, hotelId });
    } catch (err) {
      setError(resolveTripErrorMessage(err));
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [tripId]);

  useEffect(() => {
    fetchTripDetails();
  }, [fetchTripDetails]);

  // Listen for SSE price updates for this trip
  const sseContext = useSSEContextOptional();
  const priceUpdates = sseContext?.priceUpdates;
  const lastUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!priceUpdates || !tripId) return;

    // Find the latest price update for this trip
    const tripUpdate = priceUpdates.find((u) => u.trip_id === tripId);
    if (!tripUpdate) return;

    // Only refetch if this is a new update (compare updated_at timestamp)
    if (tripUpdate.updated_at === lastUpdateRef.current) return;
    lastUpdateRef.current = tripUpdate.updated_at;

    // Skip if we're already loading initial data (avoid duplicate fetches)
    if (isLoading) return;

    // Refetch trip details to get the full snapshot with offers
    // Don't show loading skeleton during refresh - keep existing UI visible
    fetchTripDetails(false).then(() => {
      // Stop the spinner once data is fetched
      setIsRefreshing(false);
    });
  }, [priceUpdates, tripId, isLoading, fetchTripDetails]);

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

    try {
      const refreshResponse = await api.trips.refresh(tripId);
      const refreshGroupId = refreshResponse.data.refresh_group_id;
      toast.success("Refresh started - prices will update automatically");

      // Poll refresh-status so we can surface upstream failures to the user.
      // The workflow raises on Skiplagged errors (and does NOT save a snapshot),
      // so we need this signal — there's no other channel that tells the UI
      // "the fetch failed" vs. "the fetch found nothing".
      pollRefreshStatus(refreshGroupId).catch(stopRefreshSpinner);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail || "Failed to refresh trip");
      } else {
        toast.error("Failed to refresh trip");
      }
      setIsRefreshing(false);
    }
  };

  // Flipped on unmount so in-flight poll loops stop instead of hitting the
  // API (and calling setState) for up to 60s after navigating away.
  const pollAbortedRef = useRef(false);
  useEffect(() => {
    pollAbortedRef.current = false;
    return () => {
      pollAbortedRef.current = true;
    };
  }, []);

  const stopRefreshSpinner = useCallback(() => setIsRefreshing(false), []);

  // Handle one refresh-status result: returns true when polling should stop.
  const settleRefreshStatus = useCallback(
    async (status: { status: string; error?: string | null }) => {
      if (status.status === "completed") {
        // Refetch directly — SSE also delivers the snapshot, but the
        // stream can be expired/disconnected, so don't depend on it.
        await fetchTripDetails(false);
        stopRefreshSpinner();
        return true;
      }
      if (status.status === "failed") {
        toast.error(
          status.error
            ? `Price refresh failed: ${status.error}`
            : "Price refresh failed. Please try again in a moment."
        );
        stopRefreshSpinner();
        return true;
      }
      // "running" / "pending" — keep polling.
      return false;
    },
    [fetchTripDetails, stopRefreshSpinner]
  );

  const pollRefreshStatus = useCallback(
    async (refreshGroupId: string) => {
      const POLL_INTERVAL_MS = 2_000;
      const INITIAL_DELAY_MS = 500;
      const MAX_POLL_MS = 60_000;
      const MAX_NOT_FOUND = 3;
      const deadline = Date.now() + MAX_POLL_MS;
      let first = true;
      let notFoundCount = 0;

      while (Date.now() < deadline) {
        await new Promise((resolve) =>
          setTimeout(resolve, first ? INITIAL_DELAY_MS : POLL_INTERVAL_MS)
        );
        if (pollAbortedRef.current) return;
        first = false;
        try {
          const { data: status } = await api.trips.getRefreshStatus(refreshGroupId);
          notFoundCount = 0;
          if (await settleRefreshStatus(status)) return;
        } catch (err) {
          // The endpoint may briefly 404 while Temporal registers the
          // workflow — tolerate a few, but a persistent 404 means the
          // workflow doesn't exist (e.g. history already purged): stop.
          // Other transient failures: keep polling until the deadline.
          if (err instanceof ApiError && err.status === 404) {
            notFoundCount += 1;
            if (notFoundCount >= MAX_NOT_FOUND) {
              stopRefreshSpinner();
              return;
            }
          }
        }
      }
      // Timed out waiting for completion — stop the spinner and stay quiet.
      // SSE will still deliver the snapshot if/when it lands.
      stopRefreshSpinner();
    },
    [settleRefreshStatus, stopRefreshSpinner]
  );

  // Creating a trip kicks off an initial PriceCheckWorkflow server-side with
  // the deterministic id `price-check-<tripId>`. When the page loads a
  // just-created trip that has no snapshots yet, surface that in-flight fetch
  // instead of a bare "No offers" state: show the refreshing indicator and
  // poll until it lands. Recency-gated so an old snapshot-less trip doesn't
  // spin on every visit.
  const initialFetchPollStarted = useRef(false);
  useEffect(() => {
    if (initialFetchPollStarted.current) return;
    if (isLoading || !trip) return;
    if (priceHistory.length > 0) return;
    if (trip.status.toLowerCase() !== "active") return;
    const createdAt = Date.parse(trip.created_at ?? "");
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > INITIAL_FETCH_WINDOW_MS) return;
    initialFetchPollStarted.current = true;
    setIsRefreshing(true);
    pollRefreshStatus(`price-check-${tripId}`).catch(stopRefreshSpinner);
  }, [isLoading, trip, priceHistory, tripId, pollRefreshStatus, stopRefreshSpinner]);

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
  const selectedHotelKey = selection.selectedHotelId;
  const selectedFlightKey = selection.selectedFlightId;
  const selectedHotel = selectedHotelKey
    ? latestOffers.hotels.find((h) => hotelStableKey(h) === selectedHotelKey)
    : null;
  const selectedFlight = selectedFlightKey
    ? latestOffers.flights.find((f) => flightStableKey(f) === selectedFlightKey)
    : null;

  const effectiveHotelPrice = selectedHotel ? parsePrice(selectedHotel.price) : hotelPriceValue;
  const effectiveFlightPrice = selectedFlight ? parsePrice(selectedFlight.price) : flightPriceValue;
  const selectedFlightLabel = selectedFlight ? flightDisplayLabel(selectedFlight) : undefined;
  const selectedHotelLabel = selectedHotel ? selectedHotel.name ?? undefined : undefined;
  const effectiveTotalPrice =
    effectiveFlightPrice != null && effectiveHotelPrice != null
      ? effectiveFlightPrice + effectiveHotelPrice
      : effectiveFlightPrice ?? effectiveHotelPrice;

  const isActive = trip.status.toLowerCase() === "active";
  const hasHotelTracking = trip.hotel_prefs !== null && trip.hotel_prefs !== undefined;

  // Calculate trend from price history (API returns descending order - newest first)
  const hasTrend = priceHistory.length >= 2;
  const currentTotal = effectiveTotalPrice ?? 0;
  const previousTotal = hasTrend
    ? parsePrice(priceHistory[1]?.total_price)
    : null;

  return (
    <div className={styles.containerCompact}>
      {/* Header */}
      <div className={`${styles.header} ${styles.stickyRegion}`}>
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
            {trip.return_date
              ? `${formatShortDate(trip.depart_date)}–${formatShortDate(trip.return_date)}`
              : formatShortDate(trip.depart_date)}
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
        {hasHotelTracking && (
          <>
            <span className={styles.pricePlus}>+</span>
            <div className={styles.priceItem}>
              <Hotel className="h-4 w-4" />
              <span className={styles.priceItemLabel}>Hotel</span>
              <span className={styles.priceItemValue}>
                {formatPrice(effectiveHotelPrice)}
              </span>
            </div>
            <span className={styles.priceEquals}>=</span>
            <div className={`${styles.priceTotal} ${styles.auroraTotalCard}`}>
              <span className={styles.priceTotalValue} data-testid="trip-total">
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
          </>
        )}
        {!hasHotelTracking && (
          <div className={`${styles.priceTotal} ${styles.auroraTotalCard}`}>
            <span className={styles.priceTotalValue} data-testid="trip-total">
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
        )}
      </div>

      {/* Main Content Grid — chart left, offers right */}
      <div className={styles.offersGrid}>
        {/* Chart */}
        <Card className={styles.chartCard}>
          <CardContent className={styles.chartCardContent}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTitle}>Price History</span>
              <div className={styles.chartLegendCompact}>
                {hasHotelTracking && (
                  <span>
                    <span
                      className={`${styles.legendLine} ${styles.legendLineThick}`}
                      style={{ borderTopColor: "hsl(var(--chart-1))" }}
                    />{" "}
                    Total
                  </span>
                )}
                <span>
                  <span
                    className={`${styles.legendLine} ${styles.legendLineDashed}`}
                    style={{ borderTopColor: "hsl(var(--chart-2))" }}
                  />{" "}
                  Flight (min)
                </span>
                {selectedFlightKey && (
                  <span>
                    <span
                      className={styles.legendLine}
                      style={{ borderTopColor: "hsl(var(--chart-2))" }}
                    />{" "}
                    {selectedFlightLabel ?? "Selected Flight"}
                  </span>
                )}
                {hasHotelTracking && (
                  <span>
                    <span
                      className={`${styles.legendLine} ${styles.legendLineDashed}`}
                      style={{ borderTopColor: "hsl(var(--chart-3))" }}
                    />{" "}
                    Hotel (min)
                  </span>
                )}
                {hasHotelTracking && selectedHotelKey && (
                  <span>
                    <span
                      className={styles.legendLine}
                      style={{ borderTopColor: "hsl(var(--chart-3))" }}
                    />{" "}
                    {selectedHotelLabel ?? "Selected Hotel"}
                  </span>
                )}
              </div>
            </div>
            <PriceHistoryChart
              priceHistory={priceHistory}
              selectedHotelKey={selectedHotelKey}
              selectedHotelLabel={selectedHotelLabel}
              selectedFlightKey={selectedFlightKey}
              selectedFlightLabel={selectedFlightLabel}
              showHotel={hasHotelTracking}
              nowTotal={effectiveTotalPrice}
            />
          </CardContent>
        </Card>

        {/* Offers panel — tabs when tracking both, plain list when flights-only */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            {hasHotelTracking ? (
              <>
                <div className={styles.offersTabs}>
                  <button
                    type="button"
                    className={`${styles.offersTab} ${offersTab === "flights" ? styles.offersTabActive : ""}`}
                    onClick={() => setOffersTab("flights")}
                  >
                    <Plane className="h-4 w-4" />
                    Flights
                  </button>
                  <button
                    type="button"
                    className={`${styles.offersTab} ${offersTab === "hotels" ? styles.offersTabActive : ""}`}
                    onClick={() => setOffersTab("hotels")}
                  >
                    <Hotel className="h-4 w-4" />
                    Hotels
                  </button>
                </div>
                {offersTab === "flights" ? (
                  <FlightsList
                    flights={latestOffers.flights}
                    selectedFlightKey={selectedFlightKey}
                    expandedFlightKey={selection.expandedFlightId}
                    onSelectFlight={(id) => dispatchSelection({ type: "selectFlight", id })}
                    isFetching={isRefreshing}
                  />
                ) : (
                  <HotelsList
                    hotels={latestOffers.hotels}
                    selectedHotelKey={selectedHotelKey}
                    onSelectHotel={(id) => dispatchSelection({ type: "selectHotel", id })}
                    nights={nights}
                    isFetching={isRefreshing}
                  />
                )}
              </>
            ) : (
              <>
                <div className={styles.listHeader}>
                  <Plane className="h-4 w-4" />
                  <span>Flights</span>
                </div>
                <FlightsList
                  flights={latestOffers.flights}
                  selectedFlightKey={selectedFlightKey}
                  expandedFlightKey={selection.expandedFlightId}
                  onSelectFlight={(id) => dispatchSelection({ type: "selectFlight", id })}
                  isFetching={isRefreshing}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
