/**
 * Alerts tab — one card per tracked trip that has a price-drop threshold set.
 *
 * The trip list (`listTrips`) carries the name/status/total but NOT the
 * notification threshold (that lives on the trip *detail*'s `notification_prefs`),
 * so each listed trip's detail is fetched to read its threshold; trips without a
 * threshold are dropped. The threshold + latest total feed an `AlertRow`, and a
 * trip whose total has dropped below its threshold is highlighted.
 *
 * The dev-only "Preview price-drop" button schedules a local notification so the
 * lock-screen / heads-up rendering is demonstrable ahead of the P5 server push.
 */
import React from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueries } from '@tanstack/react-query';

import { useTheme } from '@/lib/theme';
import { useApiClient } from '@/lib/api/provider';
import { GradientButton } from '@/components/aurora';
import { AlertRow, type AlertRowData } from '@/components/aurora/alert-row';
import { presentLocalPriceDrop } from '@/lib/notifications';

function toNumber(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function AlertsScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const router = useRouter();
  const api = useApiClient();

  const tripsQuery = useQuery({
    queryKey: ['trips'],
    queryFn: () => api.listTrips({ limit: 50 }),
  });

  const trips = tripsQuery.data ?? [];

  // Threshold lives on the trip detail, so fan out one detail fetch per trip.
  const detailQueries = useQueries({
    queries: trips.map((t) => ({
      queryKey: ['trip', t.id],
      queryFn: () => api.getTrip(t.id),
      enabled: !!t.id,
    })),
  });

  const rows: AlertRowData[] = React.useMemo(() => {
    const out: AlertRowData[] = [];
    for (const q of detailQueries) {
      const detail = q.data?.trip;
      if (!detail) continue;
      const threshold = toNumber(detail.notification_prefs?.threshold_value ?? null);
      if (threshold == null) continue;
      out.push({
        id: detail.id,
        name: detail.name,
        status: detail.status,
        threshold,
        total: toNumber(detail.total_price),
      });
    }
    return out;
  }, [detailQueries]);

  const detailsLoading = detailQueries.some((q) => q.isLoading);
  const isLoading = tripsQuery.isLoading || (trips.length > 0 && rows.length === 0 && detailsLoading);
  const isError = tripsQuery.isError;

  const onPreview = React.useCallback(() => {
    void presentLocalPriceDrop({
      tripName: 'Test 2',
      threshold: 750,
      total: 724,
      tripId: rows[0]?.id ?? trips[0]?.id ?? 'preview',
    });
  }, [rows, trips]);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.pageBg }]} edges={['top']}>
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={{ color: c.textStrong, fontFamily: tokens.font[800], fontSize: 26, letterSpacing: -0.5 }}
        >
          Alerts
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center} testID="alerts-loading">
          <ActivityIndicator color={c.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center} testID="alerts-error">
          <Text style={[styles.muted, { color: c.textBody, fontFamily: tokens.font[600] }]}>
            Couldn’t load your alerts.
          </Text>
          <View style={styles.retryWrap}>
            <GradientButton label="Retry" variant="secondary" onPress={() => tripsQuery.refetch()} />
          </View>
        </View>
      ) : (
        <FlatList
          testID="alerts-list"
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <AlertRow data={item} onPress={() => router.push(`/trip/${item.id}`)} />
          )}
          ListEmptyComponent={
            <View style={styles.center} testID="alerts-empty">
              <Text style={[styles.muted, { color: c.textBody, fontFamily: tokens.font[700] }]}>
                No price alerts yet
              </Text>
              <Text style={[styles.subtle, { color: c.textMuted, fontFamily: tokens.font[500] }]}>
                Set a price threshold on a trip and it’ll show up here.
              </Text>
            </View>
          }
        />
      )}

      {__DEV__ ? (
        <View style={styles.devBar}>
          <GradientButton
            label="Preview price-drop"
            variant="secondary"
            onPress={onPreview}
            testID="alerts-preview-button"
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  sep: { height: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { fontSize: 16, textAlign: 'center' },
  subtle: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  retryWrap: { marginTop: 16, minWidth: 140 },
  devBar: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
});
