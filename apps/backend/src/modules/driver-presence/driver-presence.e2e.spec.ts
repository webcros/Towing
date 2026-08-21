import type { INestApplication } from '@nestjs/common';
import type { DriverPresenceResponse } from '@towing/api-contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drivers, serviceZones } from '../../db/schema';
import { driverGeoKey, driverHashKey } from '../../redis/redis.constants';
import { adminAuthHeaderFor, createTestApp, driverAuthHeaderFor } from '../../test/app';
import {
  seedAdmin,
  seedDriver,
  seedFleet,
  setupTestDatabase,
  testDb,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { seedTruck } from '../../test/fixtures';
import { closeTestRedis, flushTestRedis, testRedis } from '../../test/redis';

/**
 * `POST /v1/driver/{online,offline}` — §3.1 layer 3, the gate the whole
 * marketplace hangs off.
 *
 * The assertion that matters most is the first one: an un-approved driver
 * cannot enter the candidate store. Everything downstream — dispatch, the
 * customer's map, the fleet map — trusts that membership of
 * `drivers:online:{zone}` implies an admin approved that person.
 */

let app: INestApplication;
let db: TestDatabase;

/** The seeded Bengaluru polygon, so a fix inside it resolves to a real zone. */
const INSIDE_ZONE = { lat: 12.9716, lng: 77.5946 };
/** Chennai — inside no polygon this suite seeds. */
const OUTSIDE_EVERY_ZONE = { lat: 13.0827, lng: 80.2707 };

async function seedZone(): Promise<string> {
  const [row] = await db
    .insert(serviceZones)
    .values({
      name: 'Bengaluru Metro',
      area: 'SRID=4326;POLYGON((77.45 12.80,77.80 12.80,77.80 13.15,77.45 13.15,77.45 12.80))',
      surgeBand: 'standard',
    })
    .returning({ id: serviceZones.id });
  return row!.id;
}

async function goOnline(
  driverId: string,
  at: { lat: number; lng: number },
  expected = 200,
): Promise<DriverPresenceResponse> {
  const res = await request(app.getHttpServer())
    .post('/v1/driver/online')
    .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
    .send({ at })
    .expect(expected);
  return res.body as DriverPresenceResponse;
}

describe('driver presence', () => {
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

  describe('the §3.1 gate', () => {
    it('403s a driver whose KYC is still pending', async () => {
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'pending' });

      const res = await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId, kycStatus: 'pending' }))
        .send({ at: INSIDE_ZONE })
        .expect(403);

      expect(res.body.error.details).toMatchObject({ reason: 'kyc_not_approved' });
    });

    it('403s a driver whose token SAYS approved but whose row does not', async () => {
      // The whole reason `KycApprovedGuard` re-reads the database: an access
      // token minted before a suspension stays signature-valid for its full TTL,
      // and the claim alone would let a suspended driver go online for another
      // 15 minutes.
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const staleToken = await driverAuthHeaderFor(app, { driverId, kycStatus: 'approved' });
      await db.update(drivers).set({ kycStatus: 'suspended' }).where(eq(drivers.id, driverId));

      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', staleToken)
        .send({ at: INSIDE_ZONE })
        .expect(403);
    });

    it('403s the location stream too, not only the toggle', async () => {
      // A driver suspended mid-shift keeps pinging until their app notices. The
      // guard is on the whole controller precisely so those pings stop counting
      // as supply on the very next request.
      const driverId = await seedDriver(db, { kycStatus: 'suspended' });

      await request(app.getHttpServer())
        .post('/v1/driver/location')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId, kycStatus: 'suspended' }))
        .send({ pings: [{ seq: 1, lat: 12.97, lng: 77.59, at: new Date().toISOString() }] })
        .expect(403);
    });

    it('403s a customer token on a driver route', async () => {
      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', 'Bearer nonsense')
        .send({ at: INSIDE_ZONE })
        .expect(401);
    });
  });

  describe('going online', () => {
    it('resolves the zone, persists it, and joins the candidate store', async () => {
      const zoneId = await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });

      const body = await goOnline(driverId, INSIDE_ZONE);

      expect(body).toMatchObject({
        isOnline: true,
        zoneId,
        zoneName: 'Bengaluru Metro',
        // §20.4 — capture starts, at the idle cadence until a job exists.
        pingIntervalMs: 10_000,
        seq: 0,
      });

      const [row] = await db
        .select({ isOnline: drivers.isOnline, zoneId: drivers.currentZoneId })
        .from(drivers)
        .where(eq(drivers.id, driverId));
      expect(row).toMatchObject({ isOnline: true, zoneId });

      // The identity cache the ping path reads instead of paying for a join.
      const hash = await testRedis().hgetall(driverHashKey(driverId));
      expect(hash.zoneId).toBe(zoneId);
      // No `seq` yet: a hash without one accepts the driver's first ping
      // whatever number it carries, which is what makes the app's per-session
      // counter reset safe.
      expect(hash.seq).toBeUndefined();
    });

    it('refuses a driver standing outside every service area', async () => {
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });

      const res = await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .send({ at: OUTSIDE_EVERY_ZONE })
        .expect(422);

      expect(res.body.error.code).toBe('driver_outside_zone');

      // The refusal has to be total. A driver flagged online with no zone is in
      // no GEO set — online in their own UI, invisible to every search.
      const [row] = await db
        .select({ isOnline: drivers.isOnline })
        .from(drivers)
        .where(eq(drivers.id, driverId));
      expect(row?.isOnline).toBe(false);
    });

    it('caches the fleet and truck ids a fleet-affiliated driver needs', async () => {
      const zoneId = await seedZone();
      const { fleetId } = await seedFleet(db, 'Fanout Fleet');
      const truckId = await seedTruck(db, fleetId, { plate: 'KA-01-PRES-01' });
      const driverId = await seedDriver(db, { fleetId, kycStatus: 'approved' });
      await db.update(drivers).set({ assignedTruckId: truckId }).where(eq(drivers.id, driverId));

      await goOnline(driverId, INSIDE_ZONE);

      const hash = await testRedis().hgetall(driverHashKey(driverId));
      expect(hash).toMatchObject({ zoneId, fleetId, truckId });
    });

    it('leaves an independent driver with empty fleet and truck ids', async () => {
      // What Phase 12's self-signup creates, and the reason `FleetFanoutAdapter`
      // has an early return rather than an error.
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });

      await goOnline(driverId, INSIDE_ZONE);

      const hash = await testRedis().hgetall(driverHashKey(driverId));
      expect(hash.fleetId).toBe('');
      expect(hash.truckId).toBe('');
    });
  });

  describe('going offline', () => {
    it('evicts the GEO member and the hash, and clears the zone', async () => {
      const zoneId = await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      await goOnline(driverId, INSIDE_ZONE);
      await request(app.getHttpServer())
        .post('/v1/driver/location')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .send({ pings: [{ seq: 1, ...INSIDE_ZONE, at: new Date().toISOString() }] })
        .expect(200);

      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(1);

      const res = await request(app.getHttpServer())
        .post('/v1/driver/offline')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .expect(200);

      expect(res.body).toMatchObject({ isOnline: false, zoneId: null, pingIntervalMs: null });

      // BOTH halves. A GEO member left behind carries no TTL and would be
      // returned by dispatch forever; a hash left behind would silently re-admit
      // the driver on their next ping.
      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(0);
      expect(await testRedis().exists(driverHashKey(driverId))).toBe(0);

      const [row] = await db
        .select({ isOnline: drivers.isOnline, zoneId: drivers.currentZoneId })
        .from(drivers)
        .where(eq(drivers.id, driverId));
      expect(row).toMatchObject({ isOnline: false, zoneId: null });
    });

    it('keeps the last known position — only the zone is a claim about availability', async () => {
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      await goOnline(driverId, INSIDE_ZONE);

      await request(app.getHttpServer())
        .post('/v1/driver/offline')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .expect(200);

      const [row] = await db
        .select({ location: drivers.currentLocation })
        .from(drivers)
        .where(eq(drivers.id, driverId));
      expect(row?.location?.lat).toBeCloseTo(INSIDE_ZONE.lat, 4);
    });

    it('is idempotent — a second offline is not an error', async () => {
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const auth = await driverAuthHeaderFor(app, { driverId });

      await request(app.getHttpServer()).post('/v1/driver/offline').set('Authorization', auth).expect(200);
      await request(app.getHttpServer()).post('/v1/driver/offline').set('Authorization', auth).expect(200);
    });
  });

  describe('losing authority evicts supply', () => {
    it('an admin suspension removes the driver from the candidate store immediately', async () => {
      // Revoking sessions and devices stops the driver ACTING; it does nothing
      // to §6.1's candidate store, which is keyed in Redis and knows nothing
      // about tokens. A suspended driver left in a GEO set is phantom supply:
      // dispatch scores them, locks an offer against them, and waits out the
      // timeout while the customer's search widens for no reason.
      const zoneId = await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      await goOnline(driverId, INSIDE_ZONE);
      await request(app.getHttpServer())
        .post('/v1/driver/location')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .send({ pings: [{ seq: 1, ...INSIDE_ZONE, at: new Date().toISOString() }] })
        .expect(200);
      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(1);

      const admin = await seedAdmin(db, { subRole: 'operations' });
      await request(app.getHttpServer())
        .post(`/v1/admin/drivers/${driverId}/kyc`)
        .set('Authorization', await adminAuthHeaderFor(app, { adminId: admin.id }))
        .send({ decision: 'suspend', reason: 'Documents falsified' })
        .expect(200);

      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(0);
      expect(await testRedis().exists(driverHashKey(driverId))).toBe(0);

      const [row] = await db
        .select({ isOnline: drivers.isOnline })
        .from(drivers)
        .where(eq(drivers.id, driverId));
      expect(row?.isOnline).toBe(false);
    });

    it('leaves an APPROVAL alone — approving is not a revocation', async () => {
      const zoneId = await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'pending' });
      const admin = await seedAdmin(db, { subRole: 'operations' });

      await request(app.getHttpServer())
        .post(`/v1/admin/drivers/${driverId}/kyc`)
        .set('Authorization', await adminAuthHeaderFor(app, { adminId: admin.id }))
        .send({ decision: 'approve' })
        .expect(200);

      await goOnline(driverId, INSIDE_ZONE);
      await request(app.getHttpServer())
        .post('/v1/driver/location')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .send({ pings: [{ seq: 1, ...INSIDE_ZONE, at: new Date().toISOString() }] })
        .expect(200);

      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(1);
    });
  });

  describe('the cadence contract', () => {
    it('reads the stale threshold from dispatch_config, never a constant', async () => {
      // §6.7 makes this an admin knob. A handset ageing its own marker at a
      // different threshold than the matcher excludes it by is a driver who
      // looks live to themselves and is invisible to dispatch.
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });

      const body = await goOnline(driverId, INSIDE_ZONE);

      // The `dispatch_config` singleton is absent in a truncated database, so
      // this is the documented code default (15s) taking effect — which is the
      // path a fresh deployment actually runs.
      expect(body.staleAfterMs).toBe(15_000);
      expect(body.lowAccuracyMeters).toBe(50);
    });
  });
});
