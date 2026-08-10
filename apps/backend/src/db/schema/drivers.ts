import { boolean, index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { geographyPoint } from '../geography';
import { primaryId, timestamps } from './columns';
import {
  docReviewStatusEnum,
  driverDocTypeEnum,
  driverLevelEnum,
  kycStatusEnum,
  vehicleClassEnum,
} from './enums';
import { adminUsers } from './admin';
import { fleets } from './fleets';
import { serviceZones } from './service-zones';
import { fleetTrucks } from './trucks';

/** Drivers (§17 DRIVERS). `fleet_id` is null for independent drivers. */
export const drivers = pgTable(
  'drivers',
  {
    id: primaryId(),
    mobile: text('mobile').notNull().unique(),
    name: text('name'),
    email: text('email'),
    photoUrl: text('photo_url'),
    fleetId: uuid('fleet_id').references(() => fleets.id, { onDelete: 'set null' }),
    /**
     * Which fleet truck this driver currently operates (§16.4 assign-truck).
     * One driver per truck — enforced by a partial unique index added in the
     * migration (drizzle-kit does not emit partial unique indexes).
     */
    assignedTruckId: uuid('assigned_truck_id').references(() => fleetTrucks.id, {
      onDelete: 'set null',
    }),

    /**
     * DEFAULT IS `incomplete`, NOT `pending` (changed in migration 0007).
     *
     * `pending` means "submitted and awaiting a human" and nothing else —
     * Phase 11's approval queue selects exactly that. With the old default,
     * every driver who had merely entered an OTP would land in the queue with
     * zero documents, and the "resume from incomplete" path would be
     * unreachable for anyone who self-signed-up.
     */
    kycStatus: kycStatusEnum('kyc_status').notNull().default('incomplete'),
    isOnline: boolean('is_online').notNull().default(false),
    vehicleClass: vehicleClassEnum('vehicle_class'),
    // §3.2 Band C opt-in — long hauls need a willing driver, not a pricier plan.
    longDistanceEnabled: boolean('long_distance_enabled').notNull().default(false),

    currentLocation: geographyPoint('current_location'),
    lastPingAt: timestamp('last_ping_at', { withTimezone: true }),

    rating: numeric('rating', { precision: 2, scale: 1 }),
    totalTrips: integer('total_trips').notNull().default(0),
    acceptanceRate: numeric('acceptance_rate', { precision: 5, scale: 2 }),
    completionRate: numeric('completion_rate', { precision: 5, scale: 2 }),
    level: driverLevelEnum('level').notNull().default('bronze'),

    // An approver is an ADMIN. This referenced `users` — the customer table —
    // until migration 0007, which had never been exercised because nothing
    // wrote it; repointing it post-launch would be a data migration.
    approvedBy: uuid('approved_by').references(() => adminUsers.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    /**
     * Set when a driver completes `POST /v1/driver/kyc/submit` (Phase 11). Drives
     * the admin queue's "submitted date" column — `kyc_status` alone tells you
     * a driver is `pending` but not since when.
     */
    kycSubmittedAt: timestamp('kyc_submitted_at', { withTimezone: true }),
    /**
     * §6.1 keys the presence hot set by zone (Phase 16). Schema-only seam for
     * now, same standing as `admin_users.twofa_secret` — nothing writes it until
     * the presence work lands.
     */
    currentZoneId: uuid('current_zone_id').references(() => serviceZones.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    // GIST index is added in the migration — drizzle-kit does not emit USING GIST.
    index('idx_drivers_status').on(t.kycStatus, t.isOnline),
    index('idx_drivers_fleet').on(t.fleetId),
  ],
);

export const driverDocuments = pgTable(
  'driver_documents',
  {
    id: primaryId(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    docType: driverDocTypeEnum('doc_type').notNull(),
    fileUrl: text('file_url').notNull(),
    status: docReviewStatusEnum('status').notNull().default('pending'),
    // Same repoint as `drivers.approved_by` — a verifier is an admin, not a customer.
    verifiedBy: uuid('verified_by').references(() => adminUsers.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /**
     * Per-document rejection reason (Phase 11) — distinct from the overall
     * `drivers.rejection_reason`, which was the only place a reason could live
     * while the only admin action was a driver-level decision.
     */
    rejectionReason: text('rejection_reason'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('idx_driver_documents_driver').on(t.driverId)],
);
