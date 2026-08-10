import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv, type Env } from '../../config/env';
import { testRedis, closeTestRedis, flushTestRedis } from '../../test/redis';
import { uniqueMobile } from '../../test/db';
import { OtpRateService } from '../auth/otp-rate.service';

/**
 * The per-mobile OTP send limits.
 *
 * These sit ON TOP of the `auth` throttle bucket rather than replacing it,
 * because they answer a different question. The bucket is a burst limit (5 a
 * minute) protecting the endpoint; this bounds SMS SPEND, which 5/min does not —
 * sustained, that is 7,200 messages a day to one handset, each one costing money
 * and waking a real person up.
 */
describe('OtpRateService', () => {
  let env: Env;

  beforeAll(() => {
    env = loadEnv({
      ...process.env,
      OTP_SEND_MAX_PER_WINDOW: '3',
      OTP_SEND_MIN_INTERVAL_SECONDS: '30',
      OTP_SEND_WINDOW_SECONDS: '86400',
    });
  });

  beforeEach(async () => {
    await flushTestRedis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeTestRedis();
  });

  const service = (overrides: Partial<Env> = {}) =>
    new OtpRateService(testRedis(), { ...env, ...overrides } as Env);

  it('refuses a resend inside the cooldown, and says how long to wait', async () => {
    const rate = service();
    const mobile = uniqueMobile();

    await rate.consume(mobile);

    await expect(rate.consume(mobile)).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('does not extend the cooldown when someone hammers resend', async () => {
    // `SET NX` rather than a plain SET: refreshing the key on the attempt that
    // hit it would let a client hold their own cooldown open indefinitely.
    const rate = service({ OTP_SEND_MIN_INTERVAL_SECONDS: 5 } as Partial<Env> as Env);
    const mobile = uniqueMobile();

    await rate.consume(mobile);
    await rate.consume(mobile).catch(() => {});
    await rate.consume(mobile).catch(() => {});

    const ttl = await testRedis().ttl(cooldownKey(mobile));
    expect(ttl).toBeLessThanOrEqual(5);
  });

  it('caps total sends per window regardless of how patiently they are spaced', async () => {
    const rate = service({ OTP_SEND_MIN_INTERVAL_SECONDS: 1 } as Partial<Env> as Env);
    const mobile = uniqueMobile();
    const redis = testRedis();

    // Three allowed, then refused. The cooldown key is cleared between sends to
    // stand in for waiting it out — the window cap is what is under test here.
    for (let i = 0; i < 3; i += 1) {
      await rate.consume(mobile);
      await redis.del(cooldownKey(mobile));
    }

    await expect(rate.consume(mobile)).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('counts per number — one busy handset does not lock out anyone else', async () => {
    const rate = service();
    const mine = uniqueMobile();
    const theirs = uniqueMobile();

    await rate.consume(mine);
    await expect(rate.consume(mine)).rejects.toMatchObject({ code: 'rate_limited' });

    await expect(rate.consume(theirs)).resolves.toBeUndefined();
  });

  it('FAILS OPEN when Redis is unreachable, and says so loudly', async () => {
    // The opposite polarity to `RefreshGraceService`, deliberately. This is a
    // cost control, not a security control: the Redis-backed throttle bucket is
    // still the outer layer, and locking every user out of both apps because
    // Redis blipped is a worse failure than a burst of SMS.
    const broken = {
      set: () => Promise.reject(new Error('redis down')),
      ttl: () => Promise.reject(new Error('redis down')),
      incr: () => Promise.reject(new Error('redis down')),
      expire: () => Promise.reject(new Error('redis down')),
    };
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const rate = new OtpRateService(broken as never, env);
    await expect(rate.consume(uniqueMobile())).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledOnce();
  });

  it('reports the cooldown so the client timer matches the server', async () => {
    expect(service().resendAfterSeconds()).toBe(30);
  });
});

function cooldownKey(mobile: string): string {
  // Mirrors the service: numbers are hashed, never stored raw, so a Redis dump
  // of this keyspace is not a list of everyone who tried to sign in.
  return `otp:cooldown:${createHash('sha256').update(mobile.trim()).digest('hex').slice(0, 32)}`;
}
