import { describe, expect, it } from 'vitest';
import {
  BAND_PCT,
  baseFarePaise,
  commissionPaise,
  createRng,
  resolveBand,
  splitPool,
  toRupees,
} from './pricing';

describe('resolveBand (§3.3)', () => {
  it('maps local distances to Band A', () => {
    expect(resolveBand('tow', 8)).toBe('A');
    expect(resolveBand('battery', 3)).toBe('A');
    expect(resolveBand('tow', 40)).toBe('A');
  });

  it('maps 40–100 km to Band B', () => {
    expect(resolveBand('tow', 40.1)).toBe('B');
    expect(resolveBand('tow', 100)).toBe('B');
  });

  it('maps >100 km to Band C', () => {
    expect(resolveBand('tow', 100.1)).toBe('C');
    expect(resolveBand('tow', 450)).toBe('C');
  });

  it('accident recovery is always at least Band B', () => {
    expect(resolveBand('accident_recovery', 5)).toBe('B');
    expect(resolveBand('accident_recovery', 80)).toBe('B');
    expect(resolveBand('accident_recovery', 150)).toBe('C');
  });
});

describe('commissionPaise', () => {
  it('applies the locked band percentages', () => {
    expect(commissionPaise(149_900, 'A')).toBe(14_990); // 10%
    expect(commissionPaise(500_000, 'B')).toBe(40_000); // 8%
    expect(commissionPaise(4_000_000, 'C')).toBe(200_000); // 5%
  });

  it('rounds half-up to the paisa (§7)', () => {
    // 10% of 1005 paise = 100.5 → 101
    expect(commissionPaise(1_005, 'A')).toBe(101);
    // 8% of 1006 = 80.48 → 80
    expect(commissionPaise(1_006, 'B')).toBe(80);
  });

  it('commission + pool always reconstruct the total exactly', () => {
    const rng = createRng(42);
    for (let i = 0; i < 2_000; i += 1) {
      const total = Math.floor(rng() * 10_000_000) + 1;
      const band = (['A', 'B', 'C'] as const)[i % 3]!;
      const commission = commissionPaise(total, band);
      expect(commission + (total - commission)).toBe(total);
      expect(commission).toBeGreaterThanOrEqual(0);
      expect(commission).toBeLessThan(total);
    }
  });
});

describe('splitPool (§14.3)', () => {
  it('splits 80/20 exactly on a round pool', () => {
    expect(splitPool(100_000, 80)).toEqual({ driverPaise: 80_000, fleetPaise: 20_000 });
  });

  it('legs always sum to the pool, to the paisa, for arbitrary pools and shares', () => {
    const rng = createRng(7);
    for (let i = 0; i < 5_000; i += 1) {
      const pool = Math.floor(rng() * 5_000_000) + 1;
      const driverPct = 50 + Math.floor(rng() * 51); // 50..100
      const { driverPaise, fleetPaise } = splitPool(pool, driverPct);
      expect(driverPaise + fleetPaise).toBe(pool);
      expect(fleetPaise).toBeGreaterThanOrEqual(0);
      expect(driverPaise).toBeGreaterThanOrEqual(0);
    }
  });

  it('a 100% driver share leaves the fleet leg at zero', () => {
    expect(splitPool(123_457, 100)).toEqual({ driverPaise: 123_457, fleetPaise: 0 });
  });
});

describe('baseFarePaise (§7 slabs)', () => {
  const rng = createRng(1);

  it('hits the wheel-lift slab boundaries', () => {
    expect(baseFarePaise('tow', 'wheel_lift', 5, rng)).toBe(99_900);
    expect(baseFarePaise('tow', 'wheel_lift', 5.1, rng)).toBe(149_900);
    expect(baseFarePaise('tow', 'wheel_lift', 100, rng)).toBe(799_900);
  });

  it('hits the flatbed slab boundaries', () => {
    expect(baseFarePaise('tow', 'flatbed', 5, rng)).toBe(199_900);
    expect(baseFarePaise('tow', 'flatbed', 40, rng)).toBe(649_900);
  });

  it('roadside services are flat fares regardless of class', () => {
    expect(baseFarePaise('battery', 'wheel_lift', 3, rng)).toBe(79_900);
    expect(baseFarePaise('battery', 'flatbed', 3, rng)).toBe(79_900);
    expect(baseFarePaise('breakdown', 'wheel_lift', 9, rng)).toBe(99_900);
  });

  it('long-distance quotes stay inside the §7.3 range and are whole rupees', () => {
    for (let i = 0; i < 200; i += 1) {
      const fare = baseFarePaise('tow', 'flatbed', 120, rng);
      expect(fare).toBeGreaterThanOrEqual(1_600_000);
      expect(fare).toBeLessThanOrEqual(2_000_000);
      expect(fare % 100).toBe(0);
    }
    const far = baseFarePaise('tow', 'flatbed', 500, rng);
    expect(far).toBeGreaterThanOrEqual(5_500_000);
    expect(far).toBeLessThanOrEqual(7_500_000);
  });
});

describe('toRupees', () => {
  it('formats paise as NUMERIC(12,2)-compatible strings', () => {
    expect(toRupees(0)).toBe('0.00');
    expect(toRupees(14_990)).toBe('149.90');
    expect(toRupees(-4_230_000)).toBe('-42300.00');
    expect(toRupees(1)).toBe('0.01');
  });
});

describe('BAND_PCT', () => {
  it('matches the §3.3 launch defaults inside the 5–10 guardrail', () => {
    expect(BAND_PCT).toEqual({ A: 10, B: 8, C: 5 });
  });
});
