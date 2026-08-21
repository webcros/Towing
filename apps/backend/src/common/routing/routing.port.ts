import type { GeoPoint } from '@towing/api-contracts';

/**
 * Road distance and driving time between two points (Phase 14).
 *
 * Nothing in the repo computed road distance before this. `distanceMetersSql()`
 * in `db/geography.ts` does the PostGIS side (great-circle, in the database) and
 * had zero callers; the only mention of Haversine anywhere was
 * `simulate-locations.ts` declining to bother with the trig.
 *
 * Same shape as every other port here: a `Symbol` token, an interface, adapters
 * beside it, one binding in the module. `PayoutProviderPort` says it out loud.
 *
 * TWO CONSUMERS, DIFFERENT URGENCY. §7 needs distance to pick a fare slab, and
 * that call sits inside §7.6's 2-second estimate guarantee. §11.5 will need
 * routes and live ETAs in Phase 18 and can be slower. This port serves the
 * first; the polyline half stays out until something needs to draw one.
 */
export interface RouteDistance {
  /** Road distance in metres — or great-circle × road factor on the fallback. */
  distanceMeters: number;
  /** Driving seconds, or `null` when only straight-line distance was available. */
  durationSeconds: number | null;
  /**
   * Which path produced this. Carried all the way to the customer's estimate
   * response so a degraded number can be labelled rather than passed off as a
   * routed one — the §19.2 ladder is only honest if it is visible.
   */
  source: RouteSource;
}

export type RouteSource = 'google_distance_matrix' | 'haversine';

export interface RoutingPort {
  roadDistance(from: GeoPoint, to: GeoPoint): Promise<RouteDistance>;
}

export const ROUTING = Symbol('ROUTING');
