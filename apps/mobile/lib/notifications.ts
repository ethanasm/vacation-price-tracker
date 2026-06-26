/**
 * Push-notification glue for the mobile app.
 *
 * The *pure* piece is `buildPriceDropNotification` — the title/body/data copy a
 * price-drop renders with. It's the unit-tested part (node:test) and the single
 * source of truth the P5 server push will mirror. To keep this module importable
 * by node:test (which can't transform React Native's source), the RN/Expo
 * modules are `require`d lazily *inside* the glue functions rather than at the
 * top level — so importing `buildPriceDropNotification` never pulls RN in.
 *
 * The glue is a thin wrapper over `expo-notifications`:
 *  - `configureNotificationHandler()` — foreground banner + Android heads-up
 *    channel + iOS presentation, wired once at app start (see app/_layout.tsx).
 *  - `registerForPushNotificationsAsync()` — best-effort permission + Expo push
 *    token. The token POST to the server is P5 (see `registerDeviceToken`).
 *  - `presentLocalPriceDrop()` — schedules a local notification so the
 *    lock-screen / heads-up rendering is demonstrable without the P5 trigger.
 */
/* eslint-disable @typescript-eslint/no-require-imports --
 * RN/Expo modules are required lazily inside the glue functions (not at module
 * top level) so node:test can import the pure builder without transforming
 * React Native's source. See the module doc above. */

export interface PriceDropArgs {
  tripName: string;
  /** Notification threshold in whole dollars, or null when none is set. */
  threshold: number | null;
  /** Current trip total in whole dollars. */
  total: number;
  tripId: string;
}

export interface PriceDropContent {
  title: string;
  body: string;
  data: { tripId: string };
}

/** Channel id for the Android heads-up price-drop notifications. */
export const PRICE_DROP_CHANNEL_ID = 'price-drops';

/**
 * Notification category id carrying the Android heads-up action buttons
 * (VIEW TRIP / DISMISS). Reused as the `categoryIdentifier` on scheduled
 * price-drop notifications.
 */
export const PRICE_DROP_CATEGORY_ID = 'price-drop';

/** Action id the deep-link listener (app/_layout.tsx) treats as "open the trip". */
export const VIEW_TRIP_ACTION_ID = 'viewTrip';
/** Action id that just dismisses the heads-up card. */
export const DISMISS_ACTION_ID = 'dismiss';

/**
 * Pure builder for the price-drop notification copy. Kept import-free of React
 * Native so it can be unit-tested directly with node:test.
 *
 * Title: `📉 {tripName} just dropped below ${threshold}` — or, when no threshold
 * is configured, `📉 {tripName} price drop`.
 * Body: `Now $${total} total — tap to view the trip.` (thousands-separated).
 */
export function buildPriceDropNotification({
  tripName,
  threshold,
  total,
  tripId,
}: PriceDropArgs): PriceDropContent {
  const title =
    threshold != null
      ? `📉 ${tripName} just dropped below $${threshold.toLocaleString()}`
      : `📉 ${tripName} price drop`;
  return {
    title,
    body: `Now $${total.toLocaleString()} total — tap to view the trip.`,
    data: { tripId },
  };
}

/**
 * Configure how a notification is presented while the app is foregrounded, plus
 * the Android channel used for heads-up alerts. Idempotent; call once at start.
 */
export function configureNotificationHandler(): void {
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  const { Platform } = require('react-native') as typeof import('react-native');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    // MAX importance = heads-up card on Android 8+.
    void Notifications.setNotificationChannelAsync(PRICE_DROP_CHANNEL_ID, {
      name: 'Price drops',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    }).catch(() => undefined);

    // Android heads-up actions: VIEW TRIP (deep-links via the data.tripId the
    // _layout response listener reads) + DISMISS (clears the card). iOS keeps
    // the plain lock-screen banner — no category attached.
    void Notifications.setNotificationCategoryAsync(PRICE_DROP_CATEGORY_ID, [
      {
        identifier: VIEW_TRIP_ACTION_ID,
        buttonTitle: 'View trip',
        options: { opensAppToForeground: true },
      },
      {
        identifier: DISMISS_ACTION_ID,
        buttonTitle: 'Dismiss',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]).catch(() => undefined);
  }
}

/**
 * Request notification permission and resolve the Expo push token. Best-effort:
 * returns null on web, when permission is denied, or when no project id is
 * available. Does NOT send the token anywhere — see `registerDeviceToken`.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { Platform } = require('react-native') as typeof import('react-native');
  if (Platform.OS === 'web') return null;

  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  const Constants = (require('expo-constants') as { default: typeof import('expo-constants').default })
    .default;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Hand the device's Expo push token to the backend so the daily price-check can
 * target it.
 *
 * No-op until P5 wires the receiving endpoint.
 *
 * TODO(P5): POST device token to /v1/notifications/device-token
 */
export async function registerDeviceToken(_token: string): Promise<void> {
  // Intentionally a no-op shim — the endpoint lands with P5's push trigger.
  return undefined;
}

/**
 * Render a price-drop locally (foreground banner / lock-screen / heads-up). Used
 * by the dev preview affordance and mirrors what the P5 server push will send.
 */
export async function presentLocalPriceDrop(args: PriceDropArgs): Promise<void> {
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  const { Platform } = require('react-native') as typeof import('react-native');

  await Notifications.scheduleNotificationAsync({
    content: {
      ...buildPriceDropNotification(args),
      // Android: route to the heads-up channel and attach the VIEW TRIP /
      // DISMISS action category. iOS keeps the plain lock-screen banner.
      ...(Platform.OS === 'android'
        ? { channelId: PRICE_DROP_CHANNEL_ID, categoryIdentifier: PRICE_DROP_CATEGORY_ID }
        : null),
    },
    trigger: null,
  });
}
