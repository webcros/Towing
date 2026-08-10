import { randomUUID } from 'node:crypto';
import { FLEET_NAMESPACE, type LocationUpdateEvent } from '@towing/api-contracts';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FleetGateway } from './fleet.gateway';
import { LOCATION_CHANNEL } from '../redis/redis.constants';
import { createRealtimeTestApp, wsTicketFor, type RealtimeTestApp } from '../test/app';
import { setupTestDatabase, truncateAll } from '../test/db';
import { closeTestRedis, flushTestRedis, testRedis } from '../test/redis';

/**
 * Two gateway processes against one Redis — the ALB rehearsal, automated.
 *
 * Two assertions, and BOTH are needed:
 *
 *  (a) one published ping produces EXACTLY ONE frame per client. Every node is
 *      subscribed to `location:ping`, so a relay that emitted non-locally would
 *      republish through the socket.io adapter and each client would receive N
 *      copies. This is the `.local` regression test.
 *
 *  (b) a deliberately non-local emit from node A reaches a client on node B.
 *      (a) alone passes just as happily with NO adapter installed at all, which
 *      would silently break every Track B cross-node emit. This is what proves
 *      the adapter is really wired.
 */

let nodeA: RealtimeTestApp;
let nodeB: RealtimeTestApp;
const open: Socket[] = [];

async function connect(node: RealtimeTestApp, fleetId: string): Promise<Socket> {
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

describe('multi-instance fan-out', () => {
  beforeAll(async () => {
    await setupTestDatabase();
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

  it('delivers exactly one frame per client — no adapter duplication', async () => {
    const fleetId = randomUUID();
    const truckId = randomUUID();
    const [socketA, socketB] = await Promise.all([connect(nodeA, fleetId), connect(nodeB, fleetId)]);

    const framesA: LocationUpdateEvent[] = [];
    const framesB: LocationUpdateEvent[] = [];
    socketA.on('location:update', (f: LocationUpdateEvent) => framesA.push(f));
    socketB.on('location:update', (f: LocationUpdateEvent) => framesB.push(f));

    await testRedis().publish(
      LOCATION_CHANNEL,
      JSON.stringify({
        fleetId,
        truckId,
        lat: 12.9716,
        lng: 77.5946,
        heading: 90,
        speedKph: 30,
        at: new Date().toISOString(),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 2_500));

    // With a non-local emit these would be 2 apiece on a two-node cluster.
    expect(framesA.flatMap((f) => f.positions)).toHaveLength(1);
    expect(framesB.flatMap((f) => f.positions)).toHaveLength(1);
    expect(framesA[0]?.positions[0]?.truckId).toBe(truckId);
    expect(framesB[0]?.positions[0]?.truckId).toBe(truckId);
  });

  it('routes a cross-node emit from A to a client on B — the adapter is really installed', async () => {
    const fleetId = randomUUID();
    const socketB = await connect(nodeB, fleetId);

    const received = new Promise<LocationUpdateEvent>((resolve) => {
      socketB.on('location:update', resolve);
    });

    // Node A holds no socket for this fleet. Only the Redis adapter can carry
    // this to node B.
    const gatewayA = nodeA.app.get(FleetGateway);
    expect(gatewayA.localRoomSize(fleetId)).toBe(0);
    gatewayA.broadcastAcrossNodes(fleetId, 'location:update', {
      positions: [],
      emittedAt: new Date().toISOString(),
    });

    const frame = await Promise.race([
      received,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('cross-node emit never arrived')), 5_000),
      ),
    ]);
    expect(frame.positions).toEqual([]);
  });
});
