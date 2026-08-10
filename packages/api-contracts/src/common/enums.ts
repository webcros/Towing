import { z } from 'zod';

/**
 * Enums shared by more than one realm.
 *
 * The package barrel is FLAT — everything is imported from `@towing/api-contracts`
 * root — so a name declared in two realm folders is a build error. Anything two
 * realms both need lives here and is imported, never re-declared.
 */

/**
 * §3.1 driver KYC states. Lives here rather than in `fleet/drivers.ts` (its
 * original home) because the driver realm's own session contract carries it too.
 *
 * `incomplete` = signed up, documents not submitted. `pending` = submitted and
 * awaiting a human — Phase 11's approval queue selects exactly that, which is
 * why migration 0007 made `incomplete` the column default.
 */
export const kycStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'incomplete',
  'suspended',
]);
export type KycStatus = z.infer<typeof kycStatusSchema>;

/** §4.2 admin RBAC. Enforced server-side on every admin route. */
export const adminSubRoleSchema = z.enum(['super_admin', 'operations', 'support', 'finance']);
export type AdminSubRole = z.infer<typeof adminSubRoleSchema>;

export const socialProviderSchema = z.enum(['google', 'apple']);
export type SocialProvider = z.infer<typeof socialProviderSchema>;

/**
 * The 5 documents §3.1 requires (driving licence, RC, government ID, vehicle
 * inspection photo, selfie). Shared by the driver realm (submission,
 * `driver/kyc.ts`) and the admin realm (review, `admin/drivers.ts`).
 */
export const driverDocTypeSchema = z.enum(['license', 'rc', 'gov_id', 'inspection', 'selfie']);
export type DriverDocType = z.infer<typeof driverDocTypeSchema>;

/** Per-document review state (`driver_documents.status`) — distinct from the driver's overall `kycStatus`. */
export const docReviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type DocReviewStatus = z.infer<typeof docReviewStatusSchema>;

/**
 * The two realms that log in through `/v1/auth/*`. The fleet console
 * (`/v1/fleet/auth/*`) and the admin console (`/v1/admin/auth/*`) have their own
 * endpoints because they authenticate with a password first.
 */
export const publicAuthRoleSchema = z.enum(['customer', 'driver']);
export type PublicAuthRole = z.infer<typeof publicAuthRoleSchema>;
