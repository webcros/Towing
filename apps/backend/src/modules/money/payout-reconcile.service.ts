import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { QUEUE, type QueuePort } from '../../common/queue/queue.port';
import { ENV, type Env } from '../../config/env';
import { PAYOUT_PROVIDER, type PayoutProviderPort } from './payout-provider.port';
import { PayoutsRepo } from './payouts.repo';
import { PayoutsService } from './payouts.service';

/**
 * §19.3: "a missed webhook is reconciled by scheduled polling (e.g., payment
 * status sweep every 5 min)".
 *
 * This is what makes "a timeout is not a failure" a safe rule rather than a way
 * to strand money: `PayoutsService.submit` leaves an un-acknowledged payout as
 * `requested`, and this asks the provider what actually happened.
 *
 * Single-owner across N tasks comes free from the BullMQ scheduler's Redis
 * dedup — the property `@nestjs/schedule` cannot give, and the reason the phase
 * plan made `QueuePort` a hard prerequisite for exactly this kind of sweep.
 */
@Injectable()
export class PayoutReconcileService implements OnModuleInit {
  private readonly logger = new Logger(PayoutReconcileService.name);

  /** Long enough that the poll never races a payout still mid-request elsewhere. */
  private static readonly SETTLE_GRACE_MINUTES = 2;

  constructor(
    private readonly repo: PayoutsRepo,
    private readonly payouts: PayoutsService,
    @Inject(QUEUE) private readonly queue: QueuePort,
    @Inject(PAYOUT_PROVIDER) private readonly provider: PayoutProviderPort,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queue.process('payouts.reconcile', async (payload) => {
      await this.reconcile(payload.reason);
    });

    // The dev adapter's settle timer. A real job rather than a `setTimeout`, so
    // the local lifecycle demo goes through the same durable path production
    // uses and cannot outlive the process that scheduled it.
    this.queue.process('payouts.dev-settle', async (payload) => {
      await this.payouts.markPaid(payload.payoutId, payload.providerRef);
    });

    await this.queue.schedule('payouts.reconcile', { reason: 'cron' }, this.env.PAYOUT_RECONCILE_CRON);
  }

  async reconcile(reason: 'cron' | 'manual'): Promise<{ checked: number; settled: number; failed: number }> {
    const stale = await this.repo.staleNonTerminal(PayoutReconcileService.SETTLE_GRACE_MINUTES);
    let settled = 0;
    let failed = 0;

    for (const payout of stale) {
      const ageMinutes = (Date.now() - payout.requestedAt.getTime()) / 60_000;

      // No provider reference and old enough: the request-time timeout finally
      // resolving. Nothing was ever accepted, so failing it returns the money.
      if (!payout.routeRef) {
        if (ageMinutes >= this.env.PAYOUT_STUCK_MINUTES) {
          await this.payouts.markFailed(payout.id, 'Provider never acknowledged the payout');
          failed += 1;
        }
        continue;
      }

      try {
        const handle = await this.provider.fetchPayout(payout.routeRef);

        if (handle.status === 'paid') {
          await this.payouts.markPaid(payout.id, handle.providerRef);
          settled += 1;
        } else if (handle.status === 'failed') {
          await this.payouts.markFailed(payout.id, handle.failureReason ?? 'Provider reported a failure');
          failed += 1;
        }
        // `processing` — still in flight. Ask again next tick.
      } catch (error) {
        // A provider outage must not fail the sweep for every other payout.
        this.logger.warn(`could not reconcile payout ${payout.id}: ${String(error)}`);
      }
    }

    if (stale.length > 0) {
      this.logger.log(
        `payout reconcile (${reason}) — checked ${stale.length}, settled ${settled}, failed ${failed}`,
      );
    }

    return { checked: stale.length, settled, failed };
  }
}
