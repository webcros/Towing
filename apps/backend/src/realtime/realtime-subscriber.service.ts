import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_SUB } from '../redis/redis.constants';

export type ChannelHandler = (payload: unknown, channel: string) => void;

/**
 * Owns `REDIS_SUB` — the second connection `RedisModule` has provisioned since
 * Phase 3 for exactly this ("sharing one client would break every GET/SET in the
 * process the moment the tracking gateway subscribed").
 *
 * Everything realtime multiplexes over this ONE client and ONE `message`
 * listener. Registering a listener per channel would trip Node's
 * MaxListenersExceededWarning as soon as Track B adds its namespaces, and would
 * make every handler pay every channel's JSON.parse.
 *
 * The channel→handler table is also the shape that makes sharding cheap later:
 * splitting `location:ping` into `location:ping:{fleetId}` with dynamic
 * subscribe-on-room-join is a change to this file only.
 */
@Injectable()
export class RealtimeSubscriberService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeSubscriberService.name);
  /**
   * A LIST per channel, not a single handler. `fleet:events` genuinely has two
   * independent consumers — the relay (forwards `booking:status` to sockets) and
   * the metrics broadcaster (recomputes KPIs) — and a single-handler map would
   * silently let whichever registered second erase the other.
   */
  private readonly handlers = new Map<string, ChannelHandler[]>();
  private listening = false;
  private destroyed = false;

  constructor(@Inject(REDIS_SUB) private readonly sub: Redis) {}

  async subscribe(channel: string, handler: ChannelHandler): Promise<void> {
    if (this.destroyed) return;

    const existing = this.handlers.get(channel);
    if (existing) {
      existing.push(handler);
    } else {
      this.handlers.set(channel, [handler]);
    }

    if (!this.listening) {
      this.sub.on('message', (incoming: string, raw: string) => this.dispatch(incoming, raw));
      this.listening = true;
    }

    // SUBSCRIBE is idempotent, so a second consumer of the same channel costs
    // nothing beyond the extra array entry.
    await this.sub.subscribe(channel);
    this.logger.debug(`subscribed to ${channel}`);
  }

  private dispatch(channel: string, raw: string): void {
    if (this.destroyed) return;
    const handlers = this.handlers.get(channel);
    if (!handlers || handlers.length === 0) return;

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      // A malformed message is a publisher bug, not a reason to take the
      // gateway down for every connected console.
      this.logger.warn(`discarded unparseable message on ${channel}`);
      return;
    }

    for (const handler of handlers) {
      try {
        handler(payload, channel);
      } catch (err) {
        // One bad consumer must not stop the others from seeing the message.
        this.logger.error(
          `handler for ${channel} threw: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    const channels = [...this.handlers.keys()];
    this.handlers.clear();
    if (channels.length === 0) return;
    // Unsubscribe rather than quit: RedisModule owns this client's lifecycle and
    // closes it on application shutdown.
    await this.sub.unsubscribe(...channels).catch(() => undefined);
  }
}
