import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { ENV, type Env } from '../config/env';
import { REDIS } from '../redis/redis.constants';

/**
 * Socket.io transport with `@socket.io/redis-adapter` wired from the first
 * commit (§18: "the Redis adapter lets all Fargate tasks broadcast
 * consistently").
 *
 * Install it in `main.ts` BEFORE `app.listen()` — `listen()` calls `init()`
 * implicitly, and an adapter set afterwards is silently ignored.
 *
 * NOTE ON WHAT THE ADAPTER IS AND IS NOT FOR HERE. Phase 5's own fan-out
 * (location/booking/metrics) already crosses nodes via our Redis channels, so
 * those relays emit with `.local` — see `RealtimeRelayService`. The adapter
 * earns its place for *targeted* cross-node emits (`driver:{id}` in Phase 17)
 * and cross-node room introspection, and installing it now means the handshake,
 * room scoping and namespace layout never get rebuilt for Track B.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private readonly env: Env;
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
    this.env = app.get<Env>(ENV);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const origins = this.env.CORS_ORIGINS;

    const server = super.createIOServer(port, {
      ...options,
      // Socket.io's `cors` covers the polling handshake only. A WebSocket
      // upgrade is NOT subject to browser CORS at all, so without an explicit
      // origin check any page on the internet could open a socket and present a
      // stolen ticket. Belt and braces on top of the single-use ticket.
      cors: { origin: origins, credentials: true },
      allowRequest: (
        req: { headers: { origin?: string } },
        callback: (err: string | null | undefined, allowed: boolean) => void,
      ) => {
        const origin = req.headers.origin;
        // Non-browser clients (the load smoke, supertest, future server-to-server)
        // send no Origin header and are not subject to the same-origin threat.
        if (origin === undefined || origins.includes(origin)) return callback(null, true);
        this.logger.warn(`rejected socket handshake from origin ${origin}`);
        callback('origin_not_allowed', false);
      },
      // §18: heartbeat every 25s, and the ALB idle timeout must sit above it
      // (>= 75s) or a quiet-but-alive socket gets culled by the load balancer.
      pingInterval: 25_000,
      pingTimeout: 20_000,
      // WebSocket only. Polling would need sticky sessions at the ALB just to
      // keep a handshake's two HTTP requests on one task; skipping it removes
      // that requirement and halves the failure modes.
      transports: ['websocket'],
      // We serve no browser client bundle from the API — the console imports
      // socket.io-client from npm.
      serveClient: false,
      // Deliberately NOT enabling `connectionStateRecovery`: it replays packets
      // missed during a disconnect, which for a location stream means replaying
      // stale positions. §18 says the client resyncs authoritative state over
      // REST and never assumes socket completeness.
    }) as { adapter: (factory: unknown) => void };

    // `.duplicate()` copies the source client's options, and the commands client
    // carries `maxRetriesPerRequest: 3` (fail-fast into the degradation ladder).
    // The adapter's clients must retry indefinitely instead — a capped client
    // stops delivering broadcasts after a blip and the cluster silently splits.
    const base = this.app.get<Redis>(REDIS);
    this.pubClient = base.duplicate({ maxRetriesPerRequest: null, connectionName: 'towing-io-pub' });
    this.subClient = base.duplicate({ maxRetriesPerRequest: null, connectionName: 'towing-io-sub' });

    for (const [role, client] of [
      ['pub', this.pubClient],
      ['sub', this.subClient],
    ] as const) {
      client.on('error', (err: Error) => {
        this.logger.error(`socket.io redis adapter ${role} error: ${err.message}`);
      });
    }

    server.adapter(createAdapter(this.pubClient, this.subClient));
    this.logger.log('socket.io redis adapter installed');

    return server;
  }

  async close(server: unknown): Promise<void> {
    await super.close(server as never);
    // allSettled: quit() rejects when the socket is already gone, and a noisy
    // shutdown must not mask the real reason the process is stopping.
    await Promise.allSettled([this.pubClient?.quit(), this.subClient?.quit()]);
  }
}
