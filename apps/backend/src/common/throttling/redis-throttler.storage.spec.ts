import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app';
import { setupTestDatabase } from '../../test/db';
import { closeTestRedis, flushTestRedis, testRedis } from '../../test/redis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * The Phase 8 deploy gate, half one: a rate limit that means the same thing
 * across N API tasks.
 *
 * The assertion that carries this file is `shares one budget across two app
 * instances` — everything else is guarding the ways a hand-rolled storage goes
 * quietly wrong. With the in-memory store that test passes 240 requests before
 * a 429, which is exactly the "N x too permissive" defect the gate names.
 *
 * `GET /v1/health` is the probe: unauthenticated, no DB work, and (as of the
 * per-tenant keying step) it will carry `@SkipThrottle()` — so this file drives
 * the storage directly rather than through a route wherever it can, and uses
 * HTTP only for the two-instance proof.
 */
describe('RedisThrottlerStorage', () => {
  const TTL_MS = 1_000;
  const LIMIT = 3;
  const BLOCK_MS = 1_000;

  let app: INestApplication;
  let storage: RedisThrottlerStorage;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
    storage = app.get(RedisThrottlerStorage);
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  beforeEach(async () => {
    await flushTestRedis();
  });

  const hit = (key: string) => storage.increment(key, TTL_MS, LIMIT, BLOCK_MS, 'reads');

  it('counts hits and reports the remaining window in SECONDS', async () => {
    const first = await hit('k1');

    expect(first.totalHits).toBe(1);
    expect(first.isBlocked).toBe(false);
    // ms in, seconds out. The value lands verbatim in X-RateLimit-Reset, so a
    // millisecond figure here reads as a 1000x longer window to every client.
    expect(first.timeToExpire).toBeGreaterThan(0);
    expect(first.timeToExpire).toBeLessThanOrEqual(Math.ceil(TTL_MS / 1000));

    expect((await hit('k1')).totalHits).toBe(2);
    expect((await hit('k1')).totalHits).toBe(3);
  });

  it('blocks the request that exceeds the limit, and reports Retry-After in seconds', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await hit('k2')).isBlocked).toBe(false);
    }

    const blocked = await hit('k2');
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
    expect(blocked.timeToBlockExpire).toBeLessThanOrEqual(Math.ceil(BLOCK_MS / 1000));
  });

  it('does not count hits while blocked, so a hammering client cannot extend its own block', async () => {
    for (let i = 0; i <= LIMIT; i += 1) await hit('k3');

    const counterAfterBlock = await testRedis().get('thr:reads:k3');
    for (let i = 0; i < 5; i += 1) {
      expect((await hit('k3')).isBlocked).toBe(true);
    }

    // ThrottlerStorageService's `if (!isBlocked) fireHitCount(...)`. Were the
    // counter still climbing, each request would re-arm the block and the
    // tenant would never be released.
    expect(await testRedis().get('thr:reads:k3')).toBe(counterAfterBlock);
  });

  it('releases cleanly: the window dies with the block, so the next request is not instantly re-blocked', async () => {
    for (let i = 0; i <= LIMIT; i += 1) await hit('k4');
    expect((await hit('k4')).isBlocked).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, BLOCK_MS + 150));

    // The over-limit count must not have outlived the block. If it had, this
    // request would exceed the limit again and re-block immediately — a tenant
    // locked out permanently after a single burst.
    const afterRelease = await hit('k4');
    expect(afterRelease.isBlocked).toBe(false);
    expect(afterRelease.totalHits).toBe(1);
  });

  it('re-arms an expiry-less counter rather than rate-limiting that key forever', async () => {
    // The state a node dying between INCR and PEXPIRE leaves behind.
    await testRedis().set('thr:reads:k5', '1');
    expect(await testRedis().pttl('thr:reads:k5')).toBe(-1);

    const result = await hit('k5');

    expect(result.totalHits).toBe(2);
    expect(await testRedis().pttl('thr:reads:k5')).toBeGreaterThan(0);
  });

  it('namespaces by throttler, so a money hit does not spend the reads budget', async () => {
    await storage.increment('same', TTL_MS, LIMIT, BLOCK_MS, 'reads');
    const money = await storage.increment('same', TTL_MS, LIMIT, BLOCK_MS, 'money');

    expect(money.totalHits).toBe(1);
  });

  it('degrades to per-process counting instead of 500ing when Redis is unreachable', async () => {
    const broken = new RedisThrottlerStorage({
      defineCommand: () => undefined,
      towThrottleIncr: () => Promise.reject(new Error('ECONNREFUSED')),
    } as never);
    broken.onModuleInit();

    // Fail-soft: a Redis blip must not take the API down (fail-closed) and must
    // not remove the limit entirely (fail-open). It degrades to exactly the
    // pre-Phase-8 guarantee.
    const first = await broken.increment('k6', TTL_MS, LIMIT, BLOCK_MS, 'reads');
    expect(first.totalHits).toBe(1);
    expect(first.isBlocked).toBe(false);

    for (let i = 0; i < LIMIT; i += 1) {
      await broken.increment('k6', TTL_MS, LIMIT, BLOCK_MS, 'reads');
    }
    expect((await broken.increment('k6', TTL_MS, LIMIT, BLOCK_MS, 'reads')).isBlocked).toBe(true);

    // The fallback leaves one un-unref'd timer per counted hit; without this
    // vitest hangs after the last assertion.
    broken.onApplicationShutdown();
  });
});

describe('RedisThrottlerStorage across instances', () => {
  let nodeA: INestApplication;
  let nodeB: INestApplication;

  beforeAll(async () => {
    await setupTestDatabase();
    await flushTestRedis();
    nodeA = await createTestApp();
    nodeB = await createTestApp();
  });

  afterAll(async () => {
    await nodeA.close();
    await nodeB.close();
    await closeTestRedis();
  });

  afterEach(async () => {
    await flushTestRedis();
  });

  /**
   * THE assertion of this step. Two full apps, one Redis — the ECS rehearsal,
   * automated, exactly as `multi-instance.e2e.spec.ts` does for the gateway.
   *
   * Driven through the storage rather than over HTTP because the routes worth
   * hammering all carry auth or `@SkipThrottle()`, and because this is the
   * component the deploy gate names.
   */
  it('shares one budget across two app instances', async () => {
    const a = nodeA.get(RedisThrottlerStorage);
    const b = nodeB.get(RedisThrottlerStorage);

    expect(a).not.toBe(b);

    await a.increment('tenant', 60_000, 4, 60_000, 'reads');
    await b.increment('tenant', 60_000, 4, 60_000, 'reads');
    await a.increment('tenant', 60_000, 4, 60_000, 'reads');
    const fourth = await b.increment('tenant', 60_000, 4, 60_000, 'reads');

    expect(fourth.totalHits).toBe(4);
    expect(fourth.isBlocked).toBe(false);

    // With the in-memory store each node would be on its own count of 2 here
    // and this would pass silently — the "N x too permissive" defect.
    const fifth = await a.increment('tenant', 60_000, 4, 60_000, 'reads');
    expect(fifth.isBlocked).toBe(true);
  });

  it('serves requests normally while under budget', async () => {
    await request(nodeA.getHttpServer()).get('/v1/health').expect(200);
    await request(nodeB.getHttpServer()).get('/v1/health').expect(200);
  });
});
