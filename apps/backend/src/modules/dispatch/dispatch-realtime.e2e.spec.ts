import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  CUSTOMER_NAMESPACE,
  DRIVER_NAMESPACE,
  type CustomerReadyEvent,
  type JobOffer,
  type JobRevokedEvent,
  type SearchProgressEvent,
} from '@towing/api-contracts';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createRealtimeTestApp,
  customerAuthHeaderFor,
  driverAuthHeaderFor,
  driverWsTicketFor,
  wsTicketFor,
  type RealtimeTestApp,
} from '../../test/app';
import {
  seedCustomer,
  setupTestDatabase,
  testDb,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { closeTestRedis, flushTestRedis } from '../../test/redis';
import { DispatchConfigRepo } from '../bookings/dispatch-config.repo';
import { DispatchRepo } from './dispatch.repo';
import { DispatchService } from './dispatch.service';
import { OfferService } from './offer.service';
import { seedOnlineDriver, seedSearchingBooking, seedZone } from './dispatch-fixtures';

/**
 * The realtime half of dispatch, across TWO GATEWAY PROCESSES.
 *
 * Both assertions here are cross-node on purpose. `job:offer` is the first
 * genuinely targeted emit in the product — the wave runs on whichever worker
 * picked the job up, and the driver's socket is very likely attached to a
 * different task — and `search:progress` has the same shape on the customer
 * side. A single-process test would pass with no Redis adapter installed at
 * all, and the first ALB deploy would be where anyone found out.
 */

let nodeA: RealtimeTestApp;
let nodeB: RealtimeTestApp;
let db: TestDatabase;
const open: Socket[] = [];

/** Frames per socket from construction — `realtime:ready` can beat the connect handler. */
const frames = new WeakMap<Socket, Map<string, unknown[]>>();

async function connect(url: string, ticket: string): Promise<Socket> {
  const socket = io(url, { auth: { ticket }, transports: ['websocket'], reconnection: false, timeout: 5_000 });
  open.push(socket);

  const received = new Map<string, unknown[]>();
  frames.set(socket, received);
  socket.onAny((event: string, payload: unknown) => {
    received.set(event, [...(received.get(event) ?? []), payload]);
  });

  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return socket;
}

async function nextEvent<T>(socket: Socket, event: string, timeoutMs = 5_000): Promise<T> {
  const received = frames.get(socket);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const buffered = received?.get(event);
    if (buffered && buffered.length > 0) return buffered.shift() as T;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${event}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('dispatch realtime, across two nodes', () => {
  let zoneId: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    db = testDb();
    nodeA = await createRealtimeTestApp();
    nodeB = await createRealtimeTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
    await nodeA.app.get(DispatchConfigRepo).invalidate();
    await nodeB.app.get(DispatchConfigRepo).invalidate();
    zoneId = await seedZone(db, { dispatchConfig: { radiusLadderKm: [5], offersPerWave: 2 } });
    userId = await seedCustomer(db);
  });

  afterEach(() => {
    for (const socket of open.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await nodeA.app.close();
    await nodeB.app.close();
    await closeTestRedis();
  });

  it('delivers job:offer to a driver socket on the OTHER node', async () => {
    /**
     * Phase 16 built `driver:{id}` and delivered only `config:update` on it.
     * This is what the room was actually for — and the path Phase 17's whole
     * twenty-second window depends on.
     */
    const bookingId = await seedSearchingBooking(db, { userId, zoneId });
    const driverId = await seedOnlineDriver(db, { zoneId, metersAway: 600 });

    const handset = await connect(
      `${nodeB.url}${DRIVER_NAMESPACE}`,
      await driverWsTicketFor(nodeB.app, driverId),
    );

    // The wave runs on node A.
    await nodeA.app.get(DispatchService).runWave(bookingId);

    const offer = await nextEvent<JobOffer>(handset, 'job:offer');
    expect(offer.bookingId).toBe(bookingId);
    // Gross 1200, commission 120, net 1080 — the locked §3.4 values.
    expect(offer.earnings.netPaise).toBe(108_000);
    expect(new Date(offer.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('tells the losing driver their offer was TAKEN, across nodes', async () => {
    // A takeover screen that sat there until its own timer ran out would let a
    // driver tap Accept on a job that has been gone for fifteen seconds.
    const bookingId = await seedSearchingBooking(db, { userId, zoneId });
    const winner = await seedOnlineDriver(db, { zoneId, metersAway: 300 });
    const loser = await seedOnlineDriver(db, { zoneId, metersAway: 400 });

    const loserSocket = await connect(
      `${nodeB.url}${DRIVER_NAMESPACE}`,
      await driverWsTicketFor(nodeB.app, loser),
    );

    await nodeA.app.get(DispatchService).runWave(bookingId);
    await nextEvent<JobOffer>(loserSocket, 'job:offer');

    await nodeA.app.get(OfferService).accept(bookingId, winner);

    const revoked = await nextEvent<JobRevokedEvent>(loserSocket, 'job:revoked');
    expect(revoked).toMatchObject({ bookingId, reason: 'taken' });
  });

  it('delivers §9.1.6 search progress to the customer on the other node', async () => {
    const bookingId = await seedSearchingBooking(db, { userId, zoneId });
    await seedOnlineDriver(db, { zoneId, metersAway: 600 });

    const ticket = await request(nodeB.app.getHttpServer())
      .post(`/v1/bookings/${bookingId}/realtime/ticket`)
      .set('Authorization', await customerAuthHeaderFor(nodeB.app, { userId }))
      .expect(200);

    expect(ticket.body.namespace).toBe(CUSTOMER_NAMESPACE);

    const watcher = await connect(`${nodeB.url}${CUSTOMER_NAMESPACE}`, ticket.body.ticket);
    const ready = await nextEvent<CustomerReadyEvent>(watcher, 'realtime:ready');
    expect(ready.bookingId).toBe(bookingId);

    await nodeA.app.get(DispatchService).runWave(bookingId);

    const progress = await nextEvent<SearchProgressEvent>(watcher, 'search:progress');
    expect(progress).toMatchObject({
      bookingId,
      wave: 1,
      radiusKm: 5,
      // Real, from `dispatch_attempts` — the number the old `useSearchSimulation`
      // used to invent.
      driversContacted: 1,
    });
  });

  it('tells the customer the moment a driver is assigned', async () => {
    const bookingId = await seedSearchingBooking(db, { userId, zoneId });
    const driverId = await seedOnlineDriver(db, { zoneId, metersAway: 600 });

    const ticket = await request(nodeB.app.getHttpServer())
      .post(`/v1/bookings/${bookingId}/realtime/ticket`)
      .set('Authorization', await customerAuthHeaderFor(nodeB.app, { userId }))
      .expect(200);
    const watcher = await connect(`${nodeB.url}${CUSTOMER_NAMESPACE}`, ticket.body.ticket);
    await nextEvent<CustomerReadyEvent>(watcher, 'realtime:ready');

    await nodeA.app.get(DispatchService).runWave(bookingId);
    await nodeA.app.get(OfferService).accept(bookingId, driverId);

    // Emitted from the accept path so the searching screen can hand off to
    // tracking without waiting out its ten-second poll.
    const status = await nextEvent<{ status: string }>(watcher, 'booking:status');
    expect(status.status).toBe('assigned');
  });

  describe('the /customer handshake', () => {
    it('refuses a ticket for a booking the caller does not own', async () => {
      // The ownership check is the ticket route's `repo.detail` read, scoped by
      // `userId` in its WHERE — so another customer's booking reads as absent.
      const bookingId = await seedSearchingBooking(db, { userId, zoneId });
      const stranger = await seedCustomer(db);

      await request(nodeA.app.getHttpServer())
        .post(`/v1/bookings/${bookingId}/realtime/ticket`)
        .set('Authorization', await customerAuthHeaderFor(nodeA.app, { userId: stranger }))
        .expect(404);
    });

    it('refuses a fleet ticket on the customer namespace', async () => {
      const ticket = await wsTicketFor(nodeA.app, { userId: randomUUID(), fleetId: randomUUID() });
      await expect(connect(`${nodeA.url}${CUSTOMER_NAMESPACE}`, ticket)).rejects.toThrow(
        /unauthorized/i,
      );
    });

    it('refuses a driver ticket on the customer namespace', async () => {
      const driverId = await seedOnlineDriver(db, { zoneId });
      const ticket = await driverWsTicketFor(nodeA.app, driverId);
      await expect(connect(`${nodeA.url}${CUSTOMER_NAMESPACE}`, ticket)).rejects.toThrow(
        /unauthorized/i,
      );
    });

    it('is single-use, like every other handshake ticket', async () => {
      const bookingId = await seedSearchingBooking(db, { userId, zoneId });
      const ticket = await request(nodeA.app.getHttpServer())
        .post(`/v1/bookings/${bookingId}/realtime/ticket`)
        .set('Authorization', await customerAuthHeaderFor(nodeA.app, { userId }))
        .expect(200);

      await connect(`${nodeA.url}${CUSTOMER_NAMESPACE}`, ticket.body.ticket);
      await expect(
        connect(`${nodeA.url}${CUSTOMER_NAMESPACE}`, ticket.body.ticket),
      ).rejects.toThrow(/unauthorized/i);
    });

    it('scopes the room to ONE booking — a second booking is not overheard', async () => {
      /**
       * The booking id comes from the TICKET, not from anything the socket says
       * afterwards. A customer watching their own trip must not receive progress
       * for someone else's, and the room name is what guarantees it.
       */
      const mine = await seedSearchingBooking(db, { userId, zoneId });
      const theirs = await seedSearchingBooking(db, { userId: await seedCustomer(db), zoneId });
      await seedOnlineDriver(db, { zoneId, metersAway: 600 });

      const ticket = await request(nodeA.app.getHttpServer())
        .post(`/v1/bookings/${mine}/realtime/ticket`)
        .set('Authorization', await customerAuthHeaderFor(nodeA.app, { userId }))
        .expect(200);
      const watcher = await connect(`${nodeA.url}${CUSTOMER_NAMESPACE}`, ticket.body.ticket);
      await nextEvent<CustomerReadyEvent>(watcher, 'realtime:ready');

      await nodeA.app.get(DispatchService).runWave(theirs);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(frames.get(watcher)?.get('search:progress') ?? []).toHaveLength(0);
    });
  });

  it('a driver accepting on node B assigns a booking whose wave ran on node A', async () => {
    // The full cross-node chain: search on one task, accept on the other, and
    // exactly one assignment.
    const bookingId = await seedSearchingBooking(db, { userId, zoneId });
    const driverId = await seedOnlineDriver(db, { zoneId, metersAway: 600 });

    await nodeA.app.get(DispatchService).runWave(bookingId);

    await request(nodeB.app.getHttpServer())
      .post(`/v1/jobs/${bookingId}/accept`)
      .set('Authorization', await driverAuthHeaderFor(nodeB.app, { driverId }))
      .expect(200)
      .expect((res) => expect(res.body.job.status).toBe('assigned'));

    expect(await nodeA.app.get(DispatchRepo).booking(bookingId)).toMatchObject({
      status: 'assigned',
    });
  });
});
