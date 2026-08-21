import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ErrorCodes,
  LOW_ACCURACY_METERS,
  type DriverLocationAccepted,
  type DriverLocationEvent,
  type DriverLocationPing,
} from '@towing/api-contracts';
import type { Redis } from 'ioredis';
import { ApiException } from '../../common/errors/api-exception';
import { MetricsService } from '../../common/observability/metrics.service';
import { DRIVER_LOCATION_CHANNEL, REDIS } from '../../redis/redis.constants';
import { DriverPresenceRepo } from './driver-presence.repo';
import { FleetFanoutAdapter } from './fleet-fanout.adapter';
import { LocationFlushService } from './location-flush.service';
import { PresenceStore, type ApplyPingResult } from './presence-store';

/**
 * §11.3's location pipeline. ONE entry point, two doors.
 *
 * `POST /v1/driver/location` and the `/driver` socket's `location:update` both
 * land here. That is not tidiness — it is the only way the `seq` guarantee, the
 * accuracy rule, the fan-out and the sampled persistence can be true of the
 * stream rather than true of one transport. A socket path that skipped the
 * flush buffer would produce trips whose breadcrumb trail has holes wherever
 * the signal was good enough to hold a socket.
 */
@Injectable()
export class LocationIngestService {
  private readonly logger = new Logger(LocationIngestService.name);

  constructor(
    private readonly store: PresenceStore,
    private readonly repo: DriverPresenceRepo,
    private readonly fleetFanout: FleetFanoutAdapter,
    private readonly flush: LocationFlushService,
    private readonly metrics: MetricsService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Applies a batch IN ARRAY ORDER, which is what makes the on-device buffer's
   * reconnect flush work.
   *
   * Sequentially, not `Promise.all`: the whole point of `seq` is that these are
   * ordered, and firing them concurrently would let the compare-and-set discard
   * everything after whichever happened to win. The cost is bounded — the
   * contract caps a batch at 120 — and a reconnect is rare compared with the
   * steady state of one ping at a time.
   */
  async ingest(driverId: string, pings: DriverLocationPing[]): Promise<DriverLocationAccepted> {
    let accepted = 0;
    let discarded = 0;
    let seq = 0;

    for (const ping of pings) {
      const result = await this.applyOne(driverId, ping);
      if (result === 'accepted') {
        accepted += 1;
        seq = ping.seq;
      } else {
        discarded += 1;
      }
    }

    // A batch that was entirely stale still has to answer with the truth about
    // where the server is, or the handset resumes from its own count and every
    // subsequent ping is discarded too.
    if (accepted === 0) seq = await this.store.currentSeq(driverId);

    return { accepted, discarded, seq };
  }

  private async applyOne(driverId: string, ping: DriverLocationPing): Promise<'accepted' | 'discarded'> {
    let result = await this.store.applyPing(driverId, ping);

    if (result.status === 'unknown') {
      // THE TUNNEL CASE. The hot hash carries a 30s TTL and the idle cadence is
      // 10s, so it survives the steady state — but a driver who loses signal for
      // longer comes back to an expired hash and would otherwise be told they
      // are not online, which they are. Rehydrating from the authoritative row
      // and retrying once turns a lost shift into one extra query on a path that
      // is by definition not hot.
      const rehydrated = await this.rehydrate(driverId);
      if (!rehydrated) {
        this.metrics.observeLocationPing('rejected');
        throw new ApiException(
          409,
          ErrorCodes.DRIVER_NOT_ONLINE,
          'Go online before streaming location',
        );
      }
      result = await this.store.applyPing(driverId, ping);
    }

    if (result.status !== 'applied') {
      this.metrics.observeLocationPing('discarded');
      return 'discarded';
    }

    this.metrics.observeLocationPing('accepted');
    if (ping.accuracyM !== undefined && ping.accuracyM > LOW_ACCURACY_METERS) {
      this.metrics.observeLocationPing('low_accuracy');
    }

    await Promise.all([
      this.publishDriverShaped(driverId, ping, result),
      this.fleetFanout.publish(ping, result.identity),
    ]);

    this.flush.buffer({ driverId, lat: ping.lat, lng: ping.lng, at: new Date(ping.at) });
    return 'accepted';
  }

  /**
   * The untranslated fact, for consumers that follow a PERSON rather than a
   * truck — Phase 18's customer tracking above all, which watches a driver
   * approach a pickup and has no truck id to key on.
   *
   * `lowAccuracy` is carried as a computed BOOLEAN rather than as raw metres so
   * every consumer draws the halo at the same threshold. A client comparing
   * `accuracyM` against its own constant is how two surfaces end up disagreeing
   * about whether the same fix is trustworthy.
   */
  private async publishDriverShaped(
    driverId: string,
    ping: DriverLocationPing,
    result: Extract<ApplyPingResult, { status: 'applied' }>,
  ): Promise<void> {
    const event: DriverLocationEvent = {
      driverId,
      zoneId: result.identity.zoneId,
      fleetId: result.identity.fleetId,
      lat: ping.lat,
      lng: ping.lng,
      headingDeg: ping.headingDeg ?? null,
      speedKph: ping.speedKph ?? null,
      accuracyM: ping.accuracyM ?? null,
      lowAccuracy: ping.accuracyM !== undefined && ping.accuracyM > LOW_ACCURACY_METERS,
      seq: ping.seq,
      at: ping.at,
    };

    try {
      await this.redis.publish(DRIVER_LOCATION_CHANNEL, JSON.stringify(event));
    } catch (err) {
      this.logger.warn(
        `driver fan-out failed for ${driverId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Rebuilds the hot hash from Postgres. Returns false when the driver is not
   * actually online, or lost their approval while they were away — an admin
   * suspension mid-shift must take effect on the next ping, not at the next
   * login.
   */
  private async rehydrate(driverId: string): Promise<boolean> {
    const row = await this.repo.identity(driverId);
    if (!row || !row.isOnline || row.kycStatus !== 'approved' || !row.zoneId) return false;

    await this.store.putIdentity(driverId, {
      zoneId: row.zoneId,
      fleetId: row.fleetId,
      truckId: row.truckId,
      vehicleClass: row.vehicleClass,
      longDistance: row.longDistance,
    });
    return true;
  }
}
