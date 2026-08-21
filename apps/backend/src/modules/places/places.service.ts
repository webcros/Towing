import { Inject, Injectable } from '@nestjs/common';
import type {
  GeoPoint,
  PlaceAutocompleteResponse,
  PlaceDetail,
  PlaceSource,
} from '@towing/api-contracts';
import { CacheService } from '../../common/cache/cache.service';
import { ApiException } from '../../common/errors/api-exception';
import { GEOCODING, type PlaceDetailResult, type SourcedGeocoding } from '../../common/geocoding/geocoding.port';
import { ZoneResolverService } from '../pricing/zone-resolver.service';

/**
 * §9.1.5's address search, behind our own API rather than the handset's.
 *
 * A Places key shipped inside an app binary is extractable in minutes and is
 * billed per call, so the key stays server-side behind `ExternalCallPolicy` and
 * the app talks to us. The second benefit is the one that pays for itself: ONE
 * cache serves every customer, instead of each handset paying for its own
 * lookups of the same twenty streets in a city.
 *
 * EVERY RESPONSE CARRIES ITS ZONE. Resolving `service_zones` here rather than
 * leaving it to the estimate is what lets the app warn at SELECTION time — the
 * moment the customer taps a suggestion — instead of letting them build a whole
 * booking and take a 422 at the fare sheet (§6.10, §9.1.5's "pin moved outside
 * zone"). It costs one indexed point-in-polygon against a GIST index that has
 * existed since migration 0002.
 */

/**
 * Long enough to absorb a burst of keystrokes across a city, short enough that a
 * newly-opened business appears the same day. Autocomplete is the single most
 * expensive call in the product per unit of value, and a typed address is
 * overwhelmingly one of a few hundred popular places.
 */
const AUTOCOMPLETE_TTL_SECONDS = 900;
/** A resolved place's coordinate does not move. The cap is memory, not freshness. */
const DETAILS_TTL_SECONDS = 86_400;

@Injectable()
export class PlacesService {
  constructor(
    @Inject(GEOCODING) private readonly geocoding: SourcedGeocoding,
    private readonly zones: ZoneResolverService,
    private readonly cache: CacheService,
  ) {}

  async autocomplete(query: string, near?: GeoPoint): Promise<PlaceAutocompleteResponse> {
    // Keyed on the QUERY plus a coarse bias cell, not on the exact coordinate.
    // A per-metre key would make the cache useless — no two customers stand in
    // the same spot — while a ~1 km cell is finer than the bias radius anyway.
    const cell = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : 'none';
    const key = `places:ac:v1:${cell}:${query.toLowerCase()}`;

    return this.cache.getOrSet(key, AUTOCOMPLETE_TTL_SECONDS, async () => {
      const { results, source } = await this.geocoding.autocomplete(query, near);
      return { predictions: results, source };
    });
  }

  async details(placeId: string): Promise<PlaceDetail> {
    const cached = await this.cache.getOrSet(
      `places:detail:v1:${placeId}`,
      DETAILS_TTL_SECONDS,
      async () => {
        const { result, source } = await this.geocoding.details(placeId);
        return { result, source };
      },
    );

    if (!cached.result) throw ApiException.notFound('We could not resolve that place');
    // The ZONE is resolved outside the cache on purpose: an admin redrawing a
    // service area must take effect immediately, and a coordinate cached for a
    // day would otherwise carry a stale answer to "do we operate there" for a
    // day. The expensive half (the vendor call) is cached; the cheap indexed
    // half is not.
    return this.withZone(cached.result, cached.source);
  }

  /**
   * The draggable pin's label. NOT CACHED — every drag produces a different
   * coordinate, so a cache would only ever grow.
   */
  async reverse(point: GeoPoint): Promise<PlaceDetail> {
    const { result, source } = await this.geocoding.reverse(point);
    return this.withZone(result, source);
  }

  private async withZone(result: PlaceDetailResult, source: PlaceSource): Promise<PlaceDetail> {
    const zone = await this.zones.resolve(result.point);
    return {
      placeId: result.placeId,
      label: result.label,
      address: result.address,
      point: result.point,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      source,
    };
  }
}
