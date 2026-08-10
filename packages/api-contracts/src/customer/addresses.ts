import { z } from 'zod';

/**
 * `GET/POST/PUT/DELETE /v1/me/addresses` (Phase 12). Gains `lat`/`lng` over
 * the mobile app's original mock-era `SavedLocation` shape — a saved address
 * with no coordinates can never seed a booking pickup/drop.
 */
export const savedAddressSchema = z.object({
  id: z.uuid(),
  label: z.string().nullable(),
  fullAddress: z.string(),
  lat: z.number(),
  lng: z.number(),
  isDefault: z.boolean(),
});
export type SavedAddress = z.infer<typeof savedAddressSchema>;

export const savedAddressCreateSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  fullAddress: z.string().min(1).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});
export type SavedAddressCreate = z.infer<typeof savedAddressCreateSchema>;

export const savedAddressUpdateSchema = savedAddressCreateSchema.partial();
export type SavedAddressUpdate = z.infer<typeof savedAddressUpdateSchema>;
