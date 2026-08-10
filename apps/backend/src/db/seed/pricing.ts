/**
 * §7 fare engine (demo slabs) + the deterministic RNG the seeder and the
 * location simulator share.
 *
 * Phase 7 promoted the parts that are not seed-specific — the §3.3 bands, the
 * commission formula and the §14.3 split — into
 * `@towing/api-contracts`'s `common/pricing`, so the seed and the live
 * `LedgerService` are provably the same arithmetic rather than two
 * implementations that happen to agree. They are re-exported here so this
 * module's callers (and `pricing.spec.ts`, which is the regression net for the
 * promotion) are unchanged.
 *
 * What stays: `baseFarePaise`'s slabs are demo pricing, not the
 * admin-configurable `pricing_rules` §17 will eventually own, and `createRng`
 * is a fixture concern.
 *
 * All arithmetic here is integer paise; conversion to the NUMERIC(12,2) rupee
 * strings the schema stores happens only at `toRupees` — floats never touch money.
 */
import { paiseToRupeeString } from '@towing/api-contracts';

export {
  BAND_PCT,
  commissionPaise,
  resolveBand,
  splitPool,
  splitPoolN,
  type Band,
} from '@towing/api-contracts';

export type ServiceType = 'tow' | 'battery' | 'flat_tyre' | 'fuel' | 'breakdown' | 'accident_recovery';
export type VehicleClass = 'wheel_lift' | 'flatbed';

/**
 * Was `(paise / 100).toFixed(2)`. Now the shared string-space converter, so the
 * NUMERIC strings the seed writes and the ones the API writes come out of one
 * function. Round-trips with `rupeeStringToPaise`.
 */
export const toRupees = paiseToRupeeString;

/** §7.1 / §7.2 base slabs: [maxKm, pricePaise], ascending. */
const WHEEL_LIFT_SLABS: ReadonlyArray<readonly [number, number]> = [
  [5, 99_900],
  [10, 149_900],
  [20, 219_900],
  [40, 349_900],
  [60, 499_900],
  [80, 649_900],
  [100, 799_900],
];

const FLATBED_SLABS: ReadonlyArray<readonly [number, number]> = [
  [5, 199_900],
  [10, 299_900],
  [20, 449_900],
  [40, 649_900],
  [60, 849_900],
  [80, 1_099_900],
  [100, 1_349_900],
];

/** §7.3 long-distance quote ranges: [maxKm, minPaise, maxPaise]. */
const LONG_DISTANCE_RANGES: ReadonlyArray<readonly [number, number, number]> = [
  [150, 1_600_000, 2_000_000],
  [250, 2_200_000, 3_000_000],
  [400, 3_500_000, 4_800_000],
  [600, 5_500_000, 7_500_000],
];

/** Flat roadside fares (spec Appendix B tier). */
const ROADSIDE_FARE: Partial<Record<ServiceType, number>> = {
  battery: 79_900,
  flat_tyre: 69_900,
  fuel: 69_900,
  breakdown: 99_900,
};

export function baseFarePaise(
  service: ServiceType,
  vehicleClass: VehicleClass,
  distanceKm: number,
  rng: () => number,
): number {
  const roadside = ROADSIDE_FARE[service];
  if (roadside !== undefined) return roadside;

  if (distanceKm > 100) {
    const range =
      LONG_DISTANCE_RANGES.find(([maxKm]) => distanceKm <= maxKm) ??
      LONG_DISTANCE_RANGES[LONG_DISTANCE_RANGES.length - 1]!;
    const [, min, max] = range;
    // Round to whole rupees — long-distance quotes are human-negotiated numbers.
    return Math.round((min + rng() * (max - min)) / 100) * 100;
  }

  const slabs = vehicleClass === 'flatbed' ? FLATBED_SLABS : WHEEL_LIFT_SLABS;
  const slab = slabs.find(([maxKm]) => distanceKm <= maxKm) ?? slabs[slabs.length - 1]!;
  return slab[1];
}

/**
 * mulberry32 — same generator as the location simulator so a seed value means
 * the same thing in both tools.
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() on empty array');
  return items[Math.floor(rng() * items.length)]!;
}

export function weighted<T>(rng: () => number, entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}
