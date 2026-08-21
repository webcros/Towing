import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  DRIVER_NAMESPACE,
  type DriverConfigUpdateEvent,
  type DriverLocationAccepted,
  type DriverReadyEvent,
} from '@towing/api-contracts';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { serviceZones } from '../../db/schema';
import { driverGeoKey, driverHashKey } from '../../redis/redis.constants';
import {
  createRealtimeTestApp,
  driverAuthHeaderFor,
  driverWsTicketFor,
  wsTicketFor,
} from '../../test/app';
import {
  seedDriver,
  setupTestDatabase,
  testDb,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { closeTestRedis, flushTestRedis, testRedis } from '../../test/redis';

/**
 * The `/driver` namespace — the first gateway in this codebase that accepts
 * input, and the room Phase 17's `job:offer` will be delivered to.
 *
 * The realm assertions are the ones that must never regress. A fleet ticket
 * accepted here would put a console user in `driver:{their own user id}` and
 * hand them another realm's job offers.
 */

let app: INestApplication;
let url: string;
let db: TestDatabase;
const sockets: Socket[] = [];

const INSIDE_ZONE = { lat: 12.9716, lng: 77.5946 };

async function seedZone(): Promise<string> {
  const [row] = await db
    .insert(serviceZones)
    .values({
      name: 'Bengaluru Metro',
      area: 'SRID=4326;POLYGON((77.45 12.80,77.80 12.80,77.80 13.15,77.45 13.15,77.45 12.80))',
    })
    .returning({ id: serviceZones.id });
  return row!.id;
}

/**
 * Frames received per socket, from the moment it was constructed.
 *
 * BUFFERED, because `realtime:ready` is emitted inside `handleConnection` —
 * i.e. it can already be on the wire by the time the client's own `connect`
 * handler runs. A listener attached after the connect promise resolves races
 * that frame and loses roughly half the time, which is exactly the kind of
 * flake that gets a real assertion deleted later for being "unreliable".
 */
const frames = new WeakMap<Socket, Map<string, unknown[]>>();

function connectWith(auth: Record<string, unknown>): Promise<Socket> {
  const socket = io(url + DRIVER_NAMESPACE, {
    transports: ['websocket'],
    auth,
    reconnection: false,
    forceNew: true,
  });
  sockets.push(socket);

  const received = new Map<string, unknown[]>();
  frames.set(socket, received);
  socket.onAny((event: string, payload: unknown) => {
    const list = received.get(event) ?? [];
    list.push(payload);
    received.set(event, list);
  });

  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err: Error) => reject(err));
  });
}

/** The next frame of `event`, including one that arrived before this was called. */
async function nextEvent<T>(socket: Socket, event: string, timeoutMs = 3_000): Promise<T> {
  const received = frames.get(socket);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const buffered = received?.get(event);
    if (buffered && buffered.length > 0) return buffered.shift() as T;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${event}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('driver realtime gateway', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    db = testDb();
    ({ app, url } = await createRealtimeTestApp());
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  describe('handshake', () => {
    it('joins driver:{id} on a driver ticket and announces itself', async () => {
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });

      const ready = await nextEvent<DriverReadyEvent>(socket, 'realtime:ready');
      expect(ready.driverId).toBe(driverId);
    });

    it('REFUSES a fleet ticket', async () => {
      // The assertion this whole namespace exists to make safe. A fleet ticket
      // carries a `fleet_users.id`; accepting it would room a console user as a
      // driver and deliver them Phase 17's job offers.
      const ticket = await wsTicketFor(app, { userId: randomUUID(), fleetId: randomUUID() });
      await expect(connectWith({ ticket })).rejects.toThrow(/unauthorized/i);
    });

    it('refuses a missing, malformed or already-redeemed ticket', async () => {
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const ticket = await driverWsTicketFor(app, driverId);

      await expect(connectWith({})).rejects.toThrow(/unauthorized/i);
      await expect(connectWith({ ticket: 'not-a-ticket' })).rejects.toThrow(/unauthorized/i);

      // Single-use, via GETDEL — two sockets racing a stolen ticket must not
      // both connect.
      await connectWith({ ticket });
      await expect(connectWith({ ticket })).rejects.toThrow(/unauthorized/i);
    });

    it('mints its ticket behind the KYC gate', async () => {
      const approved = await seedDriver(db, { kycStatus: 'approved' });
      const pending = await seedDriver(db, { kycStatus: 'pending' });

      await request(app.getHttpServer())
        .post('/v1/driver/realtime/ticket')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId: approved }))
        .expect(200)
        .expect((res) => {
          expect(res.body.namespace).toBe(DRIVER_NAMESPACE);
          expect(String(res.body.ticket).length).toBeGreaterThanOrEqual(32);
        });

      // A suspended driver's next reconnect is refused at ticket time rather
      // than being discovered by the gateway.
      await request(app.getHttpServer())
        .post('/v1/driver/realtime/ticket')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId: pending, kycStatus: 'pending' }))
        .expect(403);
    });
  });

  describe('config:update', () => {
    it('pushes the cadence on connect', async () => {
      // A handset that reconnected mid-shift would otherwise keep whatever
      // interval it had before the drop — possibly the offline one.
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });

      const config = await nextEvent<DriverConfigUpdateEvent>(socket, 'config:update');
      expect(config).toMatchObject({
        // Offline: nothing is captured at all (§20.4). `null` says that; a large
        // interval would merely say "rarely".
        pingIntervalMs: null,
        staleAfterMs: 15_000,
        lowAccuracyMeters: 50,
      });
    });

    it('changes the cadence when the driver goes online', async () => {
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });
      await nextEvent<DriverConfigUpdateEvent>(socket, 'config:update');

      const pushed = nextEvent<DriverConfigUpdateEvent>(socket, 'config:update');
      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .send({ at: INSIDE_ZONE })
        .expect(200);

      expect((await pushed).pingIntervalMs).toBe(10_000);
    });

    it('stops capture when the driver goes offline', async () => {
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const auth = await driverAuthHeaderFor(app, { driverId });
      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', auth)
        .send({ at: INSIDE_ZONE })
        .expect(200);

      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });
      await nextEvent<DriverConfigUpdateEvent>(socket, 'config:update');

      const pushed = nextEvent<DriverConfigUpdateEvent>(socket, 'config:update');
      await request(app.getHttpServer()).post('/v1/driver/offline').set('Authorization', auth).expect(200);

      expect((await pushed).pingIntervalMs).toBeNull();
    });
  });

  describe('location:update — the inbound handler', () => {
    it('runs the same pipeline the REST door runs, and acknowledges', async () => {
      const zoneId = await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .send({ at: INSIDE_ZONE })
        .expect(200);

      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });

      const ack = await socket
        .timeout(3_000)
        .emitWithAck('location:update', {
          seq: 1,
          lat: 12.9750,
          lng: 77.5980,
          at: new Date().toISOString(),
          headingDeg: 120,
        });

      // The ack is not decoration: the handset needs to know which pings to drop
      // from its buffer and where its sequence stands.
      expect(ack as DriverLocationAccepted).toEqual({ accepted: 1, discarded: 0, seq: 1 });

      const hash = await testRedis().hgetall(driverHashKey(driverId));
      expect(Number(hash.lat)).toBeCloseTo(12.975, 4);
      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(1);
    });

    it('shares one sequence across BOTH doors', async () => {
      // A handset that switches between socket and REST mid-shift — which the
      // background task does every time the app is backgrounded — must not have
      // its own pings discarded as stale by the other transport.
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const auth = await driverAuthHeaderFor(app, { driverId });
      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', auth)
        .send({ at: INSIDE_ZONE })
        .expect(200);

      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });
      await socket
        .timeout(3_000)
        .emitWithAck('location:update', { seq: 5, ...INSIDE_ZONE, at: new Date().toISOString() });

      const res = await request(app.getHttpServer())
        .post('/v1/driver/location')
        .set('Authorization', auth)
        .send({ pings: [{ seq: 3, ...INSIDE_ZONE, at: new Date().toISOString() }] })
        .expect(200);

      expect(res.body).toEqual({ accepted: 0, discarded: 1, seq: 5 });
    });

    it('rejects a malformed frame without dropping the socket', async () => {
      // A bad frame is one rejected message, not a disconnected driver whose
      // whole shift then goes unrecorded.
      await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
        .send({ at: INSIDE_ZONE })
        .expect(200);

      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });

      await expect(
        socket.timeout(3_000).emitWithAck('location:update', { seq: 'not-a-number', lat: 999 }),
      ).rejects.toBeTruthy();

      expect(socket.connected).toBe(true);

      // ...and the socket still works afterwards.
      const ack = await socket
        .timeout(3_000)
        .emitWithAck('location:update', { seq: 1, ...INSIDE_ZONE, at: new Date().toISOString() });
      expect((ack as DriverLocationAccepted).accepted).toBe(1);
    });

    it('takes its driver from the socket, never from the payload', async () => {
      // `DriverLocationPing` carries no driver id at all, so a spoofed one is
      // simply an unknown property — this pins that it stays that way.
      const zoneId = await seedZone();
      const victim = await seedDriver(db, { kycStatus: 'approved' });
      const attacker = await seedDriver(db, { kycStatus: 'approved' });

      for (const id of [victim, attacker]) {
        await request(app.getHttpServer())
          .post('/v1/driver/online')
          .set('Authorization', await driverAuthHeaderFor(app, { driverId: id }))
          .send({ at: INSIDE_ZONE })
          .expect(200);
      }

      const socket = await connectWith({ ticket: await driverWsTicketFor(app, attacker) });
      await socket.timeout(3_000).emitWithAck('location:update', {
        driverId: victim,
        seq: 1,
        lat: 12.9999,
        lng: 77.5999,
        at: new Date().toISOString(),
      });

      // The attacker moved; the victim did not.
      const attackerHash = await testRedis().hgetall(driverHashKey(attacker));
      expect(Number(attackerHash.lat)).toBeCloseTo(12.9999, 4);
      expect(await testRedis().hget(driverHashKey(victim), 'seq')).toBeNull();
      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('does NOT take the driver offline', async () => {
      // §6.1's liveness is ping freshness, so a driver who loses their socket in
      // a lift is still dispatchable while their last fix is fresh, and resumes
      // over REST with no state having changed. Evicting here would make
      // availability depend on TCP.
      const zoneId = await seedZone();
      const driverId = await seedDriver(db, { kycStatus: 'approved' });
      const auth = await driverAuthHeaderFor(app, { driverId });
      await request(app.getHttpServer())
        .post('/v1/driver/online')
        .set('Authorization', auth)
        .send({ at: INSIDE_ZONE })
        .expect(200);
      await request(app.getHttpServer())
        .post('/v1/driver/location')
        .set('Authorization', auth)
        .send({ pings: [{ seq: 1, ...INSIDE_ZONE, at: new Date().toISOString() }] })
        .expect(200);

      const socket = await connectWith({ ticket: await driverWsTicketFor(app, driverId) });
      await nextEvent<DriverReadyEvent>(socket, 'realtime:ready');
      socket.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(await testRedis().zcard(driverGeoKey(zoneId))).toBe(1);
      expect(await testRedis().exists(driverHashKey(driverId))).toBe(1);
    });
  });
});
