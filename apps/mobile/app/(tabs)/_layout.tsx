import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plane, Bell, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

export default function TabsLayout(): React.JSX.Element {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 4);
  const isAndroid = Platform.OS === 'android';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.textMuted,
        // Android reads as a Material pill nav bar: surface elevation + an
        // active-pill indicator behind the selected tab. iOS keeps the flat
        // hairline-topped bar.
        ...(isAndroid
          ? {
              tabBarActiveBackgroundColor: tokens.color.chipBg,
              tabBarItemStyle: { marginHorizontal: 8, marginVertical: 6, borderRadius: tokens.radius.badge },
            }
          : null),
        tabBarStyle: {
          backgroundColor: tokens.color.card,
          borderTopColor: tokens.color.hairline,
          borderTopWidth: isAndroid ? 0 : StyleSheet.hairlineWidth,
          paddingBottom: bottomPad,
          height: (isAndroid ? 60 : 50) + bottomPad,
          ...(isAndroid ? { elevation: 8 } : null),
        },
        tabBarLabelStyle: { fontFamily: tokens.font[600], fontSize: 11, letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Trips', tabBarIcon: ({ color, size }) => <Plane size={size} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Bell size={size} color={color} strokeWidth={2} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} strokeWidth={2} /> }}
      />
    </Tabs>
  );
}
