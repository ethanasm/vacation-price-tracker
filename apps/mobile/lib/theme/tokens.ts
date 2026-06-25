/**
 * Aurora design tokens — the single source of truth the mobile screens (P3)
 * consume. Pure data + helpers, no React Native imports, so node:test can
 * import this file directly. Values are copied verbatim from the Aurora
 * handoff (design_handoff_price_tracker/README.md) and apps/web globals.css.
 */

export const tokens = Object.freeze({
  color: Object.freeze({
    primary: '#7C3AED',
    primaryDeep: '#6D28D9',
    accentPink: '#EC4899',
    accentPinkLight: '#F9A8D4',
    accentCyan: '#22D3EE',
    pageBg: '#FAF8FF',
    surface: '#F4F1FC',
    surfaceAlt: '#F8F5FE',
    chipBg: '#EDE9FE',
    card: '#FFFFFF',
    hairline: '#F1EEF8',
    hairlineAlt: '#ECE8F5',
    selectedBorder: '#C9B8F5',
    textStrong: '#1A1A2E',
    textBody: '#4A4660',
    textBodyAlt: '#6B6680',
    textMuted: '#8B86A0',
    textFaint: '#BDB6D4',
    success: '#059669',
    successBg: '#ECFDF5',
    warning: '#9A7B18',
    warningBg: '#FEF6DD',
    layover: '#C98A3A',
    layoverBg: '#FDF6E9',
    layoverBorder: '#F6E7C8',
    star: '#F5A623',
    starEmpty: '#E0D9EF',
  }),
  gradient: Object.freeze({
    primary: Object.freeze(['#A78BFA', '#7C3AED'] as const),
    totalCard: Object.freeze(['#7C3AED', '#9333EA'] as const),
  }),
  airline: Object.freeze({
    AS: Object.freeze({ colors: Object.freeze(['#10617F', '#093247'] as const), label: 'AS' }),
    UA: Object.freeze({ colors: Object.freeze(['#2456C9', '#13357F'] as const), label: 'UA' }),
    DL: Object.freeze({ colors: Object.freeze(['#C8102E', '#7A0A1C'] as const), label: 'DL' }),
  }),
  radius: Object.freeze({ card: 16, inner: 13, pill: 10, badge: 999 }),
  shadow: Object.freeze({
    // RN shadow objects (iOS) + elevation (Android). rgba(60,40,120,.13) etc.
    cardOnCanvas: Object.freeze({
      shadowColor: '#3C2878',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.13,
      shadowRadius: 50,
      elevation: 8,
    }),
    primaryButton: Object.freeze({
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.32,
      shadowRadius: 14,
      elevation: 6,
    }),
    totalCard: Object.freeze({
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 22,
      elevation: 7,
    }),
  }),
  // Manrope family names exactly as @expo-google-fonts/manrope exports them
  // (loaded in lib/fonts.ts). Weight key -> RN fontFamily string.
  font: Object.freeze({
    400: 'Manrope_400Regular',
    500: 'Manrope_500Medium',
    600: 'Manrope_600SemiBold',
    700: 'Manrope_700Bold',
    800: 'Manrope_800ExtraBold',
  } as Record<400 | 500 | 600 | 700 | 800, string>),
  type: Object.freeze({
    h1: { fontSize: 26, weight: 800 as const, letterSpacing: -0.5 },
    sectionTitle: { fontSize: 16, weight: 700 as const, letterSpacing: 0 },
    statValue: { fontSize: 22, weight: 800 as const, letterSpacing: -0.4 },
    body: { fontSize: 14, weight: 500 as const, letterSpacing: 0 },
    label: { fontSize: 11, weight: 700 as const, letterSpacing: 0.5 },
  }),
});

export type Tokens = typeof tokens;

/** Format a whole-dollar amount as the Aurora UI shows it: `$789`, `$1,838`. */
export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
