import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

/**
 * Minimal screen placeholder. P3 replaces each route body with the real Aurora
 * screen; until then every route renders its title so the app boots and
 * navigation is verifiable.
 */
export function ScreenStub({ title, subtitle }: { title: string; subtitle?: string }): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]}>
      <View style={styles.center}>
        <Text
          accessibilityRole="header"
          style={{ color: tokens.color.textStrong, fontFamily: tokens.font[800], fontSize: 24 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], marginTop: 6 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
