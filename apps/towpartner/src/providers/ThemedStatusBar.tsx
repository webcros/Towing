import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@towing/theme';

/** Status bar icons follow the active theme. */
export function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.isDark ? 'light' : 'dark'} />;
}
