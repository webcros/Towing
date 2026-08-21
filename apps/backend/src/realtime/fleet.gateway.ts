import { Inject, Logger, UseFilters } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { FLEET_NAMESPACE, fleetRoom, type FleetId } from '@towing/api-contracts';
import { SkipThrottling } from '../common/throttling/throttler.config';
import { ENV, type Env } from '../config/env';
import type { FleetNamespace, FleetSocket, ServerToClientEvents } from './realtime.types';
import { WsExceptionFilter } from './ws-exception.filter';
import { WsTicketService } from './ws-ticket.service';

/**
 * The `/fleet` namespace (§16.6). Handshake auth joins `fleet:{fleet_id}` and
 * nothing else.
 *
 * `@SkipThrottling` is defensive: there are no message handlers today, but
 * `ThrottlerGuard` is a global `APP_GUARD` and its `getRequestResponse` calls
 * `switchToHttp().getRequest()`, which on a WS context yields the socket — every
 * future `@SubscribeMessage` would then throttle under one garbage key.
 *
 * Not `@SkipThrottle()`: that names a throttler called `default`, which this
 * config does not have, so it had been skipping nothing.
 */
@SkipThrottling()
@UseFilters(WsExceptionFilter)
@WebSocketGateway({ namespace: FLEET_NAMESPACE })
export class FleetGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(FleetGateway.name);

  @WebSocketServer()
  private readonly namespace!: FleetNamespace;

  constructor(
    private readonly tickets: WsTicketService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  afterInit(namespace: FleetNamespace): void {
    namespace.use((socket, next) => {
      void this.authenticate(socket as FleetSocket)
        .then(() => next())
        .catch((err: unknown) => next(err instanceof Error ? err : new Error('unauthorized')));
    });
  }

  /**
   * The ONLY place a socket's tenant is decided. It comes from a redeemed
   * server-side ticket — never from a query param, a client message, or
   * anything else the browser controls.
   */
  private async authenticate(socket: FleetSocket): Promise<void> {
    if (!this.env.REALTIME_ENABLED) {
      // §19.2 kill switch: refuse cleanly so the console falls to REST polling
      // rather than retrying a socket that will never be accepted.
      throw new Error('realtime_unavailable');
    }

    const auth = socket.handshake.auth as { ticket?: unknown } | undefined;
    const claims = await this.tickets.consume(auth?.ticket);
    if (claims === null) throw new Error('unauthorized');

    // Realm is checked BEFORE the id is trusted. A driver ticket carries a
    // `drivers.id` and no tenant; accepting it here would either unroom the
    // socket or — worse, if a `fleetId` were ever inferred — put a driver in a
    // console's room. Phase 16 added the second realm; this is the check that
    // keeps the two apart.
    if (claims.realm !== 'fleet') throw new Error('unauthorized');

    socket.data.fleetId = claims.fleetId;
    socket.data.userId = claims.subjectId;
  }

  handleConnection(socket: FleetSocket): void {
    const fleetId = socket.data.fleetId;
    if (!fleetId) {
      // Belt and braces: middleware rejection should make this unreachable, but
      // a socket with no tenant must never sit in the namespace unroomed.
      socket.disconnect(true);
      return;
    }

    void socket.join(fleetRoom(fleetId));
    socket.emit('realtime:ready', {
      fleetId,
      serverTime: new Date().toISOString(),
    });
    this.logger.debug(`socket ${socket.id} joined ${fleetRoom(fleetId)}`);
  }

  handleDisconnect(socket: FleetSocket): void {
    this.logger.debug(`socket ${socket.id} disconnected`);
  }

  /** How many sockets for this fleet are attached to THIS node. */
  localRoomSize(fleetId: FleetId | string): number {
    return this.namespace.adapter.rooms.get(fleetRoom(fleetId))?.size ?? 0;
  }

  /**
   * Fan-out of a message this node received from Redis.
   *
   * MUST be `.local`. Every node is subscribed to the same channel and so holds
   * the same message; a non-local emit republishes it through the socket.io
   * adapter to every other node, and each client then receives N copies (N =
   * node count). `.local` is both correct and N x cheaper — the Redis channel
   * IS the cross-node transport here.
   */
  relayLocal<E extends keyof ServerToClientEvents>(
    fleetId: FleetId | string,
    event: E,
    ...payload: Parameters<ServerToClientEvents[E]>
  ): void {
    this.namespace.local.to(fleetRoom(fleetId)).emit(event, ...payload);
  }

  /**
   * Cross-node emit — reaches sockets on every task via the socket.io Redis
   * adapter. Unused in Phase 5 by design (see `relayLocal`); it exists because
   * Phase 17's `job:offer` to `driver:{id}` genuinely needs it, and because the
   * multi-instance test asserts the adapter is actually installed rather than
   * silently absent.
   */
  broadcastAcrossNodes<E extends keyof ServerToClientEvents>(
    fleetId: FleetId | string,
    event: E,
    ...payload: Parameters<ServerToClientEvents[E]>
  ): void {
    this.namespace.to(fleetRoom(fleetId)).emit(event, ...payload);
  }
}
