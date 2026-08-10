import { z } from 'zod';

/**
 * Branded entity ids. Using distinct brands makes cross-entity (and, for
 * FleetId, cross-tenant) mix-ups a compile error: a repository that requires
 * `FleetId` cannot be handed a raw string or a `TruckId`.
 */
export const fleetIdSchema = z.uuid().brand<'FleetId'>();
export type FleetId = z.infer<typeof fleetIdSchema>;

export const truckIdSchema = z.uuid().brand<'TruckId'>();
export type TruckId = z.infer<typeof truckIdSchema>;

export const driverIdSchema = z.uuid().brand<'DriverId'>();
export type DriverId = z.infer<typeof driverIdSchema>;

export const bookingIdSchema = z.uuid().brand<'BookingId'>();
export type BookingId = z.infer<typeof bookingIdSchema>;

export const walletIdSchema = z.uuid().brand<'WalletId'>();
export type WalletId = z.infer<typeof walletIdSchema>;

export const payoutIdSchema = z.uuid().brand<'PayoutId'>();
export type PayoutId = z.infer<typeof payoutIdSchema>;

export const complianceDocIdSchema = z.uuid().brand<'ComplianceDocId'>();
export type ComplianceDocId = z.infer<typeof complianceDocIdSchema>;
