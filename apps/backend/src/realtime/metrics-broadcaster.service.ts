import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { FleetId, OpsMetricsEvent } from '@towing/api-contracts';
import type { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env';
import { DashboardService } from '../modules/dashboard/dashboard.service';
import {
  FLEET_EVENTS_CHANNEL,
  METRICS_CHANNEL,
  REDIS,
  metricsLockKey,
} from '../redis/redis.constants';
import { RealtimeSubscriberService } from './realtime-subscriber.service';

/**
 * Turns a burst of domain events into one recomputed `ops:metrics` payload per
 * fleet, published for every node to relay.
 *
 * WHY A PAYLOAD AND NOT AN INVALIDATE-PING: §16.6 specifies `ops:metrics` as
 * live KPI deltas, and the console patches it with `setQueryData`. A bare "go
 * refetch" would also have to bust the 15s dashboard cache first, or the console
 * refetches and renders identical numbers — an update that visibly does nothing.
 *
 * WHY THE LOCK IS A COST GUARD, NOT A CORRECTNESS GUARD: every node sees every
 * event, so without it every node recomputes (N x the DB work) and publishes (N
 * duplicate frames). Duplicates are harmless to `setQueryData`, and a node that
 * dies holding the lock costs exactly one skipped push — which the console's 15s
 * staleTime and its on-reconnect REST resync already cover. Nothing here is
 * allowed to *depend* on the lock.
 */
@Injectable()
export class MetricsBroadcasterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsBroadcasterService.name);
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private destroyed = false;

  constructor(
    private readonly subscriber: RealtimeSubscriberService,
    private readonly dashboard: DashboardService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.env.REALTIME_ENABLED) return;
    await this.subscriber.subscribe(FLEET_EVENTS_CHANNEL, (payload) => this.schedule(payload));
  }

  private schedule(payload: unknown): void {
    if (this.destroyed) return;
    if (typeof payload !== 'object' || payload === null) return;
    const fleetId = (payload as { fleetId?: unknown }).fleetId;
    if (typeof fleetId !== 'string' || fleetId.length === 0) return;

    // Coalesce: a CSV import or a burst of transitions must cost one recompute,
    // not one per row.
    const existing = this.pending.get(fleetId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.pending.delete(fleetId);
      void this.recomputeAndPublish(fleetId as FleetId);
    }, this.env.REALTIME_METRICS_DEBOUNCE_MS);
    // unref: a pending recompute must never keep a draining ECS task — or a
    // vitest worker — alive.
    timer.unref();
    this.pending.set(fleetId, timer);
  }

  private async recomputeAndPublish(fleetId: FleetId): Promise<void> {
    // Re-checked here, not just at schedule time: the app can be torn down
    // during the debounce window, and this callback would then query a closed
    // postgres pool and surface as an unhandled rejection.
    if (this.destroyed) return;

    try {
      const won = await this.redis.set(
        metricsLockKey(fleetId),
        'held',
        'PX',
        this.env.REALTIME_METRICS_DEBOUNCE_MS,
        'NX',
      );
      if (won === null) return;

      // getSummary reads through the cache FleetEventsService just invalidated,
      // so this both computes fresh numbers and repopulates `dash:{fleetId}` —
      // the REST endpoint and the pushed payload cannot disagree.
      const summary = await this.dashboard.getSummary(fleetId);
      if (this.destroyed) return;

      const event: OpsMetricsEvent & { fleetId: string } = {
        fleetId,
        kpis: summary.kpis,
        at: new Date().toISOString(),
      };
      await this.redis.publish(METRICS_CHANNEL, JSON.stringify(event));
    } catch (err) {
      // Debug, not error: during shutdown this legitimately races a closing
      // pool, and it must never rethrow out of a timer callback.
      this.logger.debug(
        `metrics recompute for ${fleetId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }
}
