import type {
  AccountDeletionResponse,
  AccountExportResponse,
  ConsentPolicyType,
} from '@towing/api-contracts';
import { env } from '@/lib/env';
import { privacyMockSource } from './privacyMockSource';
import { privacyRestSource } from './privacyRestSource';

/** §20.4 DPDP — consent capture, account deletion, data export (the driver half of the dual-realm `/me` routes). */
export interface PrivacyDataSource {
  deleteAccount(reason?: string): Promise<AccountDeletionResponse>;
  exportData(): Promise<AccountExportResponse>;
  recordConsent(policyType: ConsentPolicyType, policyVersion: string): Promise<void>;
}

export const privacyDataSource: PrivacyDataSource = env.useMocks ? privacyMockSource : privacyRestSource;
