import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FleetId, FleetPositionDto, PositionsSnapshotDto } from '@towing/api-contracts';
import type { Redis } from 'ioredis';
import { REDIS, truckGeoKey, truckHashKey } from '../redis/redis.constants';
import { PositionsRepo, type TruckRow } from './positions.repo';

/**
 * The REST snapshot the console resyncs from on every (re)connect (§18) and
 * polls every 10s when the socket is unavailable (§19.2).
 *
 * Postgres is authoritative for WHICH trucks exist; Redis is authoritative for
 * WHERE they are right now. That order is a tenancy decision, not a performance
 * one — see `PositionsRepo.trucksFor`.
 */
@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    private readonly repo: PositionsRepo,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async snapshot(fleetId: FleetId): Promise<PositionsSnapshotDto> {
    const [trucks, zones] = await Promise.all([
      this.repo.trucksFor(fleetId),
      this.repo.activeZones(),
    ]);

    let hot: Map<string, HotPosition>;
    let degraded = false;
    try {
      hot = await this.readHot(fleetId, trucks);
    } catch (err) {
      // §19.2 "Redis degraded → fall back to direct PostGIS (slower but
      // correct)". The console shows a degraded chip; it does not show an error.
      this.logger.warn(
        `redis unavailable, serving positions from postgis: ${err instanceof Error ? err.message : String(err)}`,
      );
      hot = new Map();
      degraded = true;
    }

    return {
      positions: trucks.map((truck) => toDto(truck, hot.get(truck.truckId))),
      zones: zones.map((zone) => ({ id: zone.id, name: zone.name, geometry: zone.geometry })),
      at: new Date().toISOString(),
      degraded,
    };
  }

  /**
   * One pipelined HGETALL per truck. Keyed off the Postgres id list, so a member
   * that only exists in Redis is never read and can never reach the response.
   */
  private async readHot(fleetId: FleetId, trucks: TruckRow[]): Promise<Map<string, HotPosition>> {
    const out = new Map<string, HotPosition>();
    if (trucks.length === 0) return out;

    const pipeline = this.redis.pipeline();
    for (const truck of trucks) pipeline.hgetall(truckHashKey(truck.truckId));
    const results = await pipeline.exec();

    const expired: string[] = [];
    for (const [index, truck] of trucks.entries()) {
      // `exec()` is `Array<[Error|null, unknown]> | null`, and every hop is
      // optional under noUncheckedIndexedAccess.
      const entry = results?.[index];
      const error = entry?.[0];
      const value = entry?.[1];
      if (error || typeof value !== 'object' || value === null) continue;

      const hash = value as Record<string, string | undefined>;
      if (!hash.at) {
        // Hash gone (TTL lapsed) but the truck may still sit in the GEO set —
        // GEO members have no per-member TTL, so they linger forever otherwise.
        expired.push(truck.truckId);
        continue;
      }

      const lat = num(hash.lat);
      const lng = num(hash.lng);
      if (lat === null || lng === null) continue;

      out.set(truck.truckId, {
        lat,
        lng,
        heading: num(hash.heading),
        speedKph: num(hash.speedKph),
        at: hash.at,
      });
    }

    if (expired.length > 0) void this.readRepair(fleetId, expired);
    return out;
  }

  /**
   * Read-repair: drop GEO members whose position hash has expired. Fire and
   * forget — a failure here costs a stale dispatch candidate, not a wrong
   * response, and must never delay the console's resync.
   */
  private async readRepair(fleetId: FleetId, truckIds: string[]): Promise<void> {
    try {
      await this.redis.zrem(truckGeoKey(fleetId), ...truckIds);
    } catch {
      // deliberately swallowed — see above
    }
  }
}

interface HotPosition {
  lat: number;
  lng: number;
  heading: number | null;
  speedKph: number | null;
  at: string;
}

function toDto(truck: TruckRow, hot: HotPosition | undefined): FleetPositionDto {
  const base = {
    truckId: truck.truckId,
    plate: truck.plate,
    status: truck.status,
    driverName: truck.driverName,
    activeBookingId: truck.activeBookingId,
    activeJobLeg: legOf(truck),
  };

  if (hot) {
    return {
      ...base,
      lat: hot.lat,
      lng: hot.lng,
      heading: hot.heading,
      speedKph: hot.speedKph,
      at: hot.at,
      fromFallback: false,
    };
  }

  return {
    ...base,
    lat: truck.lat,
    lng: truck.lng,
    // Postgres keeps only the position, not the motion — a fallback marker is
    // honestly still rather than confidently pointing somewhere.
    heading: null,
    speedKph: null,
    at: truck.lastPingAt?.toISOString() ?? null,
    // A truck with no hot key is on the fallback path whether or not Redis
    // itself is down; both make `presenceFor` the client's source of truth.
    fromFallback: true,
  };
}

/**
 * `pickup_lat`/`pickup_lng` are NOT NULL on a booking, so a row with an active
 * job always has a pickup; drop is optional (jumpstart, fuel, tyre have no
 * destination).
 */
function legOf(truck: TruckRow): FleetPositionDto['activeJobLeg'] {
  if (truck.activeBookingId === null) return null;
  if (truck.pickupLat === null || truck.pickupLng === null) return null;

  return {
    pickup: { lat: truck.pickupLat, lng: truck.pickupLng },
    drop:
      truck.dropLat === null || truck.dropLng === null
        ? null
        : { lat: truck.dropLat, lng: truck.dropLng },
  };
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
