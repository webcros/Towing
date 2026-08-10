import { z } from 'zod';
import { mobileSchema } from '../common/auth';

/**
 * `GET/POST/DELETE /v1/me/emergency-contacts` (Phase 12) — a hard §13 (SOS)
 * prerequisite, captured here rather than in Phase 20. No `PUT`: no edit UI
 * exists or is planned, only add/remove.
 */
export const emergencyContactSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  relation: z.string().nullable(),
});
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;

export const emergencyContactCreateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: mobileSchema,
  relation: z.string().min(1).max(60).optional(),
});
export type EmergencyContactCreate = z.infer<typeof emergencyContactCreateSchema>;
