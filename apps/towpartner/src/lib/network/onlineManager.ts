import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Bridge device connectivity into TanStack Query's onlineManager so queries
 * pause/refetch correctly across network drops (spec §10.9). Call once at boot.
 */
export function initOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return unsubscribe;
  });
}
