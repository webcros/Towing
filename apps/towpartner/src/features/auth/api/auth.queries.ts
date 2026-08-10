import { useMutation, useQueryClient } from '@tanstack/react-query';
import { track } from '@/lib/analytics/analytics';
import { clearQueuedMutations } from '@/lib/mutationQueue/queue';
import { authDataSource } from './authDataSource';
import { useAuthStore } from '../store/authStore';

/** Phone entry screen — kicks off an OTP challenge (spec §9.2.1 driver-realm equivalent of §9.1.1). */
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
      if (session.driver.isNew) {
        track('signup_complete');
      }
    },
  });
}

/** Profile → Logout. Clears the server-side refresh token, local session, and cached queries. */
export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (refreshToken: string) => authDataSource.logout(refreshToken),
    onSettled: () => {
      clearSession();
      queryClient.clear();
      // A queued entry replays under whoever is logged in when connectivity
      // returns, not under the session that originally queued it — must not
      // survive to the next driver's session on a shared device.
      clearQueuedMutations();
    },
  });
}
