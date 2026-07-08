/**
 * Create-trip modal. Grouped Aurora form: Trip details (name, From/⇄/To with
 * airport typeahead, calendar date pickers, adults select, round-trip
 * toggle), collapsible Flight/Hotel preferences, and a threshold card.
 * Submits a TripCreate body via useApiClient().createTrip with an idempotency
 * key, invalidates the trips list, and replaces into the new trip's detail.
 *
 * Controls mirror web's create form (apps/web/src/app/trips/new): dates come
 * from a bounded calendar (today … today+359, return after depart), airports
 * from the shared OurAirports typeahead, adults from a 1–9 select, and the
 * threshold input is constrained to a decimal number.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/lib/theme';
import { useApiClient } from '@/lib/api/provider';
import type { TripCreate } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { makeIdempotencyKey } from '@/lib/aurora';
import {
  MAX_DATE_DAYS_OUT,
  addDaysIso,
  sanitizeDecimal,
  todayIso,
  validateTripForm,
} from '@/lib/trip-form';
import { AuroraCard, GradientButton, SegmentedControl, type SegmentedOption } from '@/components/aurora';
import { SettingsCog } from '@/components/aurora/settings-cog';
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

export default function NewTripScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();

  // Date pickers are bounded to [today, today + 359 days], like web.
  const today = React.useMemo(() => todayIso(), []);
  const maxDate = React.useMemo(() => addDaysIso(today, MAX_DATE_DAYS_OUT), [today]);

  const [name, setName] = React.useState('');
  const [origin, setOrigin] = React.useState('');
  const [destination, setDestination] = React.useState('');
  const [isRoundTrip, setIsRoundTrip] = React.useState(true);
  // Same defaults as web's create form: out tomorrow, back in a week.
  const [departDate, setDepartDate] = React.useState(() => addDaysIso(todayIso(), 1));
  const [returnDate, setReturnDate] = React.useState(() => addDaysIso(todayIso(), 8));
  const [adults, setAdults] = React.useState('1');

  const [flightEnabled, setFlightEnabled] = React.useState(true);
  const [flightExpanded, setFlightExpanded] = React.useState(false);
  const [cabin, setCabin] = React.useState<Cabin>('economy');
  const [nonStopOnly, setNonStopOnly] = React.useState(false);

  const [hotelEnabled, setHotelEnabled] = React.useState(true);
  const [hotelExpanded, setHotelExpanded] = React.useState(false);
  const [hotelCity, setHotelCity] = React.useState('');

  const [threshold, setThreshold] = React.useState('');

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
    mutationFn: async (): Promise<{ id: string }> => {
      const thresholdValue = Number.parseFloat(threshold);
      const body: TripCreate = {
        name: name.trim(),
        origin_airport: origin.trim().toUpperCase(),
        destination_code: destination.trim().toUpperCase(),
        is_round_trip: isRoundTrip,
        depart_date: departDate,
        return_date: isRoundTrip ? returnDate : null,
        adults: Math.min(9, Math.max(1, Number.parseInt(adults, 10) || 1)),
        track_flights: flightEnabled,
        track_hotels: hotelEnabled,
        flight_prefs: flightEnabled
          ? { stops_mode: nonStopOnly ? 'nonstop' : 'any', cabin }
          : null,
        hotel_prefs: hotelEnabled
          ? { rooms: 1, adults_per_room: 2, room_selection_mode: 'cheapest', city: hotelCity.trim() }
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
    const err = validateTripForm(
      { name, origin, destination, isRoundTrip, departDate, returnDate, flightEnabled, hotelEnabled, hotelCity },
      today,
    );
    setValidationError(err);
    if (err) return;
    mutation.mutate();
  }

  const submitError = validationError
    ?? (mutation.error instanceof ApiError
      ? mutation.error.detail
      : mutation.error
        ? 'Could not create trip. Please try again.'
        : null);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={{ color: tokens.color.textStrong, fontFamily: tokens.font[800], fontSize: tokens.type.h1.fontSize, letterSpacing: tokens.type.h1.letterSpacing }}>
            Create new trip
          </Text>
          <View style={styles.headerActions}>
            <SettingsCog />
            <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="create-trip-close" onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[700], fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuroraCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: tokens.color.textStrong, fontFamily: tokens.font[700] }]}>Trip details</Text>
            <FormField
              label="Trip name"
              value={name}
              onChangeText={setName}
              placeholder="Summer in Bend"
              testID="create-trip-name-input"
              autoCapitalize="words"
              maxLength={100}
            />
            <AirportField
              label="From"
              value={origin}
              onChangeText={setOrigin}
              placeholder="Search airports…"
              testID="create-trip-origin-input"
              accessibilityLabel="From (origin)"
              right={
                <Pressable accessibilityRole="button" accessibilityLabel="Swap origin and destination" testID="create-trip-swap" onPress={swap} hitSlop={8} style={[styles.swap, { backgroundColor: tokens.color.chipBg, borderRadius: tokens.radius.inner }]}>
                  <Text style={{ color: tokens.color.primary, fontFamily: tokens.font[700], fontSize: 16 }}>⇄</Text>
                </Pressable>
              }
            />
            <AirportField
              label="To"
              value={destination}
              onChangeText={setDestination}
              placeholder="Search airports…"
              testID="create-trip-destination-input"
              accessibilityLabel="To (destination)"
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
                />
              </View>
              {isRoundTrip ? (
                <View style={styles.dateCol}>
                  <DateField
                    label="Return"
                    value={returnDate}
                    onChange={setReturnDate}
                    minDate={departDate ? addDaysIso(departDate, 1) : today}
                    maxDate={maxDate}
                    initialMonthDate={departDate || undefined}
                    placeholder="Select date"
                    testID="create-trip-return-input"
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
              testID="create-trip-adults"
            />
            <ToggleRow
              title="Round trip"
              subtitle="Track a return flight too"
              value={isRoundTrip}
              onValueChange={setIsRoundTrip}
              testID="create-trip-round-trip"
            />
          </AuroraCard>

          <AuroraCard style={styles.card}>
            <CollapsibleSection
              title="Flight preferences"
              enabled={flightEnabled}
              onEnabledChange={setFlightEnabled}
              expanded={flightExpanded}
              onToggleExpanded={() => setFlightExpanded((e) => !e)}
              testID="create-trip-flight-prefs"
            >
              <Text style={[styles.subLabel, { color: tokens.color.textBodyAlt, fontFamily: tokens.font[700] }]}>CABIN</Text>
              <SegmentedControl options={CABIN_OPTIONS} value={cabin} onChange={setCabin} testID="create-trip-cabin" />
              <View style={{ height: 6 }} />
              <ToggleRow title="Non-stop only" subtitle="Only track non-stop flights" value={nonStopOnly} onValueChange={setNonStopOnly} testID="create-trip-nonstop" />
            </CollapsibleSection>
          </AuroraCard>

          <AuroraCard style={styles.card}>
            <CollapsibleSection
              title="Hotel preferences"
              enabled={hotelEnabled}
              onEnabledChange={setHotelEnabled}
              expanded={hotelExpanded}
              onToggleExpanded={() => setHotelExpanded((e) => !e)}
              testID="create-trip-hotel-prefs"
            >
              <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], fontSize: 13 }}>
                Cheapest room, 1 room for 2 adults. Tune room types and views from the trip after creating it.
              </Text>
            </CollapsibleSection>
            {hotelEnabled ? (
              <View style={styles.hotelCity}>
                <FormField
                  label="Hotel city"
                  value={hotelCity}
                  onChangeText={setHotelCity}
                  placeholder="Maui"
                  testID="create-trip-hotel-city-input"
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
            <Text testID="create-trip-error" style={{ color: tokens.color.warning, fontFamily: tokens.font[600], fontSize: 13, marginBottom: 12 }}>
              {submitError}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerBtn}>
              <GradientButton label="Cancel" variant="secondary" onPress={() => router.back()} testID="create-trip-cancel" />
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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
