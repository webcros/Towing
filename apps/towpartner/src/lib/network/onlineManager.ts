import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { flushMutationQueue } from '@/lib/api/client';

/**
 * Bridge device connectivity into TanStack Query's onlineManager so queries
 * pause/refetch correctly across network drops (spec §10.9), flush the
 * durable mutation queue on reconnect, and bridge app foreground/background
 * into `focusManager` so a query opted into `refetchOnWindowFocus` (e.g.
 * `useKycStatus()`) re-pulls the moment the driver returns to the app —
 * React Native has no browser focus event, so nothing does this by default.
 * Call once at boot.
 */
export function initOnlineManager(): void {
  let wasOffline = false;

  onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected !== false;
      setOnline(isOnline);

      // Edge-triggered: only flush on the offline→online transition, not on
      // every connectivity event NetInfo happens to fire.
      if (isOnline && wasOffline) {
        flushMutationQueue().catch(() => {});
      }
      wasOffline = !isOnline;
    });
    return unsubscribe;
  });

  const onAppStateChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };
  AppState.addEventListener('change', onAppStateChange);
}
