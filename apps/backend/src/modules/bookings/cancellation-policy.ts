import type { CancellationTier, JobStatus } from '@towing/api-contracts';

/**
 * §3.5's cancellation policy.
 *
 * | Window after confirm | Customer charge | Driver compensation |
 * | 0–2 min              | Free            | None                |
 * | 2–10 min             | Partial (₹150)  | Configurable share  |
 * | > 10 min OR driver en route / at pickup | Full base fare | Configurable share |
 *
 * Plus the rule that overrides the clock entirely: **during `SEARCHING`
 * cancellation is always free** — "the customer hasn't been matched yet". A
 * customer who waits eleven minutes for a driver that never came has cost
 * nobody anything.
 *
 * WHY THE WHOLE LADDER IS WRITTEN WHEN ONLY THE FREE BRANCH IS REACHABLE.
 * Nothing can leave `searching` until Phase 17 assigns a driver, so in Phase 15
 * every real cancellation is free. Implementing only that branch would leave
 * the tiers to be invented later by whoever wires the ledger, from the same
 * spec table, with no test — and §3.5 is a table people get wrong. Here it is
 * transcribed once, tested against its own worked examples, and the route
 * refuses the chargeable tiers rather than quietly charging zero for them.
 */

/** §3.5's launch defaults. Admin-configurable knobs for these are Phase 19's. */
export const CANCELLATION_FREE_WINDOW_MS = 2 * 60 * 1000;
export const CANCELLATION_PARTIAL_WINDOW_MS = 10 * 60 * 1000;
export const CANCELLATION_PARTIAL_FEE_PAISE = 15_000; // ₹150

/** The states in which a driver is already committed — full fare regardless of the clock. */
const DRIVER_COMMITTED: readonly JobStatus[] = ['en_route', 'arrived', 'in_progress'];

export interface CancellationOutcome {
  tier: CancellationTier;
  feePaise: number;
  /** Why this tier — surfaced to the customer before they confirm (§9.1.7). */
  reason: string;
}

export function cancellationPolicy(params: {
  status: JobStatus;
  confirmedAt: Date;
  basePaise: number;
  now?: Date;
}): CancellationOutcome {
  const now = params.now ?? new Date();
  const elapsedMs = now.getTime() - params.confirmedAt.getTime();

  // §3.5: "During search (SEARCHING) cancellation is always free". This beats
  // the clock, not the other way round — a ten-minute fruitless search is the
  // platform's failure, not the customer's.
  if (params.status === 'searching') {
    return { tier: 'free', feePaise: 0, reason: 'Free while we are still finding you a driver' };
  }

  // A driver already moving is owed something whatever the elapsed time says.
  if (DRIVER_COMMITTED.includes(params.status)) {
    return {
      tier: 'full',
      feePaise: params.basePaise,
      reason: 'Your driver is already on the way',
    };
  }

  if (elapsedMs <= CANCELLATION_FREE_WINDOW_MS) {
    return { tier: 'free', feePaise: 0, reason: 'Free within 2 minutes of booking' };
  }

  if (elapsedMs <= CANCELLATION_PARTIAL_WINDOW_MS) {
    return {
      tier: 'partial',
      feePaise: CANCELLATION_PARTIAL_FEE_PAISE,
      reason: 'Cancelled between 2 and 10 minutes after booking',
    };
  }

  return { tier: 'full', feePaise: params.basePaise, reason: 'Cancelled more than 10 minutes after booking' };
}
