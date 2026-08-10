import type { DriverIdentity, DriverSession } from '@towing/api-contracts';

export type { DriverIdentity, DriverSession };

export interface OtpSendResult {
  challengeId: string;
  expiresAt: string;
  resendAfterSeconds: number;
}
