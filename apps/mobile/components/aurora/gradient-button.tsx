import React from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';

/** Primary = violet gradient + glow shadow; secondary = white + hairline border. */
export function GradientButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const isPrimary = variant === 'primary';
  const inner = loading ? (
    <ActivityIndicator color={isPrimary ? '#FFFFFF' : tokens.color.primary} />
  ) : (
    <Text
      style={{
        color: isPrimary ? '#FFFFFF' : tokens.color.textStrong,
        fontFamily: tokens.font[700],
        fontSize: 15,
      }}
    >
      {label}
    </Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.wrap, { borderRadius: tokens.radius.pill, opacity: disabled ? 0.5 : 1 }, isPrimary ? tokens.shadow.primaryButton : null]}
    >
      {isPrimary ? (
        <LinearGradient colors={tokens.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, { borderRadius: tokens.radius.pill }]}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, { borderRadius: tokens.radius.pill, backgroundColor: tokens.color.card, borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.color.hairline }]}>
          {inner}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'visible' },
  fill: { paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
});
