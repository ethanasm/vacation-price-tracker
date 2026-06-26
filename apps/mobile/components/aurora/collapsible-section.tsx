import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

/**
 * A section with a header row (title + enable Switch + chevron) and a body that
 * is shown when `expanded` and the section is enabled. Tapping the header toggles
 * `expanded`; the Switch toggles `enabled` independently.
 */
export function CollapsibleSection({
  title,
  enabled,
  onEnabledChange,
  expanded,
  onToggleExpanded,
  children,
  testID,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  children?: React.ReactNode;
  testID?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggleExpanded}
        style={styles.header}
      >
        <Text style={{ flex: 1, color: tokens.color.textStrong, fontFamily: tokens.font[700], fontSize: tokens.type.sectionTitle.fontSize }}>
          {title}
        </Text>
        <Switch
          value={enabled}
          onValueChange={onEnabledChange}
          trackColor={{ true: tokens.color.primary, false: tokens.color.hairlineAlt }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={tokens.color.hairlineAlt}
          accessibilityLabel={`Enable ${title}`}
        />
        <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[700], fontSize: 14, marginLeft: 10, width: 16, textAlign: 'center' }}>
          {expanded ? '▾' : '▸'}
        </Text>
      </Pressable>
      {expanded && enabled ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  body: { marginTop: 10 },
});
