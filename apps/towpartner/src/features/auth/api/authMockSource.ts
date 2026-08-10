import type { DriverSession } from '@towing/api-contracts';
import { ApiClientError } from '@/lib/api/errors';
import { resetKycMockState } from '@/features/kyc/api/kycMockSource';
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

  async verifyOtp(challengeId, otp): Promise<DriverSession> {
    await delay(400);
    if (challengeId !== MOCK_CHALLENGE_ID || otp !== MOCK_OTP) {
      throw new ApiClientError(401, 'unauthorized', 'That code was not accepted.');
    }
    // A fresh mock login always starts an unverified driver — kycMockSource's
    // state is module-scoped and would otherwise carry over a previous mock
    // session's progress across a logout/login cycle in the same JS runtime.
    resetKycMockState();
    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      driver: {
        id: 'mock-driver-1',
        mobile: mockMobile,
        name: 'Rahul Sharma',
        kycStatus: 'incomplete',
        fleetId: null,
        isNew: true,
      },
    };
  },

  async logout() {
    await delay(200);
  },
};
