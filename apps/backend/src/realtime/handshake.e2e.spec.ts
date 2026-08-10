import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { FLEET_NAMESPACE, fleetRoom, type RealtimeReadyEvent } from '@towing/api-contracts';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FleetGateway } from './fleet.gateway';
import { WsTicketService } from './ws-ticket.service';
import { createRealtimeTestApp, wsTicketFor } from '../test/app';
import { setupTestDatabase, truncateAll } from '../test/db';
import { closeTestRedis, flushTestRedis, testRedis } from '../test/redis';

/**
 * Handshake auth (§16.6). The tenancy assertion here is the load-bearing one:
 * a socket's room comes from a redeemed server-side ticket and nothing else.
 */

const USER = randomUUID();

let app: INestApplication;
let url: string;
let open: Socket[] = [];

interface Connected {
  socket: Socket;
  /** Resolves with the `realtime:ready` payload. */
  ready: Promise<RealtimeReadyEvent>;
}

/**
 * Resolves on `connect`, rejects on `connect_error` — never hangs the suite.
 *
 * The `realtime:ready` listener is registered BEFORE the socket connects: the
 * server emits it from `handleConnection`, so a listener attached after the
 * client's own `connect` handler has already fired races the packet and loses.
 */
function connectWith(auth: Record<string, unknown>): Promise<Connected> {
  return new Promise((resolve, reject) => {
    const socket = io(`${url}${FLEET_NAMESPACE}`, {
      auth,
      transports: ['websocket'],
      // We drive every retry ourselves in these tests; socket.io retrying under
      // us would turn a rejection into a timeout.
      reconnection: false,
      timeout: 5_000,
    });
    open.push(socket);

    const ready = new Promise<RealtimeReadyEvent>((resolveReady) => {
      socket.on('realtime:ready', resolveReady);
    });

    socket.on('connect', () => resolve({ socket, ready }));
    socket.on('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

/** Closes every socket and waits until the server has actually observed it. */
async function closeAll(): Promise<void> {
  const sockets = open;
  open = [];
  await Promise.all(
    sockets.map(
      (socket) =>
        new Promise<void>((resolve) => {
          if (!socket.connected) {
            socket.close();
            resolve();
            return;
          }
          socket.on('disconnect', () => resolve());
          socket.close();
        }),
    ),
  );
  // Socket.io removes the socket from its room on the server's own tick, which
  // is after the client sees 'disconnect'. Without this, room-size assertions in
  // the next test read a count that is about to change.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe('fleet gateway handshake', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await truncateAll();
    await flushTestRedis();
    ({ app, url } = await createRealtimeTestApp());
  });

  afterEach(async () => {
    await closeAll();
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  it('accepts a valid ticket and joins only that fleet room', async () => {
    const fleetA = randomUUID();
    const fleetB = randomUUID();
    const ticket = await wsTicketFor(app, { userId: USER, fleetId: fleetA });

    const { ready } = await connectWith({ ticket });
    expect((await ready).fleetId).toBe(fleetA);

    const gateway = app.get(FleetGateway);
    expect(gateway.localRoomSize(fleetA)).toBe(1);
    // The socket must not have landed anywhere else — room membership is the
    // entire tenancy boundary over WebSocket.
    expect(gateway.localRoomSize(fleetB)).toBe(0);
  });

  it('rejects a missing ticket', async () => {
    await expect(connectWith({})).rejects.toThrow(/unauthorized/i);
  });

  it('rejects a forged ticket', async () => {
    await expect(connectWith({ ticket: 'a'.repeat(43) })).rejects.toThrow(/unauthorized/i);
  });

  it('rejects a replayed ticket — the second socket never connects', async () => {
    const fleetId = randomUUID();
    const ticket = await wsTicketFor(app, { userId: USER, fleetId });

    await connectWith({ ticket });
    await expect(connectWith({ ticket })).rejects.toThrow(/unauthorized/i);

    expect(app.get(FleetGateway).localRoomSize(fleetId)).toBe(1);
  });

  it('rejects an expired ticket', async () => {
    const fleetId = randomUUID();
    // Mint through the service, then expire the key out from under it rather
    // than sleeping out a 60s TTL.
    const ticket = await app.get(WsTicketService).issue({ userId: USER, fleetId: fleetId as never });
    await testRedis().del(`ws:ticket:${ticket}`);

    await expect(connectWith({ ticket })).rejects.toThrow(/unauthorized/i);
  });

  it('scopes rooms per tenant — two fleets, two rooms', async () => {
    const fleetA = randomUUID();
    const fleetB = randomUUID();
    const [ticketA, ticketB] = await Promise.all([
      wsTicketFor(app, { userId: USER, fleetId: fleetA }),
      wsTicketFor(app, { userId: randomUUID(), fleetId: fleetB }),
    ]);

    await Promise.all([connectWith({ ticket: ticketA }), connectWith({ ticket: ticketB })]);

    const gateway = app.get(FleetGateway);
    expect(gateway.localRoomSize(fleetA)).toBe(1);
    expect(gateway.localRoomSize(fleetB)).toBe(1);
    expect(fleetRoom(fleetA)).not.toBe(fleetRoom(fleetB));
  });
});
