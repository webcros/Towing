import type { CustomerSession } from '@towing/api-contracts';
import { ApiClientError } from '@/lib/api/errors';
import type { AuthDataSource } from './authDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Fixed challenge id + code — the "hermetic Maestro flow" the B0 canonical block requires with no backend at all. */
export const MOCK_CHALLENGE_ID = '00000000-0000-4000-8000-000000000099';
export const MOCK_OTP = '123456';

let mockMobile = '';

export const authMockSource: AuthDataSource = {
  async sendOtp(mobile) {
    await delay(400);
    mockMobile = mobile;
    return {
      challengeId: MOCK_CHALLENGE_ID,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      resendAfterSeconds: 30,
    };
  },

  async verifyOtp(challengeId, otp): Promise<CustomerSession> {
    await delay(400);
    if (challengeId !== MOCK_CHALLENGE_ID || otp !== MOCK_OTP) {
      throw new ApiClientError(401, 'unauthorized', 'That code was not accepted.');
    }
    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      customer: { id: 'mock-customer-1', mobile: mockMobile, name: 'Rahul Sharma', isNew: false },
    };
  },

  async logout() {
    await delay(200);
  },
};
