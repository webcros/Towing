import { describe, expect, it } from 'vitest';
import { COARSEN_METERS, coarsen, coarsenAll } from './coarsen';

/**
 * §11.9's coarsening, on its own.
 *
 * Unit-tested rather than left to the e2e suite because the properties that
 * matter are mathematical — idempotence, band consistency, bounded error — and
 * each of them is a one-line assertion here and an awkward fixture over HTTP.
 */

const METERS_PER_DEG_LAT = 111_320;

function metersApart(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  const dLng =
    (b.lng - a.lng) * METERS_PER_DEG_LAT * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

describe('coarsen', () => {
  it('is idempotent — snapping an already-snapped point changes nothing', () => {
    // The property that makes the snap stable across polls. If it were not
    // idempotent, a client caching a coarse point and re-sending it would drift.
    const once = coarsen({ lat: 12.97231, lng: 77.59487 });
    expect(coarsen(once)).toEqual(once);
  });

  it('moves a point by less than one cell diagonal', () => {
    const truth = { lat: 12.97231, lng: 77.59487 };
    const snapped = coarsen(truth);
    // Worst case is half a cell in each axis, i.e. ~71 m for a 100 m grid.
    expect(metersApart(truth, snapped)).toBeLessThan(COARSEN_METERS);
  });

  it('gives every point in a latitude band the SAME longitude grid', () => {
    // The bug this file exists to prevent. With the longitude step derived from
    // each point's own latitude, these three land on three cells that differ in
    // the sixth decimal — visually one marker, arithmetically three, and the
    // per-cell count leaks back the resolution the coarsening removed.
    const cluster = [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.97162, lng: 77.59462 },
      { lat: 12.97164, lng: 77.59464 },
    ];
    const snapped = cluster.map(coarsen);

    expect(new Set(snapped.map((p) => JSON.stringify(p))).size).toBe(1);
  });

  it('keeps the cell ~100 m wide as latitude changes', () => {
    // Meridians converge, so a fixed DEGREE step would be ~100 m at the equator
    // and ~50 m at 60°N — the guarantee would quietly weaken with latitude.
    for (const lat of [8.1, 12.97, 28.6, 34.1]) {
      const a = coarsen({ lat, lng: 77.0 });
      const b = coarsen({ lat, lng: 77.02 });
      const cells = Math.round(metersApart(a, b) / COARSEN_METERS);
      expect(Math.abs(metersApart(a, b) / cells - COARSEN_METERS)).toBeLessThan(2);
    }
  });

  it('is deterministic — the same input always gives the same output', () => {
    const point = { lat: 12.97231, lng: 77.59487 };
    const reads = Array.from({ length: 50 }, () => JSON.stringify(coarsen(point)));
    expect(new Set(reads).size).toBe(1);
  });

  it('survives the poles rather than producing NaN', () => {
    // Nothing is towed there. A division by zero producing Infinity and then NaN
    // coordinates would be a 500 on a malformed viewport, which is worse.
    for (const lat of [90, -90, 89.9999]) {
      const snapped = coarsen({ lat, lng: 12.3 });
      expect(Number.isFinite(snapped.lat)).toBe(true);
      expect(Number.isFinite(snapped.lng)).toBe(true);
    }
  });
});

describe('coarsenAll', () => {
  it('collapses a cluster to one marker', () => {
    const points = [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.97162, lng: 77.59462 },
      { lat: 12.97164, lng: 77.59464 },
    ];
    expect(coarsenAll(points)).toHaveLength(1);
  });

  it('keeps genuinely separate drivers separate', () => {
    // ~1 km apart: ten cells, and a customer must be able to see that supply is
    // spread rather than clustered.
    const points = [
      { lat: 12.9716, lng: 77.5946 },
      { lat: 12.9806, lng: 77.5946 },
    ];
    expect(coarsenAll(points)).toHaveLength(2);
  });

  it('returns an empty list unchanged', () => {
    expect(coarsenAll([])).toEqual([]);
  });
});
