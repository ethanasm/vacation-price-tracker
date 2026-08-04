/**
 * Create-trip modal. Grouped Aurora form: Trip details (trip-type segmented
 * control, From/⇄/To with airport typeahead, calendar date pickers, adults
 * select, auto-suggested trip name), collapsible Flight preferences, a Hotel
 * tracking card, and a threshold card. Submits a TripCreate body via
 * useApiClient().createTrip with an idempotency key, invalidates the trips
 * list, and replaces into the new trip's detail.
 *
 * Validation is inline: every invalid field is flagged at once
 * (validateTripFormFields), the list scrolls to the first invalid card, and a
 * field's error clears as soon as it is edited. Trip name and hotel city
 * auto-fill from the picked destination (and stop as soon as the user edits
 * them). Closing a dirty form asks before discarding.
 *
 * Controls mirror web's create form (apps/web/src/app/trips/new): dates come
 * from a bounded calendar (today … today+359, return after depart), airports
 * from the shared OurAirports typeahead, adults from a 1–9 select, and the
 * threshold input is constrained to a decimal number.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/lib/theme';
import { useApiClient } from '@/lib/api/provider';
import type { TripCreate } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { makeIdempotencyKey } from '@/lib/aurora';
import { findAirportByCode } from '@/lib/locations';
import {
  MAX_DATE_DAYS_OUT,
  addDaysIso,
  adjustReturnDate,
  describeHotelOccupancy,
  hasNoErrors,
  hotelOccupancy,
  sanitizeDecimal,
  suggestTripName,
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

export default function NewTripScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();

  // Date pickers are bounded to [today, today + 359 days], like web.
  const today = React.useMemo(() => todayIso(), []);
  const maxDate = React.useMemo(() => addDaysIso(today, MAX_DATE_DAYS_OUT), [today]);

  // Same defaults as web's create form: out tomorrow, back in a week.
  const initialDepart = React.useMemo(() => addDaysIso(todayIso(), 1), []);
  const initialReturn = React.useMemo(() => addDaysIso(todayIso(), 8), []);

  const [name, setName] = React.useState('');
  const [origin, setOrigin] = React.useState('');
  const [destination, setDestination] = React.useState('');
  const [isRoundTrip, setIsRoundTrip] = React.useState(true);
  const [departDate, setDepartDate] = React.useState(initialDepart);
  const [returnDate, setReturnDate] = React.useState(initialReturn);
  const [adults, setAdults] = React.useState('1');

  const [flightEnabled, setFlightEnabled] = React.useState(true);
  const [flightExpanded, setFlightExpanded] = React.useState(false);
  const [cabin, setCabin] = React.useState<Cabin>('economy');
  const [nonStopOnly, setNonStopOnly] = React.useState(false);

  const [hotelEnabled, setHotelEnabled] = React.useState(true);
  const [hotelCity, setHotelCity] = React.useState('');

  const [threshold, setThreshold] = React.useState('');

  const [errors, setErrors] = React.useState<TripFormErrors>({});

  const scrollRef = React.useRef<ScrollView>(null);
  const cardYs = React.useRef<Partial<Record<ErrorCard, number>>>({});

  // Last auto-filled values: the prefill only ever overwrites its own output,
  // so the moment the user edits either field the automation lets go.
  const autoName = React.useRef('');
  const autoCity = React.useRef('');

  const adultsCount = Math.min(9, Math.max(1, Number.parseInt(adults, 10) || 1));

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

  // Prefill hotel city + trip name from the picked destination. Guarded so a
  // user-typed value is never overwritten — only '' or our own last fill is.
  React.useEffect(() => {
    const airport = findAirportByCode(destination);
    if (!airport) return;
    const place = airport.city || airport.code;
    if (hotelCity === '' || hotelCity === autoCity.current) {
      autoCity.current = place;
      setHotelCity(place);
      clearError('hotelCity');
    }
    const suggested = suggestTripName(place, departDate, returnDate, isRoundTrip);
    if (suggested && (name === '' || name === autoName.current)) {
      autoName.current = suggested;
      setName(suggested);
      clearError('name');
    }
    // Reacts to trip-shape changes only; name/hotelCity are read through the
    // guards above and must not retrigger the prefill mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, departDate, returnDate, isRoundTrip]);

  const mutation = useMutation({
    mutationFn: async (): Promise<{ id: string }> => {
      const thresholdValue = Number.parseFloat(threshold);
      const occupancy = hotelOccupancy(adultsCount);
      const body: TripCreate = {
        name: name.trim(),
        origin_airport: origin.trim().toUpperCase(),
        destination_code: destination.trim().toUpperCase(),
        is_round_trip: isRoundTrip,
        depart_date: departDate,
        return_date: isRoundTrip ? returnDate : null,
        adults: adultsCount,
        track_flights: flightEnabled,
        track_hotels: hotelEnabled,
        flight_prefs: flightEnabled
          ? { stops_mode: nonStopOnly ? 'nonstop' : 'any', cabin }
          : null,
        hotel_prefs: hotelEnabled
          ? {
              rooms: occupancy.rooms,
              adults_per_room: occupancy.adultsPerRoom,
              room_selection_mode: 'cheapest',
              city: hotelCity.trim(),
            }
          : null,
        notification_prefs: {
          threshold_type: 'trip_total',
          threshold_value: Number.isFinite(thresholdValue) ? thresholdValue : 0,
          notify_without_threshold: !Number.isFinite(thresholdValue) || thresholdValue <= 0,
          email_enabled: true,
          sms_enabled: false,
        },
      };
      const created = await api.createTrip(body, makeIdempotencyKey());
      return { id: created.id };
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      router.replace(`/trip/${created.id}`);
    },
  });

  function onSubmit(): void {
    const next = validateTripFormFields(
      { name, origin, destination, isRoundTrip, departDate, returnDate, flightEnabled, hotelEnabled, hotelCity },
      today,
    );
    setErrors(next);
    if (!hasNoErrors(next)) {
      const firstField = (Object.keys(ERROR_CARD) as (keyof TripFormErrors)[]).find((key) => next[key]);
      const y = firstField ? cardYs.current[ERROR_CARD[firstField]] : undefined;
      scrollRef.current?.scrollTo({ y: Math.max(0, (y ?? 0) - 12), animated: true });
      return;
    }
    mutation.mutate();
  }

  function isDirty(): boolean {
    return (
      name !== '' ||
      origin !== '' ||
      destination !== '' ||
      hotelCity !== '' ||
      threshold !== '' ||
      departDate !== initialDepart ||
      returnDate !== initialReturn ||
      adults !== '1' ||
      !isRoundTrip ||
      !flightEnabled ||
      !hotelEnabled ||
      cabin !== 'economy' ||
      nonStopOnly
    );
  }

  function requestClose(): void {
    if (!isDirty()) {
      router.back();
      return;
    }
    const message = 'Your entries will be lost.';
    // window.confirm on web so the Expo web export (the sandbox/e2e
    // verification surface) can exercise the guard; Alert has no web impl.
    if (Platform.OS === 'web') {
      if (window.confirm(`Discard this trip?\n\n${message}`)) router.back();
      return;
    }
    Alert.alert('Discard this trip?', message, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  const submitError = mutation.error instanceof ApiError
    ? mutation.error.detail
    : mutation.error
      ? 'Could not create trip. Please try again.'
      : null;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={{ color: tokens.color.textStrong, fontFamily: tokens.font[800], fontSize: tokens.type.h1.fontSize, letterSpacing: tokens.type.h1.letterSpacing }}>
            Create new trip
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="create-trip-close" onPress={requestClose} hitSlop={10}>
            <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[700], fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View onLayout={(e) => { cardYs.current.details = e.nativeEvent.layout.y; }}>
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
                testID="create-trip-round-trip"
              />
              <View style={{ height: 14 }} />
              <AirportField
                label="From"
                value={origin}
                onChangeText={(v) => { setOrigin(v); clearError('origin'); }}
                placeholder="Search airports…"
                testID="create-trip-origin-input"
                accessibilityLabel="From (origin)"
                error={errors.origin}
                right={
                  <Pressable accessibilityRole="button" accessibilityLabel="Swap origin and destination" testID="create-trip-swap" onPress={swap} hitSlop={8} style={[styles.swap, { backgroundColor: tokens.color.chipBg, borderRadius: tokens.radius.inner }]}>
                    <Text style={{ color: tokens.color.primary, fontFamily: tokens.font[700], fontSize: 16 }}>⇄</Text>
                  </Pressable>
                }
              />
              <AirportField
                label="To"
                value={destination}
                onChangeText={(v) => { setDestination(v); clearError('destination'); }}
                placeholder="Search airports…"
                testID="create-trip-destination-input"
                accessibilityLabel="To (destination)"
                error={errors.destination}
              />
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <DateField
                    label="Depart"
                    value={departDate}
                    onChange={onDepartChange}
                    minDate={today}
                    maxDate={maxDate}
                    placeholder="Select date"
                    testID="create-trip-depart-input"
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
                      minDate={departDate ? addDaysIso(departDate, 1) : today}
                      maxDate={maxDate}
                      initialMonthDate={departDate || undefined}
                      placeholder="Select date"
                      testID="create-trip-return-input"
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
                testID="create-trip-adults"
              />
              <FormField
                label="Trip name"
                value={name}
                onChangeText={(v) => { setName(v); clearError('name'); }}
                placeholder="Summer in Bend"
                testID="create-trip-name-input"
                autoCapitalize="words"
                maxLength={100}
                error={errors.name}
              />
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
                testID="create-trip-flight-prefs"
              >
                <Text style={[styles.subLabel, { color: tokens.color.textBodyAlt, fontFamily: tokens.font[700] }]}>CABIN</Text>
                <SegmentedControl options={CABIN_OPTIONS} value={cabin} onChange={setCabin} testID="create-trip-cabin" />
                <View style={{ height: 6 }} />
                <ToggleRow title="Non-stop only" subtitle="Only track non-stop flights" value={nonStopOnly} onValueChange={setNonStopOnly} testID="create-trip-nonstop" />
              </CollapsibleSection>
              {errors.tracking ? (
                <Text testID="create-trip-tracking-error" style={{ color: tokens.color.warning, fontFamily: tokens.font[600], fontSize: 12, marginTop: 6 }}>
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
                    ? `Cheapest room · ${describeHotelOccupancy(adultsCount)}`
                    : 'Off — this trip tracks flight prices only'
                }
                value={hotelEnabled}
                onValueChange={(v) => { setHotelEnabled(v); clearError('tracking'); clearError('hotelCity'); }}
                testID="create-trip-hotel-prefs"
              />
              {hotelEnabled ? (
                <View style={styles.hotelCity}>
                  <FormField
                    label="Hotel city"
                    value={hotelCity}
                    onChangeText={(v) => { setHotelCity(v); clearError('hotelCity'); }}
                    placeholder="Maui"
                    testID="create-trip-hotel-city-input"
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
            <Text testID="create-trip-error" style={{ color: tokens.color.warning, fontFamily: tokens.font[600], fontSize: 13, marginBottom: 12 }}>
              {submitError}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerBtn}>
              <GradientButton label="Cancel" variant="secondary" onPress={requestClose} testID="create-trip-cancel" />
            </View>
            <View style={styles.footerBtn}>
              <GradientButton
                label="Create trip"
                onPress={onSubmit}
                loading={mutation.isPending}
                testID="create-trip-submit"
                accessibilityLabel="Create trip"
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
