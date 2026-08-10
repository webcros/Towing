import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  REALTIME_EVENT,
  bookingStatusEventSchema,
  opsMetricsEventSchema,
} from '@towing/api-contracts';
import { ENV, type Env } from '../config/env';
import {
  FLEET_EVENTS_CHANNEL,
  LOCATION_CHANNEL,
  METRICS_CHANNEL,
} from '../redis/redis.constants';
import { FleetGateway } from './fleet.gateway';
import { LocationBatcher } from './location-batcher';
import { RealtimeSubscriberService } from './realtime-subscriber.service';

/**
 * Turns Redis messages into socket frames for the sockets attached to THIS node.
 *
 * TENANCY: the publisher stamps `fleetId` and this relay trusts it. Today the
 * only publishers are the trusted simulator and our own services. When driver-app
 * ingestion lands, that path MUST derive `fleetId` from the authenticated
 * driver's claims and never from the payload — the WebSocket analogue of
 * `FleetScopeGuard`. A ping is routed to `fleet:{fleetId}` verbatim, so a
 * spoofable field here is a cross-tenant leak.
 */
@Injectable()
export class RealtimeRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeRelayService.name);
  private readonly batcher = new LocationBatcher();
  private flushTimer?: NodeJS.Timeout;
  private destroyed = false;
  private malformed = 0;

  constructor(
    private readonly subscriber: RealtimeSubscriberService,
    private readonly gateway: FleetGateway,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.env.REALTIME_ENABLED) {
      this.logger.warn('REALTIME_ENABLED=false — no relays installed (§19.2 polling mode)');
      return;
    }

    await this.subscriber.subscribe(LOCATION_CHANNEL, (payload) => this.onLocationPing(payload));
    await this.subscriber.subscribe(METRICS_CHANNEL, (payload) => this.onOpsMetrics(payload));
    await this.subscriber.subscribe(FLEET_EVENTS_CHANNEL, (payload) => this.onFleetEvent(payload));

    // unref: a stray interval must never be the reason a test worker or a
    // draining ECS task refuses to exit.
    this.flushTimer = setInterval(() => this.flush(), this.env.REALTIME_FLUSH_MS);
    this.flushTimer.unref();
  }

  private onLocationPing(payload: unknown): void {
    if (!this.batcher.accept(payload)) {
      this.malformed += 1;
      if (this.malformed % 100 === 1) {
        this.logger.warn(`discarded ${this.malformed} malformed location ping(s)`);
      }
    }
  }

  /** Already-computed KPI payloads (see MetricsBroadcaster) — pure relay. */
  private onOpsMetrics(payload: unknown): void {
    const fleetId = readFleetId(payload);
    if (!fleetId) return;

    const parsed = opsMetricsEventSchema.safeParse(payload);
    if (!parsed.success) return;

    this.gateway.relayLocal(fleetId, REALTIME_EVENT.OPS_METRICS, parsed.data);
  }

  /**
   * Domain events. Only `booking_status` has a client-facing shape today; the
   * rest exist to trigger a KPI recompute and are consumed by MetricsBroadcaster.
   */
  private onFleetEvent(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) return;
    if ((payload as { kind?: unknown }).kind !== 'booking_status') return;

    const fleetId = readFleetId(payload);
    if (!fleetId) return;

    const parsed = bookingStatusEventSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn('discarded malformed booking_status event');
      return;
    }

    this.gateway.relayLocal(fleetId, REALTIME_EVENT.BOOKING_STATUS, parsed.data);
  }

  private flush(): void {
    if (this.destroyed) return;

    try {
      const dropped = this.batcher.takeDroppedCount();
      if (dropped > 0) this.logger.debug(`dropped ${dropped} out-of-order ping(s)`);

      const byFleet = this.batcher.drain();
      if (byFleet.size === 0) return;

      const emittedAt = new Date().toISOString();
      for (const [fleetId, positions] of byFleet) {
        // Local room membership. A node nobody is watching does zero work for a
        // fleet's entire ping stream — which is what makes 200 trucks across N
        // tasks cheap.
        if (this.gateway.localRoomSize(fleetId) === 0) continue;
        this.gateway.relayLocal(fleetId, REALTIME_EVENT.LOCATION_UPDATE, { positions, emittedAt });
      }
    } catch (err) {
      // Never rethrow from a timer: an unhandled rejection here takes down the
      // process (and, in vitest, fails an unrelated suite).
      this.logger.error(`flush failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = undefined;
  }
}

function readFleetId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const fleetId = (payload as { fleetId?: unknown }).fleetId;
  return typeof fleetId === 'string' && fleetId.length > 0 ? fleetId : null;
}
