import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { airlineChip, airlineLogoUrl } from '@/lib/aurora';

const SIZE = 30;

/**
 * Airline chip: the carrier's real logo when the code is in the logo corpus
 * (see airlineLogoUrl), falling back to the original-mark gradient monogram
 * for unknown carriers or when the image fails to load. The logo sits on a
 * fixed white tile so colored marks stay legible in dark mode.
 */
export function AirlineChip({ code, size = SIZE }: { code?: string | null; size?: number }): React.JSX.Element {
  const { tokens } = useTheme();
  const [failed, setFailed] = useState(false);
  const logoUrl = airlineLogoUrl(code);

  if (logoUrl && !failed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tokens.color.hairline,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: logoUrl }}
          onError={() => setFailed(true)}
          resizeMode="contain"
          style={{ width: size * 0.8, height: size * 0.8 }}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

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
