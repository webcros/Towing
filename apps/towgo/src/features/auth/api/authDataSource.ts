import type { CustomerSession } from '@towing/api-contracts';
import { env } from '@/lib/env';
import type { OtpSendResult } from '../types';
import { authMockSource } from './authMockSource';
import { authRestSource } from './authRestSource';

export interface AuthDataSource {
  sendOtp(mobile: string): Promise<OtpSendResult>;
  verifyOtp(challengeId: string, otp: string): Promise<CustomerSession>;
  logout(refreshToken: string): Promise<void>;
}

export const authDataSource: AuthDataSource = env.useMocks ? authMockSource : authRestSource;
