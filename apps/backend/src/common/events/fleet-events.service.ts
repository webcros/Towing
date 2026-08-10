import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FleetId, JobStatus } from '@towing/api-contracts';
import type { Redis } from 'ioredis';
import { FLEET_EVENTS_CHANNEL, REDIS } from '../../redis/redis.constants';
import { CacheService } from '../cache/cache.service';

/**
 * Something happened that moves a fleet's KPIs.
 *
 * `kind` exists so consumers can tell "recompute the numbers" (every kind) from
 * "and also tell the console about it" (`booking_status` only).
 */
export type FleetEvent =
  | { kind: 'truck_changed'; truckId?: string }
  | { kind: 'driver_assignment_changed'; driverId: string }
  | { kind: 'booking_status'; bookingId: string; status: JobStatus }
  /**
   * A payout moved (§9.3.7 "statuses real-time"). Needs no relay branch and no
   * new socket event: `RealtimeRelayService` forwards only `booking_status`, so
   * this is silently ignored there BY DESIGN, while `MetricsBroadcasterService`
   * fires on any kind. The value it buys is the `dash:{fleetId}` invalidation —
   * a failed payout opens an alert, the alert feed lives inside that cache
   * entry, and without the emit it would be invisible for up to 15 s.
   *
   * A client-facing `payout:status` frame is deliberately out of scope: it
   * would touch `realtime.types.ts`, `REALTIME_EVENT`, the relay branch, the
   * console socket handler and two e2e specs, for a status that changes a few
   * times a day per fleet. Query invalidation covers it.
   */
  | { kind: 'payout_status'; payoutId: string; status: string };

/**
 * The single seam mutations use to say "this fleet's dashboard is stale".
 *
 * Before Phase 5 this was three inline `cache.invalidate('dash:' + id)` calls in
 * TrucksService, and DriversService had none — which is why assigning a truck
 * silently left `utilizationPct` wrong for up to 15s. Routing both through one
 * service means "bust the cache" and "push the new numbers" can never drift
 * apart again.
 *
 * Deliberately in `common/` and `@Global()`, mirroring CacheModule: it needs
 * only REDIS and CacheService, so feature modules call it with zero import
 * wiring and there is no TrucksModule → RealtimeModule → DashboardModule cycle
 * to reason about.
 */
@Injectable()
export class FleetEventsService {
  private readonly logger = new Logger(FleetEventsService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly cache: CacheService,
  ) {}

  async emit(fleetId: FleetId | string, event: FleetEvent): Promise<void> {
    // Invalidate FIRST. If a console refetches between these two lines it must
    // get fresh numbers; the reverse order would serve the 15s-cached ones and
    // the KPI would appear to update to an unchanged value.
    await this.cache.invalidate(`dash:${fleetId}`);

    try {
      await this.redis.publish(
        FLEET_EVENTS_CHANNEL,
        JSON.stringify({ ...event, fleetId, at: new Date().toISOString() }),
      );
    } catch (err) {
      // A failed publish costs a live KPI push, which the console's 15s
      // staleTime and its on-reconnect REST resync already backstop. It must
      // never fail the mutation that caused it.
      this.logger.warn(
        `fleet event publish failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
