import { useMutation } from '@tanstack/react-query';
import type { ConsentPolicyType } from '@towing/api-contracts';
import { privacyDataSource } from './privacyDataSource';
import { privacyKeys } from './privacy.keys';

/** Legal → "Delete my account" (spec §20.4). Files a request; a later worker executes it. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (reason?: string) => privacyDataSource.deleteAccount(reason),
  });
}

/** Legal → "Download my data". On-demand, so a mutation rather than a cached query. */
export function useExportData() {
  return useMutation({
    mutationKey: privacyKeys.export(),
    mutationFn: () => privacyDataSource.exportData(),
  });
}

/** First-run consent capture — `privacy_policy` and `terms_of_service`, one call each. */
export function useRecordConsent() {
  return useMutation({
    mutationFn: ({ policyType, policyVersion }: { policyType: ConsentPolicyType; policyVersion: string }) =>
      privacyDataSource.recordConsent(policyType, policyVersion),
  });
}
