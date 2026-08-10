import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { money, primaryId, timestamps } from './columns';
import {
  actorRoleEnum,
  bookingStatusEnum,
  commissionBandEnum,
  paymentMethodEnum,
  serviceTypeEnum,
  vehicleClassEnum,
} from './enums';
import { drivers } from './drivers';
import { fleets } from './fleets';
import { serviceZones } from './service-zones';
import { users } from './users';

/**
 * Bookings (§17 BOOKINGS, state machine §5.1).
 *
 * The fare breakdown, `commission_band` and `commission_pct` are locked at
 * confirm time in the same transaction as assignment (§3.4) — later admin edits
 * to commission config must never retro-change a booking's economics.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    driverId: uuid('driver_id').references(() => drivers.id),
    fleetId: uuid('fleet_id').references(() => fleets.id),
    zoneId: uuid('zone_id').references(() => serviceZones.id),

    serviceType: serviceTypeEnum('service_type').notNull(),
    vehicleClass: vehicleClassEnum('vehicle_class').notNull(),

    pickupLat: doublePrecision('pickup_lat').notNull(),
    pickupLng: doublePrecision('pickup_lng').notNull(),
    pickupAddress: text('pickup_address'),
    dropLat: doublePrecision('drop_lat'),
    dropLng: doublePrecision('drop_lng'),
    dropAddress: text('drop_address'),
    distanceKm: numeric('distance_km', { precision: 8, scale: 2 }),

    status: bookingStatusEnum('status').notNull().default('searching'),

    baseFare: money('base_fare').notNull().default('0'),
    distanceCharge: money('distance_charge').notNull().default('0'),
    nightCharge: money('night_charge').notNull().default('0'),
    highwayCharge: money('highway_charge').notNull().default('0'),
    accidentCharge: money('accident_charge').notNull().default('0'),
    waitingCharge: money('waiting_charge').notNull().default('0'),
    surgeAmount: money('surge_amount').notNull().default('0'),
    discount: money('discount').notNull().default('0'),
    total: money('total').notNull().default('0'),

    commissionBand: commissionBandEnum('commission_band'),
    commissionPct: numeric('commission_pct', { precision: 5, scale: 2 }),
    commissionAmount: money('commission_amount').notNull().default('0'),
    driverPayout: money('driver_payout').notNull().default('0'),

    bookingOtp: text('booking_otp'),
    otpVerified: boolean('otp_verified').notNull().default(false),
    otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),

    shareToken: text('share_token'),
    shareExpiresAt: timestamp('share_expires_at', { withTimezone: true }),

    cancelledBy: actorRoleEnum('cancelled_by'),
    cancellationReason: text('cancellation_reason'),
    cancellationFee: money('cancellation_fee').notNull().default('0'),
    unableReason: text('unable_reason'),

    // Deliberately not a Drizzle FK: payments.booking_id already points back
    // here, and declaring both directions creates an unresolvable insert order.
    paymentId: uuid('payment_id'),
    paymentMethod: paymentMethodEnum('payment_method'),
    ...timestamps,
  },
  (t) => [
    index('idx_bookings_status').on(t.status),
    index('idx_bookings_user').on(t.userId),
    index('idx_bookings_driver').on(t.driverId),
    index('idx_bookings_fleet').on(t.fleetId),
    // Backs the console's keyset-paginated jobs feed: WHERE fleet_id = $1
    // ORDER BY created_at DESC, id DESC. Must match the cursor's sort exactly.
    index('idx_bookings_fleet_feed').on(t.fleetId, t.createdAt.desc(), t.id.desc()),
  ],
);

export const bookingStatusHistory = pgTable(
  'booking_status_history',
  {
    id: primaryId(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    status: bookingStatusEnum('status').notNull(),
    actor: actorRoleEnum('actor').notNull().default('system'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_booking_status_history_booking').on(t.bookingId, t.createdAt)],
);

/** Persisted breadcrumb samples for trip replay (§11.2). */
export const bookingLocationPath = pgTable(
  'booking_location_path',
  {
    id: primaryId(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_booking_location_path_booking').on(t.bookingId, t.recordedAt)],
);

/** Per-wave offer log powering the admin dispatch inspector (§9.4.6). */
export const dispatchAttempts = pgTable(
  'dispatch_attempts',
  {
    id: primaryId(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    wave: integer('wave').notNull(),
    radiusKm: numeric('radius_km', { precision: 6, scale: 2 }).notNull(),
    driverId: uuid('driver_id').references(() => drivers.id),
    outcome: text('outcome').notNull(), // offered|accepted|rejected|expired|revoked
    offeredAt: timestamp('offered_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [index('idx_dispatch_attempts_booking').on(t.bookingId, t.wave)],
);
