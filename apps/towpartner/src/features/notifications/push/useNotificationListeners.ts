import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { applyNotificationData } from './handleNotificationData';
import { ensureNotificationChannels } from './channels';
import {
  addNotificationListeners,
  configureForegroundPresentation,
  getInitialNotificationData,
} from './pushClient';
import { registerRotatedToken } from './usePushRegistration';

/**
 * Wires the three ways a notification reaches a running app, plus the fourth
 * that reaches a dead one.
 *
 *   FOREGROUND  `onReceived` — the OS banner shows over the app, and the bell's
 *               unread count has to move without a refetch of the whole feed.
 *   BACKGROUND  `onTapped` — the app was alive but not on screen.
 *   KILLED      `getInitialNotificationData` — a tap that cold-started the app.
 *               `addNotificationResponseReceivedListener` never fires for this,
 *               so without it a cold start from a tap lands on the home screen
 *               and the message is silently dropped.
 *   ROTATION    `onTokenChanged` — Expo re-mints tokens, and a stale one fails
 *               silently until the next launch.
 *
 * ⚠ NEVER EXECUTED — see `pushClient.ts`.
 */
export function useNotificationListeners(): void {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== 'authenticated') return;

    configureForegroundPresentation();
    // Cheap and idempotent, and it has to happen before the first offer push
    // ever arrives — a channel created lazily on receipt is a channel the OS
    // has already decided how to present.
    void ensureNotificationChannels();

    const subscriptions = addNotificationListeners({
      onReceived: (data) => {
        applyNotificationData(data, queryClient);
      },
      onTapped: (data) => {
        // The KYC branch inside  is the one that
        // matters here — it invalidates the status query, which unlocks the
        // online toggle. Route-based navigation from a tap arrives with the
        // screens those routes point at (Phases 17-19).
        applyNotificationData(data, queryClient);
      },
      onTokenChanged: (token) => {
        void registerRotatedToken(token);
      },
    });

    void (async () => {
      const initial = await getInitialNotificationData();
      if (initial) applyNotificationData(initial, queryClient);
    })();

    return () => subscriptions.remove();
  }, [status, queryClient]);
}
