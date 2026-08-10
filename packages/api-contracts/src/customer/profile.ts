import { z } from 'zod';

/**
 * `GET/PUT /v1/me` (Phase 12) — the customer's own profile. `mobile` is the
 * auth key (unique on `users`) and is deliberately absent from the update
 * schema: changing it would mean re-verifying a new number, which is a
 * re-authentication flow this phase does not build, not a profile edit.
 */

export const customerProfileSchema = z.object({
  id: z.uuid(),
  mobile: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  photoUrl: z.string().nullable(),
});
export type CustomerProfile = z.infer<typeof customerProfileSchema>;

export const customerProfileUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
});
export type CustomerProfileUpdate = z.infer<typeof customerProfileUpdateSchema>;
