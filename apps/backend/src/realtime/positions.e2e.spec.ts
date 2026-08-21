import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { PositionsSnapshotDto } from '@towing/api-contracts';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../common/errors/pg-errors';
import { bookings, drivers, fleetTrucks } from '../db/schema';
import { truckGeoKey, truckHashKey } from '../redis/redis.constants';
import { authHeaderFor, createTestApp } from '../test/app';
import {
  seedCustomer,
  seedDriver,
  seedFleet,
  setupTestDatabase,
  testDb,
  truncateAll,
  type TestDatabase,
} from '../test/db';
import { seedBooking, seedTruck } from '../test/fixtures';
import { closeTestRedis, flushTestRedis, testRedis } from '../test/redis';

/**
 * `GET /v1/fleet/realtime/positions` — the §18 resync source.
 *
 * The assertion that matters most is the tenancy one: Redis may only make a
 * Postgres-known truck fresher, never add a truck to the response.
 */

let app: INestApplication;
let db: TestDatabase;

async function snapshotFor(auth: string): Promise<PositionsSnapshotDto> {
  const res = await request(app.getHttpServer())
    .get('/v1/fleet/realtime/positions')
    .set('Authorization', auth)
    .expect(200);
  return res.body as PositionsSnapshotDto;
}

/** Writes the hot position hash the ping path maintains. */
async function writeHot(
  fleetId: string,
  truckId: string,
  position: { lat: number; lng: number; heading?: number; speedKph?: number; at?: string },
): Promise<void> {
  const at = position.at ?? new Date().toISOString();
  await testRedis().hset(truckHashKey(truckId), {
    fleetId,
    lat: String(position.lat),
    lng: String(position.lng),
    heading: String(position.heading ?? 90),
    speedKph: String(position.speedKph ?? 30),
    at,
  });
  await testRedis().geoadd(truckGeoKey(fleetId), position.lng, position.lat, truckId);
}

describe('realtime positions snapshot', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    db = testDb();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  it('serves the hot Redis position when one exists', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId, { plate: 'KA-01-HOT-0001' });
    await writeHot(fleetId, truckId, { lat: 12.34, lng: 77.65, heading: 210, speedKph: 42 });

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    expect(snapshot.degraded).toBe(false);
    const position = snapshot.positions.find((p) => p.truckId === truckId);
    expect(position).toMatchObject({
      plate: 'KA-01-HOT-0001',
      lat: 12.34,
      lng: 77.65,
      heading: 210,
      speedKph: 42,
      fromFallback: false,
    });
  });

  it('falls back to the persisted PostGIS position when Redis has nothing', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);
    const pingedAt = new Date('2026-08-05T09:00:00.000Z');
    await db.execute(sql`
      update fleet_trucks
      set current_location = ST_SetSRID(ST_MakePoint(77.11, 12.22), 4326)::geography,
          last_ping_at = ${pingedAt.toISOString()}
      where id = ${truckId}
    `);

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    const position = snapshot.positions.find((p) => p.truckId === truckId);
    expect(position).toMatchObject({ lat: 12.22, lng: 77.11, fromFallback: true });
    // Postgres stores the position, not the motion — a fallback marker is
    // honestly still rather than confidently pointing somewhere.
    expect(position?.heading).toBeNull();
    expect(position?.at).toBe(pingedAt.toISOString());
  });

  it('reports a truck that has never pinged with a null position, not an omission', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    const position = snapshot.positions.find((p) => p.truckId === truckId);
    expect(position).toBeDefined();
    expect(position?.lat).toBeNull();
    expect(position?.at).toBeNull();
  });

  it('never lets a foreign truck in Redis reach this tenant’s snapshot', async () => {
    const [a, b] = await Promise.all([seedFleet(db, `A ${randomUUID().slice(0, 8)}`), seedFleet(db, `B ${randomUUID().slice(0, 8)}`)]);
    const truckA = await seedTruck(db, a.fleetId);
    const truckB = await seedTruck(db, b.fleetId);

    await writeHot(a.fleetId, truckA, { lat: 12.1, lng: 77.1 });
    // Fleet B's truck planted directly in fleet A's GEO set — a poisoned or
    // stale key. Reading the GEO set first is exactly how this would leak.
    await writeHot(b.fleetId, truckB, { lat: 12.9, lng: 77.9 });
    await testRedis().geoadd(truckGeoKey(a.fleetId), 77.9, 12.9, truckB);

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId: a.ownerId, fleetId: a.fleetId }));

    expect(snapshot.positions.map((p) => p.truckId)).toEqual([truckA]);
  });

  it('read-repairs GEO members whose position hash has expired', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);

    // The state left behind by a truck that stopped pinging: GEO member alive
    // (members carry no TTL), hash gone.
    await testRedis().geoadd(truckGeoKey(fleetId), 77.5, 12.5, truckId);
    expect(await testRedis().zcard(truckGeoKey(fleetId))).toBe(1);

    await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    await expect(testRedis().zcard(truckGeoKey(fleetId))).resolves.toBe(0);
  });

  it('marks a truck whose driver is on an active booking', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);
    const driverId = await seedDriver(db, { fleetId });
    await db.update(drivers).set({ assignedTruckId: truckId }).where(eq(drivers.id, driverId));

    const bookingId = await seedBooking(db, { userId, fleetId, driverId, status: 'en_route' });

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    const position = snapshot.positions.find((p) => p.truckId === truckId);
    expect(position?.activeBookingId).toBe(bookingId);
    expect(position?.driverName).not.toBeNull();
    // §9.3.3 "active job routes": the map draws a straight truck→pickup→drop
    // leg. `seedBooking` sets pickup 12.97/77.59 and leaves drop null.
    expect(position?.activeJobLeg).toEqual({
      pickup: { lat: 12.97, lng: 77.59 },
      drop: null,
    });
  });

  it('carries the drop point when the job has a destination', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);
    const driverId = await seedDriver(db, { fleetId });
    await db.update(drivers).set({ assignedTruckId: truckId }).where(eq(drivers.id, driverId));
    const bookingId = await seedBooking(db, { userId, fleetId, driverId, status: 'in_progress' });
    await db
      .update(bookings)
      .set({ dropLat: 12.88, dropLng: 77.71 })
      .where(eq(bookings.id, bookingId));

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    expect(snapshot.positions.find((p) => p.truckId === truckId)?.activeJobLeg?.drop).toEqual({
      lat: 12.88,
      lng: 77.71,
    });
  });

  it('has no job leg when the truck is idle', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    expect(snapshot.positions.find((p) => p.truckId === truckId)?.activeJobLeg).toBeNull();
  });

  it('leaves activeBookingId null for a completed job', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);
    const driverId = await seedDriver(db, { fleetId });
    await db.update(drivers).set({ assignedTruckId: truckId }).where(eq(drivers.id, driverId));
    await seedBooking(db, { userId, fleetId, driverId, status: 'completed' });

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    expect(snapshot.positions.find((p) => p.truckId === truckId)?.activeBookingId).toBeNull();
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/v1/fleet/realtime/positions').expect(401);
  });

  it('emits one row per truck even when the driver join could duplicate', async () => {
    const { fleetId, ownerId: userId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId);
    const driverId = await seedDriver(db, { fleetId });
    await db.update(drivers).set({ assignedTruckId: truckId }).where(eq(drivers.id, driverId));
    /**
     * ⚠ THIS FIXTURE CHANGED IN PHASE 17, and the reason is worth keeping.
     *
     * It used to give one driver TWO ACTIVE bookings for two different
     * customers — exactly the shape that would duplicate a truck row through the
     * left join. Migration 0014 added `uq_bookings_one_active_per_driver`
     * (§19.4's "unique constraints as the final backstop" for the dispatch
     * engine) and that state can no longer be inserted at all: the old fixture
     * started failing on the constraint, which is the index doing its job.
     *
     * The dedupe in `PositionsRepo.trucksFor` is still correct and still worth
     * asserting — one active booking plus a finished one drives the same join
     * and the same status filter. The now-impossible case is asserted directly
     * in the test below rather than deleted.
     */
    await seedBooking(db, { userId: await seedCustomer(db), fleetId, driverId, status: 'assigned' });
    await seedBooking(db, { userId: await seedCustomer(db), fleetId, driverId, status: 'completed' });

    const snapshot = await snapshotFor(await authHeaderFor(app, { userId, fleetId }));

    // One truck must never render as two markers.
    expect(snapshot.positions.filter((p) => p.truckId === truckId)).toHaveLength(1);
    // ...and it is the ACTIVE booking that surfaced, not the completed one.
    expect(snapshot.positions.find((p) => p.truckId === truckId)?.activeBookingId).not.toBeNull();
    expect(await db.select().from(fleetTrucks).where(eq(fleetTrucks.fleetId, fleetId))).toHaveLength(1);
  });

  it('refuses to put one driver on two active jobs at all (migration 0014)', async () => {
    /**
     * The backstop whose absence the fixture above used to rely on.
     *
     * `OfferService.accept` takes `SELECT … FOR UPDATE` on the BOOKING row,
     * which serialises two drivers racing the same job — but it does nothing
     * about one driver accepting two DIFFERENT bookings in the same instant,
     * because those are two rows and neither transaction sees the other. The
     * Redis offer lock makes that vanishingly unlikely; this index makes it
     * impossible, and a driver committed to two customers at once is a state no
     * amount of application care should be the only thing preventing.
     */
    const { fleetId } = await seedFleet(db, `Fleet ${randomUUID().slice(0, 8)}`);
    const driverId = await seedDriver(db, { fleetId });

    await seedBooking(db, { userId: await seedCustomer(db), fleetId, driverId, status: 'assigned' });

    // `isUniqueViolation` rather than a message match: drizzle wraps the driver
    // error, so the constraint name sits on `cause` and the outer `message` is
    // the whole failed SQL statement. That helper is the codebase's existing
    // answer to exactly this, and it is what the service layer uses.
    const second = await seedBooking(db, {
      userId: await seedCustomer(db),
      fleetId,
      driverId,
      status: 'en_route',
    }).catch((error: unknown) => error);

    expect(isUniqueViolation(second)).toBe(true);
    expect(String((second as { cause?: { constraint_name?: string } }).cause?.constraint_name)).toBe(
      'uq_bookings_one_active_per_driver',
    );
  });
});
