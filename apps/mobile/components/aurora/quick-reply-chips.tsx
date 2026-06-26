import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

/**
 * A wrapped row of pressable suggestion pills shown when the chat thread is
 * empty. Each pill calls `onPick(text)` with its label.
 */
export function QuickReplyChips({
  options,
  onPick,
}: {
  options: string[];
  onPick: (text: string) => void;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <View style={styles.wrap}>
      {options.map((text) => (
        <Pressable
          key={text}
          accessibilityRole="button"
          accessibilityLabel={text}
          onPress={() => onPick(text)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: c.chipBg,
              borderRadius: tokens.radius.badge,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: c.primaryDeep, fontFamily: tokens.font[600], fontSize: 13 }}>
            {text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 9 },
});
