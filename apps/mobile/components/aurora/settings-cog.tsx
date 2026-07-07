import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

/**
 * The cog button shown in the top-right of every screen — opens /settings.
 * Rendered inside each screen's own header row (screens draw their headers
 * manually; the navigator headers are hidden).
 */
export function SettingsCog({ testID = 'settings-cog' }: { testID?: string }): React.JSX.Element {
  const { tokens } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      testID={testID}
      hitSlop={10}
      onPress={() => router.push('/settings')}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Settings size={22} color={tokens.color.textMuted} strokeWidth={2} />
    </Pressable>
  );
}
