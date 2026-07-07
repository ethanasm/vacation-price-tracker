/**
 * Root layout — provider chain for the whole app.
 *   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → AuthProvider
 *   → QueryClientProvider → ApiClientProvider → Stack
 * Fonts are loaded before the first paint (splash held up). The auth gate
 * redirects signed-out users to (auth)/sign-in.
 */
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';

import { ThemeProvider } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useAppFonts } from '@/lib/fonts';
import { ApiClientProvider } from '@/lib/api/provider';
import { configureNotificationHandler, DISMISS_ACTION_ID } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout(): React.JSX.Element | null {
  const fontsLoaded = useAppFonts();

  React.useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  // Configure the foreground banner / Android heads-up channel once at start.
  React.useEffect(() => {
    configureNotificationHandler();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <Providers>
              <AuthGate />
              <StatusBar style="dark" />
            </Providers>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
}

/**
 * Redirects between the (auth) group and the app shell based on session state.
 * Renders the active route via <Stack>.
 */
function AuthGate(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router]);

  // Tapping a price-drop notification (or its Android "View trip" action)
  // deep-links into that trip; the "Dismiss" action just clears the card.
  React.useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier === DISMISS_ACTION_ID) return;
      const tripId = response.notification.request.content.data?.tripId;
      if (typeof tripId === 'string' && tripId) router.push(`/trip/${tripId}`);
    });
    return () => sub.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="trip/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="trip/[id]/edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip/new" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
