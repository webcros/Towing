/**
 * The suite disables throttling globally (see `src/test/setup.ts`), so this file
 * — which is ABOUT throttling — turns it back on for itself.
 *
 * It must happen before `createTestApp()`: `ConfigModule` calls `loadEnv()` once
 * per app boot, and `vitest`'s `isolate: true` gives this file its own module
 * graph, so the assignment cannot leak into another spec.
 */
process.env.THROTTLE_DISABLED = '';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeaderFor, createTestApp } from '../../test/app';
import { seedFleet, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { closeTestRedis, flushTestRedis, testRedis } from '../../test/redis';

describe('TenantThrottlerGuard', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let fleetA: string;
  let fleetB: string;
  let authA: string;
  let authB: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();

    const a = await seedFleet(db, 'Tenant A');
    const b = await seedFleet(db, 'Tenant B');
    fleetA = a.fleetId;
    fleetB = b.fleetId;
    authA = await authHeaderFor(app, { userId: a.ownerId, fleetId: a.fleetId });
    authB = await authHeaderFor(app, { userId: b.ownerId, fleetId: b.fleetId });
  });

  it('gives each fleet its own budget from the same source address', async () => {
    // Every request in this file arrives on ::ffff:127.0.0.1. With the stock
    // tracker that is ONE bucket, so tenant B would be throttled by tenant A's
    // traffic — which is what happens behind the BFF in production.
    const limit = 300;

    for (let i = 0; i < limit; i += 1) {
      await request(app.getHttpServer()).get('/v1/fleet/trucks').set('Authorization', authA);
    }

    await request(app.getHttpServer())
      .get('/v1/fleet/trucks')
      .set('Authorization', authA)
      .expect(429);

    await request(app.getHttpServer())
      .get('/v1/fleet/trucks')
      .set('Authorization', authB)
      .expect(200);
  });

  it('spends one budget across different endpoints, not one per endpoint', async () => {
    // The stock generateKey hashes the class and handler names in, so `reads`
    // was really its limit PER HANDLER. These two routes must share.
    for (let i = 0; i < 150; i += 1) {
      await request(app.getHttpServer()).get('/v1/fleet/trucks').set('Authorization', authA);
    }
    for (let i = 0; i < 150; i += 1) {
      await request(app.getHttpServer()).get('/v1/fleet/drivers').set('Authorization', authA);
    }

    await request(app.getHttpServer())
      .get('/v1/fleet/jobs')
      .set('Authorization', authA)
      .expect(429);
  });

  it('writes a readable Redis key rather than a hash', async () => {
    await request(app.getHttpServer()).get('/v1/fleet/trucks').set('Authorization', authA);

    // `thr:reads:f:<fleetId>` — greppable with `redis-cli --scan`, which is the
    // difference between diagnosing a live rate limit in a minute and in an hour.
    expect(await testRedis().get(`thr:reads:f:${fleetA}`)).toBe('1');
    expect(await testRedis().get(`thr:reads:f:${fleetB}`)).toBeNull();
  });

  it('falls back to the source address when there is no usable token', async () => {
    await request(app.getHttpServer()).get('/v1/fleet/trucks').expect(401);
    await request(app.getHttpServer())
      .get('/v1/fleet/trucks')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);

    const keys = await testRedis().keys('thr:reads:ip:*');
    expect(keys).toHaveLength(1);
    expect(await testRedis().get(keys[0]!)).toBe('2');
  });

  it('does not let refresh spend the auth budget', async () => {
    // The class-level @ThrottleBucket('auth') is 5/min. If the handler-level
    // 'refresh' tag did not override it, six refreshes would 429 — and behind
    // the BFF, with no email to key on, that would be five per minute for the
    // whole deployment.
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/v1/fleet/auth/refresh')
        .send({ refreshToken: `token-${i}` });

      expect(res.status).not.toBe(429);
    }
  });

  it('keys the auth bucket on the targeted account, not the caller', async () => {
    const attempt = (email: string) =>
      request(app.getHttpServer())
        .post('/v1/fleet/auth/login')
        .send({ email, password: 'wrong-password-here' });

    for (let i = 0; i < 5; i += 1) await attempt('victim@example.com');
    expect((await attempt('victim@example.com')).status).toBe(429);

    // A second account is untouched: credential stuffing against one target
    // must not lock everyone else out of logging in.
    expect((await attempt('bystander@example.com')).status).not.toBe(429);
  });

  it('never throttles the health probes', async () => {
    // Unauthenticated, so per-tenant keying would put every load-balancer probe
    // from every target into one bucket. Without @SkipThrottle() a scaled-out
    // deployment 429s its own health checks and the ALB kills healthy targets.
    for (let i = 0; i < 320; i += 1) {
      await request(app.getHttpServer()).get('/v1/health').expect(200);
    }
  });

  it('still reports the rate-limit headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/fleet/trucks')
      .set('Authorization', authA)
      .expect(200);

    expect(res.headers['x-ratelimit-limit-reads']).toBe('300');
    expect(res.headers['x-ratelimit-remaining-reads']).toBe('299');
    // Seconds, not milliseconds — the storage converts, and a 60000 here is the
    // classic ms-in/seconds-out bug.
    expect(Number(res.headers['x-ratelimit-reset-reads'])).toBeLessThanOrEqual(60);
  });
});
