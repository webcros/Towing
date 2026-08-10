import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import { loadEnv, type Env } from '../../config/env';
import { THROTTLE_BUCKETS, throttlerOptions } from './throttler.config';

const env = loadEnv({
  ...process.env,
  THROTTLE_DISABLED: '',
});

/**
 * `ThrottlerModuleOptions` is a union with a bare `ThrottlerOptions[]`; we
 * always return the object form, and narrowing once here keeps the assertions
 * readable.
 */
function options(source: Env = env): { throttlers: ThrottlerOptions[]; skipIf?: unknown } {
  const result = throttlerOptions(source);
  if (Array.isArray(result)) throw new Error('expected the object form of ThrottlerModuleOptions');
  return result as { throttlers: ThrottlerOptions[]; skipIf?: unknown };
}

describe('throttlerOptions', () => {
  /**
   * The drift guard.
   *
   * `SkipThrottling()` has to name every bucket explicitly — the library's
   * `@SkipThrottle()` matches skip metadata per throttler name and defaults to
   * a name (`default`) this config does not use, so a bare one skips nothing.
   * A sixth bucket added here but not to `THROTTLE_BUCKETS` would therefore
   * silently keep throttling the webhook controller, the gateway and the health
   * probes. This is the assertion that stops that.
   */
  it('configures exactly the buckets THROTTLE_BUCKETS declares', () => {
    const configured = options()
      .throttlers.map((t) => t.name)
      .sort();

    expect(configured).toEqual([...THROTTLE_BUCKETS].sort());
  });

  it('never sets getTracker or generateKey, which would silently beat the guard', () => {
    // ThrottlerGuard.onModuleInit does `commonOptions.getTracker ??= this.getTracker.bind(this)`.
    // An entry here wins over TenantThrottlerGuard's override, and every tenant
    // collapses back into one IP-keyed bucket with no error anywhere.
    const raw = options() as Record<string, unknown>;

    expect(raw.getTracker).toBeUndefined();
    expect(raw.generateKey).toBeUndefined();
  });

  it('honours THROTTLE_DISABLED for load runs and the test suite', () => {
    expect(options().skipIf).toBeUndefined();

    const disabled = options(loadEnv({ ...process.env, THROTTLE_DISABLED: '1' }));
    expect(disabled.skipIf).toBeTypeOf('function');
  });

  /**
   * THROTTLE_DISABLED has to disable EVERY bucket, not just `reads`.
   *
   * `ThrottlerGuard` resolves the switch as
   * `namedThrottler.skipIf || this.commonOptions.skipIf` — an OR, not a merge —
   * so the module-level `skipIf` above never reaches a bucket that carries its
   * own. Every tagged bucket does, which meant the flag had in practice been
   * turning off `reads` and leaving money, auth, refresh and realtime live in
   * the test suite and in every k6 run. Found when the sixth admin login in a
   * spec 429'd instead of reporting its lockout.
   */
  it('disables every bucket, not only the untagged one', () => {
    const disabled = options(loadEnv({ ...process.env, THROTTLE_DISABLED: '1' }));
    const context = {
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;

    for (const throttler of disabled.throttlers) {
      // `reads` has no per-throttler skipIf and relies on the module-level one.
      if (!throttler.skipIf) continue;
      expect(throttler.skipIf(context), `${throttler.name} still throttles`).toBe(true);
    }
  });

  it('still applies the tagged-bucket inversion when throttling is ON', () => {
    // The guard evaluates every throttler on every route, so a tight bucket must
    // skip any route that did not opt into it — otherwise `auth`'s 5/min would
    // cap the whole API.
    const context = {
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;

    const auth = options().throttlers.find((t) => t.name === 'auth');
    expect(auth?.skipIf?.(context)).toBe(true);
  });

  it('takes every limit from env so a load run can retune without a redeploy', () => {
    const tuned = options(
      loadEnv({ ...process.env, THROTTLE_DISABLED: '', THROTTLE_READS_LIMIT: '7' }),
    );

    expect(tuned.throttlers.find((t) => t.name === 'reads')?.limit).toBe(7);
  });
});
