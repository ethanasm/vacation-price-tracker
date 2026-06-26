import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

/** Title + optional subtitle on the left, a primary-tinted Switch on the right. */
export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  testID,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.text}>
        <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[600], fontSize: 14 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: tokens.color.primary, false: tokens.color.hairlineAlt }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={tokens.color.hairlineAlt}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  text: { flex: 1, paddingRight: 12 },
});
