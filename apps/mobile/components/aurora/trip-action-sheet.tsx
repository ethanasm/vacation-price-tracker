import React from 'react';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, Pause, Play, Pencil, Trash2, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import type { TripSummary } from '@/lib/api/client';

function ActionRow({
  icon: Icon,
  label,
  onPress,
  destructive = false,
  disabled = false,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const color = destructive ? tokens.color.destructive : tokens.color.textStrong;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? tokens.color.surface : 'transparent', opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Icon color={color} size={20} strokeWidth={2} />
      <Text style={{ color, fontFamily: tokens.font[600], fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Bottom action sheet opened by long-pressing a trip on the Trips list — the
 * mobile twin of web's right-click context menu (trip-row-actions.tsx): Refresh
 * and Pause/Resume (both hidden for expired trips, which Skiplagged can no
 * longer price), Edit, and a destructive Delete. Purely presentational — the
 * screen owns the mutations and closes the sheet by clearing `trip`.
 */
export function TripActionSheet({
  trip,
  onClose,
  onRefresh,
  onToggleStatus,
  onEdit,
  onDelete,
}: {
  trip: TripSummary | null;
  onClose: () => void;
  onRefresh: (trip: TripSummary) => void;
  onToggleStatus: (trip: TripSummary) => void;
  onEdit: (trip: TripSummary) => void;
  onDelete: (trip: TripSummary) => void;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  // Keep rendering the last trip while the Modal slides out (trip goes null on
  // close, but the sheet body shouldn't vanish mid-animation).
  const [lastTrip, setLastTrip] = React.useState(trip);
  if (trip && trip !== lastTrip) setLastTrip(trip);
  const shown = trip ?? lastTrip;

  const isPaused = shown?.status === 'paused';
  const isExpired = shown?.status === 'expired';

  return (
    <Modal visible={trip !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close trip actions"
          style={[styles.backdrop, { backgroundColor: 'rgba(26, 26, 46, 0.45)' }]}
          onPress={onClose}
          testID="trip-action-sheet-backdrop"
        />
        {shown ? (
          <View
            testID="trip-action-sheet"
            style={[
              styles.sheet,
              tokens.shadow.cardOnCanvas,
              { backgroundColor: tokens.color.card, paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: tokens.color.starEmpty }]} />
            <Text
              numberOfLines={1}
              style={[styles.title, { color: tokens.color.textStrong, fontFamily: tokens.font[700] }]}
            >
              {shown.name}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: tokens.color.textMuted, fontFamily: tokens.font[500] }]}
            >
              {`${shown.origin_airport} ↔ ${shown.destination_code}`}
            </Text>

            {!isExpired ? (
              <>
                <ActionRow
                  icon={RefreshCw}
                  label="Refresh"
                  onPress={() => onRefresh(shown)}
                  testID="trip-action-refresh"
                />
                <ActionRow
                  icon={isPaused ? Play : Pause}
                  label={isPaused ? 'Resume' : 'Pause'}
                  onPress={() => onToggleStatus(shown)}
                  testID="trip-action-pause"
                />
              </>
            ) : null}
            <ActionRow icon={Pencil} label="Edit" onPress={() => onEdit(shown)} testID="trip-action-edit" />
            <View style={[styles.separator, { backgroundColor: tokens.color.hairline }]} />
            <ActionRow
              icon={Trash2}
              label="Delete"
              destructive
              onPress={() => onDelete(shown)}
              testID="trip-action-delete"
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  title: { fontSize: 16, paddingHorizontal: 8 },
  subtitle: { fontSize: 12, paddingHorizontal: 8, marginTop: 2, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 4, marginHorizontal: 8 },
});
