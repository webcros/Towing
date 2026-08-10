import { z } from 'zod';
import { docReviewStatusSchema, driverDocTypeSchema } from '../common/enums';
import {
  driverCapabilitiesResponseSchema,
  driverCapabilitiesUpdateSchema,
} from '../driver/kyc';
import { vehicleClassSchema } from '../fleet/trucks';

/**
 * Admin KYC queue + per-document review (Phase 11, `modules/admin-drivers`) —
 * the console built on top of Phase 10's single `POST .../kyc` decision route.
 */

export const adminPendingDocumentSchema = z.object({
  id: z.uuid(),
  docType: driverDocTypeSchema,
  status: docReviewStatusSchema,
  rejectionReason: z.string().nullable(),
  /** Short-TTL `storage.presignGet()` URL — re-fetch the queue once it expires, don't cache it. */
  thumbnailUrl: z.url(),
});
export type AdminPendingDocument = z.infer<typeof adminPendingDocumentSchema>;

/** `GET /v1/admin/drivers/pending` — scoped to `kyc_status = 'pending'` only (§3.1: "submitted and awaiting a human"). */
export const adminPendingDriverSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  mobile: z.string(),
  vehicleClass: vehicleClassSchema.nullable(),
  longDistanceEnabled: z.boolean(),
  kycSubmittedAt: z.iso.datetime().nullable(),
  documents: z.array(adminPendingDocumentSchema),
});
export type AdminPendingDriver = z.infer<typeof adminPendingDriverSchema>;

export const adminPendingDriversResponseSchema = z.object({
  items: z.array(adminPendingDriverSchema),
});
export type AdminPendingDriversResponse = z.infer<typeof adminPendingDriversResponseSchema>;

/**
 * `POST /v1/admin/drivers/:id/documents/:docId/review` — genuinely new in
 * Phase 11: Phase 10 only ever decided at the driver level, never per-document.
 */
export const adminDocumentReviewSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().min(3).max(500).optional(),
  })
  .refine((body) => body.decision !== 'reject' || Boolean(body.reason), {
    message: 'A rejection reason is required',
    path: ['reason'],
  });
export type AdminDocumentReview = z.infer<typeof adminDocumentReviewSchema>;

export const adminDocumentReviewResultSchema = z.object({
  documentId: z.uuid(),
  docType: driverDocTypeSchema,
  status: docReviewStatusSchema,
  rejectionReason: z.string().nullable(),
});
export type AdminDocumentReviewResult = z.infer<typeof adminDocumentReviewResultSchema>;

/** `PUT /v1/admin/drivers/:id/capabilities` — same shape as the driver's own self-service PUT (`driver/kyc.ts`); admin can additionally revoke the §3.2 long-haul opt-in. */
export const adminCapabilitiesUpdateSchema = driverCapabilitiesUpdateSchema;
export type AdminCapabilitiesUpdate = z.infer<typeof adminCapabilitiesUpdateSchema>;

export const adminCapabilitiesResponseSchema = driverCapabilitiesResponseSchema;
export type AdminCapabilitiesResponse = z.infer<typeof adminCapabilitiesResponseSchema>;
