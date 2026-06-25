import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api/provider';
import { useTheme } from '@/lib/theme';
import { StatusChip, PriceChart, GradientButton } from '@/components/aurora';
import { StatTrio } from '@/components/aurora/stat-trio';
import { FlightRow } from '@/components/aurora/flight-row';
import { HotelRow } from '@/components/aurora/hotel-row';
import {
  initialSelection,
  selectReducer,
  computeTripTotal,
  buildChartSeries,
  parsePrice,
  type FlightOffer,
  type HotelOffer,
  type PriceSnapshot,
} from '@/lib/aurora';
import type { TripDetail, TripDetailResponse } from '@/lib/api/client';

const MAX_VISIBLE = 4;

/** Whole nights between two ISO/`YYYY-MM-DD` dates (min 1 when a return exists). */
function nightsBetween(depart?: string | null, ret?: string | null): number {
  if (!depart || !ret) return 1;
  const a = Date.parse(depart);
  const b = Date.parse(ret);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(Math.round((b - a) / 86400000), 1);
}

function formatDateRange(depart?: string | null, ret?: string | null): string {
  const d = (depart ?? '').slice(5).replace('-', '/');
  const r = (ret ?? '').slice(5).replace('-', '/');
  return ret ? `${d}–${r}` : d;
}

export default function TripDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApiClient();
  const { tokens } = useTheme();
  const c = tokens.color;

  const query = useQuery<TripDetailResponse>({
    queryKey: ['trip', id],
    queryFn: () => api.getTrip(id as string),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: c.pageBg }]}>
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: c.pageBg }]}>
        <Text style={[styles.errorTitle, { color: c.textStrong, fontFamily: tokens.font[700] }]}>
          Couldn’t load this trip
        </Text>
        <View style={styles.retryWrap}>
          <GradientButton label="Try again" onPress={() => void query.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const history = query.data.price_history ?? [];
  const flights = (history.find((s) => (s.flight_offers ?? []).length > 0)?.flight_offers ??
    []) as FlightOffer[];
  const hotels = (history.find((s) => (s.hotel_offers ?? []).length > 0)?.hotel_offers ??
    []) as HotelOffer[];
  // Re-mount the interactive body (re-seeding the cheapest selection) whenever
  // the offer set changes — e.g. after a Refresh brings a fresh snapshot.
  const seedKey = `${flights.map((f) => f.id).join(',')}|${hotels.map((h) => h.id).join(',')}`;

  return (
    <TripDetailBody
      key={seedKey}
      tripId={id as string}
      trip={query.data.trip}
      history={history}
      flights={flights}
      hotels={hotels}
      onRefresh={() => void query.refetch()}
      isRefreshing={query.isRefetching}
    />
  );
}

function TripDetailBody({
  tripId,
  trip,
  history,
  flights,
  hotels,
  onRefresh,
  isRefreshing,
}: {
  tripId: string;
  trip: TripDetail;
  history: PriceSnapshot[];
  flights: FlightOffer[];
  hotels: HotelOffer[];
  onRefresh: () => void;
  isRefreshing: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const { tokens } = useTheme();
  const c = tokens.color;

  const nights = nightsBetween(trip.depart_date, trip.return_date);
  const adults = trip.adults ?? 1;

  const [sel, dispatch] = React.useReducer(selectReducer, undefined, () =>
    initialSelection(flights, hotels),
  );

  const selectedFlight = flights.find((f) => f.id === sel.selectedFlightId) ?? null;
  const selectedHotel = hotels.find((h) => h.id === sel.selectedHotelId) ?? null;
  const flightPrice = selectedFlight ? parsePrice(selectedFlight.price) ?? 0 : 0;
  const hotelPerNight = selectedHotel ? parsePrice(selectedHotel.price) ?? 0 : 0;
  const hotelTotal = Math.round(hotelPerNight * nights);
  const tripTotal = computeTripTotal(selectedFlight, selectedHotel, nights);
  const chart = buildChartSeries(history, tripTotal, hotelTotal);

  const [showAllFlights, setShowAllFlights] = React.useState(false);
  const [showAllHotels, setShowAllHotels] = React.useState(false);
  const visibleFlights = showAllFlights ? flights : flights.slice(0, MAX_VISIBLE);
  const visibleHotels = showAllHotels ? hotels : hotels.slice(0, MAX_VISIBLE);

  const statusTone = trip.status === 'active' ? 'active' : 'paused';
  const route = `${trip.origin_airport} → ${trip.destination_code}`;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.pageBg }]} edges={['top']}>
      {/* Sticky top region — stays pinned while the lists scroll beneath. */}
      <View style={[styles.header, { backgroundColor: c.pageBg, borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.breadcrumb, { color: c.textMuted, fontFamily: tokens.font[600] }]}>
            {`Your Trips  /  ${trip.name}`}
          </Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: c.textStrong, fontFamily: tokens.font[800] }]}>
            {trip.name}
          </Text>
          <StatusChip tone={statusTone} label={trip.status === 'active' ? 'ACTIVE' : 'PAUSED'} />
        </View>

        <Text style={[styles.meta, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
          {`${route} · ${formatDateRange(trip.depart_date, trip.return_date)} · ${nights} night${nights === 1 ? '' : 's'} · ${adults} adult${adults === 1 ? '' : 's'}`}
        </Text>

        <View style={styles.actions}>
          <View style={styles.actionBtn}>
            <GradientButton
              label="Edit"
              variant="secondary"
              onPress={() => router.push(`/trip/${tripId}` as never)}
            />
          </View>
          <View style={styles.actionBtn}>
            <GradientButton
              label={isRefreshing ? 'Refreshing…' : 'Refresh'}
              loading={isRefreshing}
              onPress={onRefresh}
            />
          </View>
        </View>

        <View style={styles.statTrioWrap}>
          <StatTrio
            flight={flightPrice}
            hotelTotal={hotelTotal}
            hotelPerNight={hotelPerNight}
            tripTotal={tripTotal}
          />
        </View>

        <View style={styles.chartWrap}>
          <PriceChart points={chart.points} nowLabel={chart.nowLabel} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {flights.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.textStrong, fontFamily: tokens.font[700] }]}>
              Flights
            </Text>
            {visibleFlights.map((fl) => (
              <FlightRow
                key={fl.id}
                offer={fl}
                nights={nights}
                selected={sel.selectedFlightId === fl.id}
                expanded={sel.expandedFlightId === fl.id}
                onPress={() => dispatch({ kind: 'flight', id: fl.id })}
              />
            ))}
            {flights.length > MAX_VISIBLE && !showAllFlights ? (
              <ShowMore count={flights.length - MAX_VISIBLE} onPress={() => setShowAllFlights(true)} />
            ) : null}
          </View>
        ) : null}

        {hotels.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.textStrong, fontFamily: tokens.font[700] }]}>
              Hotels
            </Text>
            {visibleHotels.map((ho) => (
              <HotelRow
                key={ho.id}
                offer={ho}
                nights={nights}
                selected={sel.selectedHotelId === ho.id}
                expanded={sel.expandedHotelId === ho.id}
                onPress={() => dispatch({ kind: 'hotel', id: ho.id })}
              />
            ))}
            {hotels.length > MAX_VISIBLE && !showAllHotels ? (
              <ShowMore count={hotels.length - MAX_VISIBLE} onPress={() => setShowAllHotels(true)} />
            ) : null}
          </View>
        ) : null}

        {flights.length === 0 && hotels.length === 0 ? (
          <Text style={[styles.empty, { color: c.textMuted, fontFamily: tokens.font[500] }]}>
            No price snapshots yet. Pull Refresh to fetch the latest offers.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShowMore({ count, onPress }: { count: number; onPress: () => void }): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.showMore, { borderColor: c.selectedBorder }]}
    >
      <Text style={{ color: c.primary, fontFamily: tokens.font[700], fontSize: 13 }}>
        {`Show ${count} more`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  errorTitle: { fontSize: 17 },
  retryWrap: { minWidth: 160 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breadcrumb: { fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 24, letterSpacing: -0.5 },
  meta: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1 },
  statTrioWrap: { marginTop: 2 },
  chartWrap: { marginTop: 4 },
  scrollBody: { padding: 16, paddingBottom: 40, gap: 20 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16 },
  showMore: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 30 },
});
