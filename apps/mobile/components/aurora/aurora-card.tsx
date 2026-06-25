import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '@/lib/theme';

/** White surface card: radius 16, card-on-canvas shadow. `accent` paints a 3px
 * left border (used for the multi-carrier flight card). */
export function AuroraCard({
  children,
  accent,
  style,
  ...rest
}: ViewProps & { accent?: string }): React.JSX.Element {
  const { tokens } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: tokens.color.card,
          borderRadius: tokens.radius.card,
          ...tokens.shadow.cardOnCanvas,
        },
        accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ card: { padding: 16 } });
