import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

/** Rule-track segmented control with a white active pill (subtle shadow). */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (v: V) => void;
  testID?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View testID={testID} style={[styles.track, { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.pill }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, { borderRadius: tokens.radius.pill }, active ? { backgroundColor: tokens.color.card, ...tokens.shadow.cardOnCanvas, shadowOpacity: 0.06, shadowRadius: 6 } : null]}
          >
            <Text style={{ color: active ? tokens.color.textStrong : tokens.color.textMuted, fontFamily: tokens.font[active ? 700 : 500], fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
});
