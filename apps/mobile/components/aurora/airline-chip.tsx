import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { airlineChip } from '@/lib/aurora';

const SIZE = 30;

/** A single original-mark airline monogram chip (NOT a real trademark). */
export function AirlineChip({ code, size = SIZE }: { code?: string | null; size?: number }): React.JSX.Element {
  const { tokens } = useTheme();
  const chip = airlineChip(code);
  return (
    <LinearGradient
      colors={chip.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#FFFFFF', fontFamily: tokens.font[800], fontSize: size * 0.4 }}>{chip.label}</Text>
    </LinearGradient>
  );
}

/** Two overlapping chips for a multi-carrier itinerary (−10px overlap, 2px white ring). */
export function AirlineChipPair({ codes }: { codes: [string, string] | string[] }): React.JSX.Element {
  return (
    <View style={styles.pairRow}>
      {codes.slice(0, 2).map((code, i) => (
        <View key={`${code}-${i}`} style={[styles.ring, i > 0 ? { marginLeft: -10 } : null]}>
          <AirlineChip code={code} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pairRow: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderRadius: 9, borderWidth: 2, borderColor: '#FFFFFF' },
});
