/**
 * Theme provider + hooks. The token set is static (Aurora is a single light
 * theme), so the provider mostly exists to give screens a stable `useTheme()`
 * entry point and a memoised `useThemedStyles` helper. Kept thin on purpose —
 * P3 builds StyleSheets on top of this.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { tokens, type Tokens } from './tokens';

export { tokens, formatUsd, type Tokens } from './tokens';

export interface ThemeValue {
  tokens: Tokens;
}

const ThemeContext = React.createContext<ThemeValue>({ tokens });

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const value = React.useMemo<ThemeValue>(() => ({ tokens }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return React.useContext(ThemeContext);
}

/**
 * Build a memoised StyleSheet from the tokens. Usage:
 *   const styles = useThemedStyles((t) => ({ card: { backgroundColor: t.color.card } }));
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (t: Tokens) => T,
): T {
  return React.useMemo(() => StyleSheet.create(factory(tokens)), [factory]);
}
