import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plane, Building2 } from 'lucide-react-native';
import { useTheme, formatUsd } from '@/lib/theme';

/**
 * The Flight / Hotel / Trip-total stat row that sits above the price chart. The
 * trip-total chip is a violet gradient card; the other two are plain surface
 * chips. Values are formatted via `formatUsd`. The three value `Text`s carry
 * the canonical E2E testIDs.
 */
export function StatTrio({
  flight,
  hotelTotal,
  hotelPerNight,
  tripTotal,
}: {
  flight: number;
  hotelTotal: number;
  hotelPerNight: number;
  tripTotal: number;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: c.surface, borderRadius: tokens.radius.inner }]}>
        <View style={styles.labelRow}>
          <Plane size={13} color={c.textMuted} strokeWidth={2} />
          <Text style={[styles.label, { color: c.textMuted, fontFamily: tokens.font[700] }]}>FLIGHT</Text>
        </View>
        <Text
          testID="trip-detail-flight-stat"
          accessibilityLabel={`Flight ${formatUsd(flight)}`}
          style={[styles.value, { color: c.textStrong, fontFamily: tokens.font[800] }]}
        >
          {formatUsd(flight)}
        </Text>
      </View>

      <View style={[styles.chip, { backgroundColor: c.surface, borderRadius: tokens.radius.inner }]}>
        <View style={styles.labelRow}>
          <Building2 size={13} color={c.textMuted} strokeWidth={2} />
          <Text style={[styles.label, { color: c.textMuted, fontFamily: tokens.font[700] }]}>HOTEL</Text>
        </View>
        <Text
          testID="trip-detail-hotel-stat"
          accessibilityLabel={`Hotel ${formatUsd(hotelTotal)}`}
          style={[styles.value, { color: c.textStrong, fontFamily: tokens.font[800] }]}
        >
          {formatUsd(hotelTotal)}
        </Text>
        <Text style={[styles.subnote, { color: c.textMuted, fontFamily: tokens.font[500] }]}>
          {`${formatUsd(hotelPerNight)}/night`}
        </Text>
      </View>

      <LinearGradient
        colors={tokens.gradient.totalCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.chip, styles.totalChip, { borderRadius: tokens.radius.inner, ...tokens.shadow.totalCard }]}
      >
        <Text style={[styles.label, { color: '#FFFFFF', fontFamily: tokens.font[700], opacity: 0.85 }]}>
          TRIP TOTAL
        </Text>
        <Text
          testID="trip-detail-total-stat"
          accessibilityLabel={`Trip total ${formatUsd(tripTotal)}`}
          style={[styles.value, { color: '#FFFFFF', fontFamily: tokens.font[800] }]}
        >
          {formatUsd(tripTotal)}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, padding: 12, justifyContent: 'center' },
  totalChip: { alignItems: 'flex-start' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  label: { fontSize: 10, letterSpacing: 0.5 },
  value: { fontSize: 20, letterSpacing: -0.4 },
  subnote: { fontSize: 10, marginTop: 2 },
});
