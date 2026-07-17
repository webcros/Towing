import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@towing/theme';
import { useThemeStore } from '@/store/themeStore';
import { QueryProvider } from './QueryProvider';
import { FontGate } from './FontGate';

/**
 * Provider stack (outer → inner): gesture handler → safe area → query cache →
 * theme → font gate. Order matters — theme must wrap everything that reads it,
 * and the font gate holds the first paint until Inter is loaded.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const preference = useThemeStore((s) => s.preference);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <ThemeProvider preference={preference}>
            <FontGate>{children}</FontGate>
          </ThemeProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
