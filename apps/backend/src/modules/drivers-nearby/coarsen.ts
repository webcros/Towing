import type { GeoPoint } from '@towing/api-contracts';

/**
 * §11.9's position coarsening for `GET /v1/drivers/nearby`.
 *
 * SNAPPING, NOT JITTER — this is the whole file, and it is the one decision here
 * worth defending.
 *
 * Jitter (add a random offset of up to ~100 m) looks equivalent and is
 * catastrophically weaker: the offset is re-rolled per request, so a client
 * polling every few seconds collects N independent samples of the same true
 * point and averages them. The error of that mean shrinks as 1/√N — roughly 100
 * m at one sample, ~10 m at a hundred, which a home screen left open reaches in
 * a couple of minutes. The privacy property evaporates exactly for the customer
 * patient enough to want it broken.
 *
 * A grid snap has no such decay. Every request returns the same cell for the
 * same input, so repeated reads add no information at all, and the true position
 * is unrecoverable no matter how long anyone watches. The cost is that a driver
 * crossing a cell boundary appears to hop ~100 m — which is honest, because the
 * response also states `coarsenedToMeters` and the client draws a marker sized
 * to that uncertainty rather than a precise dot.
 *
 * The grid is anchored at (0, 0) rather than at the viewport, deliberately: a
 * viewport-relative grid would move with the customer's pan, which reintroduces
 * exactly the resampling attack the snap exists to prevent.
 *
 * IT IS A GRID, NOT A PER-POINT ROUNDING. The longitude step depends on
 * latitude, so it is derived from the SNAPPED latitude band rather than from
 * each point's own exact latitude. Deriving it per point looks equivalent and is
 * not: two drivers four metres apart have slightly different latitudes, so they
 * would get slightly different longitude steps and land on two cells that differ
 * in the sixth decimal — visually one marker, arithmetically two, and the
 * per-cell count leaks back exactly the resolution the coarsening removed. The
 * band makes every point at a given latitude share one grid.
 */

/** ~100 m, the figure §11.9 names. */
export const COARSEN_METERS = 100;

/** One degree of latitude, everywhere. Longitude is not this simple — see below. */
const METERS_PER_DEG_LAT = 111_320;

/**
 * Snaps a point onto a ~100 m grid.
 *
 * THE LONGITUDE STEP IS LATITUDE-DEPENDENT. Meridians converge towards the
 * poles, so a fixed degree step would be ~100 m at the equator and ~50 m at 60°N
 * — i.e. the guarantee would quietly weaken the further from the equator a
 * driver is. Dividing by `cos(lat)` keeps the cell ~100 m wide in metres
 * wherever it is. India sits at 8–37°N, so the correction is between 1% and 25%:
 * small enough to be tempting to skip, large enough to matter to the claim.
 *
 * `cos` is clamped away from zero for the poles. Nothing is towed there, but a
 * division by zero producing `Infinity` and then `NaN` coordinates is a worse
 * failure than a wide cell.
 */
export function coarsen(point: GeoPoint): GeoPoint {
  const latStep = COARSEN_METERS / METERS_PER_DEG_LAT;
  const snappedLat = Math.round(point.lat / latStep) * latStep;

  // `snappedLat`, NOT `point.lat` — see the header. The step has to be a
  // property of the BAND, or the grid stops being a grid.
  const cosLat = Math.max(Math.cos((snappedLat * Math.PI) / 180), 0.01);
  const lngStep = COARSEN_METERS / (METERS_PER_DEG_LAT * cosLat);

  return {
    // Rounded to 6 decimals so the value is a clean number on the wire rather
    // than a float artefact that leaks the step size in its last digits.
    lat: round6(snappedLat),
    lng: round6(Math.round(point.lng / lngStep) * lngStep),
  };
}

/**
 * Snaps a list and DEDUPES it.
 *
 * Two drivers in the same cell must not render as two markers at identical
 * coordinates — that is visually a single marker anyway, and emitting both would
 * let a client count supply per cell, which is finer-grained information than
 * the coarsening is supposed to leave.
 *
 * The honest total still reaches the customer: `count` in the response is taken
 * BEFORE this runs.
 */
export function coarsenAll(points: GeoPoint[]): GeoPoint[] {
  const seen = new Map<string, GeoPoint>();
  for (const point of points) {
    const snapped = coarsen(point);
    seen.set(`${snapped.lat},${snapped.lng}`, snapped);
  }
  return [...seen.values()];
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}
