import { z } from 'zod';
import { docReviewStatusSchema, driverDocTypeSchema, kycStatusSchema } from '../common/enums';
import { vehicleClassSchema } from '../fleet/trucks';

/**
 * Driver KYC submission (Phase 11, `modules/driver-kyc`) — §3.1 layer 1, the
 * app side of the gate. TowPartner's wizard (Phase 12) is the first UI on top
 * of this; this phase ships the API only.
 */

export const driverKycPresignRequestSchema = z.object({
  docType: driverDocTypeSchema,
});
export type DriverKycPresignRequest = z.infer<typeof driverKycPresignRequestSchema>;

/**
 * A presigned PUT the client uploads bytes to directly, plus the `key` it
 * must echo back to `POST /v1/driver/kyc/documents/confirm` once the upload
 * succeeds — the presign call cannot itself know the upload happened.
 */
export const driverKycPresignResponseSchema = z.object({
  uploadUrl: z.url(),
  key: z.string(),
  expiresAt: z.iso.datetime(),
});
export type DriverKycPresignResponse = z.infer<typeof driverKycPresignResponseSchema>;

export const driverKycConfirmRequestSchema = z.object({
  docType: driverDocTypeSchema,
  key: z.string().min(1),
});
export type DriverKycConfirmRequest = z.infer<typeof driverKycConfirmRequestSchema>;

export const driverKycDocumentStatusSchema = z.object({
  docType: driverDocTypeSchema,
  status: docReviewStatusSchema,
  rejectionReason: z.string().nullable(),
});
export type DriverKycDocumentStatus = z.infer<typeof driverKycDocumentStatusSchema>;

export const driverKycStatusResponseSchema = z.object({
  kycStatus: kycStatusSchema,
  /** Overall note from the last `reject`/`request_info` admin decision, if any. */
  rejectionReason: z.string().nullable(),
  documents: z.array(driverKycDocumentStatusSchema),
});
export type DriverKycStatusResponse = z.infer<typeof driverKycStatusResponseSchema>;

export const driverKycSubmitResponseSchema = z.object({
  kycStatus: kycStatusSchema,
  kycSubmittedAt: z.iso.datetime(),
});
export type DriverKycSubmitResponse = z.infer<typeof driverKycSubmitResponseSchema>;

/** §3.2 — vehicle class and the Band C long-haul opt-in, both admin-revocable (`admin/drivers.ts`). */
export const driverCapabilitiesUpdateSchema = z
  .object({
    vehicleClass: vehicleClassSchema.optional(),
    longDistanceEnabled: z.boolean().optional(),
  })
  .refine((body) => body.vehicleClass !== undefined || body.longDistanceEnabled !== undefined, {
    message: 'At least one of vehicleClass or longDistanceEnabled must be provided',
  });
export type DriverCapabilitiesUpdate = z.infer<typeof driverCapabilitiesUpdateSchema>;

export const driverCapabilitiesResponseSchema = z.object({
  vehicleClass: vehicleClassSchema.nullable(),
  longDistanceEnabled: z.boolean(),
});
export type DriverCapabilitiesResponse = z.infer<typeof driverCapabilitiesResponseSchema>;
