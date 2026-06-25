import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plane, Bell, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

export default function TabsLayout(): React.JSX.Element {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 4);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.primary,
        tabBarInactiveTintColor: tokens.color.textMuted,
        tabBarStyle: {
          backgroundColor: tokens.color.card,
          borderTopColor: tokens.color.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: bottomPad,
          height: 50 + bottomPad,
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
