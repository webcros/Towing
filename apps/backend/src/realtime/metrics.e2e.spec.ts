import { randomUUID } from 'node:crypto';
import {
  FLEET_NAMESPACE,
  type BookingStatusEvent,
  type OpsMetricsEvent,
} from '@towing/api-contracts';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FLEET_EVENTS_CHANNEL } from '../redis/redis.constants';
import { authHeaderFor, createRealtimeTestApp, wsTicketFor, type RealtimeTestApp } from '../test/app';
import { seedFleet, setupTestDatabase, testDb, truncateAll, type TestDatabase } from '../test/db';
import { seedTruck } from '../test/fixtures';
import { closeTestRedis, flushTestRedis, testRedis } from '../test/redis';

/**
 * `ops:metrics` and `booking:status` (§16.6), end to end: a mutation or a
 * published domain event reaches a connected console.
 */

let node: RealtimeTestApp;
let db: TestDatabase;
const open: Socket[] = [];

async function connect(fleetId: string): Promise<Socket> {
  const ticket = await wsTicketFor(node.app, { userId: randomUUID(), fleetId });
  const socket = io(`${node.url}${FLEET_NAMESPACE}`, {
    auth: { ticket },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5_000,
  });
  open.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return socket;
}

function once<T>(socket: Socket, event: string, timeoutMs = 12_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} never arrived`)), timeoutMs);
    socket.on(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('realtime KPI + booking status', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    db = testDb();
    node = await createRealtimeTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
  });

  afterAll(async () => {
    for (const socket of open) socket.close();
    await node.app.close();
    await closeTestRedis();
  });

  it('pushes recomputed KPIs after a truck mutation, and REST agrees', async () => {
    const { fleetId, ownerId } = await seedFleet(db, `Metrics ${randomUUID().slice(0, 8)}`);
    const auth = await authHeaderFor(node.app, { userId: ownerId, fleetId });
    const socket = await connect(fleetId);
    const received = once<OpsMetricsEvent>(socket, 'ops:metrics');

    await request(node.app.getHttpServer())
      .post('/v1/fleet/trucks')
      .set('Authorization', auth)
      .send({ plate: 'KA-05-NEW-0001', type: 'flatbed', capacityTons: 5 })
      .expect(201);

    const event = await received;
    expect(event.kpis.totalTrucks).toBe(1);
    expect(event.kpis.activeTrucks).toBe(1);

    // The pushed payload and the REST endpoint must not disagree: the
    // broadcaster recomputes THROUGH the cache it just invalidated, so
    // `dash:{fleetId}` now holds exactly what was pushed.
    const rest = await request(node.app.getHttpServer())
      .get('/v1/fleet/dashboard')
      .set('Authorization', auth)
      .expect(200);
    expect(rest.body.kpis).toEqual(event.kpis);
  });

  it('relays a booking:status event to the fleet room', async () => {
    const fleetId = randomUUID();
    const bookingId = randomUUID();
    const socket = await connect(fleetId);
    const received = once<BookingStatusEvent>(socket, 'booking:status');

    // Exactly what the simulator publishes after committing a transition.
    await testRedis().publish(
      FLEET_EVENTS_CHANNEL,
      JSON.stringify({
        kind: 'booking_status',
        fleetId,
        bookingId,
        status: 'en_route',
        at: new Date().toISOString(),
      }),
    );

    const event = await received;
    expect(event).toMatchObject({ bookingId, status: 'en_route' });
  });

  it('never delivers another tenant’s booking:status', async () => {
    const fleetA = randomUUID();
    const fleetB = randomUUID();
    const socketA = await connect(fleetA);

    const seen: BookingStatusEvent[] = [];
    socketA.on('booking:status', (e: BookingStatusEvent) => seen.push(e));

    await testRedis().publish(
      FLEET_EVENTS_CHANNEL,
      JSON.stringify({
        kind: 'booking_status',
        fleetId: fleetB,
        bookingId: randomUUID(),
        status: 'completed',
        at: new Date().toISOString(),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(seen).toEqual([]);
  });

  it('coalesces a burst of events into a single recompute', async () => {
    const { fleetId, ownerId } = await seedFleet(db, `Burst ${randomUUID().slice(0, 8)}`);
    const auth = await authHeaderFor(node.app, { userId: ownerId, fleetId });
    await seedTruck(db, fleetId);
    const socket = await connect(fleetId);

    const frames: OpsMetricsEvent[] = [];
    socket.on('ops:metrics', (e: OpsMetricsEvent) => frames.push(e));

    for (let i = 0; i < 4; i += 1) {
      await request(node.app.getHttpServer())
        .post('/v1/fleet/trucks')
        .set('Authorization', auth)
        .send({ plate: `KA-09-BST-000${i}`, type: 'flatbed', capacityTons: 5 })
        .expect(201);
    }

    // Debounce is 2s; four mutations inside it must cost one recompute, not four.
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    expect(frames).toHaveLength(1);
    expect(frames[0]?.kpis.totalTrucks).toBe(5);
  });
});
