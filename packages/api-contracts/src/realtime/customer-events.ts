import { z } from 'zod';
import { jobStatusSchema } from '../fleet/jobs';

/**
 * The `/customer` namespace (§16.6) — Phase 17.
 *
 * WHY A THIRD NAMESPACE RATHER THAN A THIRD ROOM. The three realms differ in
 * what they may SEND, not only in what they receive: `/fleet` accepts nothing,
 * `/driver` accepts a location stream, and this one accepts nothing either.
 * Collapsing them would mean one `ClientToServerEvents` union covering all
 * three, and the guarantee "a customer socket cannot send anything" would
 * become a runtime check instead of a type.
 *
 * Phase 18 inherits this namespace for live driver position — the same
 * arrangement that had Phase 16 build `driver:{id}` for Phase 17's offers.
 */

export const CUSTOMER_NAMESPACE = '/customer';

/**
 * The only room a customer socket joins, and it is scoped to ONE booking.
 *
 * NOT `customer:{userId}`. A customer has at most one trip in flight (§3.8), so
 * a per-user room would carry exactly one booking's traffic anyway — and the
 * booking id is what the dispatch engine has in hand when it emits. Keying on
 * the booking also means the room name is decided by a ticket the server minted
 * after proving ownership, rather than by anything the client says afterwards.
 */
export const bookingRoom = (bookingId: string): string => `booking:${bookingId}`;

/** Server→customer event names. Client→server is deliberately empty. */
export const CUSTOMER_EVENT = {
  READY: 'realtime:ready',
  SEARCH_PROGRESS: 'search:progress',
  BOOKING_STATUS: 'booking:status',
} as const;
export type CustomerEventName = (typeof CUSTOMER_EVENT)[keyof typeof CUSTOMER_EVENT];

export const customerReadySchema = z.object({
  bookingId: z.uuid(),
  serverTime: z.iso.datetime(),
});
export type CustomerReadyEvent = z.infer<typeof customerReadySchema>;

/**
 * §9.1.6's "wave transitions reflect the actual engine state (no fake
 * progress)".
 *
 * TowGo's search screen used to run a `setTimeout` ladder that invented a driver
 * after 6.5 seconds; Phase 15 deleted it and left the screen honestly saying
 * "searching" forever. This is what replaces it — every field is read from the
 * engine at the moment it advances a wave, and the same numbers are available on
 * `GET /bookings/:id` for §19.2's polling fallback, so the two channels cannot
 * tell the customer different stories.
 */
export const searchProgressSchema = z.object({
  bookingId: z.uuid(),
  /** 1-based rung of the §6.4 ladder. */
  wave: z.number().int().positive(),
  radiusKm: z.number().positive(),
  /**
   * Drivers offered this booking SO FAR, cumulative across waves — not the
   * current wave's count. The customer is being reassured that effort is being
   * expended, and a number that reset to 3 on every wave would read as progress
   * going backwards.
   */
  driversContacted: z.number().int().nonnegative(),
  /**
   * When the search gives up (§6.4's ~180 s). Sent so the client can show a
   * finite wait rather than an unbounded spinner, and so a reconnecting client
   * knows how much of it is left.
   */
  deadlineAt: z.iso.datetime(),
  at: z.iso.datetime(),
});
export type SearchProgressEvent = z.infer<typeof searchProgressSchema>;

/**
 * §5.1 status changes for this booking.
 *
 * Shares its name with the fleet console's `booking:status` and deliberately
 * NOT its shape — that one carries `fleetId` for tenant routing, which is
 * meaningless here and is not the customer's business. Same event name because
 * it is the same fact.
 */
export const customerBookingStatusSchema = z.object({
  bookingId: z.uuid(),
  status: jobStatusSchema,
  at: z.iso.datetime(),
});
export type CustomerBookingStatusEvent = z.infer<typeof customerBookingStatusSchema>;
