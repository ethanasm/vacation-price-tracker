import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { AuroraCard, StatusChip, type ChipTone } from '@/components/aurora';
import { useTheme } from '@/lib/theme';
import { formatMoneyString } from '@/lib/aurora';
import type { TripSummary } from '@/lib/api/client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Aug 12 – Aug 19' style range from ISO date strings (YYYY-MM-DD). */
function dateRange(depart: string, ret?: string | null): string {
  const fmt = (d?: string | null): string => {
    if (!d) return '';
    const [, mo, dom] = d.split('-');
    const idx = Number.parseInt(mo, 10) - 1;
    return MONTHS[idx] && dom ? `${MONTHS[idx]} ${Number.parseInt(dom, 10)}` : d;
  };
  const start = fmt(depart);
  const end = fmt(ret);
  return end ? `${start} – ${end}` : start;
}

/** active/error -> "active" tone+chip; paused/expired -> "paused". */
function statusChip(status: TripSummary['status']): { tone: ChipTone; label: string } {
  if (status === 'active') return { tone: 'active', label: 'ACTIVE' };
  return { tone: 'paused', label: status.toUpperCase() };
}

function MiniStat({
  label,
  value,
  valueColor,
  testID,
}: {
  label: string;
  value: string;
  valueColor: string;
  testID?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View style={styles.stat}>
      <Text
        style={{
          color: tokens.color.textMuted,
          fontFamily: tokens.font[700],
          fontSize: tokens.type.label.fontSize,
          letterSpacing: tokens.type.label.letterSpacing,
        }}
      >
        {label}
      </Text>
      <Text
        testID={testID}
        style={{
          color: valueColor,
          fontFamily: tokens.font[800],
          fontSize: 18,
          letterSpacing: -0.3,
          marginTop: 3,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * A single trip row on the Trips list: name + status chip, a `${origin} ↔
 * ${destination} · ${dateRange}` meta line, and a three-up Flight / Hotel /
 * Total mini-stat row. Money via formatMoneyString; absent component prices
 * render "—" (full numbers live on Trip detail). The whole card is pressable;
 * a long press opens the trip action sheet (web's right-click menu twin).
 */
export function TripCard({
  trip,
  onPress,
  onLongPress,
}: {
  trip: TripSummary;
  onPress: () => void;
  onLongPress?: () => void;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const chip = statusChip(trip.status);
  const dash = '—';
  const flight = trip.current_flight_price != null ? formatMoneyString(trip.current_flight_price) : dash;
  const hotel = trip.current_hotel_price != null ? formatMoneyString(trip.current_hotel_price) : dash;
  const total = trip.total_price != null ? formatMoneyString(trip.total_price) : dash;

  return (
    <Pressable
      // Bare canonical row testID the Maestro flows match (they tap/assert the
      // first `trip-card`). A `trip-card-${id}` form would NOT full-match Maestro's
      // bare `id: "trip-card"`, and a `trip-card.*` regex would collide with the
      // always-present `trip-card-total` stat below — so the row stays bare and
      // per-trip targeting uses accessibilityLabel.
      testID="trip-card"
      accessibilityRole="button"
      accessibilityLabel={`Trip ${trip.name}`}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <AuroraCard>
        <View style={styles.topRow}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: tokens.color.textStrong,
              fontFamily: tokens.font[700],
              fontSize: 16,
            }}
          >
            {trip.name}
          </Text>
          <StatusChip tone={chip.tone} label={chip.label} />
        </View>

        <Text
          numberOfLines={1}
          style={{
            color: tokens.color.textMuted,
            fontFamily: tokens.font[500],
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {`${trip.origin_airport} ↔ ${trip.destination_code} · ${dateRange(trip.depart_date, trip.return_date)}`}
        </Text>

        <View style={styles.statRow}>
          <MiniStat label="FLIGHT" value={flight} valueColor={tokens.color.textStrong} />
          <MiniStat label="HOTEL" value={hotel} valueColor={tokens.color.textStrong} />
          <MiniStat
            label="TOTAL"
            value={total}
            valueColor={tokens.color.primary}
            testID="trip-card-total"
          />
        </View>
      </AuroraCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statRow: { flexDirection: 'row', marginTop: 14, gap: 12 },
  stat: { flex: 1 },
});
