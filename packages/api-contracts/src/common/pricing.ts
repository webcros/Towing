/**
 * §3.3 commission bands + §14.3 split math, in integer paise.
 *
 * Lives in api-contracts, not the backend, for three reasons:
 *  1. this package is already the shared money vocabulary (`paiseSchema`,
 *     `rupeeStringToPaise`, `paiseToRupeeString`) and already ships non-schema
 *     functions, so this is not a precedent change;
 *  2. `commissionPaise` is genuinely part of the contract — the split DTO
 *     carries `commissionPaise` and a client must be able to verify it;
 *  3. the seed (`apps/backend/src/db/seed/pricing.ts`) and the live settlement
 *     path must be provably the same function, not two implementations that
 *     agree today.
 *
 * §7's only rounding rule: "All computation in paise precision; commission
 * rounded half-up to the paisa; driver net = total − commission (so the two
 * always sum exactly)." Every function here is integer-in / integer-out.
 */

export type Band = 'A' | 'B' | 'C';

/** §3.3 launch percentages. The DB guardrail (`ck_bookings_commission_pct_guardrail`) is 5–10. */
export const BAND_PCT: Record<Band, number> = { A: 10, B: 8, C: 5 };

export type PricingServiceType =
  | 'tow'
  | 'battery'
  | 'flat_tyre'
  | 'fuel'
  | 'breakdown'
  | 'accident_recovery';

/** §3.3: service type + billed distance decide the band; accident is always ≥ B. */
export function resolveBand(service: PricingServiceType, distanceKm: number): Band {
  if (distanceKm > 100) return 'C';
  if (service === 'accident_recovery') return 'B';
  if (distanceKm > 40) return 'B';
  return 'A';
}

/** §7: `PlatformEarning = Total × commission%`, rounded half-up to the paisa. */
export function commissionPaise(totalPaise: number, band: Band): number {
  return Math.round((totalPaise * BAND_PCT[band]) / 100);
}

/**
 * §14.3 two-way split of the driver pool. Largest-remainder style: the fleet
 * leg is rounded and the driver leg is the exact remainder, so the two always
 * sum to the pool to the paisa.
 *
 * §7.5's worked vector: pool 404_910 at 80/20 → fleet 80_982 (₹809.82),
 * driver 323_928 (₹3,239.28).
 *
 * The rounding order is load-bearing — it is the shape 755 seeded ledger rows
 * were written with, and `verifySeedInvariants`' third invariant asserts the
 * legs sum back to `bookings.driver_payout`. Do not "simplify" it to rounding
 * the driver leg instead.
 */
export function splitPool(
  poolPaise: number,
  driverSharePct: number,
): { driverPaise: number; fleetPaise: number } {
  const fleetPaise = Math.round((poolPaise * (100 - driverSharePct)) / 100);
  return { driverPaise: poolPaise - fleetPaise, fleetPaise };
}

/**
 * N-way largest-remainder allocation. The legs always sum to `totalPaise`
 * exactly, whatever the weights — which is the property `splitPool` gives for
 * N=2 and Track B Phase 19 needs for a three-way platform/fleet/driver split.
 *
 * Integer arithmetic throughout: the comparison key is the exact numerator
 * remainder (`total × weight mod sum`), never a float fraction, so ties break
 * deterministically on the lower index rather than on floating-point noise.
 */
export function splitPoolN(totalPaise: number, weights: readonly number[]): number[] {
  if (weights.length === 0) {
    throw new Error('splitPoolN needs at least one weight');
  }
  if (!Number.isSafeInteger(totalPaise)) {
    throw new Error(`splitPoolN needs integer paise, got ${totalPaise}`);
  }

  let weightSum = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`splitPoolN weights must be non-negative and finite, got ${w}`);
    }
    weightSum += w;
  }
  if (weightSum <= 0) {
    throw new Error('splitPoolN weights must sum to a positive number');
  }

  const legs: number[] = [];
  const remainders: number[] = [];
  for (const w of weights) {
    const numerator = totalPaise * w;
    if (!Number.isSafeInteger(numerator)) {
      throw new Error('splitPoolN overflowed safe-integer range');
    }
    const floor = Math.floor(numerator / weightSum);
    legs.push(floor);
    remainders.push(numerator - floor * weightSum);
  }

  let unallocated = totalPaise - legs.reduce((sum, leg) => sum + leg, 0);
  const byRemainder = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; unallocated > 0; i += 1, unallocated -= 1) {
    const target = byRemainder[i % byRemainder.length]!.index;
    legs[target] = legs[target]! + 1;
  }

  return legs;
}
