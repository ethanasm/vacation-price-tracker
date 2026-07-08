/**
 * Edit-trip modal — the mobile twin of web's /trips/[tripId]/edit. Loads the
 * trip, seeds the same grouped Aurora form as trip/new (airport typeahead,
 * calendar date pickers, adults select, round-trip toggle), and PATCHes a
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
import type { TripDetail } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { buildTripUpdate, seedThreshold } from '@/lib/trip-edit';
import {
  MAX_DATE_DAYS_OUT,
  addDaysIso,
  sanitizeDecimal,
  todayIso,
  validateTripForm,
} from '@/lib/trip-form';
import { AuroraCard, GradientButton, SegmentedControl, type SegmentedOption } from '@/components/aurora';
import { FormField } from '@/components/aurora/form-field';
import { ToggleRow } from '@/components/aurora/toggle-row';
import { CollapsibleSection } from '@/components/aurora/collapsible-section';
import { AirportField } from '@/components/aurora/airport-field';
import { DateField } from '@/components/aurora/date-field';
import { SelectField } from '@/components/aurora/select-field';

type Cabin = 'economy' | 'premium_economy' | 'business' | 'first';
const CABIN_OPTIONS: SegmentedOption<Cabin>[] = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

// 1–9 adults, matching the API bound and web's traveler select.
const ADULT_OPTIONS = Array.from({ length: 9 }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? '1 Adult' : `${i + 1} Adults`,
}));

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

function EditTripForm({ trip }: { trip: TripDetail }): React.JSX.Element {
  const { tokens } = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();

  // Bound the pickers like web (today … today+359), but let a trip that
  // already departed keep its saved date: the floor drops to that date so
  // renaming an expired trip doesn't force a date change.
  const today = React.useMemo(() => todayIso(), []);
  const minDepart = trip.depart_date && trip.depart_date < today ? trip.depart_date : today;
  const maxDate = React.useMemo(() => addDaysIso(today, MAX_DATE_DAYS_OUT), [today]);

  const [name, setName] = React.useState(trip.name);
  const [origin, setOrigin] = React.useState(trip.origin_airport);
  const [destination, setDestination] = React.useState(trip.destination_code);
  const [isRoundTrip, setIsRoundTrip] = React.useState(trip.is_round_trip);
  const [departDate, setDepartDate] = React.useState(trip.depart_date);
  const [returnDate, setReturnDate] = React.useState(trip.return_date ?? '');
  const [adults, setAdults] = React.useState(String(Math.min(9, Math.max(1, trip.adults))));

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

  function onDepartChange(iso: string): void {
    setDepartDate(iso);
    // A return on/before the new departure can never be valid — clear it so
    // the return picker reopens on the departure month for a fresh pick.
    if (returnDate && returnDate <= iso) setReturnDate('');
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.updateTrip(
        trip.id,
        buildTripUpdate(trip, {
          name,
          origin,
          destination,
          departDate,
          isRoundTrip,
          returnDate,
          adults,
          flightEnabled,
          cabin,
          nonStopOnly,
          hotelEnabled,
          hotelCity,
          threshold,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
      router.back();
    },
  });

  function onSubmit(): void {
    const err = validateTripForm(
      { name, origin, destination, isRoundTrip, departDate, returnDate, flightEnabled, hotelEnabled, hotelCity },
      minDepart,
    );
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
              maxLength={100}
            />
            <AirportField
              label="From"
              value={origin}
              onChangeText={setOrigin}
              placeholder="Search airports…"
              testID="edit-trip-origin-input"
              accessibilityLabel="From (origin)"
              right={
                <Pressable accessibilityRole="button" accessibilityLabel="Swap origin and destination" testID="edit-trip-swap" onPress={swap} hitSlop={8} style={[styles.swap, { backgroundColor: tokens.color.chipBg, borderRadius: tokens.radius.inner }]}>
                  <Text style={{ color: tokens.color.primary, fontFamily: tokens.font[700], fontSize: 16 }}>⇄</Text>
                </Pressable>
              }
            />
            <AirportField
              label="To"
              value={destination}
              onChangeText={setDestination}
              placeholder="Search airports…"
              testID="edit-trip-destination-input"
              accessibilityLabel="To (destination)"
            />
            <View style={styles.dateRow}>
              <View style={styles.dateCol}>
                <DateField
                  label="Depart"
                  value={departDate}
                  onChange={onDepartChange}
                  minDate={minDepart}
                  maxDate={maxDate}
                  placeholder="Select date"
                  testID="edit-trip-depart-input"
                  accessibilityLabel="Departure date"
                />
              </View>
              {isRoundTrip ? (
                <View style={styles.dateCol}>
                  <DateField
                    label="Return"
                    value={returnDate}
                    onChange={setReturnDate}
                    minDate={departDate ? addDaysIso(departDate, 1) : minDepart}
                    maxDate={maxDate}
                    initialMonthDate={departDate || undefined}
                    placeholder="Select date"
                    testID="edit-trip-return-input"
                    accessibilityLabel="Return date"
                  />
                </View>
              ) : null}
            </View>
            <SelectField
              label="Adults"
              value={adults}
              options={ADULT_OPTIONS}
              onChange={setAdults}
              testID="edit-trip-adults"
            />
            <ToggleRow
              title="Round trip"
              subtitle="Track a return flight too"
              value={isRoundTrip}
              onValueChange={setIsRoundTrip}
              testID="edit-trip-round-trip"
            />
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
              onChangeText={(t) => setThreshold(sanitizeDecimal(t))}
              placeholder="800"
              keyboardType="decimal-pad"
              maxLength={9}
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
