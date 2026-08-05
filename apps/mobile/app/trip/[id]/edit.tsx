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
  adjustReturnDate,
  hasNoErrors,
  sanitizeDecimal,
  todayIso,
  validateTripFormFields,
  type TripFormErrors,
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

type TripType = 'round_trip' | 'one_way';
const TRIP_TYPE_OPTIONS: SegmentedOption<TripType>[] = [
  { value: 'round_trip', label: 'Round trip' },
  { value: 'one_way', label: 'One-way' },
];

// 1–9 adults, matching the API bound and web's traveler select.
const ADULT_OPTIONS = Array.from({ length: 9 }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? '1 Adult' : `${i + 1} Adults`,
}));

/** Which form card a validation error belongs to, for scroll-to-first-error. */
type ErrorCard = 'details' | 'flight' | 'hotel';
const ERROR_CARD: Record<keyof TripFormErrors, ErrorCard> = {
  name: 'details',
  origin: 'details',
  destination: 'details',
  departDate: 'details',
  returnDate: 'details',
  tracking: 'flight',
  hotelCity: 'hotel',
};

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
  const [hotelCity, setHotelCity] = React.useState(trip.hotel_prefs?.city ?? '');

  const [threshold, setThreshold] = React.useState(() => seedThreshold(trip));

  const [errors, setErrors] = React.useState<TripFormErrors>({});

  const scrollRef = React.useRef<ScrollView>(null);
  const cardYs = React.useRef<Partial<Record<ErrorCard, number>>>({});
  // Per-field offsets within their card, so a submit scrolls to the invalid
  // *field* (the details card is taller than small screens), not just its card.
  const fieldYs = React.useRef<Partial<Record<keyof TripFormErrors, number>>>({});

  function clearError(field: keyof TripFormErrors): void {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function swap(): void {
    setOrigin(destination);
    setDestination(origin);
    clearError('origin');
    clearError('destination');
  }

  function onDepartChange(iso: string): void {
    const prevDepart = departDate;
    setDepartDate(iso);
    // Keep the trip length when the departure moves instead of silently
    // clearing the return (adjustReturnDate leaves an explicitly-valid
    // return untouched).
    setReturnDate(adjustReturnDate(prevDepart, iso, returnDate, maxDate));
    clearError('departDate');
    clearError('returnDate');
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
    const next = validateTripFormFields(
      { name, origin, destination, isRoundTrip, departDate, returnDate, flightEnabled, hotelEnabled, hotelCity },
      minDepart,
    );
    setErrors(next);
    if (!hasNoErrors(next)) {
      const firstField = (Object.keys(ERROR_CARD) as (keyof TripFormErrors)[]).find((key) => next[key]);
      const cardY = firstField ? cardYs.current[ERROR_CARD[firstField]] : undefined;
      const fieldY = firstField ? fieldYs.current[firstField] : undefined;
      scrollRef.current?.scrollTo({ y: Math.max(0, (cardY ?? 0) + (fieldY ?? 0) - 24), animated: true });
      return;
    }
    mutation.mutate();
  }

  // Summary near the submit button: the first inline error (the flagged field
  // may sit scrolled out of view), else the mutation failure.
  const firstErrorMessage =
    (Object.keys(ERROR_CARD) as (keyof TripFormErrors)[])
      .map((key) => errors[key])
      .find(Boolean) ?? null;
  const submitError = firstErrorMessage
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

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* zIndex keeps the airport dropdown overlay above the sibling cards
              below on Android, where elevation stacks per-parent. */}
          <View style={styles.detailsCardWrap} onLayout={(e) => { cardYs.current.details = e.nativeEvent.layout.y; }}>
            <AuroraCard style={styles.card}>
              <Text style={[styles.sectionTitle, { color: tokens.color.textStrong, fontFamily: tokens.font[700] }]}>Trip details</Text>
              <Text style={[styles.subLabel, { color: tokens.color.textBodyAlt, fontFamily: tokens.font[700] }]}>TRIP TYPE</Text>
              <SegmentedControl
                options={TRIP_TYPE_OPTIONS}
                value={isRoundTrip ? 'round_trip' : 'one_way'}
                onChange={(v) => {
                  setIsRoundTrip(v === 'round_trip');
                  clearError('returnDate');
                }}
                testID="edit-trip-round-trip"
              />
              <View style={{ height: 14 }} />
              <View style={styles.originFieldWrap} onLayout={(e) => { fieldYs.current.origin = e.nativeEvent.layout.y; }}>
                <AirportField
                  label="From"
                  value={origin}
                  onChangeText={(v) => { setOrigin(v); clearError('origin'); }}
                  placeholder="Search airports…"
                  testID="edit-trip-origin-input"
                  accessibilityLabel="From (origin)"
                  error={errors.origin}
                  right={
                    <Pressable accessibilityRole="button" accessibilityLabel="Swap origin and destination" testID="edit-trip-swap" onPress={swap} hitSlop={8} style={[styles.swap, { backgroundColor: tokens.color.chipBg, borderRadius: tokens.radius.inner }]}>
                      <Text style={{ color: tokens.color.primary, fontFamily: tokens.font[700], fontSize: 16 }}>⇄</Text>
                    </Pressable>
                  }
                />
              </View>
              <View style={styles.destinationFieldWrap} onLayout={(e) => { fieldYs.current.destination = e.nativeEvent.layout.y; }}>
                <AirportField
                  label="To"
                  value={destination}
                  onChangeText={(v) => { setDestination(v); clearError('destination'); }}
                  placeholder="Search airports…"
                  testID="edit-trip-destination-input"
                  accessibilityLabel="To (destination)"
                  error={errors.destination}
                />
              </View>
              <View
                style={styles.dateRow}
                onLayout={(e) => {
                  fieldYs.current.departDate = e.nativeEvent.layout.y;
                  fieldYs.current.returnDate = e.nativeEvent.layout.y;
                }}
              >
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
                    error={errors.departDate}
                  />
                </View>
                {isRoundTrip ? (
                  <View style={styles.dateCol}>
                    <DateField
                      label="Return"
                      value={returnDate}
                      onChange={(iso) => { setReturnDate(iso); clearError('returnDate'); }}
                      minDate={departDate ? addDaysIso(departDate, 1) : minDepart}
                      maxDate={maxDate}
                      initialMonthDate={departDate || undefined}
                      placeholder="Select date"
                      testID="edit-trip-return-input"
                      accessibilityLabel="Return date"
                      error={errors.returnDate}
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
              <View onLayout={(e) => { fieldYs.current.name = e.nativeEvent.layout.y; }}>
                <FormField
                  label="Trip name"
                  value={name}
                  onChangeText={(v) => { setName(v); clearError('name'); }}
                  placeholder="Summer in Bend"
                  testID="edit-trip-name-input"
                  autoCapitalize="words"
                  maxLength={100}
                  error={errors.name}
                />
              </View>
            </AuroraCard>
          </View>

          <View onLayout={(e) => { cardYs.current.flight = e.nativeEvent.layout.y; }}>
            <AuroraCard style={styles.card}>
              <CollapsibleSection
                title="Flight preferences"
                enabled={flightEnabled}
                onEnabledChange={(v) => { setFlightEnabled(v); clearError('tracking'); }}
                expanded={flightExpanded}
                onToggleExpanded={() => setFlightExpanded((e) => !e)}
                testID="edit-trip-flight-prefs"
              >
                <Text style={[styles.subLabel, { color: tokens.color.textBodyAlt, fontFamily: tokens.font[700] }]}>CABIN</Text>
                <SegmentedControl options={CABIN_OPTIONS} value={cabin} onChange={setCabin} testID="edit-trip-cabin" />
                <View style={{ height: 6 }} />
                <ToggleRow title="Non-stop only" subtitle="Only track non-stop flights" value={nonStopOnly} onValueChange={setNonStopOnly} testID="edit-trip-nonstop" />
              </CollapsibleSection>
              {errors.tracking ? (
                <Text testID="edit-trip-tracking-error" style={{ color: tokens.color.warning, fontFamily: tokens.font[600], fontSize: 12, marginTop: 6 }}>
                  {errors.tracking}
                </Text>
              ) : null}
            </AuroraCard>
          </View>

          <View onLayout={(e) => { cardYs.current.hotel = e.nativeEvent.layout.y; }}>
            <AuroraCard style={styles.card}>
              <ToggleRow
                title="Hotel tracking"
                subtitle={
                  hotelEnabled
                    ? 'Room count, room types, and views keep your saved preferences'
                    : 'Off — this trip tracks flight prices only'
                }
                value={hotelEnabled}
                onValueChange={(v) => { setHotelEnabled(v); clearError('tracking'); clearError('hotelCity'); }}
                testID="edit-trip-hotel-prefs"
              />
              {hotelEnabled ? (
                <View style={styles.hotelCity} onLayout={(e) => { fieldYs.current.hotelCity = e.nativeEvent.layout.y; }}>
                  <FormField
                    label="Hotel city"
                    value={hotelCity}
                    onChangeText={(v) => { setHotelCity(v); clearError('hotelCity'); }}
                    placeholder="Maui"
                    testID="edit-trip-hotel-city-input"
                    accessibilityLabel="Hotel city"
                    autoCapitalize="words"
                    maxLength={200}
                    error={errors.hotelCity}
                  />
                </View>
              ) : null}
            </AuroraCard>
          </View>

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
  detailsCardWrap: { zIndex: 20, elevation: 20 },
  // Static stacking order so each airport dropdown paints over the
  // sibling fields below it (the onLayout wrappers would otherwise
  // reset the fields' own zIndex raise to source order).
  originFieldWrap: { zIndex: 6, elevation: 6 },
  destinationFieldWrap: { zIndex: 5, elevation: 5 },
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
