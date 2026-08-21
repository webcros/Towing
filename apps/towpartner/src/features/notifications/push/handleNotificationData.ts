import type { QueryClient } from '@tanstack/react-query';
import { pushDataPayloadSchema, type PushDataPayload } from '@towing/api-contracts';
import { useAuthStore } from '@/features/auth/store/authStore';
import { kycKeys } from '@/features/kyc/api/kyc.queries';
import { notificationKeys } from '../api/notifications.keys';

/**
 * What a received or tapped push actually does — including the §9.4.3 money
 * shot.
 *
 * ⚠ IT SWITCHES ON `data.event`, AND SO DOES THE BACKEND. That field is the
 * discriminator, declared exactly once in `pushDataPayloadSchema` and imported
 * by both halves, and the payload is PARSED through that shared schema rather
 * than read field by field — so a rename breaks the build instead of breaking
 * the demo. If the two sides ever picked different names the push would arrive,
 * nothing would refetch, and the bug would be invisible without a device.
 */
export type NotificationAction = { kind: 'none' } | { kind: 'navigate'; route: string };

export function parsePushData(raw: Record<string, unknown>): PushDataPayload | null {
  const parsed = pushDataPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function applyNotificationData(
  raw: Record<string, unknown>,
  queryClient: QueryClient,
): NotificationAction {
  const data = parsePushData(raw);
  if (!data) return { kind: 'none' };

  // Always: a new notification means a new inbox row and a moved unread count.
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });

  /**
   * THE ACCEPTANCE CHAIN, CLIENT HALF.
   *
   * Admin approves in the web console → the backend emits
   * `driver.kyc.approved` → this arrives → the KYC query is invalidated →
   * `useKycStatus`'s effect writes the fresh status into `authStore` →
   * `HomeScreen`'s `disabled={!approved || !kycVerified}` flips. No manual
   * refetch, which is the §9.4.3 AC Phase 11 could only approximate.
   *
   * Handled explicitly rather than relying on the generic `invalidate` split
   * below, because `kycVerified` is store state that no query invalidation
   * touches on its own — and invariant 64 requires a THIS-SESSION server
   * confirmation, not a cached status, before the toggle unlocks.
   *
   * Approval does NOT revoke the driver's session (`admin-drivers.service.ts`
   * revokes only on `suspended`/`rejected`), so they are still signed in and
   * the refetch simply succeeds.
   */
  if (
    data.event === 'driver.kyc.approved' ||
    data.event === 'driver.kyc.rejected' ||
    data.event === 'driver.kyc.request_info'
  ) {
    void queryClient.invalidateQueries({ queryKey: kycKeys.all });
    if (data.route) return { kind: 'navigate', route: data.route };
    return { kind: 'none' };
  }

  // `invalidate` is a query-key NAMESPACE the server names — dot-separated so a
  // later phase can refresh jobs or earnings without this file learning about
  // either. It must match the client's key root: `kycKeys.all` is `['kyc']`,
  // so the server sends `'kyc'`, not `'driver.kyc'`.
  if (data.invalidate) {
    void queryClient.invalidateQueries({ queryKey: data.invalidate.split('.') });
  }

  if (data.action === 'open' && data.route) {
    return { kind: 'navigate', route: data.route };
  }

  return { kind: 'none' };
}

/** Exposed so a screen can react to an approval without re-parsing the payload. */
export function isApprovalEvent(raw: Record<string, unknown>): boolean {
  return parsePushData(raw)?.event === 'driver.kyc.approved';
}

/** Kept next to the handler so the store bridge is visible from one place. */
export function currentKycVerified(): boolean {
  return useAuthStore.getState().kycVerified;
}
