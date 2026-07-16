/**
 * Settings — mobile twin of the web settings page (apps/web/src/app/trips/settings).
 * Notification preferences for every user, plus the operator feature-flag card
 * for admins. Fresh user state (email toggle + is_admin) comes from
 * GET /v1/auth/me rather than the cached sign-in session, so an admin promoted
 * after sign-in still sees the Admin card.
 */
import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';

import { useTheme } from '@/lib/theme';
import { useApiClient } from '@/lib/api/provider';
import { AuroraCard } from '@/components/aurora';
import { ToggleRow } from '@/components/aurora/toggle-row';
import type { AppSettingItem, FeatureFlagItem, UserResponse } from '@/lib/api/client';

/** Humanize a snake_case flag name for display ("beta_optimizer" → "Beta optimizer"). */
function flagLabel(name: string): string {
  const spaced = name.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Humanize a snake_case setting value for display ("fast_flights" → "Fast Flights"). */
function valueLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function SectionTitle({ children, icon }: { children: string; icon?: React.ReactNode }): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[700], fontSize: 16 }}>
        {children}
      </Text>
    </View>
  );
}

function SectionCaption({ children }: { children: string }): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        color: tokens.color.textMuted,
        fontFamily: tokens.font[500],
        fontSize: 12,
        marginTop: 2,
        marginBottom: 8,
        lineHeight: 17,
      }}
    >
      {children}
    </Text>
  );
}

function SettingSegmentRow({
  setting,
  disabled,
  onSelect,
}: {
  setting: AppSettingItem;
  disabled: boolean;
  onSelect: (value: string) => void;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={flagLabel(setting.name)}>
      <Text style={{ color: c.textStrong, fontFamily: tokens.font[600], fontSize: 14 }}>
        {flagLabel(setting.name)}
      </Text>
      <Text
        style={{
          color: c.textMuted,
          fontFamily: tokens.font[500],
          fontSize: 12,
          marginTop: 2,
          lineHeight: 17,
        }}
      >
        {setting.description}
      </Text>
      <View style={[styles.segmentGroup, { borderColor: c.hairline }]}>
        {setting.allowed_values.map((value) => {
          const active = setting.value === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
              accessibilityLabel={valueLabel(value)}
              testID={`settings-setting-${setting.name}-${value}`}
              disabled={disabled}
              onPress={() => {
                if (!active) onSelect(value);
              }}
              style={[
                styles.segmentButton,
                active ? { backgroundColor: c.primary } : null,
              ]}
            >
              <Text
                style={{
                  color: active ? '#FFFFFF' : c.textMuted,
                  fontFamily: tokens.font[600],
                  fontSize: 12,
                }}
              >
                {valueLabel(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AdminFlagsCard(): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const api = useApiClient();
  const queryClient = useQueryClient();

  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => api.listFeatureFlags(),
  });

  const settingsQuery = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => api.listAppSettings(),
  });

  const mutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.setFeatureFlag(name, enabled),
    onSuccess: (updated) => {
      queryClient.setQueryData<FeatureFlagItem[]>(['feature-flags'], (current) =>
        (current ?? []).map((flag) => (flag.name === updated.name ? updated : flag)),
      );
    },
    onError: () => {
      Alert.alert('Failed to update flag', 'Please try again.');
    },
  });

  const settingMutation = useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) =>
      api.setAppSetting(name, value),
    onSuccess: (updated) => {
      queryClient.setQueryData<AppSettingItem[]>(['app-settings'], (current) =>
        (current ?? []).map((setting) => (setting.name === updated.name ? updated : setting)),
      );
    },
    onError: () => {
      Alert.alert('Failed to update setting', 'Please try again.');
    },
  });

  const busy = mutation.isPending || settingMutation.isPending;

  return (
    <AuroraCard style={styles.card} testID="settings-admin-card">
      <SectionTitle icon={<ShieldCheck size={18} color={c.textStrong} strokeWidth={2} />}>
        Admin
      </SectionTitle>
      <SectionCaption>
        Operator feature flags — these change behavior for every user, instantly.
      </SectionCaption>
      {flagsQuery.isError || settingsQuery.isError ? (
        <Text style={{ color: c.textMuted, fontFamily: tokens.font[500], fontSize: 13 }}>
          Failed to load feature flags.
        </Text>
      ) : flagsQuery.isLoading || settingsQuery.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.cardSpinner} />
      ) : (
        <>
          {(settingsQuery.data ?? []).map((setting, index) => (
            <View
              key={setting.name}
              style={index > 0 ? [styles.rowDivider, { borderTopColor: c.hairline }] : null}
            >
              <SettingSegmentRow
                setting={setting}
                disabled={busy}
                onSelect={(value) => settingMutation.mutate({ name: setting.name, value })}
              />
            </View>
          ))}
          {(flagsQuery.data ?? []).map((flag, index) => (
            <View
              key={flag.name}
              style={
                index > 0 || (settingsQuery.data ?? []).length > 0
                  ? [styles.rowDivider, { borderTopColor: c.hairline }]
                  : null
              }
            >
              <ToggleRow
                title={flagLabel(flag.name)}
                subtitle={flag.description}
                value={flag.enabled}
                disabled={busy}
                onValueChange={(next) => mutation.mutate({ name: flag.name, enabled: next })}
                testID={`settings-flag-${flag.name}`}
              />
            </View>
          ))}
        </>
      )}
    </AuroraCard>
  );
}

export default function SettingsScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => api.getMe() });

  const emailMutation = useMutation({
    mutationFn: (next: boolean) => api.updatePreferences({ email_notifications_enabled: next }),
    onSuccess: (updated) => {
      queryClient.setQueryData<UserResponse>(['me'], (current) =>
        current ? { ...current, email_notifications_enabled: updated.email_notifications_enabled } : current,
      );
    },
    onError: () => {
      Alert.alert('Failed to update settings', 'Please try again.');
    },
  });

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.pageBg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="settings-back"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ArrowLeft size={18} color={c.textMuted} strokeWidth={2} />
          <Text style={{ color: c.textMuted, fontFamily: tokens.font[600], fontSize: 14 }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            color: c.textStrong,
            fontFamily: tokens.font[tokens.type.h1.weight],
            fontSize: tokens.type.h1.fontSize,
            letterSpacing: tokens.type.h1.letterSpacing,
            marginTop: 10,
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} testID="settings-scroll-region">
        <AuroraCard style={styles.card}>
          <SectionTitle>Notifications</SectionTitle>
          <SectionCaption>
            Manage how you hear about price changes on your tracked trips.
          </SectionCaption>
          {meQuery.isError ? (
            <Text style={{ color: c.textMuted, fontFamily: tokens.font[500], fontSize: 13 }}>
              Couldn’t load your settings. Pull to refresh or come back later.
            </Text>
          ) : meQuery.isLoading || !meQuery.data ? (
            <ActivityIndicator color={c.primary} style={styles.cardSpinner} testID="settings-loading" />
          ) : (
            <>
              <ToggleRow
                title="Email notifications"
                subtitle="Get a daily digest when a tracked trip drops below your price target."
                value={meQuery.data.email_notifications_enabled}
                disabled={emailMutation.isPending}
                onValueChange={(next) => emailMutation.mutate(next)}
                testID="settings-email-toggle"
              />
              <View style={[styles.rowDivider, { borderTopColor: c.hairline }]}>
                <ToggleRow
                  title="SMS alerts"
                  subtitle="Instant text on a major price drop."
                  value={false}
                  disabled
                  onValueChange={() => undefined}
                  testID="settings-sms-toggle"
                />
              </View>
            </>
          )}
        </AuroraCard>

        {meQuery.data?.is_admin ? <AdminFlagsCard /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  card: { marginBottom: 16 },
  cardSpinner: { marginVertical: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 8 },
  segmentGroup: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 2,
    marginTop: 8,
    gap: 2,
  },
  segmentButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
