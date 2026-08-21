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
import { fleetTrucks } from './trucks';
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

    /**
     * §5.1's booking OTP, SHA-256 hashed — never the code itself.
     *
     * This column was `booking_otp text` holding the PLAINTEXT code until
     * migration 0012 (only the seed had ever written it). Phase 13 refused to
     * route OTPs through the notification spine precisely because that would
     * "reverse the hash-at-rest posture `login_challenges.code_hash` has"; a
     * plaintext booking OTP sitting on the row for the life of the trip did
     * exactly that, and this is the same digest those login codes use.
     */
    bookingOtpHash: text('booking_otp_hash'),
    otpVerified: boolean('otp_verified').notNull().default(false),
    /**
     * End of the current 30-minute window (§9.1.7). Retrieval past it mints a
     * fresh code and restarts the clock — a tow can easily outlast one window,
     * and a dead code at the handover is worse than a rotated one.
     */
    otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
    /** §9.2.3 "wrong OTP (retry, capped)". Had nowhere to live before 0012. */
    otpAttempts: integer('otp_attempts').notNull().default(0),

    shareToken: text('share_token'),
    shareExpiresAt: timestamp('share_expires_at', { withTimezone: true }),

    cancelledBy: actorRoleEnum('cancelled_by'),
    cancellationReason: text('cancellation_reason'),
    cancellationFee: money('cancellation_fee').notNull().default('0'),
    unableReason: text('unable_reason'),

    /**
     * The truck the job was actually done with, snapshotted at assign (Phase 17
     * writes it). Without it, reassigning a driver's truck silently rewrites
     * historical job attribution and every fleet earnings report —
     * `dashboard.service.ts` still carries its "honest proxy until bookings
     * carry a truck_id" comment.
     */
    truckId: uuid('truck_id').references(() => fleetTrucks.id),

    /**
     * Durable §6.4 wave state. In-memory search progress does not survive a
     * Fargate task recycling mid-search, and a booking whose wave is unknown
     * cannot be resumed — it can only be restarted from radius one.
     *
     * WRITTEN BY PHASE 17, AND RESUMPTION IS THE WHOLE POINT. §6.5's re-dispatch
     * after a driver cancels "resumes at the wave where it previously matched"
     * rather than restarting at 2 km — a customer whose driver dropped out four
     * minutes in must not be sent to the back of the queue for it.
     *
     * `dispatch_deadline_at` is set once, on the first wave, and is the real
     * terminator of a search: 5 rungs × 3 offers × 20 s is 300 s against a
     * ~180 s deadline, so the clock runs out before the ladder does.
     */
    searchWave: integer('search_wave'),
    dispatchDeadlineAt: timestamp('dispatch_deadline_at', { withTimezone: true }),

    /**
     * §9.1.5's "schedule for later". A scheduled booking is still created
     * immediately and still enters `searching` — §5.1 has no scheduled state —
     * but its dispatch job is enqueued with a matching delay, so Phase 17
     * cannot offer tomorrow's tow today.
     */
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),

    /**
     * §9.1.5's "booking for someone else": whoever the driver will actually
     * meet, when that is not the account holder. Null means the customer.
     */
    contactName: text('contact_name'),
    contactMobile: text('contact_mobile'),

    /** §9.1.5's note editor — free text the driver sees on the job card. */
    note: text('note'),

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
    // The customer's own keyset feed (`GET /v1/bookings`). `idx_bookings_user`
    // is user_id ALONE, so without this twin of the fleet feed every page of a
    // customer's trip history sorts. Same DESC NULLS LAST shape, for the same
    // sortless-plan reason.
    index('idx_bookings_user_feed').on(t.userId, t.createdAt.desc(), t.id.desc()),
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

/**
 * Persisted breadcrumb samples for trip replay (§11.2).
 *
 * Written for the first time by Phase 16's ~30s location flush, whose INSERT
 * finds the driver's active booking with its own SELECT rather than caching one
 * — see `DriverPresenceRepo.sampleBookingPath`. `idx_bookings_driver_active`
 * (migration 0013) is what keeps that join off the driver's whole trip history.
 *
 * SAMPLES, NOT A TRACE. At the on-job cadence of 3s a full trace would be
 * ~1,200 rows per driver-hour for a replay nobody watches at that resolution;
 * the flush coalesces to one row per driver per window.
 */
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

/**
 * Per-wave offer log powering the admin dispatch inspector (§9.4.6).
 *
 * APPEND-ONLY AUDIT, NOT STATE. Phase 17's engine keeps its durable wave
 * position on `bookings.search_wave` / `dispatch_deadline_at` and its live locks
 * in Redis; this table records what happened. Reconstructing "where is the
 * search now" by querying these rows would be a second source of truth that
 * disagrees the first time a row is written outside a transaction.
 *
 * It has TWO readers, both added in Phase 17: the §6.5 exclusion set (who has
 * already been offered this booking, so a re-dispatch does not ask them again)
 * and the rolling 30-day `drivers.acceptance_rate` recompute — which is 15 % of
 * the §6.2 score, so a wrong row here changes a driver's income.
 *
 * `outcome` is constrained by `ck_dispatch_attempts_outcome` (migration 0014) to
 * the five values named below; `idx_dispatch_attempts_driver` there backs the
 * acceptance-rate window. Neither is emitted by drizzle-kit.
 */
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
