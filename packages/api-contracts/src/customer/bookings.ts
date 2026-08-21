import { z } from 'zod';
import { serviceTypeSchema } from '../common/enums';
import { geoPointSchema } from '../common/geo';
import { unsignedPaiseSchema } from '../common/money';
import { commissionBandSchema, jobStatusSchema } from '../fleet/jobs';
import { vehicleClassSchema } from '../fleet/trucks';
import { fareBreakdownSchema } from './pricing-estimate';

/**
 * The customer's booking surface (§16.2, §5.1, §9.1.5–§9.1.10).
 *
 * STATUS IS `jobStatusSchema`, THE SAME TEN VALUES THE FLEET SEES. §5.1 defines
 * exactly ten states and `booking_status` in Postgres holds exactly those ten.
 * TowGo's local `statusMeta.ts` invented an eleventh — `'scheduled'` — which no
 * server can ever return; a scheduled booking is `searching` with a future
 * `scheduledAt`, and the app derives its badge from that. Declaring a second
 * status vocabulary here would make the two drift by design.
 *
 * MONEY IS INTEGER PAISE and timestamps are ISO 8601, both without exception.
 * Phase 12 corrected the contract this way and deferred the booking feature's
 * own fields to "their own phases (15 bookings)" — this is that phase.
 */

/** `POST /v1/bookings` — the §3.4 confirm. Requires an `Idempotency-Key` header (§19.4). */
export const bookingCreateSchema = z
  .object({
    /** A `services.slug` from `GET /v1/services`; the server maps it to a billable type. */
    serviceSlug: z.string().min(1),
    /** Overrides the catalogue row's default. Required when that default is null. */
    vehicleClass: vehicleClassSchema.optional(),

    pickup: geoPointSchema,
    /** Human-readable label for the pickup pin, shown back in the trip list. */
    pickupAddress: z.string().min(1).max(300),
    drop: geoPointSchema.optional(),
    dropAddress: z.string().min(1).max(300).optional(),

    /**
     * §9.1.5's "later". Recorded and honoured as a dispatch DELAY; the booking
     * is still created immediately and still enters `searching`, because §5.1
     * has no scheduled state. Must be in the future when present.
     */
    scheduledAt: z.iso.datetime().optional(),

    /** §9.1.5's note editor. */
    note: z.string().max(500).optional(),

    /**
     * §9.1.5's "booking for someone else". The person the driver will actually
     * meet, when that is not the account holder.
     */
    contact: z
      .object({
        name: z.string().min(1).max(120),
        mobile: z.string().regex(/^\+?[0-9]{10,15}$/, 'Not a valid mobile number'),
      })
      .optional(),

    /** A `saved_vehicles` row, so the driver knows what they are collecting. */
    savedVehicleId: z.uuid().optional(),
  })
  .refine((body) => !body.drop || Boolean(body.dropAddress), {
    message: 'dropAddress is required when a drop is given',
    path: ['dropAddress'],
  });
export type BookingCreate = z.infer<typeof bookingCreateSchema>;

/**
 * A booking as its own customer sees it.
 *
 * NO COMMISSION FIELDS, for the same §7.6 reason the estimate has none — the
 * booking row carries `commission_band`, `commission_pct`, `commission_amount`
 * and `driver_payout`, and none of them is the customer's business. The mapper
 * builds this field by field rather than spreading the row.
 */
export const bookingSchema = z.object({
  id: z.uuid(),
  /** Human-quotable short code, e.g. `TW-3F9A21B4`. Matches what the fleet console shows. */
  reference: z.string(),
  status: jobStatusSchema,

  serviceSlug: z.string(),
  serviceType: serviceTypeSchema,
  vehicleClass: vehicleClassSchema,

  pickupAddress: z.string().nullable(),
  pickup: geoPointSchema,
  dropAddress: z.string().nullable(),
  drop: geoPointSchema.nullable(),
  distanceKm: z.number().nullable(),

  /** The fare LOCKED at confirm (§3.4). Admin edits afterwards never touch it. */
  breakdown: fareBreakdownSchema,
  /** §3.3 tier. A label, not a take rate. */
  band: commissionBandSchema.nullable(),

  /** Future-dated when the customer chose "later"; null for an immediate tow. */
  scheduledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Booking = z.infer<typeof bookingSchema>;

/** `GET /v1/bookings/:id` — everything in the list row plus what only the detail screen needs. */
export const bookingDetailSchema = bookingSchema.extend({
  note: z.string().nullable(),
  contactName: z.string().nullable(),
  contactMobile: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  cancelledBy: z.enum(['customer', 'driver', 'fleet_owner', 'admin', 'system']).nullable(),
  cancellationFeePaise: unsignedPaiseSchema,
  /**
   * Whether the booking OTP can be fetched yet (§9.1.7 — never before
   * assignment). Sent so the app can show or hide the OTP card without probing
   * a route that would 409.
   */
  otpAvailable: z.boolean(),
  /**
   * Live §6.4 search state, or `null` once the booking is no longer searching.
   *
   * §19.2's REST fallback carries the SAME facts the `/customer` socket pushes,
   * so a client on the 10-second poll and a client on a socket cannot tell the
   * customer different stories about how the search is going. §9.1.6's AC is
   * "wave transitions reflect the actual engine state" — polled real state is
   * real state; only invented state is forbidden.
   */
  search: z
    .object({
      wave: z.number().int().positive(),
      radiusKm: z.number().positive(),
      /** Cumulative across waves — see `searchProgressSchema` for why. */
      driversContacted: z.number().int().nonnegative(),
      deadlineAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;

/** `GET /v1/bookings` — keyset paginated, newest first. */
export const bookingListResponseSchema = z.object({
  items: z.array(bookingSchema),
  nextCursor: z.string().nullable(),
});
export type BookingListResponse = z.infer<typeof bookingListResponseSchema>;

/**
 * `GET /v1/bookings/:id/otp` (§9.1.7).
 *
 * `expiresAt` is 30 minutes from THIS retrieval. Fetching again inside the
 * window returns the same code; fetching after it mints a new one and restarts
 * the clock, so a slow search or heavy traffic can never leave the customer
 * holding a dead code at the handover.
 */
export const bookingOtpResponseSchema = z.object({
  code: z.string().length(6),
  expiresAt: z.iso.datetime(),
});
export type BookingOtpResponse = z.infer<typeof bookingOtpResponseSchema>;

/** `POST /v1/bookings/:id/cancel`. */
export const bookingCancelSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type BookingCancel = z.infer<typeof bookingCancelSchema>;

/**
 * §3.5's tiers. Phase 15 only permits `free`; the chargeable tiers need the
 * ledger and land in Phase 19, so the route computes the fee, reports it, and
 * refuses.
 */
export const cancellationTierSchema = z.enum(['free', 'partial', 'full']);
export type CancellationTier = z.infer<typeof cancellationTierSchema>;

export const bookingCancelResponseSchema = z.object({
  id: z.uuid(),
  status: jobStatusSchema,
  tier: cancellationTierSchema,
  feePaise: unsignedPaiseSchema,
});
export type BookingCancelResponse = z.infer<typeof bookingCancelResponseSchema>;
