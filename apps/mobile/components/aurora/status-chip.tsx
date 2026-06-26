import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

export type ChipTone = 'active' | 'paused' | 'nonstop' | 'stop' | 'success' | 'layover';

/** Pill badge (radius 999). Tone selects fg/bg from the Aurora status tokens. */
export function StatusChip({ tone, label }: { tone: ChipTone; label: string }): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const map: Record<ChipTone, { fg: string; bg: string; border?: string }> = {
    active: { fg: c.primaryDeep, bg: c.chipBg },
    paused: { fg: c.warning, bg: c.warningBg },
    nonstop: { fg: c.success, bg: c.successBg },
    stop: { fg: c.warning, bg: c.warningBg },
    success: { fg: c.success, bg: c.successBg },
    layover: { fg: c.layover, bg: c.layoverBg, border: c.layoverBorder },
  };
  const t = map[tone];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: t.bg, borderRadius: tokens.radius.badge },
        t.border ? { borderWidth: StyleSheet.hairlineWidth, borderColor: t.border } : null,
      ]}
    >
      <Text style={{ color: t.fg, fontFamily: tokens.font[700], fontSize: 10, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
});
