import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { applyNotificationData } from './handleNotificationData';
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

    const subscriptions = addNotificationListeners({
      onReceived: (data) => {
        applyNotificationData(data, queryClient);
      },
      onTapped: (data) => {
        // Navigation from a tap is deliberately NOT wired this phase: the only
        // registered customer trigger has `action: 'open'` with no route, and
        // a route table for bookings/jobs/payments belongs with the phases that
        // create those screens (15/17/19). The invalidation still runs.
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
