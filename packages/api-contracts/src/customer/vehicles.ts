import { z } from 'zod';

/**
 * §9.1.5: "vehicle determines class" — the customer picks their OWN vehicle's
 * category here; the tow-truck class (`wheel_lift`/`flatbed`, `fleet/trucks.ts`'s
 * `vehicleClassSchema`) is a server-side derivation from this, not modeled yet.
 *
 * No taxonomy is named in the spec docs — this list is a Phase 12 default,
 * confirm-or-override per `ToBeDoneEhsan.md`. `savedVehicles.type` is a bare
 * `text` column (no DB enum), so widening this list later is a contract change
 * only, never a migration.
 */
export const vehicleCategorySchema = z.enum([
  'hatchback',
  'sedan',
  'suv',
  'muv',
  'luxury',
  'bike',
  'other',
]);
export type VehicleCategory = z.infer<typeof vehicleCategorySchema>;

/** `GET /v1/me/vehicles` item shape, and the `POST`/`PUT` request bodies below. */
export const savedVehicleSchema = z.object({
  id: z.uuid(),
  type: vehicleCategorySchema,
  makeModel: z.string().nullable(),
  plate: z.string().nullable(),
  rcUrl: z.string().nullable(),
  isDefault: z.boolean(),
});
export type SavedVehicle = z.infer<typeof savedVehicleSchema>;

export const savedVehicleCreateSchema = z.object({
  type: vehicleCategorySchema,
  makeModel: z.string().min(1).max(120).optional(),
  plate: z.string().min(1).max(20).optional(),
  isDefault: z.boolean().optional(),
});
export type SavedVehicleCreate = z.infer<typeof savedVehicleCreateSchema>;

export const savedVehicleUpdateSchema = savedVehicleCreateSchema.partial();
export type SavedVehicleUpdate = z.infer<typeof savedVehicleUpdateSchema>;

/**
 * `POST /v1/me/vehicles/:id/rc/presign` — the RC-photo upload, same
 * presign→confirm shape as Phase 11's driver KYC documents (see
 * `common/storage/presigned-upload.helper.ts` server-side).
 */
export const vehicleRcPresignResponseSchema = z.object({
  uploadUrl: z.url(),
  key: z.string(),
  expiresAt: z.iso.datetime(),
});
export type VehicleRcPresignResponse = z.infer<typeof vehicleRcPresignResponseSchema>;

export const vehicleRcConfirmRequestSchema = z.object({
  key: z.string().min(1),
});
export type VehicleRcConfirmRequest = z.infer<typeof vehicleRcConfirmRequestSchema>;
