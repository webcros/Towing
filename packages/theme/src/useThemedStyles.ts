import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './useTheme';
import type { Theme } from './types';

/**
 * Build a themed StyleSheet, memoized on the active theme. Define the factory
 * at module scope so its identity is stable:
 *
 *   const styles = (t: Theme) => ({ box: { backgroundColor: t.colors.card } });
 *   const s = useThemedStyles(styles);
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}
