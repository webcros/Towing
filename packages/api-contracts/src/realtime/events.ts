import { z } from 'zod';
import { dashboardKpisSchema } from '../fleet/dashboard';
import { jobStatusSchema } from '../fleet/jobs';

/**
 * Socket.io wire contracts (§16.6). Every payload is parsed with these on BOTH
 * ends: `JSON.parse` is `any`, and the wire is the one place where a shape
 * change is silent rather than a type error.
 */

/** Socket.io namespace the fleet console connects to. */
export const FLEET_NAMESPACE = '/fleet';

/**
 * The only room a fleet socket ever joins, derived solely from the verified
 * handshake claim. Nothing client-supplied reaches a room name — the WebSocket
 * analogue of `FleetScopeGuard`.
 */
export const fleetRoom = (fleetId: string): string => `fleet:${fleetId}`;

/** Server→client event names (§16.6). Client→server is deliberately empty. */
export const REALTIME_EVENT = {
  READY: 'realtime:ready',
  LOCATION_UPDATE: 'location:update',
  BOOKING_STATUS: 'booking:status',
  OPS_METRICS: 'ops:metrics',
} as const;
export type RealtimeEventName = (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT];

/**
 * One truck's last known position. Mirrors the ping payload the location
 * publisher puts on Redis, plus the fields the map needs but a ping does not
 * carry (`status`, `activeBookingId`) — those come from the snapshot and are
 * held by the client between pings.
 */
export const truckPositionSchema = z.object({
  truckId: z.uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Compass bearing, 0° = north, 90° = east. */
  heading: z.number().nullable(),
  speedKph: z.number().nullable(),
  /** Ping timestamp — the input to `presenceFor`, not the time we relayed it. */
  at: z.iso.datetime(),
});
export type TruckPositionDto = z.infer<typeof truckPositionSchema>;

/**
 * A batch, not a single position: the relay coalesces to <=1 frame per truck per
 * flush window so 200 trucks pinging at 1Hz cost one message per second, not 200.
 */
export const locationUpdateSchema = z.object({
  positions: z.array(truckPositionSchema),
  /** When the server flushed this batch — `at` minus this is the relay latency. */
  emittedAt: z.iso.datetime(),
});
export type LocationUpdateEvent = z.infer<typeof locationUpdateSchema>;

/** §16.6 `booking:status` — status + ts. The client refetches for anything more. */
export const bookingStatusEventSchema = z.object({
  bookingId: z.uuid(),
  status: jobStatusSchema,
  at: z.iso.datetime(),
});
export type BookingStatusEvent = z.infer<typeof bookingStatusEventSchema>;

/**
 * §16.6 `ops:metrics` — live KPI deltas. Carries the whole recomputed KPI object
 * rather than a "something changed" ping, because the console patches it with
 * `setQueryData`; a bare invalidation would refetch the same 15s-cached numbers
 * and appear to do nothing.
 */
export const opsMetricsEventSchema = z.object({
  kpis: dashboardKpisSchema,
  at: z.iso.datetime(),
});
export type OpsMetricsEvent = z.infer<typeof opsMetricsEventSchema>;

/** Sent once on connect so the client can distinguish "connected" from "subscribed". */
export const realtimeReadySchema = z.object({
  fleetId: z.uuid(),
  serverTime: z.iso.datetime(),
});
export type RealtimeReadyEvent = z.infer<typeof realtimeReadySchema>;
