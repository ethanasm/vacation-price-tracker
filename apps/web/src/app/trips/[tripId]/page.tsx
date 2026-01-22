"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Plane,
  Hotel,
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
import type {
  TripDetail,
  FlightOffer,
  HotelOffer,
  HotelPriceHistory,
} from "@/lib/api";
import {
  formatPrice,
  formatShortDate,
  formatDuration,
  formatFlightTime,
} from "@/lib/format";
import { mockTripsData } from "@/lib/mock-data";
import styles from "./page.module.css";

const parsePrice = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getHotelShortName = (name: string | null | undefined): string => {
  if (!name) return "Hotel";
  return name.split(" ")[0] || "Hotel";
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
  hotelPriceHistories,
  selectedHotelId,
  flightPrice,
  selectedHotelName,
}: {
  hotelPriceHistories: HotelPriceHistory[];
  selectedHotelId: string | null;
  flightPrice: string | null;
  selectedHotelName: string;
}) {
  const selectedHistory =
    hotelPriceHistories.find((h) => h.hotel_id === selectedHotelId) ??
    hotelPriceHistories[0];

  if (!selectedHistory || selectedHistory.snapshots.length === 0) {
    return (
      <div className={styles.emptyChart}>
        <TrendingUp className={styles.emptyChartIcon} />
        <p>No price history yet</p>
      </div>
    );
  }

  const flightPriceNum = parsePrice(flightPrice) ?? 0;

  const chartData = selectedHistory.snapshots.map((snapshot) => ({
    date: formatShortDate(snapshot.date),
    total: (parsePrice(snapshot.total_price) ?? 0) + flightPriceNum,
    flight: flightPriceNum,
    hotel: parsePrice(snapshot.total_price) ?? 0,
  }));

  const chartConfig = {
    total: { label: "Total", color: "hsl(var(--chart-1))" },
    flight: { label: "Flight", color: "hsl(var(--chart-2))" },
    hotel: { label: selectedHotelName, color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className={styles.chartContainer}>
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} tickMargin={4} tickFormatter={(v) => `$${v}`} fontSize={11} width={45} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span>
                  {chartConfig[name as keyof typeof chartConfig]?.label}: <strong>${Number(value).toLocaleString()}</strong>
                </span>
              )}
            />
          }
        />
        <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot={{ r: 3 }} />
        <Line dataKey="flight" type="monotone" stroke="var(--color-flight)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
        <Line dataKey="hotel" type="monotone" stroke="var(--color-hotel)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
      </LineChart>
    </ChartContainer>
  );
}

function PriceTrend({ currentPrice, previousPrice }: { currentPrice: number; previousPrice: number }) {
  if (!Number.isFinite(previousPrice) || previousPrice <= 0 || !Number.isFinite(currentPrice)) {
    return null;
  }
  const diff = currentPrice - previousPrice;
  const percentChange = ((diff / previousPrice) * 100).toFixed(1);
  const isDown = diff < 0;

  return (
    <span className={`${styles.trendInline} ${isDown ? styles.trendDown : styles.trendUp}`}>
      {isDown ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {isDown ? "" : "+"}
      {percentChange}%
    </span>
  );
}

function FlightOption({ flight, isFirst }: { flight: FlightOffer; isFirst: boolean }) {
  const outboundAirline = flight.airline_code ?? flight.airline?.substring(0, 2).toUpperCase() ?? "—";
  // Extract airline code from return flight number (e.g., "UA 456" -> "UA")
  const returnAirline = flight.return_flight?.flight_number?.split(/[\s\d]/)[0] || outboundAirline;

  return (
    <div className={`${styles.flightCard} ${isFirst ? styles.bestFlight : ""}`}>
      <div className={styles.flightRow}>
        <div className={styles.flightLegs}>
          <div className={styles.flightLeg}>
            <span className={styles.airlineCode}>{outboundAirline}</span>
            <span className={styles.flightTimes}>{formatFlightTime(flight.departure_time)}–{formatFlightTime(flight.arrival_time)}</span>
            <span className={styles.flightMeta}>{formatDuration(flight.duration_minutes)}</span>
          </div>
          {flight.return_flight && (
            <div className={styles.flightLeg}>
              <span className={styles.airlineCode}>{returnAirline}</span>
              <span className={styles.flightTimes}>{formatFlightTime(flight.return_flight.departure_time)}–{formatFlightTime(flight.return_flight.arrival_time)}</span>
              <span className={styles.flightMeta}>{formatDuration(flight.return_flight.duration_minutes)}</span>
            </div>
          )}
        </div>
        <div className={styles.flightPriceCol}>
          <span className={styles.flightPrice}>{formatPrice(flight.price)}</span>
          {isFirst && <span className={styles.bestLabel}>Best</span>}
        </div>
      </div>
    </div>
  );
}

function HotelOption({
  hotel,
  isSelected,
  onSelect,
}: {
  hotel: HotelOffer;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.hotelCardCompact} ${isSelected ? styles.hotelSelected : ""}`}
      onClick={onSelect}
    >
      <div className={styles.hotelRadioCompact}>
        <div className={`${styles.radioOuter} ${isSelected ? styles.radioSelected : ""}`}>
          {isSelected && <div className={styles.radioInner} />}
        </div>
      </div>
      <span className={styles.hotelNameCompact}>{hotel.hotel_name}</span>
      <span className={styles.hotelPriceCompact}>{formatPrice(hotel.total_price)}</span>
    </button>
  );
}

export default function TripDetailPage({
  params,
}: Readonly<{
  params: Promise<{ tripId: string }>;
}>) {
  const router = useRouter();
  const { tripId } = use(params);

  const mockData = mockTripsData[tripId];
  const initialTrip = mockData?.trip ?? null;
  const initialFlights = mockData?.top_flights ?? [];
  const initialHotels = mockData?.tracked_hotels ?? [];
  const initialHotelHistories = mockData?.hotel_price_histories ?? [];
  const initialSelectedHotel = initialHotels.length > 0 ? initialHotels[0].hotel_id : null;

  const [trip, setTrip] = useState<TripDetail | null>(initialTrip);
  const [topFlights] = useState<FlightOffer[]>(initialFlights);
  const [trackedHotels] = useState<HotelOffer[]>(initialHotels);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(initialSelectedHotel);
  const [hotelPriceHistories] = useState<HotelPriceHistory[]>(initialHotelHistories);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStatusToggle = async (checked: boolean) => {
    if (!tripId || !trip) return;
    setIsUpdatingStatus(true);
    const newStatus = checked ? "active" : "paused";
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTrip({ ...trip, status: newStatus });
      toast.success(newStatus === "active" ? "Tracking resumed" : "Tracking paused");
    } catch {
      toast.error("Failed to update trip status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!tripId) return;
    setIsDeleting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("Trip deleted");
      router.push("/trips");
    } catch {
      toast.error("Failed to delete trip");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!trip) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h2>Trip not found</h2>
          <Button variant="outline" onClick={() => router.push("/trips")}>
            <ArrowLeft className="h-4 w-4" /> Back to trips
          </Button>
        </div>
      </div>
    );
  }

  const selectedHotel = trackedHotels.find((h) => h.hotel_id === selectedHotelId);
  const flightPrice = topFlights.length > 0 ? topFlights[0].price : trip.current_flight_price;
  const hotelPrice = selectedHotel?.total_price ?? trip.current_hotel_price;
  const flightPriceValue = parsePrice(flightPrice);
  const hotelPriceValue = parsePrice(hotelPrice);
  const totalPriceValue =
    flightPriceValue !== null && hotelPriceValue !== null
      ? flightPriceValue + hotelPriceValue
      : parsePrice(trip.total_price);
  const selectedHotelShortName = getHotelShortName(selectedHotel?.hotel_name);

  const isActive = trip.status.toLowerCase() === "active";

  // Calculate trend from hotel history
  const selectedHistory =
    hotelPriceHistories.find((h) => h.hotel_id === selectedHotel?.hotel_id) ??
    hotelPriceHistories[0];
  const hasTrend = Boolean(selectedHistory && selectedHistory.snapshots.length >= 2);
  const currentTotal = totalPriceValue ?? 0;
  const previousHotelPrice = hasTrend
    ? parsePrice(selectedHistory?.snapshots[selectedHistory.snapshots.length - 2]?.total_price)
    : null;
  const previousTotal =
    previousHotelPrice !== null && flightPriceValue !== null
      ? previousHotelPrice + flightPriceValue
      : null;

  return (
    <div className={styles.containerCompact}>
      {/* Header */}
      <div className={styles.headerCompact}>
        <Button variant="ghost" size="icon" onClick={() => router.push("/trips")} className={styles.backButton}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className={styles.headerInfo}>
          <h1 className={styles.titleCompact}>{trip.name}</h1>
          <span className={styles.routeCompact}>
            {trip.origin_airport} {trip.is_round_trip ? "↔" : "→"} {trip.destination_code} · {formatShortDate(trip.depart_date)}–{trip.return_date ? formatShortDate(trip.return_date) : ""}
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
            <Badge variant={getStatusVariant(trip.status)}>{trip.status.toUpperCase()}</Badge>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{trip.name}&quot; and all price history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
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
          <span className={styles.priceItemValue}>{formatPrice(flightPriceValue)}</span>
        </div>
        <span className={styles.pricePlus}>+</span>
        <div className={styles.priceItem}>
          <Hotel className="h-4 w-4" />
          <span className={styles.priceItemLabel}>{selectedHotelShortName}</span>
          <span className={styles.priceItemValue}>{formatPrice(hotelPriceValue)}</span>
        </div>
        <span className={styles.priceEquals}>=</span>
        <div className={styles.priceTotal}>
          <span className={styles.priceTotalValue}>{formatPrice(totalPriceValue)}</span>
          {hasTrend && previousTotal !== null && currentTotal !== previousTotal && (
            <PriceTrend currentPrice={currentTotal} previousPrice={previousTotal} />
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
                <span><span className={styles.legendDot} style={{ background: "hsl(var(--chart-1))" }} /> Total</span>
                <span><span className={styles.legendDot} style={{ background: "hsl(var(--chart-2))" }} /> Flight</span>
                <span><span className={styles.legendDot} style={{ background: "hsl(var(--chart-3))" }} /> {selectedHotelShortName}</span>
              </div>
            </div>
            <PriceHistoryChart
              hotelPriceHistories={hotelPriceHistories}
              selectedHotelId={selectedHotelId}
              flightPrice={flightPrice ?? null}
              selectedHotelName={selectedHotelShortName}
            />
          </CardContent>
        </Card>

        {/* Hotels */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            <div className={styles.listHeader}>
              <Hotel className="h-4 w-4" />
              <span>Hotels</span>
            </div>
            <div className={styles.hotelsListCompact}>
              {trackedHotels.map((hotel) => (
                <HotelOption
                  key={hotel.id}
                  hotel={hotel}
                  isSelected={selectedHotelId === hotel.hotel_id}
                  onSelect={() => setSelectedHotelId(hotel.hotel_id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Flights */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            <div className={styles.listHeader}>
              <Plane className="h-4 w-4" />
              <span>Flights</span>
            </div>
            <div className={styles.flightsListCompact}>
              {topFlights.slice(0, 3).map((flight, i) => (
                <FlightOption key={flight.id} flight={flight} isFirst={i === 0} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
