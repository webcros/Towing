import { env } from '@/lib/env';
import type { DriverDocType, DriverKycPresignResponse, DriverKycStatusResponse, DriverKycSubmitResponse } from '../types';
import { kycMockSource } from './kycMockSource';
import { kycRestSource } from './kycRestSource';

/**
 * Boundary between UI and the already-shipped `driver-kyc` backend module
 * (Phase 11). Mock/REST selection follows the same `env.useMocks` switch as
 * every other feature's data source.
 */
export interface KycDataSource {
  presign(docType: DriverDocType): Promise<DriverKycPresignResponse>;
  confirm(docType: DriverDocType, key: string): Promise<void>;
  getStatus(): Promise<DriverKycStatusResponse>;
  submit(): Promise<DriverKycSubmitResponse>;
}

export const kycDataSource: KycDataSource = env.useMocks ? kycMockSource : kycRestSource;
