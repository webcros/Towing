import { z } from 'zod';
import { geoPointSchema } from '../common/geo';

/**
 * §11.2/§11.3 driver presence and the location pipeline (Phase 16).
 *
 * THE INGRESS HAS TWO DOORS AND ONE SHAPE. `POST /v1/driver/location` and the
 * `/driver` socket's `location:update` carry the identical payload, because
 * they feed the identical pipeline — the socket is the fast path when one is
 * live, REST is what a background task uses in Doze, and a handset that
 * silently changed shape between them would be undebuggable.
 */

/**
 * One fix. `seq` is the ONLY thing that orders the stream.
 *
 * Not `at`: a handset's clock is user-settable and NTP-drifted, and two pings
 * a second apart routinely carry timestamps out of order over a bad cellular
 * link. `seq` is monotonic per driver per session, assigned by the app, and the
 * server discards anything at or below what it has already stored (§11.3
 * "late/out-of-order packets discarded server-side"). A late packet that
 * overwrites a newer one drags the marker backwards, which reads to a watching
 * customer as the driver reversing.
 */
export const driverLocationPingSchema = geoPointSchema.extend({
  /** Monotonic per driver. Resets only on go-online, which also resets the server's. */
  seq: z.number().int().nonnegative(),
  /** The handset's clock. Displayed and aged, never used for ordering. */
  at: z.iso.datetime(),
  /** Horizontal accuracy in metres. Absent when the OS did not report one. */
  accuracyM: z.number().nonnegative().max(100_000).optional(),
  /** Compass bearing, 0° = north — the convention `TruckPositionDto.heading` uses. */
  headingDeg: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).max(400).optional(),
});
export type DriverLocationPing = z.infer<typeof driverLocationPingSchema>;

/**
 * A BATCH, because the on-device buffer must flush IN ORDER on reconnect.
 *
 * N separate POSTs race each other over a recovering connection and arrive
 * shuffled — at which point the `seq` guard correctly discards most of the
 * backlog and the trip's breadcrumb trail has holes in it. One request, one
 * array, applied in array order, has neither problem.
 *
 * Capped at 120: two minutes of on-job cadence, which is longer than any
 * realistic tunnel, and small enough that a malicious client cannot turn one
 * request into a thousand Redis round trips.
 */
export const driverLocationBatchSchema = z.object({
  pings: z.array(driverLocationPingSchema).min(1).max(120),
});
export type DriverLocationBatch = z.infer<typeof driverLocationBatchSchema>;

export const driverLocationAcceptedSchema = z.object({
  accepted: z.number().int().nonnegative(),
  /** Pings at or below the stored `seq`. A non-zero count here is normal after a reconnect. */
  discarded: z.number().int().nonnegative(),
  /** The server's stored sequence after applying the batch — the app resumes above it. */
  seq: z.number().int().nonnegative(),
});
export type DriverLocationAccepted = z.infer<typeof driverLocationAcceptedSchema>;

/**
 * Going online REQUIRES a current fix.
 *
 * §6.1 keys the candidate store by zone, and a zone is resolved by
 * point-in-polygon against `service_zones`. A driver with no coordinate has no
 * zone, and a driver with no zone is in no GEO set — i.e. online in the UI and
 * invisible to dispatch, which is the worst of both. Demanding the fix up front
 * turns that into an honest error at the toggle.
 */
export const driverGoOnlineSchema = z.object({
  at: geoPointSchema,
  accuracyM: z.number().nonnegative().max(100_000).optional(),
});
export type DriverGoOnline = z.infer<typeof driverGoOnlineSchema>;

export const driverPresenceResponseSchema = z.object({
  isOnline: z.boolean(),
  /** Null when offline, or when the fix fell outside every active zone. */
  zoneId: z.uuid().nullable(),
  zoneName: z.string().nullable(),
  /** The same values `config:update` pushes, so a REST-only client is never stranded. */
  pingIntervalMs: z.number().int().positive().nullable(),
  staleAfterMs: z.number().int().positive(),
  lowAccuracyMeters: z.number().int().positive(),
  /** Where the driver's sequence must resume — see `driverLocationPingSchema.seq`. */
  seq: z.number().int().nonnegative(),
});
export type DriverPresenceResponse = z.infer<typeof driverPresenceResponseSchema>;
