import React, { createContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme } from './themes/lightTheme';
import { darkTheme } from './themes/darkTheme';
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

  const theme = useMemo<Theme>(() => {
    const resolved: ThemeMode =
      preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
    return resolved === 'dark' ? darkTheme : lightTheme;
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
