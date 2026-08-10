import { ApiClientError } from '@/lib/api/errors';
import { REQUIRED_KYC_DOC_TYPES, type DriverDocType, type DocReviewStatus, type KycStatus } from '../types';
import type { KycDataSource } from './kycDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface MockDocState {
  status: DocReviewStatus;
  rejectionReason: string | null;
}

// Module-scoped, like authMockSource's `mockMobile` — there is exactly one
// mock session at a time in a dev/Maestro run.
let mockKycStatus: KycStatus = 'incomplete';
let mockRejectionReason: string | null = null;
const mockDocs = new Map<DriverDocType, MockDocState>();

/** Called by authMockSource on a fresh mock login so a previous run's KYC progress doesn't leak into a new one. */
export function resetKycMockState(): void {
  mockKycStatus = 'incomplete';
  mockRejectionReason = null;
  mockDocs.clear();
}

/** Read by capabilitiesMockSource so its `KycApprovedGuard` simulation checks the same state this module owns. */
export function getMockKycStatus(): KycStatus {
  return mockKycStatus;
}

export const kycMockSource: KycDataSource = {
  async presign(docType) {
    await delay(300);
    return {
      uploadUrl: `mock://driver-documents/${docType}`,
      key: `driver-documents/mock-driver-1/${docType}-${Date.now()}.jpg`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  },

  async confirm(docType) {
    await delay(300);
    // Mirrors the real service: a resubmission resets the doc's review, and
    // the overall status/reason don't move here — only `submit()` changes those.
    mockDocs.set(docType, { status: 'pending', rejectionReason: null });
  },

  async getStatus() {
    await delay(300);
    return {
      kycStatus: mockKycStatus,
      rejectionReason: mockRejectionReason,
      // Real backend: a doc with no confirmed upload simply has no row, so it
      // is absent here too rather than showing as some default "empty" status.
      documents: Array.from(mockDocs.entries()).map(([docType, state]) => ({
        docType,
        status: state.status,
        rejectionReason: state.rejectionReason,
      })),
    };
  },

  async submit() {
    await delay(400);
    if (mockKycStatus !== 'incomplete') {
      throw new ApiClientError(409, 'conflict', `Cannot submit from kyc_status '${mockKycStatus}'`);
    }
    const missing = REQUIRED_KYC_DOC_TYPES.filter((docType) => !mockDocs.has(docType));
    if (missing.length > 0) {
      throw new ApiClientError(422, 'validation_error', 'All 5 documents must be uploaded before submitting', {
        missing,
      });
    }
    mockKycStatus = 'pending';
    const kycSubmittedAt = new Date().toISOString();
    return { kycStatus: mockKycStatus, kycSubmittedAt };
  },
};
