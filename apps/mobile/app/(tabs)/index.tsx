import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react-native';
import { AuroraCard, GradientButton } from '@/components/aurora';
import { TripCard } from '@/components/aurora/trip-card';
import { useApiClient } from '@/lib/api/provider';
import { useTheme } from '@/lib/theme';
import type { TripSummary } from '@/lib/api/client';

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
  const query = useQuery({ queryKey: ['trips'], queryFn: () => api.listTrips() });

  const trips = query.data ?? [];
  const count = trips.length;

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
          <TripCard trip={item} onPress={() => router.push(`/trip/${item.id}`)} />
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

      <View style={styles.fill}>{renderBody()}</View>

      <Pressable
        testID="new-trip-fab"
        accessibilityRole="button"
        accessibilityLabel="New trip"
        onPress={() => router.push('/trip/new')}
        style={({ pressed }) => [
          styles.fab,
          tokens.shadow.primaryButton,
          { backgroundColor: tokens.color.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Plus color="#FFFFFF" size={26} strokeWidth={2.5} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
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
});
