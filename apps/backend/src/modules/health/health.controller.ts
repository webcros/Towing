import { Controller, Get } from '@nestjs/common';
import { SkipThrottling } from '../../common/throttling/throttler.config';
import { BullMqAdapter } from '../../common/queue/bullmq.adapter';
import { LedgerService } from '../../db/ledger/ledger.service';
import { EarningsProjectorService } from '../money/earnings-projector.service';

/**
 * `@SkipThrottle()` is load-bearing, not tidiness.
 *
 * These routes are unauthenticated, so per-tenant keying resolves every caller
 * to the SAME `ip:` bucket — and the callers are the load balancer's health
 * probes, one per target every few seconds, plus every alarm and synthetic
 * check. Left throttled, a scaled-out deployment exhausts the reads budget on
 * its own probes, the ALB starts seeing 429s, and it kills healthy targets.
 *
 * The endpoints are counts-only and do no tenant work, so there is nothing here
 * worth rate limiting in the first place.
 */
@Controller('health')
@SkipThrottling()
export class HealthController {
  constructor(
    private readonly queue: BullMqAdapter,
    private readonly ledgerService: LedgerService,
    private readonly projector: EarningsProjectorService,
  ) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'towing-backend',
      time: new Date().toISOString(),
    };
  }

  /**
   * Queue depth, per job (§12.3 "a DLQ and a depth alarm").
   *
   * `failed` is the DLQ depth — jobs that exhausted their attempts and need a
   * human. It is the number worth alarming on; `waiting` growing without bound
   * is the other. Deliberately unauthenticated, like `/health`: this is an
   * infrastructure probe, it exposes counts and no tenant data, and an alarm
   * that needs a fleet login is an alarm that will not be wired up.
   */
  @Get('queues')
  async queues() {
    const stats = await this.queue.stats();
    return {
      time: new Date().toISOString(),
      queues: stats,
      /** Cheap top-level signal so an alarm can watch one field. */
      deadLettered: stats.reduce((sum, q) => sum + q.failed, 0),
    };
  }

  /**
   * Ledger integrity (§14.1 "reconciled against the ledger", §3.4).
   *
   * Computes live rather than serving the cached nightly report, so an operator
   * checking during an incident gets the truth and not a 12-hour-old number.
   * `lastRun` is the nightly job's stored result, for "when did this last pass
   * unattended?".
   *
   * Unauthenticated for the same reason as `/health/queues`: it exposes counts
   * and zero tenant data, and an alarm that needs a fleet login is an alarm
   * nobody wires up. **Deliberately no rupee amounts and no wallet ids** — a
   * drift count is an operational signal; the identifying detail is in the logs.
   */
  @Get('ledger')
  async ledger() {
    const [invariants, drifted, lastRun] = await Promise.all([
      this.ledgerService.invariants(),
      this.ledgerService.driftedWallets(50),
      this.projector.lastReport(),
    ]);

    return {
      time: new Date().toISOString(),
      ...invariants,
      driftedWallets: drifted.length,
      maxDeltaPaise: drifted.reduce((max, w) => Math.max(max, Math.abs(w.deltaPaise)), 0),
      lastRun,
    };
  }
}
