import { Inject, Injectable, Logger } from '@nestjs/common';
import { TRUCK_HASH_TTL_MS, type DriverLocationPing } from '@towing/api-contracts';
import type { Redis } from 'ioredis';
import {
  LOCATION_CHANNEL,
  REDIS,
  truckGeoKey,
  truckHashKey,
} from '../../redis/redis.constants';
import type { DriverPresenceIdentity } from './presence-store';

/**
 * Driver ping → the fleet console's existing truck-shaped world.
 *
 * WHY THIS EXISTS AT ALL. Phase 5 fans out TRUCK-keyed data into `fleet:{id}`
 * rooms and the console has consumed exactly that shape since. Phase 16's ping
 * is DRIVER-keyed. Something has to translate, and the choice is between
 * teaching `<FleetMap>` a second shape or writing this adapter — this adapter,
 * because the console is a shipped, load-tested surface and the acceptance
 * criterion for this phase is that it shows a real driver *without being
 * touched*.
 *
 * WHAT IT WRITES, AND WHY BOTH. The socket fan-out alone would move the marker
 * live but leave `GET /fleet/realtime/positions` reporting `fromFallback: true`
 * for an actively-pinging driver — so a console that reconnects, or one in
 * §19.2 polling mode, would show them as a stale PostGIS position. The truck
 * hash and the tenant GEO set are therefore refreshed alongside the publish,
 * which is precisely the trio `simulate-locations.ts` writes. The simulator is
 * the reference implementation of this shape; this is the real one.
 *
 * ONLY A FLEET-AFFILIATED DRIVER WITH AN ASSIGNED TRUCK CAN APPEAR. An
 * independent driver has `fleet_id` null and no `assigned_truck_id` by
 * construction — which is exactly what Phase 12's self-signup creates — and
 * silently produces no fleet fan-out. That is correct, not a gap: there is no
 * fleet whose map they belong on.
 */
@Injectable()
export class FleetFanoutAdapter {
  private readonly logger = new Logger(FleetFanoutAdapter.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async publish(ping: DriverLocationPing, identity: DriverPresenceIdentity): Promise<void> {
    const { fleetId, truckId } = identity;
    if (!fleetId || !truckId) return;

    // The `truckPositionSchema` shape verbatim. `LocationBatcher.accept()`
    // safeParses against it on the other side, so a field added here that the
    // schema does not know is silently dropped, and a missing one drops the
    // whole ping — which is why this is written out explicitly rather than
    // spread from the driver payload.
    const payload = {
      truckId,
      fleetId,
      lat: ping.lat,
      lng: ping.lng,
      heading: ping.headingDeg ?? null,
      speedKph: ping.speedKph ?? null,
      at: ping.at,
    };

    try {
      await this.redis
        .pipeline()
        .publish(LOCATION_CHANNEL, JSON.stringify(payload))
        .geoadd(truckGeoKey(fleetId), ping.lng, ping.lat, truckId)
        .hset(truckHashKey(truckId), {
          fleetId,
          lat: String(ping.lat),
          lng: String(ping.lng),
          heading: payload.heading === null ? '' : String(payload.heading),
          speedKph: payload.speedKph === null ? '' : String(payload.speedKph),
          at: ping.at,
        })
        .pexpire(truckHashKey(truckId), TRUCK_HASH_TTL_MS)
        .exec();
    } catch (err) {
      // A console that misses a frame is a degraded map; a driver whose ping is
      // rejected because a console's map failed is a driver dispatch cannot
      // find. The candidate store has already been written by the time we get
      // here, so swallowing this keeps the more important half correct.
      this.logger.warn(
        `fleet fan-out failed for truck ${truckId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
