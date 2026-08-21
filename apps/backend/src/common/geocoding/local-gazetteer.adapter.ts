import { Injectable } from '@nestjs/common';
import type { GeoPoint, PlaceSource } from '@towing/api-contracts';
import { haversineMeters } from '../../modules/pricing/pricing.math';
import { GAZETTEER, LOCAL_PLACE_PREFIX, type GazetteerEntry } from './gazetteer.data';
import type { GeocodingPort, PlaceDetailResult, PlacePredictionResult } from './geocoding.port';

/**
 * §19.2's "Places degraded → local gazetteer" — and, until a Maps key exists,
 * the LIVE DEFAULT.
 *
 * A PERMANENT PATH, NOT A STUB. `GEOCODING_PROVIDER` defaults to `local`, and
 * this stays reachable after a key arrives because the breaker falls back to it
 * every time Google is down. Same standing as `HaversineRoutingAdapter`,
 * `DevPayoutAdapter`, `DiskStorageAdapter` and the four log notification
 * channels: `pnpm backend` must keep working with no vendor account, forever.
 *
 * IT IS HONEST ABOUT BEING SMALL. Twenty-one localities across the two seeded
 * cities is not a geocoder, and the responses say `source: 'local'` so the app
 * can tell the customer that address search is limited rather than implying
 * their street simply does not exist. What it buys is real: the whole typed-
 * address flow — the debounce, the prediction list, the coordinate that reaches
 * the fare engine, the zone check — is exercised end to end today instead of
 * being written blind against a key that has not been bought.
 *
 * NO NETWORK, NO POLICY, NO BREAKER. There is nothing to time out, which is
 * also why it is the safe bottom of the ladder.
 */
@Injectable()
export class LocalGazetteerAdapter implements GeocodingPort {
  readonly source: PlaceSource = 'local';

  /**
   * Substring matching over name, area and aliases, ranked by how early the
   * match starts and then by distance from the bias point.
   *
   * NOT FUZZY. A trigram or Levenshtein ranker over twenty-one entries is
   * cheerful over-engineering: with this few places the failure mode that
   * matters is "the place is not in the list at all", which no amount of
   * cleverness fixes, and a typo-tolerant matcher would mostly succeed at
   * returning confidently wrong suburbs.
   */
  async autocomplete(query: string, near?: GeoPoint): Promise<PlacePredictionResult[]> {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];

    const scored = GAZETTEER.flatMap((entry) => {
      const position = matchPosition(entry, needle);
      if (position === null) return [];
      const distance = near ? haversineMeters(near, entry.point) : 0;
      return [{ entry, position, distance }];
    });

    scored.sort((a, b) => a.position - b.position || a.distance - b.distance);

    // Ten, matching what Google returns. A longer list on a phone is scrolled
    // past rather than read.
    return scored.slice(0, 10).map(({ entry }) => ({
      placeId: `${LOCAL_PLACE_PREFIX}${entry.id}`,
      primary: entry.name,
      secondary: entry.area,
    }));
  }

  /**
   * `null` for an id this adapter does not own — a Google place id surviving in
   * a client's state across a provider switch, most plausibly. Returning null
   * rather than throwing lets the router try the other rung.
   */
  async details(placeId: string): Promise<PlaceDetailResult | null> {
    if (!placeId.startsWith(LOCAL_PLACE_PREFIX)) return null;
    const id = placeId.slice(LOCAL_PLACE_PREFIX.length);
    const entry = GAZETTEER.find((candidate) => candidate.id === id);
    if (!entry) return null;
    return toDetail(entry);
  }

  /**
   * Nearest known locality, or the bare coordinate.
   *
   * The 3 km cut-off is the point of the method. Without it a pin dropped in
   * open country would be labelled with whichever of twenty-one localities
   * happened to be least far away — possibly 60 km off — and the customer would
   * confirm a pickup named after a place they are nowhere near. Past the
   * threshold the coordinate itself is the honest label.
   */
  async reverse(point: GeoPoint): Promise<PlaceDetailResult> {
    let nearest: { entry: GazetteerEntry; meters: number } | null = null;
    for (const entry of GAZETTEER) {
      const meters = haversineMeters(point, entry.point);
      if (nearest === null || meters < nearest.meters) nearest = { entry, meters };
    }

    if (nearest !== null && nearest.meters <= NEAREST_LABEL_METERS) {
      return {
        ...toDetail(nearest.entry),
        // The PIN's coordinate, never the gazetteer entry's. The customer
        // dragged to a specific point and the fare is measured from it; snapping
        // to a locality centroid would silently move the pickup by up to 3 km.
        point,
        placeId: `latlng:${point.lat},${point.lng}`,
      };
    }

    return {
      placeId: `latlng:${point.lat},${point.lng}`,
      label: formatCoordinate(point),
      address: formatCoordinate(point),
      point,
    };
  }
}

/** Beyond this a nearest-locality label is a guess, not an address. */
const NEAREST_LABEL_METERS = 3_000;

/** Where the needle starts, lowest wins; `null` for no match at all. */
function matchPosition(entry: GazetteerEntry, needle: string): number | null {
  const haystacks = [entry.name, entry.area, entry.city, ...(entry.aliases ?? [])];
  let best: number | null = null;
  for (const haystack of haystacks) {
    const at = haystack.toLowerCase().indexOf(needle);
    if (at === -1) continue;
    if (best === null || at < best) best = at;
  }
  return best;
}

function toDetail(entry: GazetteerEntry): PlaceDetailResult {
  return {
    placeId: `${LOCAL_PLACE_PREFIX}${entry.id}`,
    label: entry.name,
    address: `${entry.name}, ${entry.area}`,
    point: entry.point,
  };
}

/** Five decimals ≈ 1.1 m — precise enough to act on, short enough to read. */
function formatCoordinate(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
