import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ThrottlerStorageService, type ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.constants';

/**
 * `ThrottlerStorageRecord` is declared in the package but not re-exported from
 * its index, so it is derived from the one method that returns it — which also
 * means it cannot drift from the interface we implement.
 */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Redis-backed `ThrottlerStorage` — the counter that makes a rate limit mean the
 * same thing across N API tasks.
 *
 * Hand-rolled rather than imported. Both published storage packages peer-depend
 * on `ioredis@^5` while the app runs `ioredis@6`, and BullMQ already drags a
 * transitive 5.x copy into the tree: installing one would resolve against that
 * copy, giving a second `Redis` class and a second connection pool, and quietly
 * breaking the single-`REDIS`-client invariant `RedisModule` is built on. What
 * the package contains is the script below, which we would have had to read
 * anyway to know its block semantics.
 *
 * FIXED WINDOW, not the sliding decrement `ThrottlerStorageService` uses. The
 * in-memory implementation schedules a `setTimeout` per hit that decrements the
 * counter one at a time; a fixed window is one INCR and one PEXPIRE, which is
 * the only shape that stays atomic across processes. The user-visible
 * difference is that the budget refills all at once at the window edge instead
 * of trickling — for a 60 s window and limits in the hundreds, nothing notices.
 */
@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  /**
   * Availability fallback, NOT a cache.
   *
   * Fail-closed would turn a Redis blip into a total API outage, which is worse
   * than what rate limiting defends against. Fail-open is a DoS hole. Falling
   * back to the stock in-memory store degrades the guarantee from "global
   * across N tasks" to "per-task, so N x the limit" — which is precisely what
   * this service shipped as before Phase 8 — while never dropping a legitimate
   * request.
   */
  private readonly fallback = new ThrottlerStorageService();

  /** Last time the degradation was logged, so an outage is not one line per request. */
  private lastDegradedLogAt = 0;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleInit(): void {
    // defineCommand, not `eval`: this runs on EVERY request, so it wants EVALSHA
    // with ioredis's automatic reload after a NOSCRIPT (i.e. after a SCRIPT
    // FLUSH or a failover). The idempotency interceptor uses plain `eval`
    // because it only runs on requests that carry an Idempotency-Key.
    //
    // Defining twice on the shared client is harmless — it is a property
    // assignment, and every instance defines the identical script.
    this.redis.defineCommand(THROTTLE_COMMAND, {
      numberOfKeys: 2,
      lua: INCREMENT_SCRIPT,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `thr:${throttlerName}:${key}`;

    try {
      const [totalHits, windowPttl, blocked, blockPttl] = await (
        this.redis as unknown as ThrottleCommandClient
      )[THROTTLE_COMMAND](
        counterKey,
        `${counterKey}:blk`,
        String(ttl),
        String(limit),
        String(blockDuration),
      );

      return {
        totalHits,
        // MILLISECONDS IN, SECONDS OUT. @nestjs/throttler hands `ttl` and
        // `blockDuration` in ms but reads both time fields back in seconds
        // (ThrottlerStorageService returns `Math.ceil((expiresAt - now) / 1000)`),
        // and they land verbatim in `X-RateLimit-Reset` and `Retry-After`.
        // Returning ms here produces a Retry-After of 60000 — sixteen hours.
        timeToExpire: Math.ceil(windowPttl / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockPttl / 1000),
      };
    } catch (error) {
      this.logDegraded(error);
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  onApplicationShutdown(): void {
    // The fallback keeps one un-unref'd setTimeout per counted hit. If it was
    // ever used — and a spec that kills Redis mid-run will use it — those
    // timers hold the event loop open and vitest never exits.
    this.fallback.onApplicationShutdown();
  }

  private logDegraded(error: unknown): void {
    const now = Date.now();
    if (now - this.lastDegradedLogAt < DEGRADED_LOG_INTERVAL_MS) return;
    this.lastDegradedLogAt = now;

    this.logger.warn(
      `Rate limiting degraded to per-process counters: ${String(error)}. ` +
        'Limits are now N x the configured value across N tasks.',
    );
  }
}

const THROTTLE_COMMAND = 'towThrottleIncr';
const DEGRADED_LOG_INTERVAL_MS = 10_000;

/** The shape `defineCommand` grafts onto the client. */
interface ThrottleCommandClient {
  [THROTTLE_COMMAND]: (
    counterKey: string,
    blockKey: string,
    ttlMs: string,
    limit: string,
    blockDurationMs: string,
  ) => Promise<[number, number, number, number]>;
}

/**
 * KEYS[1] window counter · KEYS[2] block marker
 * ARGV[1] ttl ms · ARGV[2] limit · ARGV[3] blockDuration ms
 * Returns { totalHits, windowPttlMs, isBlocked (1|0), blockPttlMs }
 */
const INCREMENT_SCRIPT = `
local blockPttl = redis.call('PTTL', KEYS[2])

-- The block is checked FIRST and short-circuits the counter, mirroring
-- ThrottlerStorageService's \`if (!isBlocked) fireHitCount(...)\`. A blocked
-- caller that kept incrementing would re-arm its own block on every request and
-- never be released.
if blockPttl > 0 then
  local held = tonumber(redis.call('GET', KEYS[1])) or 0
  local heldPttl = redis.call('PTTL', KEYS[1])
  if heldPttl < 0 then heldPttl = 0 end
  return { held, heldPttl, 1, blockPttl }
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

local windowPttl = redis.call('PTTL', KEYS[1])
-- PTTL of -1 means the key exists with no expiry, reachable only if a node died
-- between the INCR and the PEXPIRE above. Without this re-arm the counter is
-- immortal and that tenant is rate-limited forever.
if windowPttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  windowPttl = tonumber(ARGV[1])
end

if hits > tonumber(ARGV[2]) then
  local blockMs = tonumber(ARGV[3])
  redis.call('SET', KEYS[2], '1', 'PX', blockMs)
  -- Retire the counter with the block, so the window cannot outlive it. If the
  -- block expired while an over-limit count was still alive, the very next
  -- request would exceed the limit again and re-block immediately — a tenant
  -- locked out permanently after one burst. This is the Redis equivalent of the
  -- in-memory store resetting totalHits to 0 when a block lapses.
  redis.call('PEXPIRE', KEYS[1], blockMs)
  return { hits, blockMs, 1, blockMs }
end

return { hits, windowPttl, 0, 0 }
`;
