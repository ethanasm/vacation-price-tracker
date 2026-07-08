import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import {
  formatDisplayDate,
  isoDate,
  monthGrid,
  monthInRange,
  monthLabel,
  parseIsoDate,
  shiftMonth,
} from '@/lib/trip-form';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Labelled date field — the mobile twin of web's DatePicker (calendar
 * popover). The field itself looks like a FormField but opens a bottom-sheet
 * month calendar instead of a keyboard; days outside [minDate, maxDate] are
 * disabled, so the picked value can only be a valid in-range YYYY-MM-DD.
 *
 * testID contract (Maestro): the field is `testID`, the month steppers are
 * `${testID}-prev-month` / `${testID}-next-month`, and each day cell is
 * `${testID}-day-<n>` within the visible month.
 */
export function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  initialMonthDate,
  placeholder = 'Select date',
  testID,
  accessibilityLabel,
}: {
  label: string;
  /** Selected date as YYYY-MM-DD, or '' for none. */
  value: string;
  onChange: (iso: string) => void;
  /** Earliest selectable date (YYYY-MM-DD, inclusive). */
  minDate: string;
  /** Latest selectable date (YYYY-MM-DD, inclusive). */
  maxDate: string;
  /** Month shown when opening without a value (e.g. the depart month). */
  initialMonthDate?: string;
  placeholder?: string;
  testID?: string;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const [visible, setVisible] = React.useState(() => baseMonth(value, initialMonthDate, minDate));

  const isAndroid = Platform.OS === 'android';
  const fieldStyle = isAndroid
    ? {
        backgroundColor: 'transparent',
        borderBottomWidth: 2,
        borderBottomColor: tokens.color.primary,
        paddingHorizontal: 0,
      }
    : {
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.inner,
      };

  function openSheet(): void {
    setVisible(baseMonth(value, initialMonthDate, minDate));
    setOpen(true);
  }

  function pick(day: number): void {
    onChange(isoDate(new Date(visible.year, visible.month, day)));
    setOpen(false);
  }

  const grid = monthGrid(visible.year, visible.month);
  const prev = shiftMonth(visible.year, visible.month, -1);
  const next = shiftMonth(visible.year, visible.month, 1);
  const prevEnabled = monthInRange(prev.year, prev.month, minDate, maxDate);
  const nextEnabled = monthInRange(next.year, next.month, minDate, maxDate);

  return (
    <View style={styles.wrap}>
      <Text
        style={{
          color: tokens.color.textBodyAlt,
          fontFamily: tokens.font[700],
          fontSize: tokens.type.label.fontSize,
          letterSpacing: tokens.type.label.letterSpacing,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityValue={value ? { text: formatDisplayDate(value) } : undefined}
        testID={testID}
        onPress={openSheet}
        style={[styles.field, fieldStyle]}
      >
        <Text
          style={{
            color: value ? tokens.color.textStrong : tokens.color.textFaint,
            fontFamily: tokens.font[600],
            fontSize: 15,
          }}
        >
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.fill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${label} calendar`}
            style={[styles.backdrop, { backgroundColor: 'rgba(26, 26, 46, 0.45)' }]}
            onPress={() => setOpen(false)}
            testID={testID ? `${testID}-backdrop` : undefined}
          />
          <View
            testID={testID ? `${testID}-calendar` : undefined}
            style={[
              styles.sheet,
              tokens.shadow.cardOnCanvas,
              { backgroundColor: tokens.color.card, paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: tokens.color.starEmpty }]} />
            <View style={styles.monthRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                testID={testID ? `${testID}-prev-month` : undefined}
                onPress={() => prevEnabled && setVisible(prev)}
                disabled={!prevEnabled}
                hitSlop={8}
                style={[styles.monthNav, { backgroundColor: tokens.color.surface, opacity: prevEnabled ? 1 : 0.35 }]}
              >
                <ChevronLeft color={tokens.color.textStrong} size={18} strokeWidth={2.5} />
              </Pressable>
              <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[700], fontSize: 16 }}>
                {monthLabel(visible.year, visible.month)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                testID={testID ? `${testID}-next-month` : undefined}
                onPress={() => nextEnabled && setVisible(next)}
                disabled={!nextEnabled}
                hitSlop={8}
                style={[styles.monthNav, { backgroundColor: tokens.color.surface, opacity: nextEnabled ? 1 : 0.35 }]}
              >
                <ChevronRight color={tokens.color.textStrong} size={18} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map((d, i) => (
                <View key={`wd-${i}`} style={styles.cell}>
                  <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[700], fontSize: 11 }}>
                    {d}
                  </Text>
                </View>
              ))}
              {grid.map((day, i) => {
                if (day === null) {
                  return <View key={`pad-${i}`} style={styles.cell} />;
                }
                const iso = isoDate(new Date(visible.year, visible.month, day));
                const enabled = iso >= minDate && iso <= maxDate;
                const selected = iso === value;
                return (
                  <View key={iso} style={styles.cell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={formatDisplayDate(iso)}
                      accessibilityState={{ disabled: !enabled, selected }}
                      testID={testID ? `${testID}-day-${day}` : undefined}
                      onPress={() => enabled && pick(day)}
                      disabled={!enabled}
                      style={[
                        styles.day,
                        selected ? { backgroundColor: tokens.color.primary } : null,
                      ]}
                    >
                      <Text
                        style={{
                          color: selected
                            ? '#FFFFFF'
                            : enabled
                              ? tokens.color.textStrong
                              : tokens.color.textFaint,
                          fontFamily: tokens.font[selected ? 700 : 500],
                          fontSize: 14,
                        }}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function baseMonth(
  value: string,
  initialMonthDate: string | undefined,
  minDate: string,
): { year: number; month: number } {
  const seed = parseIsoDate(value) ?? parseIsoDate(initialMonthDate ?? '') ?? parseIsoDate(minDate) ?? new Date();
  return { year: seed.getFullYear(), month: seed.getMonth() };
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  field: { paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'center' },
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthNav: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
