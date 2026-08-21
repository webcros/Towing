import type { GeoPoint, PlaceSource } from '@towing/api-contracts';

/**
 * Turning text into a place, and a place into a coordinate (§9.1.5, Phase 16).
 *
 * SIBLING OF `RoutingPort`, NOT PART OF IT. Both are "Google Maps Platform"
 * from a billing point of view and nothing else: routing answers "how far", is
 * called once per fare estimate inside §7.6's 2-second budget, and degrades to
 * arithmetic. This answers "where", is called on nearly every keystroke, and
 * degrades to a gazetteer. They have different call rates, different caches and
 * different fallbacks, so they get different ports — `routing.port.ts` makes
 * the same argument in the other direction ("the polyline half stays out until
 * something needs to draw one").
 *
 * THREE VERBS, ONE PLACE ID SPACE. `autocomplete` returns opaque ids,
 * `details` resolves one to a coordinate, and `reverse` goes the other way for
 * the map pin. The ids are adapter-scoped — a `local:` id means nothing to
 * Google and vice versa — which is exactly why `PlaceSource` travels with every
 * response instead of being inferred by the caller.
 */

export interface PlacePredictionResult {
  placeId: string;
  primary: string;
  secondary: string;
}

export interface PlaceDetailResult {
  placeId: string;
  label: string;
  address: string;
  point: GeoPoint;
}

export interface GeocodingPort {
  /** Which rung answered — carried into the response so a degraded answer is labelled. */
  readonly source: PlaceSource;

  /**
   * Suggestions for a partial query. `near` is a BIAS, not a filter: results
   * near the customer beat alphabetically similar ones 2,000 km away, but a
   * query with no bias must still return something.
   */
  autocomplete(query: string, near?: GeoPoint): Promise<PlacePredictionResult[]>;

  /** Resolves one prediction to a coordinate. `null` for an id this adapter does not own. */
  details(placeId: string): Promise<PlaceDetailResult | null>;

  /**
   * Coordinate → address, for the draggable map pin. Never returns null: a pin
   * always lands somewhere, and the honest answer for open country is the
   * coordinate itself rather than an error the UI has to invent copy for.
   */
  reverse(point: GeoPoint): Promise<PlaceDetailResult>;
}

/**
 * What the ROUTER exposes, and what consumers inject.
 *
 * Deliberately a different shape from `GeocodingPort`: every method tags its
 * answer with the rung that produced it. An adapter cannot report this — it only
 * ever knows its own `source` — and the router cannot report it through the
 * plain port without smuggling state onto the instance, which would be wrong the
 * moment two requests degrade differently.
 *
 * It matters more here than for routing's `RouteDistance.source`. Place ids are
 * ADAPTER-SCOPED: a `local:` id means nothing to Google and vice versa, so a
 * client that cached predictions from one rung and calls `details` after the
 * ladder moved has to be able to tell what it is holding.
 */
export interface SourcedGeocoding {
  autocomplete(
    query: string,
    near?: GeoPoint,
  ): Promise<{ results: PlacePredictionResult[]; source: PlaceSource }>;
  details(placeId: string): Promise<{ result: PlaceDetailResult | null; source: PlaceSource }>;
  reverse(point: GeoPoint): Promise<{ result: PlaceDetailResult; source: PlaceSource }>;
}

/** Bound to `GeocodingRouterAdapter`, never to a concrete adapter. */
export const GEOCODING = Symbol('GEOCODING');
