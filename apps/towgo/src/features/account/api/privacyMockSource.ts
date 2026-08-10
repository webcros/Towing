import { randomUUID } from 'expo-crypto';
import type { AccountDeletionResponse, AccountExportResponse, ConsentRecord } from '@towing/api-contracts';
import type { PrivacyDataSource } from './privacyDataSource';
import { profileMockSource } from './profileMockSource';
import { vehiclesMockSource } from './vehiclesMockSource';
import { addressesMockSource } from './addressesMockSource';
import { emergencyContactsMockSource } from './emergencyContactsMockSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const consents: ConsentRecord[] = [];

export const privacyMockSource: PrivacyDataSource = {
  async deleteAccount(_reason): Promise<AccountDeletionResponse> {
    await delay(500);
    return { requestId: randomUUID(), status: 'requested', requestedAt: new Date().toISOString() };
  },

  async exportData(): Promise<AccountExportResponse> {
    await delay(600);
    const [profile, vehicles, addresses, emergencyContacts] = await Promise.all([
      profileMockSource.getProfile(),
      vehiclesMockSource.list(),
      addressesMockSource.list(),
      emergencyContactsMockSource.list(),
    ]);
    return { profile, vehicles, addresses, emergencyContacts, consents };
  },

  async recordConsent(policyType, policyVersion) {
    await delay(300);
    consents.push({ policyType, policyVersion, consentedAt: new Date().toISOString() });
  },
};
