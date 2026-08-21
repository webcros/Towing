// Shares the presence thresholds with the real pipeline rather than redeclaring
// them, for the reason `simulate-locations.ts` states: a simulator whose ageing
// maths disagrees with the gateway's is a simulator that proves nothing.
import { DRIVER_HASH_TTL_MS, PING_CADENCE } from '@towing/api-contracts';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { loadEnv } from '../config/env';
import { loadDotenv } from '../config/load-dotenv';
import type { LatLng } from '../db/geography';
import * as schema from '../db/schema';
import { drivers, serviceZones } from '../db/schema';
// Key and channel constants come from the constants file rather than
// RedisModule (which re-exports them) so a tsx script does not pull in the Nest
// module graph. Sharing them is what stops the simulator and the real ping path
// from drifting.
import {
  DRIVER_LOCATION_CHANNEL,
  LOCATION_CHANNEL,
  driverGeoKey,
  driverHashKey,
  truckGeoKey,
  truckHashKey,
} from '../redis/redis.constants';

/**
 * Fake driver supply for a seeded database. Run with `pnpm sim:drivers`.
 *
 * THE SIBLING OF `sim:locations`, AND NOT A REPLACEMENT FOR IT. That one drives
 * fleet TRUCKS and writes `trucks:online:{fleetId}` — the shape Phase 5's
 * console map consumes. This one drives approved DRIVERS and writes
 * `drivers:online:{zoneId}` — §6.1's candidate store, the thing Phase 17's
 * matcher reads. Both keys exist in production and both are written by every
 * real ping; running either simulator alone exercises one half.
 *
 * IT EXISTS SO PHASE 17 IS NOT BLOCKED ON HARDWARE. A progressive-radius search
 * cannot be developed, let alone load-tested against the §6.10 p50 < 30 s
 * target, with the zero physical handsets this project has. `--drivers=200`
 * produces the supply that makes the wave ladder mean something.
 *
 * IT WRITES THE SAME FOUR THINGS THE PIPELINE DOES — driver GEO set, driver
 * hash, driver-shaped publish, and the fleet translation — deliberately
 * duplicating `LocationIngestService` rather than importing it. The duplication
 * is the test: if the two ever disagree about what a ping leaves behind, the
 * `sim:drivers` fixture stops matching production and the matcher developed
 * against it is developed against a fiction. Keep them in step.
 */

interface SimArgs {
  drivers: number;
  intervalMs: number;
  dbIntervalMs: number;
  roamKm: number;
  seed: number;
  durationSec: number;
  /** Stop pinging a fraction of drivers, to exercise the liveness filter. */
  stalePct: number;
}

const DEFAULTS: SimArgs = {
  drivers: 25,
  intervalMs: PING_CADENCE.idleMs,
  dbIntervalMs: 30_000,
  roamKm: 5,
  seed: 4242,
  durationSec: 0,
  stalePct: 0,
};

const USAGE = [
  'simulate-drivers — drives seeded approved drivers into §6.1’s candidate store',
  '',
  '  pnpm sim:drivers [options]',
  '',
  `  --drivers=N      approved drivers to drive     (default ${DEFAULTS.drivers})`,
  `  --interval=MS    ping cadence per driver       (default ${DEFAULTS.intervalMs})`,
  `  --db-interval=MS Postgres flush cadence        (default ${DEFAULTS.dbIntervalMs})`,
  `  --roam=KM        leash radius from origin      (default ${DEFAULTS.roamKm})`,
  `  --seed=N         PRNG seed                     (default ${DEFAULTS.seed})`,
  `  --stale-pct=N    % of drivers that stop pinging after 30s (default ${DEFAULTS.stalePct})`,
  '  --duration=SEC   stop after SEC seconds        (default: until Ctrl-C)',
  '  --help',
].join('\n');

const MIN_SPEED_KPH = 15;
const MAX_SPEED_KPH = 55;
const SPEED_DRIFT_KPH = 6;
const MAX_TURN_DEG = 15;
const METERS_PER_DEG_LAT = 111_320;

/** Bengaluru (§2 persona city) — only for a driver the seed left without a location. */
const FALLBACK_ORIGIN: LatLng = { lat: 12.9716, lng: 77.5946 };
const FALLBACK_SPREAD_KM = 4;

/** How long a `--stale-pct` driver pings before going quiet, in ms. */
const STALE_AFTER_MS = 30_000;

interface DriverSim {
  id: string;
  name: string;
  zoneId: string;
  fleetId: string | null;
  truckId: string | null;
  vehicleClass: string | null;
  longDistance: boolean;
  origin: LatLng;
  lat: number;
  lng: number;
  headingDeg: number;
  speedKph: number;
  seq: number;
  at: Date;
  dirty: boolean;
  /** Chosen up front from the seeded PRNG so a run is reproducible. */
  goesStale: boolean;
}

interface Stats {
  pings: number;
  flushes: number;
  rowsWritten: number;
  skippedTicks: number;
  errors: number;
}

function parseArgs(argv: readonly string[]): SimArgs {
  const args: SimArgs = { ...DEFAULTS };

  for (const raw of argv) {
    const eqAt = raw.indexOf('=');
    const key = eqAt === -1 ? raw : raw.slice(0, eqAt);
    const value = eqAt === -1 ? undefined : raw.slice(eqAt + 1);

    switch (key) {
      case '--help':
        console.log(USAGE);
        process.exit(0);
        break;
      case '--drivers':
        args.drivers = numeric(key, value, 1);
        break;
      case '--interval':
        args.intervalMs = numeric(key, value, 50);
        break;
      case '--db-interval':
        args.dbIntervalMs = numeric(key, value, 500);
        break;
      case '--roam':
        args.roamKm = numeric(key, value, 0.1);
        break;
      case '--seed':
        args.seed = numeric(key, value, 0);
        break;
      case '--stale-pct':
        args.stalePct = numeric(key, value, 0);
        break;
      case '--duration':
        args.durationSec = numeric(key, value, 1);
        break;
      default:
        throw new Error(`unknown argument "${raw}" — run with --help`);
    }
  }

  return args;
}

function numeric(key: string, value: string | undefined, min: number): number {
  const parsed = Number(value);
  if (value === undefined || !Number.isFinite(parsed) || parsed < min) {
    throw new Error(`${key} expects a number >= ${min}, got "${value ?? ''}"`);
  }
  return parsed;
}

/** mulberry32 — same generator as `simulate-locations.ts`, so a seed replays a run. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;
const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const round = (value: number, places: number) => Number(value.toFixed(places));

function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  const dLng = (b.lng - a.lng) * METERS_PER_DEG_LAT * Math.cos(toRad((a.lat + b.lat) / 2));
  return Math.hypot(dLat, dLng);
}

function bearingDeg(from: LatLng, to: LatLng): number {
  const dLat = to.lat - from.lat;
  const dLng = (to.lng - from.lng) * Math.cos(toRad((from.lat + to.lat) / 2));
  return wrap360(toDeg(Math.atan2(dLng, dLat)));
}

/** One tick: wander the heading, drift the speed, re-aim at the origin at the leash. */
function advance(driver: DriverSim, args: SimArgs, rng: () => number): void {
  const jitter = () => rng() * 2 - 1;

  driver.speedKph = Math.min(
    MAX_SPEED_KPH,
    Math.max(MIN_SPEED_KPH, driver.speedKph + jitter() * SPEED_DRIFT_KPH),
  );
  driver.headingDeg = wrap360(driver.headingDeg + jitter() * MAX_TURN_DEG);

  const meters = (driver.speedKph * 1000 * args.intervalMs) / 3_600_000;
  const heading = toRad(driver.headingDeg);

  driver.lat += (meters * Math.cos(heading)) / METERS_PER_DEG_LAT;
  driver.lng += (meters * Math.sin(heading)) / (METERS_PER_DEG_LAT * Math.cos(toRad(driver.lat)));

  if (metersBetween(driver, driver.origin) > args.roamKm * 1000) {
    driver.headingDeg = wrap360(bearingDeg(driver, driver.origin) + jitter() * 25);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  loadDotenv();
  const env = loadEnv();
  const rng = createRng(args.seed);

  const client = postgres(env.DATABASE_URL, { max: 4, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema });

  const stats: Stats = { pings: 0, flushes: 0, rowsWritten: 0, skippedTicks: 0, errors: 0 };

  const redis = new Redis(env.REDIS_URL);
  redis.on('error', (error: Error) => {
    stats.errors += 1;
    console.error('[sim] redis:', error.message);
  });

  // APPROVED ONLY. §3.1 makes approval a precondition of going online, so a
  // simulator that put a `pending` driver in the candidate store would be
  // manufacturing supply the real system refuses to create — and Phase 17 would
  // be developed against a population it will never see.
  const rows = await db
    .select({
      id: drivers.id,
      name: drivers.name,
      fleetId: drivers.fleetId,
      truckId: drivers.assignedTruckId,
      vehicleClass: drivers.vehicleClass,
      longDistance: drivers.longDistanceEnabled,
      currentLocation: drivers.currentLocation,
    })
    .from(drivers)
    .where(and(eq(drivers.kycStatus, 'approved'), isNotNull(drivers.mobile)))
    .orderBy(drivers.id)
    .limit(args.drivers);

  if (rows.length === 0) {
    console.error('[sim] no approved drivers found — run `pnpm db:seed` first');
    await redis.quit();
    await client.end({ timeout: 5 });
    process.exit(1);
  }

  const zones = await db
    .select({ id: serviceZones.id, name: serviceZones.name })
    .from(serviceZones)
    .where(eq(serviceZones.isActive, true))
    .orderBy(serviceZones.id);

  if (zones.length === 0) {
    console.error('[sim] no active service_zones — the candidate store is partitioned by zone');
    await redis.quit();
    await client.end({ timeout: 5 });
    process.exit(1);
  }

  const startedAt = Date.now();
  const fleet: DriverSim[] = rows.map((row, index) => {
    const spreadDeg = (FALLBACK_SPREAD_KM * 1000) / METERS_PER_DEG_LAT;
    const origin = row.currentLocation ?? {
      lat: FALLBACK_ORIGIN.lat + (rng() * 2 - 1) * spreadDeg,
      lng: FALLBACK_ORIGIN.lng + (rng() * 2 - 1) * spreadDeg,
    };

    return {
      id: row.id,
      name: row.name ?? row.id.slice(0, 8),
      // Round-robin rather than point-in-polygon: the seeded drivers' fallback
      // origins are not guaranteed to sit inside any polygon, and a simulator
      // that silently dropped half its population for being "outside every zone"
      // would look like a bug in the matcher rather than in the fixture.
      zoneId: zones[index % zones.length]!.id,
      fleetId: row.fleetId,
      truckId: row.truckId,
      vehicleClass: row.vehicleClass,
      longDistance: row.longDistance,
      origin,
      lat: origin.lat,
      lng: origin.lng,
      headingDeg: rng() * 360,
      speedKph: MIN_SPEED_KPH + rng() * (MAX_SPEED_KPH - MIN_SPEED_KPH),
      seq: 0,
      at: new Date(startedAt),
      dirty: false,
      goesStale: rng() * 100 < args.stalePct,
    };
  });

  console.log('[sim] simulate-drivers starting');
  console.log(`[sim]   drivers    ${fleet.length} approved, across ${zones.length} zone(s)`);
  console.log(`[sim]   postgres   ${new URL(env.DATABASE_URL).host} (flush every ${args.dbIntervalMs}ms)`);
  console.log(`[sim]   redis      ${new URL(env.REDIS_URL).host} → GEOADD ${driverGeoKey('{zoneId}')}, publish ${DRIVER_LOCATION_CHANNEL}`);
  console.log(`[sim]   cadence    1 ping / driver / ${args.intervalMs}ms  ·  roam leash ${args.roamKm}km  ·  seed ${args.seed}`);
  if (args.stalePct > 0) {
    const stale = fleet.filter((d) => d.goesStale).length;
    console.log(`[sim]   stale      ${stale} driver(s) stop pinging after ${STALE_AFTER_MS / 1000}s (liveness filter fixture)`);
  }
  const withTruck = fleet.filter((d) => d.fleetId && d.truckId).length;
  console.log(`[sim]   fleet map  ${withTruck}/${fleet.length} are fleet-affiliated with an assigned truck and will appear on a fleet map`);

  // Mark them online in Postgres so the §19.2 PostGIS fallback and the fleet
  // console agree with Redis. Without this the degraded path finds nobody while
  // the hot path finds everyone, which reads as a Redis bug.
  await db
    .update(drivers)
    .set({ isOnline: true, updatedAt: new Date() })
    .where(sql`${drivers.id} in ${sql.raw(`(${fleet.map((d) => `'${d.id}'`).join(',')})`)}`);

  async function publishTick(): Promise<void> {
    const at = new Date();
    const elapsed = at.getTime() - startedAt;
    const pipeline = redis.pipeline();
    let pinged = 0;

    for (const driver of fleet) {
      if (driver.goesStale && elapsed > STALE_AFTER_MS) continue;

      advance(driver, args, rng);
      driver.at = at;
      driver.dirty = true;
      driver.seq += 1;
      pinged += 1;

      const lat = round(driver.lat, 6);
      const lng = round(driver.lng, 6);
      const headingDeg = round(driver.headingDeg, 1);
      const speedKph = round(driver.speedKph, 1);
      const iso = at.toISOString();

      // 1 & 2 — the candidate store: zone GEO set + the per-driver hot hash.
      pipeline.geoadd(driverGeoKey(driver.zoneId), lng, lat, driver.id);
      pipeline.hset(driverHashKey(driver.id), {
        zoneId: driver.zoneId,
        fleetId: driver.fleetId ?? '',
        truckId: driver.truckId ?? '',
        vehicleClass: driver.vehicleClass ?? '',
        longDistance: driver.longDistance ? '1' : '0',
        seq: String(driver.seq),
        lat: String(lat),
        lng: String(lng),
        headingDeg: String(headingDeg),
        speedKph: String(speedKph),
        accuracyM: '8',
        at: iso,
      });
      pipeline.pexpire(driverHashKey(driver.id), DRIVER_HASH_TTL_MS);

      // 3 — the driver-shaped fan-out (Phase 18's tracking consumes this).
      pipeline.publish(
        DRIVER_LOCATION_CHANNEL,
        JSON.stringify({
          driverId: driver.id,
          zoneId: driver.zoneId,
          fleetId: driver.fleetId,
          lat,
          lng,
          headingDeg,
          speedKph,
          accuracyM: 8,
          lowAccuracy: false,
          seq: driver.seq,
          at: iso,
        }),
      );

      // 4 — the fleet translation, so the Phase 5 console map shows a real
      // human. Only reachable for a fleet-affiliated driver with an assigned
      // truck, exactly as `FleetFanoutAdapter` requires.
      if (driver.fleetId && driver.truckId) {
        pipeline.publish(
          LOCATION_CHANNEL,
          JSON.stringify({
            truckId: driver.truckId,
            fleetId: driver.fleetId,
            lat,
            lng,
            heading: headingDeg,
            speedKph,
            at: iso,
          }),
        );
        pipeline.geoadd(truckGeoKey(driver.fleetId), lng, lat, driver.truckId);
        pipeline.hset(truckHashKey(driver.truckId), {
          fleetId: driver.fleetId,
          lat: String(lat),
          lng: String(lng),
          heading: String(headingDeg),
          speedKph: String(speedKph),
          at: iso,
        });
        pipeline.pexpire(truckHashKey(driver.truckId), DRIVER_HASH_TTL_MS);
      }
    }

    await pipeline.exec();
    stats.pings += pinged;
  }

  /** The slow authoritative write — `DriverPresenceRepo.flushPositions` by hand. */
  async function flushToPostgres(): Promise<void> {
    const pending = fleet.filter((driver) => driver.dirty);
    if (pending.length === 0) return;

    const values = pending.map(
      (driver) =>
        // toISOString: raw `sql` params bypass drizzle's column mapping, and
        // postgres.js Bind rejects a bare Date (engineering note 4).
        sql`(${driver.id}::uuid, ${driver.lng}::double precision, ${driver.lat}::double precision, ${driver.at.toISOString()}::timestamptz, ${driver.zoneId}::uuid)`,
    );

    await db.execute(sql`
      update drivers as d
      set current_location = ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography,
          last_ping_at = v.at,
          current_zone_id = v.zone_id,
          is_online = true,
          updated_at = now()
      from (values ${sql.join(values, sql`, `)}) as v(id, lng, lat, at, zone_id)
      where d.id = v.id
    `);

    for (const driver of pending) driver.dirty = false;
    stats.flushes += 1;
    stats.rowsWritten += pending.length;

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    console.log(
      `[sim] t+${elapsed}s · ${stats.pings} pings · flush #${stats.flushes} (${pending.length} drivers) · ${stats.errors} errors`,
    );
  }

  const onError = (label: string) => (error: unknown) => {
    stats.errors += 1;
    console.error(`[sim] ${label} failed:`, error instanceof Error ? error.message : error);
  };

  let publishing = false;
  const pingTimer = setInterval(() => {
    // A slow Redis round trip must not queue ticks behind each other; a skipped
    // tick is honest backpressure, a backlog is a memory leak.
    if (publishing) {
      stats.skippedTicks += 1;
      return;
    }
    publishing = true;
    void publishTick()
      .catch(onError('publish'))
      .finally(() => {
        publishing = false;
      });
  }, args.intervalMs);

  let flushing = false;
  const dbTimer = setInterval(() => {
    if (flushing) return;
    flushing = true;
    void flushToPostgres()
      .catch(onError('db flush'))
      .finally(() => {
        flushing = false;
      });
  }, args.dbIntervalMs);

  let stopping = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (stopping) return;
    stopping = true;

    clearInterval(pingTimer);
    clearInterval(dbTimer);

    console.log(`\n[sim] ${reason} — flushing and taking drivers offline`);
    await flushToPostgres().catch(onError('final flush'));

    // Leaving drivers online in Postgres with an expiring Redis hash is exactly
    // the phantom-supply state the real go-offline path exists to prevent, and
    // it would poison the next run's §19.2 fallback for a full stale window.
    const evict = redis.pipeline();
    for (const driver of fleet) {
      evict.zrem(driverGeoKey(driver.zoneId), driver.id);
      evict.del(driverHashKey(driver.id));
    }
    await evict.exec().catch(onError('redis evict'));

    await db
      .update(drivers)
      .set({ isOnline: false, currentZoneId: null, updatedAt: new Date() })
      .where(sql`${drivers.id} in ${sql.raw(`(${fleet.map((d) => `'${d.id}'`).join(',')})`)}`)
      .catch(onError('offline'));

    await redis.quit().catch(onError('redis quit'));
    await client.end({ timeout: 5 }).catch(onError('postgres close'));

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    console.log(
      `[sim] stopped after ${elapsed}s · ${stats.pings} pings · ${stats.flushes} flushes (${stats.rowsWritten} rows) · ${stats.skippedTicks} skipped ticks · ${stats.errors} errors`,
    );
    process.exit(stats.errors > 0 ? 1 : 0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  if (args.durationSec > 0) {
    setTimeout(() => void shutdown(`duration ${args.durationSec}s reached`), args.durationSec * 1000);
  }

  console.log('[sim] running — Ctrl-C to stop');
}

main().catch((error: unknown) => {
  console.error('[sim] failed to start:', error);
  process.exit(1);
});
