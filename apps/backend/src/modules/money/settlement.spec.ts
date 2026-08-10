import { describe, expect, it } from 'vitest';
import { splitPoolN } from '@towing/api-contracts';
import { createRng } from '../../db/seed/pricing';
import { computeSettlement } from './settlement';

/**
 * The §7.5 worked examples are the acceptance vectors for this whole phase:
 * if the ledger disagrees with them, the money is wrong in a way no
 * integration test would catch.
 */
describe('computeSettlement — §7.5 worked vectors', () => {
  it('fleet driver, flatbed 12 km, 80/20, Band A: ₹4,499 → ₹449.90 / ₹3,239.28 / ₹809.82', () => {
    const s = computeSettlement({ totalPaise: 449_900, band: 'A', driverSharePct: 80 });

    expect(s.commissionPaise).toBe(44_990); // ₹449.90
    expect(s.poolPaise).toBe(404_910); // ₹4,049.10
    expect(s.driverSharePaise).toBe(323_928); // ₹3,239.28
    expect(s.fleetSharePaise).toBe(80_982); // ₹809.82

    // The property the whole §14 ledger rests on.
    expect(s.driverSharePaise + s.fleetSharePaise).toBe(s.poolPaise);
    expect(s.commissionPaise + s.poolPaise).toBe(s.grossPaise);

    expect(s.legs).toEqual([
      { owner: 'driver', type: 'driver_share_credit', amountPaise: 323_928 },
      { owner: 'fleet', type: 'fleet_share_credit', amountPaise: 80_982 },
    ]);
  });

  it('wheel-lift 8 km daytime, Band A: ₹1,499 → platform ₹149.90, driver ₹1,349.10', () => {
    const s = computeSettlement({ totalPaise: 149_900, band: 'A', driverSharePct: null });
    expect(s.commissionPaise).toBe(14_990);
    expect(s.driverSharePaise).toBe(134_910);
    expect(s.fleetSharePaise).toBe(0);
    expect(s.legs).toEqual([{ owner: 'driver', type: 'fare_credit', amountPaise: 134_910 }]);
  });

  it('flatbed 15 km night, Band A: ₹5,173.85 → platform ₹517.39, driver ₹4,656.46', () => {
    const s = computeSettlement({ totalPaise: 517_385, band: 'A', driverSharePct: null });
    expect(s.commissionPaise).toBe(51_739); // 51_738.5 rounds half-up
    expect(s.driverSharePaise).toBe(465_646);
  });

  it('accident recovery 25 km with surge, Band B: ₹5,998.80 → platform ₹479.90, driver ₹5,518.90', () => {
    const s = computeSettlement({ totalPaise: 599_880, band: 'B', driverSharePct: null });
    expect(s.commissionPaise).toBe(47_990); // 47_990.4 → 47_990
    expect(s.driverSharePaise).toBe(551_890);
  });

  it('long-distance flatbed 300 km at ₹40,000, Band C: platform ₹2,000, pool ₹38,000', () => {
    const s = computeSettlement({ totalPaise: 4_000_000, band: 'C', driverSharePct: null });
    expect(s.commissionPaise).toBe(200_000);
    expect(s.poolPaise).toBe(3_800_000);
  });
});

describe('computeSettlement — edge cases', () => {
  it('drops a zero leg rather than writing one the CHECK constraint would reject', () => {
    const allDriver = computeSettlement({ totalPaise: 100_000, band: 'A', driverSharePct: 100 });
    expect(allDriver.fleetSharePaise).toBe(0);
    expect(allDriver.legs.map((l) => l.type)).toEqual(['driver_share_credit']);

    const allFleet = computeSettlement({ totalPaise: 100_000, band: 'A', driverSharePct: 0 });
    expect(allFleet.driverSharePaise).toBe(0);
    expect(allFleet.legs.map((l) => l.type)).toEqual(['fleet_share_credit']);
  });

  it('a zero-total booking produces no legs at all', () => {
    expect(computeSettlement({ totalPaise: 0, band: 'A', driverSharePct: 80 }).legs).toEqual([]);
  });

  it('rejects a negative or non-integer total before any money is written', () => {
    expect(() => computeSettlement({ totalPaise: -1, band: 'A', driverSharePct: 80 })).toThrow();
    expect(() => computeSettlement({ totalPaise: 10.5, band: 'A', driverSharePct: 80 })).toThrow();
  });

  it('rejects an out-of-range driver share', () => {
    expect(() => computeSettlement({ totalPaise: 100, band: 'A', driverSharePct: 101 })).toThrow();
    expect(() => computeSettlement({ totalPaise: 100, band: 'A', driverSharePct: -1 })).toThrow();
  });

  it('legs always reconstruct the pool for arbitrary totals and shares', () => {
    const rng = createRng(1_607);
    for (let i = 0; i < 3_000; i += 1) {
      const total = Math.floor(rng() * 10_000_000);
      const band = (['A', 'B', 'C'] as const)[i % 3]!;
      const pct = i % 7 === 0 ? null : Math.floor(rng() * 101);
      const s = computeSettlement({ totalPaise: total, band, driverSharePct: pct });

      expect(s.commissionPaise + s.poolPaise).toBe(total);
      expect(s.driverSharePaise + s.fleetSharePaise).toBe(s.poolPaise);
      expect(s.legs.reduce((sum, l) => sum + l.amountPaise, 0)).toBe(s.poolPaise);
      expect(s.legs.every((l) => l.amountPaise > 0)).toBe(true);
    }
  });
});

describe('splitPoolN — N-way largest remainder', () => {
  it('matches splitPool for the two-way §7.5 case', () => {
    // splitPoolN orders legs by the weights given; [driver, fleet] here.
    expect(splitPoolN(404_910, [80, 20])).toEqual([323_928, 80_982]);
  });

  it('splits a three-way platform/fleet/driver pool exactly (Phase 19 shape)', () => {
    const legs = splitPoolN(100_000, [70, 20, 10]);
    expect(legs.reduce((a, b) => a + b, 0)).toBe(100_000);
  });

  it('distributes an indivisible remainder deterministically by largest remainder', () => {
    // 10 / 3 = 3.33 each; the two largest remainders tie, so the lower indices win.
    expect(splitPoolN(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });

  it('legs sum exactly for random weight vectors, including zero weights', () => {
    const rng = createRng(99);
    for (let i = 0; i < 3_000; i += 1) {
      const total = Math.floor(rng() * 5_000_000);
      const n = 1 + Math.floor(rng() * 5);
      const weights: number[] = Array.from({ length: n }, () => Math.floor(rng() * 100));
      if (weights.reduce((a, b) => a + b, 0) === 0) weights[0] = 1;

      const legs = splitPoolN(total, weights);
      expect(legs).toHaveLength(n);
      expect(legs.reduce((a, b) => a + b, 0)).toBe(total);
      // A zero weight can never be allocated a share.
      weights.forEach((w, idx) => {
        if (w === 0) expect(legs[idx]).toBe(0);
      });
    }
  });

  it('rejects empty, negative and all-zero weights', () => {
    expect(() => splitPoolN(100, [])).toThrow();
    expect(() => splitPoolN(100, [1, -1])).toThrow();
    expect(() => splitPoolN(100, [0, 0])).toThrow();
  });
});
