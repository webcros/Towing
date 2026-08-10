import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  FLEET_NAMESPACE,
  type LocationUpdateEvent,
  type TruckPositionDto,
} from '@towing/api-contracts';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LOCATION_CHANNEL } from '../redis/redis.constants';
import { createRealtimeTestApp, wsTicketFor } from '../test/app';
import { setupTestDatabase, truncateAll } from '../test/db';
import { closeTestRedis, flushTestRedis, testRedis } from '../test/redis';

/**
 * Redis ping → batched `location:update` in the right room, and only there.
 */

let app: INestApplication;
let url: string;
let open: Socket[] = [];

async function connect(fleetId: string): Promise<Socket> {
  const ticket = await wsTicketFor(app, { userId: randomUUID(), fleetId });
  const socket = io(`${url}${FLEET_NAMESPACE}`, {
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

function ping(fleetId: string, truckId: string, overrides: Partial<TruckPositionDto> = {}) {
  return JSON.stringify({
    fleetId,
    truckId,
    lat: 12.9716,
    lng: 77.5946,
    heading: 90,
    speedKph: 30,
    at: new Date().toISOString(),
    ...overrides,
  });
}

/** Collects every `location:update` a socket receives over `ms`. */
function collect(socket: Socket, ms: number): Promise<LocationUpdateEvent[]> {
  const frames: LocationUpdateEvent[] = [];
  socket.on('location:update', (frame: LocationUpdateEvent) => frames.push(frame));
  return new Promise((resolve) => setTimeout(() => resolve(frames), ms));
}

describe('location fan-out', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await truncateAll();
    await flushTestRedis();
    ({ app, url } = await createRealtimeTestApp());
  });

  afterEach(() => {
    for (const socket of open) socket.close();
    open = [];
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  it('relays a published ping to the fleet room', async () => {
    const fleetId = randomUUID();
    const truckId = randomUUID();
    const socket = await connect(fleetId);

    const received = new Promise<LocationUpdateEvent>((resolve) => {
      socket.on('location:update', resolve);
    });
    await testRedis().publish(LOCATION_CHANNEL, ping(fleetId, truckId, { lat: 12.34 }));

    const frame = await received;
    expect(frame.positions).toHaveLength(1);
    expect(frame.positions[0]?.truckId).toBe(truckId);
    expect(frame.positions[0]?.lat).toBe(12.34);
    expect(Date.parse(frame.emittedAt)).toBeGreaterThan(0);
  });

  it('never leaks another tenant’s ping into this fleet’s room', async () => {
    const fleetA = randomUUID();
    const fleetB = randomUUID();
    const socketA = await connect(fleetA);
    const socketB = await connect(fleetB);

    const framesA = collect(socketA, 2_500);
    const framesB = collect(socketB, 2_500);

    const truckB = randomUUID();
    await testRedis().publish(LOCATION_CHANNEL, ping(fleetB, truckB));

    // The whole tenancy boundary over WebSocket, asserted directly.
    expect(await framesA).toEqual([]);
    const receivedB = await framesB;
    expect(receivedB.flatMap((f) => f.positions).map((p) => p.truckId)).toContain(truckB);
  });

  it('coalesces a burst for one truck into a single frame', async () => {
    const fleetId = randomUUID();
    const truckId = randomUUID();
    const socket = await connect(fleetId);

    const frames = collect(socket, 2_500);
    const base = Date.now();
    // Five pings well inside one 1s flush window.
    for (let i = 0; i < 5; i += 1) {
      await testRedis().publish(
        LOCATION_CHANNEL,
        ping(fleetId, truckId, { lat: 12 + i / 100, at: new Date(base + i * 10).toISOString() }),
      );
    }

    const positions = (await frames).flatMap((f) => f.positions);
    expect(positions).toHaveLength(1);
    // Last write wins: the newest ping is the one the operator sees.
    expect(positions[0]?.lat).toBeCloseTo(12.04, 5);
  });

  it('discards an out-of-order ping rather than moving the marker backwards', async () => {
    const fleetId = randomUUID();
    const truckId = randomUUID();
    const socket = await connect(fleetId);

    const frames = collect(socket, 2_500);
    const now = Date.now();
    await testRedis().publish(
      LOCATION_CHANNEL,
      ping(fleetId, truckId, { lat: 13.5, at: new Date(now).toISOString() }),
    );
    await testRedis().publish(
      LOCATION_CHANNEL,
      ping(fleetId, truckId, { lat: 12.1, at: new Date(now - 5_000).toISOString() }),
    );

    const positions = (await frames).flatMap((f) => f.positions);
    expect(positions).toHaveLength(1);
    expect(positions[0]?.lat).toBe(13.5);
  });

  it('survives a malformed ping without dropping the good ones', async () => {
    const fleetId = randomUUID();
    const truckId = randomUUID();
    const socket = await connect(fleetId);

    const frames = collect(socket, 2_500);
    await testRedis().publish(LOCATION_CHANNEL, 'not json at all');
    await testRedis().publish(LOCATION_CHANNEL, JSON.stringify({ fleetId, lat: 'north' }));
    await testRedis().publish(LOCATION_CHANNEL, ping(fleetId, truckId));

    const positions = (await frames).flatMap((f) => f.positions);
    expect(positions.map((p) => p.truckId)).toEqual([truckId]);
  });
});
