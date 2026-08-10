import type { CustomerIdentity, CustomerSession } from '@towing/api-contracts';

export type { CustomerIdentity, CustomerSession };

export interface OtpSendResult {
  challengeId: string;
  expiresAt: string;
  resendAfterSeconds: number;
}
