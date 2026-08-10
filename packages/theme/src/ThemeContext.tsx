import React, { createContext, useMemo } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { lightTheme } from './themes/lightTheme';
import { darkTheme } from './themes/darkTheme';
import { scaleTokens } from './tokens/scale';
import type { Theme, ThemeMode } from './types';

/** User's theme choice; 'system' follows the OS appearance. */
export type ThemePreference = 'light' | 'dark' | 'system';

export const ThemeContext = createContext<Theme>(lightTheme);

export type ThemeProviderProps = {
  preference?: ThemePreference;
  children: React.ReactNode;
};

export function ThemeProvider({ preference = 'system', children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();

  const theme = useMemo<Theme>(() => {
    const resolved: ThemeMode =
      preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
    const base = resolved === 'dark' ? darkTheme : lightTheme;

    // Tokens are authored at the 390dp reference width; re-scale them to the
    // real viewport so the design keeps its proportions on narrower phones.
    const { ratio, spacing, typography, sizes } = scaleTokens(width);

    return {
      ...base,
      spacing,
      typography,
      sizes,
      scaleRatio: ratio,
      scale: (dp: number) => Math.round(dp * ratio * 2) / 2,
    };
  }, [preference, systemScheme, width]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
