import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

/** Cover photo with a graceful violet-surface placeholder when no URL / on error. */
export function HotelPhoto({
  uri,
  size = 56,
}: {
  uri?: string | null;
  size?: number;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const [failed, setFailed] = React.useState(false);
  const radius = tokens.radius.inner;
  if (!uri || failed) {
    return (
      <View
        style={[styles.ph, { width: size, height: size, borderRadius: radius, backgroundColor: tokens.color.surface }]}
      >
        <Building2 size={size * 0.4} color={tokens.color.textFaint} strokeWidth={2} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius }}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({ ph: { alignItems: 'center', justifyContent: 'center' } });
