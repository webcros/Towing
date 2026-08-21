import { JwtService } from '@nestjs/jwt';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { loadEnv, type Env } from '../config/env';
import { loadDotenv } from '../config/load-dotenv';
import * as schema from '../db/schema';
import { bookings, dispatchAttempts, drivers, serviceZones, services, users } from '../db/schema';
import { driverGeoKey, driverHashKey } from '../redis/redis.constants';

/**
 * §6.10's time-to-match, MEASURED against a live backend. `pnpm bench:dispatch`.
 *
 * WHY A SCRIPT AND NOT A TEST. The target — p50 under 30 s, p90 under 90 s — is
 * a claim about a system with real queue latency, real twenty-second offer
 * timeouts and real concurrency. The suite runs with `QUEUE_ENABLED=false` and
 * calls `runWave` directly, which is right for proving the LOGIC and tells you
 * nothing about the LATENCY. This drives the whole path: `POST /v1/bookings` →
 * BullMQ delayed jobs → waves → `POST /v1/jobs/:id/accept`.
 *
 * THE ACCEPT RATE IS THE PARAMETER THAT MATTERS. A marketplace where every
 * driver accepts instantly matches on wave 1 every time and proves nothing;
 * `--accept-rate=0.3` makes most offers time out, which is what actually
 * exercises the ladder and the deadline.
 *
 * ⚠ Writes to whatever `DATABASE_URL` points at. Dev stack only.
 *
 * Prerequisites:
 *   pnpm db:reset
 *   QUEUE_ENABLED=true pnpm backend      # the workers must actually be running
 */

interface BenchArgs {
  bookings: number;
  drivers: number;
  acceptRate: number;
  timeoutSec: number;
  radiusKm: number;
  seed: number;
}

const DEFAULTS: BenchArgs = {
  bookings: 10,
  drivers: 40,
  acceptRate: 0.5,
  timeoutSec: 200,
  radiusKm: 2,
  seed: 20_260_819,
};

const USAGE = [
  'bench-dispatch — §6.10 time-to-match against a LIVE backend',
  '',
  '  pnpm db:reset && QUEUE_ENABLED=true pnpm backend',
  '  pnpm bench:dispatch [options]',
  '',
  `  --bookings=N      concurrent searches         (default ${DEFAULTS.bookings})`,
  `  --drivers=N       online drivers to place     (default ${DEFAULTS.drivers})`,
  `  --accept-rate=F   fraction who accept, 0–1    (default ${DEFAULTS.acceptRate})`,
  `  --radius=KM       spread of drivers           (default ${DEFAULTS.radiusKm})`,
  `  --timeout=SEC     give up after               (default ${DEFAULTS.timeoutSec})`,
  `  --seed=N          PRNG seed                   (default ${DEFAULTS.seed})`,
  '  --help',
].join('\n');

/** Bengaluru (§2 persona city), inside the seeded zone polygon. */
const CENTRE = { lat: 12.9716, lng: 77.5946 };
const METERS_PER_DEG_LAT = 111_320;

function parseArgs(argv: readonly string[]): BenchArgs {
  const args = { ...DEFAULTS };
  for (const raw of argv) {
    const eqAt = raw.indexOf('=');
    const key = eqAt === -1 ? raw : raw.slice(0, eqAt);
    const value = eqAt === -1 ? undefined : Number(raw.slice(eqAt + 1));

    if (key === '--help') {
      console.log(USAGE);
      process.exit(0);
    }
    if (value === undefined || !Number.isFinite(value)) {
      throw new Error(`${key} expects a number — run with --help`);
    }

    if (key === '--bookings') args.bookings = value;
    else if (key === '--drivers') args.drivers = value;
    else if (key === '--accept-rate') args.acceptRate = value;
    else if (key === '--radius') args.radiusKm = value;
    else if (key === '--timeout') args.timeoutSec = value;
    else if (key === '--seed') args.seed = value;
    else throw new Error(`unknown argument "${raw}" — run with --help`);
  }
  return args;
}

/** mulberry32 — a fixed seed makes two runs comparable. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

/** Tokens signed the way `TokenService` signs them — no OTP round trip. */
function tokens(env: Env) {
  const jwt = new JwtService({ secret: env.JWT_ACCESS_SECRET });
  return {
    customer: (userId: string) =>
      jwt.signAsync({ sub: userId, role: 'customer' }, { expiresIn: env.JWT_ACCESS_TTL_SECONDS }),
    driver: (driverId: string) =>
      jwt.signAsync(
        { sub: driverId, role: 'driver', kyc_status: 'approved' },
        { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
      ),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadDotenv();
  const env = loadEnv();
  const rng = createRng(args.seed);
  const sign = tokens(env);
  const api = env.PUBLIC_API_URL;

  const client = postgres(env.DATABASE_URL, { max: 10, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema });
  const redis = new Redis(env.REDIS_URL);
  redis.on('error', (error: Error) => console.error('[bench] redis:', error.message));

  const health = await fetch(`${api}/v1/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`[bench] no backend at ${api} — start it with QUEUE_ENABLED=true`);
    process.exit(1);
  }

  const [zone] = await db
    .select({ id: serviceZones.id })
    .from(serviceZones)
    .where(eq(serviceZones.isActive, true))
    .limit(1);
  const [service] = await db.select({ slug: services.slug }).from(services).limit(1);
  const roster = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(eq(drivers.kycStatus, 'approved'))
    .orderBy(drivers.id)
    .limit(args.drivers);
  if (!zone || !service || roster.length === 0) {
    console.error('[bench] seed data missing — run `pnpm db:reset` first');
    process.exit(1);
  }

  /**
   * FRESH CUSTOMERS, created here rather than borrowed from the seed.
   *
   * The first run of this script had every booking refused, and each refusal was
   * a §3.8 guard working exactly as specified: seeded customers carry
   * `completed` trips, so `blockOnUnpaidBalance` refuses them, and one customer
   * cannot hold N concurrent searches anyway. Working around those guards would
   * have meant disabling them; creating clean customers measures the matcher
   * without touching the rules in front of it.
   */
  const customers = await db
    .insert(users)
    .values(
      Array.from({ length: args.bookings }, (_, i) => ({
        mobile: `+9199${String(args.seed).slice(-4)}${String(i).padStart(4, '0')}`,
        name: `Bench Customer ${i + 1}`,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (customers.length < args.bookings) {
    console.error(
      `[bench] only created ${customers.length}/${args.bookings} customers — ` +
        'a previous run with this seed left rows behind; pass a different --seed',
    );
    process.exit(1);
  }

  console.log('[bench] §6.10 time-to-match');
  console.log(
    `[bench]   drivers      ${roster.length} within ${args.radiusKm} km` +
      // The seed has ten approved drivers; asking for more silently benches a
      // smaller marketplace than the flag says. `pnpm db:seed:load` scales it.
      (roster.length < args.drivers ? ` (asked for ${args.drivers} — run \`pnpm db:seed:load\` for more)` : ''),
  );
  console.log(`[bench]   bookings     ${args.bookings} concurrent`);
  console.log(`[bench]   accept rate  ${(args.acceptRate * 100).toFixed(0)}%`);
  console.log('');

  // ── Place every driver online, fresh, and in the candidate store ──────────
  // The full Phase 16 state: the matcher reads Redis first and Postgres second,
  // and a driver present in only one of them is not a realistic population.
  const spreadDeg = (args.radiusKm * 1000) / METERS_PER_DEG_LAT;
  const pipeline = redis.pipeline();
  for (const driver of roster) {
    const lat = CENTRE.lat + (rng() * 2 - 1) * spreadDeg;
    const lng = CENTRE.lng + (rng() * 2 - 1) * spreadDeg;
    pipeline.hset(driverHashKey(driver.id), {
      zoneId: zone.id,
      fleetId: '',
      truckId: '',
      vehicleClass: 'flatbed',
      longDistance: '0',
      seq: '1',
      lat: String(lat),
      lng: String(lng),
      headingDeg: '90',
      speedKph: '0',
      accuracyM: '8',
      at: new Date().toISOString(),
    });
    // Far longer than the 30s production TTL: nothing is re-pinging these
    // drivers, and a population that ages out mid-run would measure the
    // liveness filter rather than the matcher.
    pipeline.pexpire(driverHashKey(driver.id), 3_600_000);
    pipeline.geoadd(driverGeoKey(zone.id), lng, lat, driver.id);
  }
  await pipeline.exec();

  const driverIds = roster.map((d) => d.id);
  await db
    .update(drivers)
    .set({ isOnline: true, currentZoneId: zone.id, lastPingAt: new Date(), vehicleClass: 'flatbed' })
    .where(inArray(drivers.id, driverIds));

  // §3.2 excludes a driver already on a job, and the seed leaves several mid-trip
  // — without this the effective population is quietly smaller than reported.
  await db
    .update(bookings)
    .set({ status: 'paid' })
    .where(
      and(
        inArray(bookings.driverId, driverIds),
        inArray(bookings.status, ['assigned', 'en_route', 'arrived', 'in_progress']),
      ),
    );

  // ── Confirm the bookings through the REAL route ───────────────────────────
  // One customer each: §3.8 allows one active booking per customer, and that
  // guard is correct rather than something to work around.
  const startedAt = Date.now();
  const created: string[] = [];

  for (let i = 0; i < args.bookings; i += 1) {
    const customer = customers[i]!;
    const res = await fetch(`${api}/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await sign.customer(customer.id)}`,
        'Idempotency-Key': `bench-${args.seed}-${i}`,
      },
      body: JSON.stringify({
        serviceSlug: service.slug,
        vehicleClass: 'flatbed',
        pickup: {
          lat: CENTRE.lat + (rng() * 2 - 1) * spreadDeg * 0.3,
          lng: CENTRE.lng + (rng() * 2 - 1) * spreadDeg * 0.3,
        },
        pickupAddress: `Bench pickup ${i + 1}`,
        // A tow needs a destination — the catalogue row refuses without one,
        // which the first run of this script discovered the honest way.
        drop: { lat: 12.9345, lng: 77.6266 },
        dropAddress: 'Koramangala, Bengaluru',
      }),
    });

    if (!res.ok) {
      console.error(`[bench] booking ${i + 1} refused: ${res.status} ${await res.text()}`);
      continue;
    }
    created.push(((await res.json()) as { id: string }).id);
  }

  console.log(`[bench] ${created.length} searches started — driving driver responses…`);

  // ── Drive driver behaviour, and measure ───────────────────────────────────
  const matchedMs = new Map<string, number>();
  const handled = new Set<string>();
  const deadline = Date.now() + args.timeoutSec * 1_000;

  while (matchedMs.size < created.length && Date.now() < deadline) {
    const offers = await db
      .select({ bookingId: dispatchAttempts.bookingId, driverId: dispatchAttempts.driverId })
      .from(dispatchAttempts)
      .where(
        and(eq(dispatchAttempts.outcome, 'offered'), inArray(dispatchAttempts.bookingId, created)),
      );

    for (const offer of offers) {
      if (!offer.driverId) continue;
      const key = `${offer.bookingId}:${offer.driverId}`;
      if (handled.has(key)) continue;
      handled.add(key);

      // Below the rate: accept. Above it: stay silent and let the offer time
      // out, which is what makes the ladder and the deadline do real work.
      if (rng() >= args.acceptRate) continue;

      await fetch(`${api}/v1/jobs/${offer.bookingId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await sign.driver(offer.driverId)}` },
      }).catch(() => undefined);
    }

    const resolved = await db
      .select({ id: bookings.id, status: bookings.status, updatedAt: bookings.updatedAt })
      .from(bookings)
      .where(inArray(bookings.id, created));

    for (const row of resolved) {
      if (row.status !== 'searching' && !matchedMs.has(row.id)) {
        matchedMs.set(row.id, row.updatedAt.getTime() - startedAt);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const assigned = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(inArray(bookings.id, created), eq(bookings.status, 'assigned')));

  const assignedIds = new Set(assigned.map((row) => row.id));
  // ONLY successful matches count towards the target. A `no_drivers_found`
  // resolved fast, and folding it in would make a failing marketplace look like
  // a quick one.
  const durations = [...matchedMs.entries()]
    .filter(([id]) => assignedIds.has(id))
    .map(([, ms]) => ms)
    .sort((a, b) => a - b);

  console.log('');
  console.log('[bench] ── results ─────────────────────────────────────────');
  console.log(`[bench]   searches       ${created.length}`);
  console.log(`[bench]   assigned       ${assigned.length}`);
  console.log(`[bench]   no drivers     ${matchedMs.size - assigned.length}`);
  console.log(`[bench]   still running  ${created.length - matchedMs.size}`);
  if (durations.length > 0) {
    console.log(`[bench]   p50            ${(percentile(durations, 50) / 1000).toFixed(1)}s   (§6.10 target < 30s)`);
    console.log(`[bench]   p90            ${(percentile(durations, 90) / 1000).toFixed(1)}s   (§6.10 target < 90s)`);
    console.log(`[bench]   max            ${(durations[durations.length - 1]! / 1000).toFixed(1)}s`);
  } else {
    console.log('[bench]   no assignments — check the backend log for wave output');
  }

  await redis.quit();
  await client.end({ timeout: 5 });
}

main().catch((error: unknown) => {
  console.error('[bench] failed:', error);
  process.exit(1);
});
