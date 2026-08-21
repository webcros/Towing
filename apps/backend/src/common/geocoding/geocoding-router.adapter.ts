import { Inject, Injectable, Logger } from '@nestjs/common';
import type { GeoPoint, PlaceSource } from '@towing/api-contracts';
import { ENV, type Env } from '../../config/env';
import { MetricsService } from '../observability/metrics.service';
import type { PlaceDetailResult, PlacePredictionResult, SourcedGeocoding } from './geocoding.port';
import { GooglePlacesAdapter } from './google-places.adapter';
import { LocalGazetteerAdapter } from './local-gazetteer.adapter';

/**
 * §19.2's degradation ladder for address search, written in the same commit as
 * the primary it degrades from — "a ladder that has never executed is not a
 * ladder", the guiding decision `RoutingRouterAdapter` already states.
 *
 * WHY THE FALLBACK IS HERE AND NOT IN THE CALLER, verbatim from routing's
 * reasoning: `PlacesService` should ask for suggestions and get some. If every
 * caller had to catch `CircuitOpenError` and remember to degrade, the second
 * caller would eventually forget, and the failure mode is a 500 on an address
 * box during exactly the outage the ladder exists for.
 *
 * IT REPORTS WHICH RUNG ANSWERED, and that is not cosmetic here the way it
 * nearly is for a distance. A `local:` place id is meaningless to Google and a
 * Google id is meaningless to the gazetteer, so a client that cached predictions
 * from one rung and calls `details` after the ladder moved must be able to tell.
 * `source` travels on every response for that reason; `details()` below also
 * tries the other adapter rather than 404ing an id it simply does not own.
 *
 * `source` on the ROUTER is the configured primary, not the rung that answered
 * a particular call — per-call truth is on each response.
 */
@Injectable()
export class GeocodingRouterAdapter implements SourcedGeocoding {
  private readonly logger = new Logger(GeocodingRouterAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly google: GooglePlacesAdapter,
    private readonly local: LocalGazetteerAdapter,
    private readonly metrics: MetricsService,
  ) {}

  get source(): PlaceSource {
    return this.env.GEOCODING_PROVIDER === 'google_places' ? 'google_places' : 'local';
  }

  private get googleEnabled(): boolean {
    return this.env.GEOCODING_PROVIDER === 'google_places' && Boolean(this.env.GOOGLE_MAPS_API_KEY);
  }

  async autocomplete(
    query: string,
    near?: GeoPoint,
  ): Promise<{ results: PlacePredictionResult[]; source: PlaceSource }> {
    if (this.googleEnabled) {
      try {
        const results = await this.google.autocomplete(query, near);
        // An EMPTY result from a healthy Google is a real answer — "we have
        // never heard of that either" — and must not silently fall through to a
        // twenty-one-entry gazetteer that would answer differently. Degrading on
        // zero results would make the two rungs disagree about what exists.
        return { results, source: 'google_places' };
      } catch (error) {
        this.degraded('autocomplete', error);
      }
    }

    return { results: await this.local.autocomplete(query, near), source: 'local' };
  }

  /**
   * Tries the adapter that OWNS the id first, then the other.
   *
   * A client can legitimately hold a `local:` id from before a key was
   * configured, or a Google id from before an outage. Neither should become a
   * 404 the customer experiences as "that suggestion you just tapped does not
   * exist".
   */
  async details(placeId: string): Promise<{ result: PlaceDetailResult | null; source: PlaceSource }> {
    const localFirst = placeId.startsWith('local:');

    if (!localFirst && this.googleEnabled) {
      try {
        const result = await this.google.details(placeId);
        if (result) return { result, source: 'google_places' };
      } catch (error) {
        this.degraded('details', error);
      }
    }

    const local = await this.local.details(placeId);
    if (local) return { result: local, source: 'local' };

    // A `local:` id that the gazetteer does not know is not worth asking Google
    // about — the prefix is ours and Google would reject it — so this only
    // reaches Google for an unprefixed id the first branch skipped or failed on.
    if (localFirst || !this.googleEnabled) return { result: null, source: 'local' };

    try {
      return { result: await this.google.details(placeId), source: 'google_places' };
    } catch (error) {
      this.degraded('details', error);
      return { result: null, source: 'local' };
    }
  }

  async reverse(point: GeoPoint): Promise<{ result: PlaceDetailResult; source: PlaceSource }> {
    if (this.googleEnabled) {
      try {
        return { result: await this.google.reverse(point), source: 'google_places' };
      } catch (error) {
        this.degraded('reverse', error);
      }
    }

    return { result: await this.local.reverse(point), source: 'local' };
  }

  /**
   * Catches EVERYTHING, deliberately. A breaker-open error, a timeout, a
   * malformed vendor body and an unexpected TypeError are all the same fact from
   * the customer's side: Google could not be asked. `ExternalCallPolicy` has
   * already counted the failure and moved the breaker by the time we get here,
   * so swallowing loses no signal — the vendor's health lives in
   * `external_calls_total`, and the degradation is counted separately below.
   */
  private degraded(op: string, error: unknown): void {
    this.metrics.observeExternalCall('geocoding_fallback', 'error');
    this.logger.warn(
      `Places ${op} unavailable (${error instanceof Error ? error.name : 'unknown'}) — falling back to the local gazetteer`,
    );
  }
}
