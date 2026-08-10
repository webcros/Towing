import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  seconds,
  SkipThrottle,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Env } from '../../config/env';

const WINDOW_MS = seconds(60);

/**
 * Every bucket, in one place. `throttlerOptions` below is asserted against this
 * list by `throttler.config.spec.ts`, so a new bucket cannot be added to one
 * without the other — which matters because `SkipThrottling` has to name them
 * all explicitly (see below).
 */
export const THROTTLE_BUCKETS = ['reads', 'money', 'auth', 'refresh', 'realtime'] as const;

export type ThrottleBucketName = (typeof THROTTLE_BUCKETS)[number];

/**
 * Opts a route out of EVERY bucket.
 *
 * Use this, never a bare `@SkipThrottle()`. The library's decorator defaults to
 * `{ default: true }` and the guard checks skip metadata per throttler NAME —
 * so on a config like ours, where no throttler is called `default`, a bare
 * `@SkipThrottle()` silently skips nothing at all. (It was silently doing
 * nothing on the webhook controller and the gateway until Phase 8 noticed.)
 */
export const SkipThrottling = (): MethodDecorator & ClassDecorator =>
  SkipThrottle(Object.fromEntries(THROTTLE_BUCKETS.map((bucket) => [bucket, true])));

/**
 * Tags a handler (or a whole controller) into a tighter bucket:
 * `@ThrottleBucket('auth')` on the OTP routes, `@ThrottleBucket('money')` on
 * payment/payout mutations. Untagged routes get the `reads` baseline.
 */
export const ThrottleBucket = Reflector.createDecorator<ThrottleBucketName>();

const reflector = new Reflector();

/**
 * @nestjs/throttler evaluates *every* configured throttler on *every* route, so
 * a bare 5/min bucket would cap the entire API at 5 requests a minute. Inverting
 * it — each tight bucket skips unless the route opted in — is the only way to
 * get per-bucket limits out of a single global guard.
 */
function skipUnlessTagged(bucket: ThrottleBucketName) {
  return (context: ExecutionContext): boolean =>
    reflector.getAllAndOverride(ThrottleBucket, [context.getHandler(), context.getClass()]) !==
    bucket;
}

/**
 * Options factory for `ThrottlerModule.forRootAsync(...)`.
 *
 * STORAGE: `RedisThrottlerStorage` (Phase 8), so one budget is shared by every
 * API task rather than each task keeping its own. It degrades to the stock
 * in-memory store if Redis is unreachable — see that file for why fail-soft is
 * the right polarity here.
 *
 * ⚠ DO NOT add `getTracker` or `generateKey` to the returned object.
 * `ThrottlerGuard.onModuleInit` does `commonOptions.getTracker ??= this.getTracker.bind(this)`,
 * so an entry here silently WINS over `TenantThrottlerGuard`'s override and
 * every tenant collapses back into one IP-keyed bucket.
 */
export function throttlerOptions(env: Env, storage?: ThrottlerStorage): ThrottlerModuleOptions {
  /**
   * ⚠ THE MODULE-LEVEL `skipIf` BELOW ONLY REACHES BUCKETS THAT HAVE NONE OF
   * THEIR OWN. `ThrottlerGuard` resolves it as
   * `namedThrottler.skipIf || this.commonOptions.skipIf` — a logical OR, not a
   * merge — so every bucket carrying `skipUnlessTagged(...)` (money, auth,
   * refresh, realtime) never saw it, and `THROTTLE_DISABLED=1` had in practice
   * been disabling `reads` and nothing else.
   *
   * That is why the tagged buckets go through `skipTagged()` here rather than
   * `skipUnlessTagged()` directly: when the switch is off it has to be off for
   * all five, which is what the name promises and what a k6 run and the test
   * suite both depend on.
   *
   * Same family of defect as the two already recorded in this directory: a
   * library option that looks applied and silently is not.
   */
  const skipTagged = (bucket: ThrottleBucketName) =>
    env.THROTTLE_DISABLED ? () => true : skipUnlessTagged(bucket);

  return {
    errorMessage: 'Too many requests, please retry shortly',
    ...(storage ? { storage } : {}),
    // Escape hatch for test suites and load runs that legitimately exceed the
    // reads budget. `THROTTLE_DISABLED=1` is mandatory for a k6 run, or the run
    // measures this file instead of the API.
    ...(env.THROTTLE_DISABLED ? { skipIf: () => true } : {}),
    throttlers: [
      // Baseline for ordinary reads and writes; always on.
      //
      // These numbers only started meaning what they say in Phase 8. The stock
      // `generateKey` hashes `ClassName-handlerName` into the key, so this was
      // really its limit PER ENDPOINT — roughly 21x looser in aggregate — and
      // the default tracker keys on req.ip, which behind the BFF is one bucket
      // shared by every tenant. `TenantThrottlerGuard` fixes both, which is why
      // the limit rose from 120 to 300 in the same change.
      { name: 'reads', ttl: WINDOW_MS, limit: env.THROTTLE_READS_LIMIT },
      // Money mutations are idempotent but expensive downstream (Razorpay,
      // ledger writes) — a stuck client must not be able to hammer them.
      {
        name: 'money',
        ttl: WINDOW_MS,
        limit: env.THROTTLE_MONEY_LIMIT,
        skipIf: skipTagged('money'),
      },
      // OTP send/verify: the limit is what makes brute-forcing a 6-digit code
      // infeasible, so it is deliberately far below anything a human hits.
      {
        name: 'auth',
        ttl: WINDOW_MS,
        limit: env.THROTTLE_AUTH_LIMIT,
        skipIf: skipTagged('auth'),
      },
      /**
       * Token refresh, split out of `auth` in Phase 8.
       *
       * It had been sharing the controller's 5/min because `@ThrottleBucket`
       * sits on `AuthController` as a whole. That was survivable only while the
       * tracker was a shared IP and the key included the handler name. Per
       * tenant, a refresh carries no email to key on, so it would fall back to
       * the BFF's address — five refreshes a minute for the ENTIRE deployment,
       * and a console that logs everyone out under load.
       *
       * A refresh is also a different kind of event from a login: it costs no
       * scrypt, it is driven by the access-token TTL rather than by a human, and
       * several open tabs legitimately fire it at once.
       */
      {
        name: 'refresh',
        ttl: WINDOW_MS,
        limit: env.THROTTLE_REFRESH_LIMIT,
        skipIf: skipTagged('refresh'),
      },
      // WebSocket handshake tickets. One per connection attempt, and the client
      // backs off exponentially, so a healthy console spends a handful an hour —
      // but a reconnect storm across many tabs must not be free.
      {
        name: 'realtime',
        ttl: WINDOW_MS,
        limit: env.THROTTLE_REALTIME_LIMIT,
        skipIf: skipTagged('realtime'),
      },
    ],
  };
}
