import { apiFetch } from '@/lib/api/client';
import type { DriverKycPresignResponse, DriverKycStatusResponse, DriverKycSubmitResponse } from '../types';
import type { KycDataSource } from './kycDataSource';

export const kycRestSource: KycDataSource = {
  presign(docType) {
    return apiFetch<DriverKycPresignResponse>('driver/kyc/documents/presign', {
      method: 'POST',
      body: JSON.stringify({ docType }),
    });
  },

  confirm(docType, key) {
    // A weak signal at a job site is exactly when this call is likely to be
    // attempted — enqueueOnFailure lets it survive a dropped connection
    // instead of silently losing an already-uploaded document's confirmation.
    return apiFetch<void>('driver/kyc/documents/confirm', {
      method: 'POST',
      body: JSON.stringify({ docType, key }),
      idempotent: true,
      enqueueOnFailure: true,
    });
  },

  getStatus() {
    return apiFetch<DriverKycStatusResponse>('driver/kyc/status');
  },

  submit() {
    return apiFetch<DriverKycSubmitResponse>('driver/kyc/submit', {
      method: 'POST',
      idempotent: true,
      enqueueOnFailure: true,
    });
  },
};
