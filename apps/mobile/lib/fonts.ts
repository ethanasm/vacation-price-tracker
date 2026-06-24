/**
 * Loads the Manrope family (weights 400–800) used across the Aurora UI.
 * Called once during root-layout mount with the splash screen held up until
 * it resolves (see app/_layout.tsx). Re-exports FONT so screens can reference
 * family names without importing tokens twice.
 */
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { tokens } from './theme/tokens';

export const FONT = tokens.font;

export const APP_FONTS = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

/** Hook form — returns true once fonts are ready. Used by the root layout. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts(APP_FONTS);
  return loaded;
}
