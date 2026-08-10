import { driverDocTypeSchema } from '@towing/api-contracts';
import type {
  DocReviewStatus,
  DriverCapabilitiesResponse,
  DriverCapabilitiesUpdate,
  DriverDocType,
  DriverKycDocumentStatus,
  DriverKycPresignResponse,
  DriverKycStatusResponse,
  DriverKycSubmitResponse,
  KycStatus,
} from '@towing/api-contracts';

export type {
  DocReviewStatus,
  DriverCapabilitiesResponse,
  DriverCapabilitiesUpdate,
  DriverDocType,
  DriverKycDocumentStatus,
  DriverKycPresignResponse,
  DriverKycStatusResponse,
  DriverKycSubmitResponse,
  KycStatus,
};

/** Single source of truth for the wizard's 5 slots and their order — derived from the shared schema, not hand-duplicated. */
export const REQUIRED_KYC_DOC_TYPES = driverDocTypeSchema.options;

export const DOC_TYPE_LABELS: Record<DriverDocType, string> = {
  license: 'Driving Licence',
  rc: 'Vehicle RC',
  gov_id: 'Government ID',
  inspection: 'Vehicle Inspection Photo',
  selfie: 'Selfie',
};

export const DOC_TYPE_HINTS: Record<DriverDocType, string> = {
  license: 'Front side, all corners visible',
  rc: 'Registration certificate for your tow vehicle',
  gov_id: 'Aadhaar, PAN, or Voter ID',
  inspection: 'Recent photo of the vehicle with its plate visible',
  selfie: 'A clear photo of your face, no filters',
};
