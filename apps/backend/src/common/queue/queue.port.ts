/**
 * Background-job seam (plan's locked decision: "BullMQ behind a `QueuePort`;
 * Redis already required; SQS/EventBridge becomes an adapter swap on AWS").
 *
 * This port — not the compliance worker or the CSV import that sit on top of it
 * — is the hard prerequisite for Track B Phases 13, 17 and 19:
 *   · 13 needs queue-backed notification fan-out with retries and a DLQ (§12.3).
 *   · 17 needs dispatch offer timers that are DURABLE and SINGLE-OWNER across N
 *     Fargate tasks. In-process `setTimeout` over N tasks double-assigns a
 *     fare-locked booking, which corrupts the ledger rather than degrading UX.
 *   · 19 needs a reconciliation sweep that runs ONCE, not N times against the
 *     same uncaptured payment.
 *
 * Everything here is therefore designed around durability and single-ownership,
 * not around convenience.
 */

export const QUEUE = Symbol('QUEUE');

/**
 * The registry of every background job. Adding an entry here is what makes a
 * job typed end-to-end — `enqueue` will not accept a payload that does not
 * match, and a handler cannot claim the wrong shape.
 *
 * Named `domain.action` so the BullMQ queue names are readable in redis-cli and
 * in any future dashboard.
 */
export interface JobPayloads {
  /** Hourly compliance sweep: expiry transitions + 30-day alerts (§9.3.4). */
  'compliance.sweep': { reason: 'cron' | 'manual' };
  /** Bulk truck CSV import too large to process in the request (§9.3.4). */
  'trucks.bulk-import': { fleetId: string; importId: string };
  /**
   * Recompute one `(fleet, IST day, driver)` cell of the earnings projection.
   * Absolute, not a delta — see `earnings-projector.ts` for why that matters
   * under at-least-once delivery.
   */
  'earnings.project': { fleetId: string; day: string; driverId: string };
  /** Nightly ledger reconciliation + projection audit (§14.1 "reconciled nightly"). */
  'earnings.reconcile': { reason: 'cron' | 'manual'; days?: number };
  /** §19.3's missed-webhook sweep: ask the provider about non-terminal payouts. */
  'payouts.reconcile': { reason: 'cron' | 'manual' };
  /**
   * The dev adapter's settle timer. A durable delayed job rather than a
   * `setTimeout`, so the local lifecycle demo runs the same path production
   * does and cannot outlive the process that scheduled it.
   */
  'payouts.dev-settle': { payoutId: string; providerRef: string };
}

export type JobName = keyof JobPayloads;

export interface EnqueueOptions {
  /**
   * Idempotency key. BullMQ refuses a second job with the same id while the
   * first is still known, which is what makes "enqueue on every request" safe.
   */
  jobId?: string;
  /** Run no earlier than this many ms from now (Phase 17's offer timers). */
  delayMs?: number;
  /** Total attempts including the first. Beyond this the job lands in the DLQ. */
  attempts?: number;
  /** Base delay for exponential backoff between attempts. */
  backoffMs?: number;
}

export type JobHandler<N extends JobName> = (payload: JobPayloads[N]) => Promise<void>;

/** Counts behind the §12.3 depth alarm; `failed` is the DLQ depth. */
export interface QueueStats {
  name: JobName;
  waiting: number;
  active: number;
  delayed: number;
  /** Attempts exhausted — these are the jobs a human has to look at. */
  failed: number;
  completed: number;
}

export interface QueuePort {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayloads[N],
    options?: EnqueueOptions,
  ): Promise<void>;

  /**
   * Registers a cron schedule for a job.
   *
   * MUST be safe to call from every task on boot: the adapter deduplicates by
   * schedule key in Redis so N tasks produce ONE timer. That is the property
   * `@nestjs/schedule` cannot give us — it would run the sweep N times.
   */
  schedule<N extends JobName>(name: N, payload: JobPayloads[N], cron: string): Promise<void>;

  /** Starts a worker for this job. Call once per process, during module init. */
  process<N extends JobName>(name: N, handler: JobHandler<N>): void;

  /** Snapshot for `/v1/health` and the depth alarm. */
  stats(): Promise<QueueStats[]>;
}
