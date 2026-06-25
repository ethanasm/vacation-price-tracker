import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme, formatUsd } from '@/lib/theme';
import { AuroraCard } from './aurora-card';
import { StatusChip } from './status-chip';

export interface AlertRowData {
  id: string;
  name: string;
  /** Trip tracking status — only `active`/`paused` render a chip tone. */
  status: 'active' | 'paused' | 'error' | 'expired';
  /** Notification threshold in whole dollars. */
  threshold: number;
  /** Latest tracked trip total in whole dollars, or null if not yet priced. */
  total: number | null;
}

/**
 * A single price-alert card: trip name + status chip, the configured threshold
 * ("Alert below $X"), and the current total. When the latest total has dropped
 * below the threshold, the total gets a `success`-tone chip showing how far
 * under ("↓ $Y").
 */
export function AlertRow({
  data,
  onPress,
}: {
  data: AlertRowData;
  onPress: () => void;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const isUnder = data.total != null && data.total < data.threshold;
  const drop = isUnder ? data.threshold - (data.total as number) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${data.name} price alert`}
      testID={`alert-row-${data.id}`}
      onPress={onPress}
    >
      <AuroraCard accent={isUnder ? c.success : undefined}>
        <View style={styles.headerRow}>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: c.textStrong, fontFamily: tokens.font[700] }]}
          >
            {data.name}
          </Text>
          {data.status === 'paused' ? (
            <StatusChip tone="paused" label="PAUSED" />
          ) : (
            <StatusChip tone="active" label="ACTIVE" />
          )}
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.label, { color: c.textMuted, fontFamily: tokens.font[600] }]}>
            Alert below {formatUsd(data.threshold)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
            Current total
          </Text>
          <View style={styles.totalValueWrap}>
            <Text
              style={[
                styles.total,
                { color: isUnder ? c.success : c.textStrong, fontFamily: tokens.font[800] },
              ]}
            >
              {data.total != null ? formatUsd(data.total) : '—'}
            </Text>
            {isUnder ? <StatusChip tone="success" label={`↓ ${formatUsd(drop)}`} /> : null}
          </View>
        </View>
      </AuroraCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 16, letterSpacing: -0.2 },
  metaRow: { marginTop: 6 },
  label: { fontSize: 12, letterSpacing: 0.2 },
  totalRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 13 },
  totalValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  total: { fontSize: 20, letterSpacing: -0.4 },
});
