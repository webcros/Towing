import { useMutation, useQueryClient } from '@tanstack/react-query';
import { track } from '@/lib/analytics/analytics';
import { unregisterThisDevice } from '@/features/notifications/push/usePushRegistration';
import { authDataSource } from './authDataSource';
import { useAuthStore } from '../store/authStore';

/** Phone entry screen — kicks off an OTP challenge (spec §9.1.1). */
export function useSendOtp() {
  return useMutation({
    mutationFn: (mobile: string) => authDataSource.sendOtp(mobile),
    onSuccess: () => track('signup_start'),
  });
}

/** OTP screen — verifying starts the authenticated session. */
export function useVerifyOtp() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: ({ challengeId, otp }: { challengeId: string; otp: string }) =>
      authDataSource.verifyOtp(challengeId, otp),
    onSuccess: (session) => {
      setSession(session);
      if (session.customer.isNew) {
        track('signup_complete');
      }
    },
  });
}

/** Settings → Logout. Clears the server-side refresh token, local session, and cached queries. */
export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (refreshToken: string) => {
      // BEFORE the session is cleared, because the call needs the bearer token
      // (invariant 73). A push token outlives the session on its handset, and
      // the next person to sign in here would otherwise see this customer's
      // notifications on the lock screen.
      //
      // Best-effort — it must never be the thing that stops a sign-out. The
      // server also revokes on suspension and account deletion, because a
      // client cannot be relied on to tell it.
      await unregisterThisDevice();
      return authDataSource.logout(refreshToken);
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}
