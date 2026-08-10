import { z } from 'zod';
// Moved to `common/enums` in Phase 10 — the driver realm's own session contract
// needs it too, and the package barrel is flat, so it can only be declared once.
// Re-exported here so `kycStatusSchema` keeps resolving for existing importers.
import { kycStatusSchema } from '../common/enums';
import { unsignedPaiseSchema } from '../common/money';
import { pageEnvelopeSchema, pageQuerySchema } from '../common/pagination';
import { vehicleClassSchema } from './trucks';

export const fleetDriverSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  kycStatus: kycStatusSchema,
  isOnline: z.boolean(),
  assignedTruckPlate: z.string().nullable(),
  rating: z.number().nullable(),
  tripsTotal: z.number().int(),
  /** SUM(driver_share_credit) since the IST month start. */
  monthNetPaise: unsignedPaiseSchema,
});
export type FleetDriverDto = z.infer<typeof fleetDriverSchema>;

export const driversListQuerySchema = pageQuerySchema;
export const driversListResponseSchema = pageEnvelopeSchema(fleetDriverSchema);
export type DriversListResponse = z.infer<typeof driversListResponseSchema>;

/**
 * Invite creates a KYC-`incomplete` driver row; the driver completes KYC in
 * TowPartner and approval stays central with platform admin (spec §9.3.5).
 * NOTE: `drivers.mobile` is globally unique — inviting a number that already
 * exists (even as an independent driver) returns 409 `duplicate_mobile`.
 */
export const driverInviteSchema = z.object({
  name: z.string().min(2).max(80),
  mobile: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use E.164 format, e.g. +919845012345'),
  vehicleClass: vehicleClassSchema.optional(),
});
export type DriverInviteRequest = z.infer<typeof driverInviteSchema>;

/** `truckId: null` unassigns. One driver per truck, enforced by a partial unique index. */
export const assignTruckSchema = z.object({
  truckId: z.uuid().nullable(),
});
export type AssignTruckRequest = z.infer<typeof assignTruckSchema>;
