import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env';
import { REDIS, REDIS_SUB } from './redis.constants';

export {
  FLEET_EVENTS_CHANNEL,
  LOCATION_CHANNEL,
  METRICS_CHANNEL,
  REDIS,
  REDIS_SUB,
  metricsLockKey,
  truckGeoKey,
  truckHashKey,
  wsTicketKey,
} from './redis.constants';

type ConnectionRole = 'commands' | 'subscriber';

const logger = new Logger('RedisModule');

function createConnection(env: Env, role: ConnectionRole): Redis {
  const client = new Redis(env.REDIS_URL, {
    connectionName: `towing-${role}`,
    // Eager connect: the first booking write should not pay TCP + AUTH latency,
    // and an unreachable Redis announces itself in the boot logs rather than in
    // a customer's dispatch request.
    lazyConnect: false,
    // Capped backoff with a floor — a Redis blip must not turn every task's
    // reconnect into a thundering herd the instant it comes back (§19.6).
    retryStrategy: (times) => Math.min(times * 200, 3_000),
    // Commands give up after a few reconnect attempts so a request fails fast
    // into the degradation ladder (§19.2) instead of hanging for the outage.
    // The subscriber issues no commands; it should keep retrying forever.
    maxRetriesPerRequest: role === 'commands' ? 3 : null,
  });

  // ioredis emits 'error' on every failed reconnect, and an EventEmitter with no
  // 'error' listener throws — without this a two-second blip kills the process.
  client.on('error', (err: Error) => {
    logger.error(`redis ${role} connection error: ${err.message}`);
  });

  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => createConnection(env, 'commands'),
    },
    {
      provide: REDIS_SUB,
      inject: [ENV],
      useFactory: (env: Env) => createConnection(env, 'subscriber'),
    },
  ],
  exports: [REDIS, REDIS_SUB],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(REDIS_SUB) private readonly sub: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    // allSettled: quit() rejects when the socket is already gone (Redis died
    // first, or the task is being killed), and a noisy shutdown must not mask
    // the real reason the process is stopping.
    await Promise.allSettled([this.redis.quit(), this.sub.quit()]);
  }
}
