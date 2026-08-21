import type { QueryClient } from '@tanstack/react-query';
import { pushDataPayloadSchema, type PushDataPayload } from '@towing/api-contracts';
import { notificationKeys } from '../api/notifications.keys';

/**
 * What a received or tapped push actually does.
 *
 * ⚠ IT SWITCHES ON `data.event`, AND SO DOES THE BACKEND. That field is the
 * discriminator, declared exactly once in `pushDataPayloadSchema` and imported
 * by both halves. If the two sides ever picked different names the push would
 * arrive, nothing would refetch, and the bug would be invisible without a
 * device in hand — so the payload is PARSED through the shared schema here
 * rather than read field by field, and a rename breaks the build.
 */
export type NotificationAction =
  | { kind: 'none' }
  | { kind: 'navigate'; route: string };

export function parsePushData(raw: Record<string, unknown>): PushDataPayload | null {
  const parsed = pushDataPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Applied for EVERY push, foreground or tapped: the bell's unread count is
 * stale the moment a notification exists, whether or not the user acted on it.
 */
export function applyNotificationData(
  raw: Record<string, unknown>,
  queryClient: QueryClient,
): NotificationAction {
  const data = parsePushData(raw);
  if (!data) return { kind: 'none' };

  // Always: a new notification means a new inbox row.
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });

  // `invalidate` is a query-key NAMESPACE the server names, not a route — it
  // is how a later phase can make a push refresh a booking or a payment
  // without this file learning about either.
  if (data.invalidate) {
    void queryClient.invalidateQueries({ queryKey: data.invalidate.split('.') });
  }

  if (data.action === 'open' && data.route) {
    return { kind: 'navigate', route: data.route };
  }

  return { kind: 'none' };
}
