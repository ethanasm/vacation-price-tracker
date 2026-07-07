import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react-native';
import { AuroraCard, GradientButton } from '@/components/aurora';
import { SettingsCog } from '@/components/aurora/settings-cog';
import { TripCard } from '@/components/aurora/trip-card';
import { TripActionSheet } from '@/components/aurora/trip-action-sheet';
import { useApiClient } from '@/lib/api/provider';
import { useTheme } from '@/lib/theme';
import type { ApiClient, TripSummary } from '@/lib/api/client';

/**
 * Kick off a server-side price refresh for one trip and wait for the workflow
 * to finish (same 2s/30-attempt poll as web's trip-row-actions), so callers
 * can refetch the list once fresh prices have landed.
 */
async function refreshTripAndWait(api: ApiClient, tripId: string): Promise<void> {
  const { refresh_group_id } = await api.refreshTrip(tripId);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = await api.getRefreshStatus(refresh_group_id);
    if (status.status === 'failed') throw new Error(status.error ?? 'Refresh failed');
    // Same terminal condition as web: an explicit completed status, or every
    // workflow in the group having finished one way or the other.
    if (status.status === 'completed') return;
    if (status.total > 0 && status.completed + status.failed >= status.total) return;
  }
  // Still running after 60s — stop polling without treating it as a failure;
  // the caller's onSettled invalidation picks up prices whenever they land.
}

/** Grey placeholder card shown while the trip list loads. */
function SkeletonCard(): React.JSX.Element {
  const { tokens } = useTheme();
  const block = (w: number | `${number}%`, h: number, mt = 0): React.JSX.Element => (
    <View
      style={{
        width: w,
        height: h,
        marginTop: mt,
        borderRadius: 6,
        backgroundColor: tokens.color.surface,
      }}
    />
  );
  return (
    <AuroraCard>
      <View style={styles.topRow}>
        {block('55%', 16)}
        {block(64, 18)}
      </View>
      {block('70%', 12, 8)}
      <View style={styles.statRow}>
        {block('28%', 26)}
        {block('28%', 26)}
        {block('28%', 26)}
      </View>
    </AuroraCard>
  );
}

export default function TripsScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['trips'], queryFn: () => api.listTrips() });

  const trips = query.data ?? [];
  const count = trips.length;

  // Long-pressed trip whose action sheet is open (null = closed).
  const [actionTrip, setActionTrip] = React.useState<TripSummary | null>(null);

  function invalidateTrip(tripId: string): void {
    void queryClient.invalidateQueries({ queryKey: ['trips'] });
    void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
  }

  const refreshMutation = useMutation({
    mutationFn: (trip: TripSummary) => refreshTripAndWait(api, trip.id),
    onSettled: (_data, _err, trip) => invalidateTrip(trip.id),
    onError: () => Alert.alert('Refresh failed', 'Could not refresh prices. Please try again.'),
  });

  const statusMutation = useMutation({
    mutationFn: (trip: TripSummary) =>
      api.updateTripStatus(trip.id, trip.status === 'paused' ? 'active' : 'paused'),
    onSuccess: (_data, trip) => invalidateTrip(trip.id),
    onError: () => Alert.alert('Update failed', 'Could not update the trip. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (trip: TripSummary) => api.deleteTrip(trip.id),
    onSuccess: (_data, trip) => invalidateTrip(trip.id),
    onError: () => Alert.alert('Delete failed', 'Could not delete the trip. Please try again.'),
  });

  function confirmDelete(trip: TripSummary): void {
    setActionTrip(null);
    const message = `“${trip.name}” and all its price history will be permanently deleted.`;
    // RN-web has no Alert implementation — fall back to window.confirm so the
    // web export (the sandbox/e2e verification surface) can exercise delete.
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete trip?\n\n${message}`)) deleteMutation.mutate(trip);
      return;
    }
    Alert.alert('Delete trip?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(trip) },
    ]);
  }

  const refreshControl = (
    <RefreshControl
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
      }}
      tintColor={tokens.color.primary}
      colors={[tokens.color.primary]}
    />
  );

  function renderBody(): React.JSX.Element {
    // Initial load: skeletons.
    if (query.isLoading) {
      return (
        <View style={styles.listContent}>
          <SkeletonCard />
          <View style={{ height: 12 }} />
          <SkeletonCard />
          <View style={{ height: 12 }} />
          <SkeletonCard />
        </View>
      );
    }

    // Error: centered message + Try again.
    if (query.isError) {
      return (
        <View style={styles.center}>
          <Text style={[styles.centerTitle, { color: tokens.color.textStrong, fontFamily: tokens.font[700] }]}>
            Couldn’t load your trips
          </Text>
          <Text style={[styles.centerBody, { color: tokens.color.textMuted, fontFamily: tokens.font[500] }]}>
            Check your connection and try again.
          </Text>
          <View style={styles.centerCta}>
            <GradientButton label="Try again" onPress={() => void query.refetch()} />
          </View>
        </View>
      );
    }

    // Empty: centered copy + New trip CTA.
    if (count === 0) {
      return (
        <View style={styles.center}>
          <Text style={[styles.centerTitle, { color: tokens.color.textStrong, fontFamily: tokens.font[700] }]}>
            No trips yet
          </Text>
          <Text style={[styles.centerBody, { color: tokens.color.textMuted, fontFamily: tokens.font[500] }]}>
            Track a vacation’s flight and hotel prices to get started.
          </Text>
          <View style={styles.centerCta}>
            <GradientButton
              label="New trip"
              onPress={() => router.push('/trip/new')}
              accessibilityLabel="New trip"
            />
          </View>
        </View>
      );
    }

    return (
      <FlatList<TripSummary>
        testID="trips-list"
        data={trips}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/trip/${item.id}`)}
            onLongPress={() => setActionTrip(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            accessibilityRole="header"
            style={{
              color: tokens.color.textStrong,
              fontFamily: tokens.font[tokens.type.h1.weight],
              fontSize: tokens.type.h1.fontSize,
              letterSpacing: tokens.type.h1.letterSpacing,
            }}
          >
            Your Trips
          </Text>
          <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], fontSize: 13, marginTop: 2 }}>
            {`${count} tracked`}
          </Text>
        </View>
        <SettingsCog />
      </View>

      <View style={styles.fill}>{renderBody()}</View>

      {/* Android: Material extended FAB (a "New trip" pill). iOS: circular FAB. */}
      <Pressable
        testID="new-trip-fab"
        accessibilityRole="button"
        accessibilityLabel="New trip"
        onPress={() => router.push('/trip/new')}
        style={({ pressed }) => [
          Platform.OS === 'android' ? styles.fabExtended : styles.fab,
          tokens.shadow.primaryButton,
          { backgroundColor: tokens.color.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Plus color="#FFFFFF" size={Platform.OS === 'android' ? 22 : 26} strokeWidth={2.5} />
        {Platform.OS === 'android' ? (
          <Text style={[styles.fabLabel, { fontFamily: tokens.font[700] }]}>New trip</Text>
        ) : null}
      </Pressable>

      <TripActionSheet
        trip={actionTrip}
        onClose={() => setActionTrip(null)}
        onRefresh={(trip) => {
          setActionTrip(null);
          refreshMutation.mutate(trip);
        }}
        onToggleStatus={(trip) => {
          setActionTrip(null);
          statusMutation.mutate(trip);
        }}
        onEdit={(trip) => {
          setActionTrip(null);
          router.push(`/trip/${trip.id}/edit`);
        }}
        onDelete={confirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerText: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 96 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerTitle: { fontSize: 18, textAlign: 'center' },
  centerBody: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  centerCta: { marginTop: 20, alignSelf: 'stretch' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabExtended: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  fabLabel: { color: '#FFFFFF', fontSize: 15, marginLeft: 8 },
});
