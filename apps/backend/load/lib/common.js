import { SharedArray } from 'k6/data';
import { check } from 'k6';

/**
 * Shared helpers for the k6 profiles.
 *
 * Plain JavaScript, not TypeScript: k6 is a Go binary with its own JS runtime,
 * not Node. There is no npm here and no build step — only k6's own modules.
 */

export const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:4000';

/**
 * `open()` is only legal in k6's init context, and a `SharedArray` keeps ONE
 * copy of the tokens across all VUs instead of one per VU.
 */
export const TOKENS = new SharedArray('tokens', () =>
  JSON.parse(open('/scripts/.tokens.json')),
);

export function authFor(vu) {
  return TOKENS[vu % TOKENS.length];
}

export function headers(token) {
  return { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } };
}

/**
 * The guard against a bogus green.
 *
 * A load run needs `THROTTLE_DISABLED=1`, or the reads bucket caps every VU at
 * a few requests a second and the run measures the rate limiter instead of the
 * API — while still reporting a beautiful p95, because a 429 is fast. Every
 * response passes through here, and `checks{kind:throttle}` is a threshold, so
 * a forgotten flag fails the run instead of flattering it.
 */
export function assertNotThrottled(res) {
  check(res, { 'not throttled': (r) => r.status !== 429 }, { kind: 'throttle' });
}

export function assertOk(res, name) {
  check(res, { [`${name} is 200`]: (r) => r.status === 200 });
  assertNotThrottled(res);
}
