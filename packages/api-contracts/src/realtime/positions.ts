import { z } from 'zod';
import { latLngSchema, truckStatusSchema } from '../fleet/trucks';

/**
 * `GET /v1/fleet/realtime/positions` — the REST snapshot the console resyncs
 * from on every (re)connect (§18: never trust socket completeness), and the
 * source it polls every 10s when the socket is unavailable (§19.2).
 *
 * This is not `GET /fleet/trucks`: that reads `fleet_trucks.current_location`,
 * which the ping path only flushes every ~10s by design. This endpoint reads the
 * hot Redis position and falls back to PostGIS.
 */
export const fleetPositionSchema = z.object({
  truckId: z.uuid(),
  plate: z.string(),
  status: truckStatusSchema,
  driverName: z.string().nullable(),
  /** Null when the truck has never pinged and has no persisted position. */
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  heading: z.number().nullable(),
  speedKph: z.number().nullable(),
  /** Feeds `presenceFor`. Null renders as offline. */
  at: z.iso.datetime().nullable(),
  /** Non-null when the truck's driver is on an active booking — the "on job" marker colour. */
  activeBookingId: z.uuid().nullable(),
  /**
   * Pickup and drop for the active job, so the map can draw the leg.
   *
   * This is a STRAIGHT LINE between two points, not a routed polyline: §11.4's
   * road-following polyline needs the Directions API, which arrives with Track B
   * (Phases 15–16). Drawn dashed and labelled as such — an approximate leg is
   * useful context, a fake route that "drives through buildings" is not.
   */
  activeJobLeg: z
    .object({
      pickup: latLngSchema,
      /** Null for services with no destination (jumpstart, fuel, tyre). */
      drop: latLngSchema.nullable(),
    })
    .nullable(),
  /** True when this row came from PostGIS rather than the hot Redis key. */
  fromFallback: z.boolean(),
});
export type FleetPositionDto = z.infer<typeof fleetPositionSchema>;

/**
 * A service zone as GeoJSON. The vendorless default basemap draws these so the
 * map shows the fleet's operating area instead of an empty rectangle, and they
 * back the §9.3.3 zone filter.
 */
export const fleetZoneSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** GeoJSON Polygon/MultiPolygon geometry, straight from ST_AsGeoJSON. */
  geometry: z.unknown(),
});
export type FleetZoneDto = z.infer<typeof fleetZoneSchema>;

export const positionsSnapshotSchema = z.object({
  positions: z.array(fleetPositionSchema),
  zones: z.array(fleetZoneSchema),
  at: z.iso.datetime(),
  /**
   * §19.2: Redis was unreachable and every position came from PostGIS. The
   * console shows a degraded chip rather than an error — slower but correct.
   */
  degraded: z.boolean(),
});
export type PositionsSnapshotDto = z.infer<typeof positionsSnapshotSchema>;
