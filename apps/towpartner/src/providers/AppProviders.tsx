import React from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ThemeProvider } from '@towing/theme';
import { PressablePrimitiveProvider } from '@towing/ui';
import { MotionPressable } from '@/motion';
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
      {/* iOS only. initialWindowMetrics is captured when the native module is
          constructed — before Android applies edge-to-edge window insets — so on
          Android it renders a first frame with bottom: 0. Without it the provider
          simply holds the frame until real insets arrive, which is what we want. */}
      <SafeAreaProvider initialMetrics={Platform.OS === 'ios' ? initialWindowMetrics : undefined}>
        <QueryProvider>
          <ThemeProvider preference={preference}>
            {/* Swaps the Pressable inside every @towing/ui component for the
                Reanimated-backed one, which is what finally gives Card (and so
                JobCard) the press feedback its `pressScale` prop was already
                asking for. */}
            <PressablePrimitiveProvider value={MotionPressable}>
              <FontGate>{children}</FontGate>
            </PressablePrimitiveProvider>
          </ThemeProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
