/**
 * Edit-trip modal — the mobile twin of web's /trips/[tripId]/edit. Loads the
 * trip, seeds the same grouped Aurora form as trip/new, and PATCHes a
 * TripUpdate via useApiClient().updateTrip. Pref fields the mobile form
 * doesn't expose (airlines, max stops, rooms, room types, views, star rating,
 * email/SMS toggles) are preserved from the loaded trip rather than reset, and
 * disabling flight/hotel tracking omits the prefs object entirely so the
 * saved preferences survive a re-enable.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/lib/theme';
import { useApiClient } from '@/lib/api/provider';
import type { TripDetail, TripUpdate } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { AuroraCard, GradientButton, SegmentedControl, type SegmentedOption } from '@/components/aurora';
import { FormField } from '@/components/aurora/form-field';
import { ToggleRow } from '@/components/aurora/toggle-row';
import { CollapsibleSection } from '@/components/aurora/collapsible-section';

type Cabin = 'economy' | 'premium_economy' | 'business' | 'first';
const CABIN_OPTIONS: SegmentedOption<Cabin>[] = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function EditTripScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const api = useApiClient();

  const query = useQuery({
    queryKey: ['trip', id],
    queryFn: () => api.getTrip(id as string),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: tokens.color.pageBg }]}>
        <ActivityIndicator color={tokens.color.primary} />
      </SafeAreaView>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: tokens.color.pageBg }]}>
        <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[700], fontSize: 17 }}>
          Couldn’t load this trip
        </Text>
        <View style={styles.retryWrap}>
          <GradientButton label="Try again" onPress={() => void query.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  return <EditTripForm trip={query.data.trip} />;
}

/** Seed the threshold field: blank when the trip notifies on every refresh. */
function seedThreshold(trip: TripDetail): string {
  const prefs = trip.notification_prefs;
  if (!prefs || prefs.notify_without_threshold) return '';
  const value = Number.parseFloat(prefs.threshold_value);
  return Number.isFinite(value) && value > 0 ? String(value) : '';
}

function EditTripForm({ trip }: { trip: TripDetail }): React.JSX.Element {
  const { tokens } = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const [name, setName] = React.useState(trip.name);
  const [origin, setOrigin] = React.useState(trip.origin_airport);
  const [destination, setDestination] = React.useState(trip.destination_code);
  const [departDate, setDepartDate] = React.useState(trip.depart_date);
  const [returnDate, setReturnDate] = React.useState(trip.return_date ?? '');
  const [adults, setAdults] = React.useState(String(trip.adults));

  const [flightEnabled, setFlightEnabled] = React.useState(trip.track_flights);
  const [flightExpanded, setFlightExpanded] = React.useState(false);
  const [cabin, setCabin] = React.useState<Cabin>(trip.flight_prefs?.cabin ?? 'economy');
  const [nonStopOnly, setNonStopOnly] = React.useState(trip.flight_prefs?.stops_mode === 'nonstop');

  const [hotelEnabled, setHotelEnabled] = React.useState(trip.track_hotels);
  const [hotelExpanded, setHotelExpanded] = React.useState(false);
  const [hotelCity, setHotelCity] = React.useState(trip.hotel_prefs?.city ?? '');

  const [threshold, setThreshold] = React.useState(() => seedThreshold(trip));

  const [validationError, setValidationError] = React.useState<string | null>(null);

  function swap(): void {
    setOrigin(destination);
    setDestination(origin);
  }

  function validate(): string | null {
    if (!name.trim()) return 'Trip name is required.';
    if (!origin.trim()) return 'From (origin) is required.';
    if (!destination.trim()) return 'To (destination) is required.';
    if (!DATE_RE.test(departDate.trim())) return 'Depart date must be YYYY-MM-DD.';
    if (returnDate.trim() && !DATE_RE.test(returnDate.trim())) return 'Return date must be YYYY-MM-DD.';
    if (hotelEnabled && !hotelCity.trim()) return 'Hotel city is required when tracking hotels.';
    return null;
  }

  function buildUpdate(): TripUpdate {
    const isRoundTrip = returnDate.trim().length > 0;
    const thresholdValue = Number.parseFloat(threshold);
    const hasThreshold = Number.isFinite(thresholdValue) && thresholdValue > 0;
    const existingNotify = trip.notification_prefs;

    // The mobile form edits a subset of each prefs object — start from the
    // trip's saved prefs so untouched fields round-trip unchanged.
    const body: TripUpdate = {
      name: name.trim(),
      origin_airport: origin.trim().toUpperCase(),
      destination_code: destination.trim().toUpperCase(),
      is_round_trip: isRoundTrip,
      depart_date: departDate.trim(),
      return_date: isRoundTrip ? returnDate.trim() : null,
      adults: Math.max(1, Number.parseInt(adults, 10) || 1),
      track_flights: flightEnabled,
      track_hotels: hotelEnabled,
      notification_prefs: {
        threshold_type: existingNotify?.threshold_type ?? 'trip_total',
        threshold_value: hasThreshold ? thresholdValue : 0,
        notify_without_threshold: !hasThreshold,
        email_enabled: existingNotify?.email_enabled ?? true,
        sms_enabled: existingNotify?.sms_enabled ?? false,
      },
    };
    if (flightEnabled) {
      const existing = trip.flight_prefs;
      body.flight_prefs = {
        airlines: existing?.airlines ?? [],
        // The toggle only distinguishes nonstop from "not nonstop" — keep a
        // saved '1-stop' preference instead of collapsing it to 'any'.
        stops_mode: nonStopOnly
          ? 'nonstop'
          : existing?.stops_mode && existing.stops_mode !== 'nonstop'
            ? existing.stops_mode
            : 'any',
        max_stops: existing?.max_stops ?? null,
        cabin,
      };
    }
    if (hotelEnabled) {
      const existing = trip.hotel_prefs;
      body.hotel_prefs = {
        rooms: existing?.rooms ?? 1,
        adults_per_room: existing?.adults_per_room ?? 2,
        city: hotelCity.trim(),
        room_selection_mode: existing?.room_selection_mode ?? 'cheapest',
        preferred_room_types: existing?.preferred_room_types ?? [],
        preferred_views: existing?.preferred_views ?? [],
        min_star_rating: existing?.min_star_rating ?? null,
      };
    }
    return body;
  }

  const mutation = useMutation({
    mutationFn: () => api.updateTrip(trip.id, buildUpdate()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
      router.back();
    },
  });

  function onSubmit(): void {
    const err = validate();
    setValidationError(err);
    if (err) return;
    mutation.mutate();
  }

  const submitError = validationError
    ?? (mutation.error instanceof ApiError
      ? mutation.error.detail
      : mutation.error
        ? 'Could not save changes. Please try again.'
        : null);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={{ color: tokens.color.textStrong, fontFamily: tokens.font[800], fontSize: tokens.type.h1.fontSize, letterSpacing: tokens.type.h1.letterSpacing }}>
            Edit trip
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="edit-trip-close" onPress={() => router.back()} hitSlop={10}>
            <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[700], fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuroraCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: tokens.color.textStrong, fontFamily: tokens.font[700] }]}>Trip details</Text>
            <FormField
              label="Trip name"
              value={name}
              onChangeText={setName}
              placeholder="Summer in Bend"
              testID="edit-trip-name-input"
              autoCapitalize="words"
            />
            <FormField
              label="From"
              value={origin}
              onChangeText={setOrigin}
              placeholder="SFO"
              testID="edit-trip-origin-input"
              accessibilityLabel="From (origin)"
              autoCapitalize="characters"
              maxLength={3}
              right={
                <Pressable accessibilityRole="button" accessibilityLabel="Swap origin and destination" testID="edit-trip-swap" onPress={swap} hitSlop={8} style={[styles.swap, { backgroundColor: tokens.color.chipBg, borderRadius: tokens.radius.inner }]}>
                  <Text style={{ color: tokens.color.primary, fontFamily: tokens.font[700], fontSize: 16 }}>⇄</Text>
                </Pressable>
              }
            />
            <FormField
              label="To"
              value={destination}
              onChangeText={setDestination}
              placeholder="RDM"
              testID="edit-trip-destination-input"
              accessibilityLabel="To (destination)"
              autoCapitalize="characters"
              maxLength={3}
            />
            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <FormField label="Depart" value={departDate} onChangeText={setDepartDate} placeholder="2026-08-22" testID="edit-trip-depart-input" keyboardType="numbers-and-punctuation" maxLength={10} />
              </View>
              <View style={styles.dateCol}>
                <FormField label="Return" value={returnDate} onChangeText={setReturnDate} placeholder="2026-08-26" testID="edit-trip-return-input" keyboardType="numbers-and-punctuation" maxLength={10} />
              </View>
            </View>
            <FormField label="Adults" value={adults} onChangeText={setAdults} placeholder="1" keyboardType="number-pad" maxLength={2} />
          </AuroraCard>

          <AuroraCard style={styles.card}>
            <CollapsibleSection
              title="Flight preferences"
              enabled={flightEnabled}
              onEnabledChange={setFlightEnabled}
              expanded={flightExpanded}
              onToggleExpanded={() => setFlightExpanded((e) => !e)}
              testID="edit-trip-flight-prefs"
            >
              <Text style={[styles.subLabel, { color: tokens.color.textBodyAlt, fontFamily: tokens.font[700] }]}>CABIN</Text>
              <SegmentedControl options={CABIN_OPTIONS} value={cabin} onChange={setCabin} testID="edit-trip-cabin" />
              <View style={{ height: 6 }} />
              <ToggleRow title="Non-stop only" subtitle="Only track non-stop flights" value={nonStopOnly} onValueChange={setNonStopOnly} testID="edit-trip-nonstop" />
            </CollapsibleSection>
          </AuroraCard>

          <AuroraCard style={styles.card}>
            <CollapsibleSection
              title="Hotel preferences"
              enabled={hotelEnabled}
              onEnabledChange={setHotelEnabled}
              expanded={hotelExpanded}
              onToggleExpanded={() => setHotelExpanded((e) => !e)}
              testID="edit-trip-hotel-prefs"
            >
              <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], fontSize: 13 }}>
                Room count, room types, and views carry over from your saved preferences.
              </Text>
            </CollapsibleSection>
            {hotelEnabled ? (
              <View style={styles.hotelCity}>
                <FormField
                  label="Hotel city"
                  value={hotelCity}
                  onChangeText={setHotelCity}
                  placeholder="Maui"
                  testID="edit-trip-hotel-city-input"
                  accessibilityLabel="Hotel city"
                  autoCapitalize="words"
                  maxLength={200}
                />
              </View>
            ) : null}
          </AuroraCard>

          <AuroraCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: tokens.color.textStrong, fontFamily: tokens.font[700] }]}>Alert me when…</Text>
            <FormField
              label="Total drops below ($)"
              value={threshold}
              onChangeText={setThreshold}
              placeholder="800"
              keyboardType="number-pad"
              maxLength={7}
            />
            <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], fontSize: 12 }}>
              Leave blank to be notified on every price refresh.
            </Text>
          </AuroraCard>

          {submitError ? (
            <Text testID="edit-trip-error" style={{ color: tokens.color.warning, fontFamily: tokens.font[600], fontSize: 13, marginBottom: 12 }}>
              {submitError}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerBtn}>
              <GradientButton label="Cancel" variant="secondary" onPress={() => router.back()} testID="edit-trip-cancel" />
            </View>
            <View style={styles.footerBtn}>
              <GradientButton
                label="Save changes"
                onPress={onSubmit}
                loading={mutation.isPending}
                testID="edit-trip-submit"
                accessibilityLabel="Save changes"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  retryWrap: { minWidth: 160 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  card: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, marginBottom: 12 },
  subLabel: { fontSize: 11, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  hotelCity: { marginTop: 12 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateCol: { flex: 1 },
  swap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 12 },
  footerBtn: { flex: 1 },
});
