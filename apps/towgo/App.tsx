import React from 'react';
import { AppProviders } from '@/providers/AppProviders';
import { ThemedStatusBar } from '@/providers/ThemedStatusBar';
import { RootNavigator } from '@/navigation/RootNavigator';
import { initOnlineManager } from '@/lib/network/onlineManager';

// Bridge connectivity into TanStack Query once, at module load.
initOnlineManager();

export default function App() {
  return (
    <AppProviders>
      <ThemedStatusBar />
      <RootNavigator />
    </AppProviders>
  );
}
