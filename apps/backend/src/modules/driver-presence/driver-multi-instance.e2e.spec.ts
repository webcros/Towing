import { randomUUID } from 'node:crypto';
import {
  DRIVER_NAMESPACE,
  FLEET_NAMESPACE,
  type DriverConfigUpdateEvent,
  type LocationUpdateEvent,
} from '@towing/api-contracts';
import { eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drivers, serviceZones } from '../../db/schema';
import {
  authHeaderFor,
  createRealtimeTestApp,
  driverAuthHeaderFor,
  driverWsTicketFor,
  wsTicketFor,
  type RealtimeTestApp,
} from '../../test/app';
import {
  seedDriver,
  seedFleet,
  setupTestDatabase,
  testDb,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { seedTruck } from '../../test/fixtures';
import { closeTestRedis, flushTestRedis } from '../../test/redis';

/**
 * TWO GATEWAY PROCESSES, ONE REDIS — Phase 16's ALB rehearsal, and the phase's
 * cross-surface acceptance criterion automated.
 *
 * The chain under test is the whole point of the phase: a driver's ping arrives
 * at node A over HTTP, and a fleet console watching from node B sees the marker
 * move. Every hop is real — the pipeline, the fleet fan-out adapter, the Redis
 * channel, Phase 5's relay, and the `fleet:{id}` room — and none of the
 * console's code was touched to make it work.
 *
 * A single-process test cannot make this claim. Under one task the fan-out would
 * appear to work with no Redis transport at all, and the first ALB deploy would
 * be the first time anyone found out.
 */

let nodeA: RealtimeTestApp;
let nodeB: RealtimeTestApp;
let db: TestDatabase;
const open: Socket[] = [];

const INSIDE_ZONE = { lat: 12.9716, lng: 77.5946 };

async function connectFleet(node: RealtimeTestApp, fleetId: string): Promise<Socket> {
  const ticket = await wsTicketFor(node.app, { userId: randomUUID(), fleetId });
  return connect(`${node.url}${FLEET_NAMESPACE}`, ticket);
}

async function connectDriver(node: RealtimeTestApp, driverId: string): Promise<Socket> {
  return connect(`${node.url}${DRIVER_NAMESPACE}`, await driverWsTicketFor(node.app, driverId));
}

async function connect(url: string, ticket: string): Promise<Socket> {
  const socket = io(url, {
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

function nextFrame<T>(socket: Socket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('driver ping → fleet map, across two nodes', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    db = testDb();
    await truncateAll();
    await flushTestRedis();
    // Sequential, not Promise.all: both bind port 0 and share one Postgres pool
    // helper, and vitest runs with fileParallelism disabled anyway.
    nodeA = await createRealtimeTestApp();
    nodeB = await createRealtimeTestApp();
  });

  afterAll(async () => {
    for (const socket of open) socket.close();
    await nodeA.app.close();
    await nodeB.app.close();
    await closeTestRedis();
  });

  it('shows a real driver on the Phase 5 fleet map from a different node', async () => {
    await db.insert(serviceZones).values({
      name: 'Bengaluru Metro',
      area: 'SRID=4326;POLYGON((77.45 12.80,77.80 12.80,77.80 13.15,77.45 13.15,77.45 12.80))',
    });

    // The fixture the acceptance criterion requires and that nothing else
    // produces: fleet-affiliated, truck-assigned, KYC-approved. An independent
    // driver — which is what self-signup creates — belongs on no fleet map at
    // all, so this criterion is unreachable without seeding one deliberately.
    const { fleetId, ownerId } = await seedFleet(db, `Cross-node ${randomUUID().slice(0, 8)}`);
    const truckId = await seedTruck(db, fleetId, { plate: 'KA-01-XNODE-1' });
    const driverId = await seedDriver(db, { fleetId, kycStatus: 'approved', name: 'Suresh Kumar' });
    await db.update(drivers).set({ assignedTruckId: truckId }).where(eq(drivers.id, driverId));

    // The console is on node B and knows nothing about node A.
    const console = await connectFleet(nodeB, fleetId);
    const frame = nextFrame<LocationUpdateEvent>(console, 'location:update');

    // The driver's app talks to node A.
    const driverAuth = await driverAuthHeaderFor(nodeA.app, { driverId });
    await request(nodeA.app.getHttpServer())
      .post('/v1/driver/online')
      .set('Authorization', driverAuth)
      .send({ at: INSIDE_ZONE })
      .expect(200);
    await request(nodeA.app.getHttpServer())
      .post('/v1/driver/location')
      .set('Authorization', driverAuth)
      .send({
        pings: [
          { seq: 1, lat: 12.9750, lng: 77.5980, at: new Date().toISOString(), headingDeg: 210, speedKph: 42 },
        ],
      })
      .expect(200);

    const received = await frame;
    const position = received.positions.find((p) => p.truckId === truckId);

    expect(position).toMatchObject({
      truckId,
      lat: 12.975,
      lng: 77.598,
      heading: 210,
      speedKph: 42,
    });

    // ...and the REST resync the console performs on every reconnect agrees,
    // reading from node B's process.
    const snapshot = await request(nodeB.app.getHttpServer())
      .get('/v1/fleet/realtime/positions')
      .set('Authorization', await authHeaderFor(nodeB.app, { userId: ownerId, fleetId }))
      .expect(200);

    expect(snapshot.body.positions.find((p: { truckId: string }) => p.truckId === truckId)).toMatchObject({
      driverName: 'Suresh Kumar',
      fromFallback: false,
    });
  });

  it('delivers config:update to a driver socket on the OTHER node', async () => {
    // Phase 5 installed the socket.io Redis adapter and deliberately used none
    // of it — its relays emit `.local`, because every node already holds the
    // message. This is the adapter's first real user: the REST call lands on
    // node A and the driver's socket is attached to node B, so the frame has to
    // cross. Phase 17's `job:offer` to `driver:{id}` takes exactly this path.
    await db.insert(serviceZones).values({
      name: 'Bengaluru Metro 2',
      area: 'SRID=4326;POLYGON((77.45 12.80,77.80 12.80,77.80 13.15,77.45 13.15,77.45 12.80))',
    });
    const driverId = await seedDriver(db, { kycStatus: 'approved' });

    const handset = await connectDriver(nodeB, driverId);
    // Drain the on-connect frame so the assertion is about the pushed one.
    await nextFrame<DriverConfigUpdateEvent>(handset, 'config:update').catch(() => undefined);

    const pushed = nextFrame<DriverConfigUpdateEvent>(handset, 'config:update');
    await request(nodeA.app.getHttpServer())
      .post('/v1/driver/online')
      .set('Authorization', await driverAuthHeaderFor(nodeA.app, { driverId }))
      .send({ at: INSIDE_ZONE })
      .expect(200);

    expect((await pushed).pingIntervalMs).toBe(10_000);
  });
});
