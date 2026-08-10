import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.constants';

/**
 * Read-through JSON cache on Redis. Deliberately tiny: `getOrSet` is the only
 * verb Phase 4 needs (dashboard 15s). Failure mode is availability-first — a
 * Redis blip serves fresh data instead of an error.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getOrSet<T>(key: string, ttlSeconds: number, produce: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (err) {
      this.logger.warn(`cache read failed for ${key}: ${message(err)}`);
    }

    const value = await produce();

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`cache write failed for ${key}: ${message(err)}`);
    }

    return value;
  }

  /** Event-driven bust (mutations call this so a 15s TTL never serves stale KPIs). */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`cache invalidate failed for ${key}: ${message(err)}`);
    }
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
