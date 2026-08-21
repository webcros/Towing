import { z } from 'zod';

/**
 * A bounded WGS-84 point.
 *
 * `fleet/trucks.ts` already exports a `latLngSchema`, but it is
 * `z.object({ lat: z.number(), lng: z.number() })` with no range — fine for
 * echoing a position the server itself wrote, wrong for a coordinate a client
 * sends. Phase 14 point-in-polygons the customer's pickup against
 * `service_zones`, so an out-of-range value must be a 422 at the edge rather
 * than a PostGIS error from inside `ST_MakePoint`.
 */
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;
