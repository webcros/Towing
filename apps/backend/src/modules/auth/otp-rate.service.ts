import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { ApiException } from '../../common/errors/api-exception';
import { ENV, type Env } from '../../config/env';
import { REDIS } from '../../redis/redis.constants';

/**
 * Per-mobile limits on OTP sends, on top of the `auth` throttle bucket.
 *
 * WHY THIS EXISTS ALONGSIDE THE THROTTLER. The bucket is a BURST limit — 5 per
 * minute — and the thing it protects is the login endpoint. It does not protect
 * the SMS bill: 5/min sustained is 7,200 messages a day to a single number, each
 * one costing real money and landing on a real person's phone. That is a
 * different question with a different window, so it gets its own counter.
 *
 * The phase plan originally called for a bespoke Redis rate window here because
 * `@nestjs/throttler`'s default store was per-process and therefore N times too
 * permissive behind more than one task. Phase 8 replaced that store with
 * `RedisThrottlerStorage`, so THAT rationale is spent. What was left unsolved is
 * the two things above: the bucket had no per-account key for a phone-only realm
 * (fixed in `TenantThrottlerGuard`), and no limit at the timescale SMS spend
 * happens on (fixed here).
 *
 * FAILS OPEN, the opposite polarity to `RefreshGraceService`. A Redis outage
 * here means someone could burn SMS credit; a Redis outage with fail-closed
 * means nobody in either mobile app can log in at all. The Redis-backed throttle
 * bucket is still the outer layer, and this is a cost control rather than a
 * security control, so availability wins. The error is logged loudly.
 */
@Injectable()
export class OtpRateService {
  private readonly logger = new Logger(OtpRateService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Records a send against a mobile number, throwing if it is over budget.
   *
   * Called BEFORE the SMS goes out, and counted even when the send later fails:
   * the cost being controlled is the attempt, and not counting failures would
   * make a provider outage look like unlimited quota.
   */
  async consume(mobile: string): Promise<void> {
    const id = hash(mobile);

    // Numbers are hashed, never stored raw: a Redis dump of this keyspace would
    // otherwise be a list of everyone who tried to sign in, in plaintext.
    const cooldownKey = `otp:cooldown:${id}`;
    const windowKey = `otp:sends:${id}`;

    try {
      // NX so an existing cooldown is not extended by the attempt that hit it —
      // otherwise hammering resend would hold the cooldown open indefinitely.
      const fresh = await this.redis.set(
        cooldownKey,
        '1',
        'EX',
        this.env.OTP_SEND_MIN_INTERVAL_SECONDS,
        'NX',
      );

      if (fresh === null) {
        const ttl = await this.redis.ttl(cooldownKey);
        throw ApiException.rateLimited(
          `Wait ${Math.max(ttl, 1)} seconds before requesting another code`,
        );
      }

      const sends = await this.redis.incr(windowKey);
      if (sends === 1) {
        // Only the first send in a window arms the expiry, so the window is
        // fixed from the first attempt rather than sliding forward forever.
        await this.redis.expire(windowKey, this.env.OTP_SEND_WINDOW_SECONDS);
      }

      if (sends > this.env.OTP_SEND_MAX_PER_WINDOW) {
        throw ApiException.rateLimited('Too many codes requested for this number — try later');
      }
    } catch (error) {
      if (error instanceof ApiException) throw error;

      this.logger.error(
        `OTP rate limiting unavailable, allowing the send (SMS spend is unguarded): ${String(error)}`,
      );
    }
  }

  /** Seconds a client should wait before offering "resend" — drives the UI timer. */
  resendAfterSeconds(): number {
    return this.env.OTP_SEND_MIN_INTERVAL_SECONDS;
  }
}

function hash(mobile: string): string {
  return createHash('sha256').update(mobile.trim()).digest('hex').slice(0, 32);
}
