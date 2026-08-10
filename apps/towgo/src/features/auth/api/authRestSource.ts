import type { CustomerSession, OtpSendResponse } from '@towing/api-contracts';
import { publicFetch } from '@/lib/api/client';
import type { AuthDataSource } from './authDataSource';

export const authRestSource: AuthDataSource = {
  async sendOtp(mobile) {
    const res = await publicFetch<OtpSendResponse>('auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ mobile, role: 'customer' }),
    });
    return res;
  },

  verifyOtp(challengeId, otp) {
    return publicFetch<CustomerSession>('auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId, otp }),
    });
  },

  async logout(refreshToken) {
    await publicFetch<void>('auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};
