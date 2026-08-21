import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_PARTIAL_FEE_PAISE,
  cancellationPolicy,
} from './cancellation-policy';

/**
 * §3.5's table, including its three worked examples verbatim.
 *
 * Only the `free` tier is reachable in Phase 15 (nothing leaves `searching`
 * until dispatch exists), which is exactly why the chargeable tiers are tested
 * here: the arithmetic is written once, now, from the spec — not later by
 * whoever wires the ledger, from memory.
 */

const CONFIRMED = new Date('2026-08-17T10:00:00.000Z');
const at = (minutes: number) => new Date(CONFIRMED.getTime() + minutes * 60_000);

/** §7.1 wheel-lift 0–5 km, the base fare §3.5's example B uses. */
const BASE_999 = 99_900;
/** §7.2 flatbed 0–5 km, example C's ₹1,999. */
const BASE_1999 = 199_900;

describe('§3.5 worked examples', () => {
  it('A — cancels at 1m30s → ₹0', () => {
    const outcome = cancellationPolicy({
      status: 'assigned',
      confirmedAt: CONFIRMED,
      basePaise: BASE_999,
      now: at(1.5),
    });
    expect(outcome.tier).toBe('free');
    expect(outcome.feePaise).toBe(0);
  });

  it('B — wheel-lift ₹999, cancels at 6m before the driver moves → ₹150 partial', () => {
    const outcome = cancellationPolicy({
      status: 'assigned',
      confirmedAt: CONFIRMED,
      basePaise: BASE_999,
      now: at(6),
    });
    expect(outcome.tier).toBe('partial');
    expect(outcome.feePaise).toBe(CANCELLATION_PARTIAL_FEE_PAISE);
    expect(outcome.feePaise).toBe(15_000); // ₹150
  });

  it('C — flatbed, driver en route, cancels at 12m → full base fare ₹1,999', () => {
    const outcome = cancellationPolicy({
      status: 'en_route',
      confirmedAt: CONFIRMED,
      basePaise: BASE_1999,
      now: at(12),
    });
    expect(outcome.tier).toBe('full');
    expect(outcome.feePaise).toBe(BASE_1999);
  });
});

describe('§3.5 — during SEARCHING cancellation is always free', () => {
  it.each([0, 1, 5, 30, 240])('free at %i minutes', (minutes) => {
    // "the customer hasn't been matched yet". This beats the clock, not the
    // other way round — a fruitless 30-minute search is the platform's failure.
    const outcome = cancellationPolicy({
      status: 'searching',
      confirmedAt: CONFIRMED,
      basePaise: BASE_1999,
      now: at(minutes),
    });
    expect(outcome.tier).toBe('free');
    expect(outcome.feePaise).toBe(0);
  });
});

describe('the 0–2 / 2–10 / >10 windows', () => {
  const tierAt = (minutes: number) =>
    cancellationPolicy({
      status: 'assigned',
      confirmedAt: CONFIRMED,
      basePaise: BASE_999,
      now: at(minutes),
    }).tier;

  it('is free up to and including the 2-minute boundary', () => {
    expect(tierAt(0)).toBe('free');
    expect(tierAt(1.99)).toBe('free');
    expect(tierAt(2)).toBe('free');
  });

  it('is partial just past 2 minutes and up to 10', () => {
    expect(tierAt(2.01)).toBe('partial');
    expect(tierAt(9.99)).toBe('partial');
    expect(tierAt(10)).toBe('partial');
  });

  it('is full past 10 minutes', () => {
    expect(tierAt(10.01)).toBe('full');
    expect(tierAt(60)).toBe('full');
  });
});

describe('a committed driver overrides the clock', () => {
  it.each(['en_route', 'arrived', 'in_progress'] as const)(
    '%s is full fare even inside the free window',
    (status) => {
      // §3.5: "> 10 minutes **or** driver en route / at pickup". The `or` is
      // what this asserts — a driver who set off 30 seconds after confirm has
      // still set off.
      const outcome = cancellationPolicy({
        status,
        confirmedAt: CONFIRMED,
        basePaise: BASE_1999,
        now: at(0.5),
      });
      expect(outcome.tier).toBe('full');
      expect(outcome.feePaise).toBe(BASE_1999);
    },
  );

  it('assigned is NOT committed — the driver has accepted but not moved', () => {
    expect(
      cancellationPolicy({
        status: 'assigned',
        confirmedAt: CONFIRMED,
        basePaise: BASE_1999,
        now: at(0.5),
      }).tier,
    ).toBe('free');
  });
});

describe('every outcome explains itself', () => {
  it.each(['searching', 'assigned', 'en_route'] as const)('%s carries a reason', (status) => {
    // §9.1.7: the cancel button "shows fee before confirming". A fee with no
    // sentence attached is a number a customer has to phone support about.
    const outcome = cancellationPolicy({
      status,
      confirmedAt: CONFIRMED,
      basePaise: BASE_999,
      now: at(20),
    });
    expect(outcome.reason.length).toBeGreaterThan(10);
  });
});
