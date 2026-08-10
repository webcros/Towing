import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../config/env';
import { TenantThrottlerGuard } from './tenant-throttler.guard';
import { ThrottleBucket } from './throttler.config';

const env = loadEnv();
const jwt = new JwtService({ secret: env.JWT_ACCESS_SECRET });

/**
 * Which budget a request spends, per realm.
 *
 * Before Phase 10 this read `fleet_id` and nothing else, so a driver or customer
 * token produced no tracker and fell through to `ip:` — which behind the BFF and
 * carrier-grade NAT is ONE bucket shared by every mobile client in the
 * deployment. One busy driver would have rate-limited the whole fleet of them.
 */
describe('TenantThrottlerGuard tracker, per realm', () => {
  function guard(): TenantThrottlerGuard {
    return new TenantThrottlerGuard(
      { throttlers: [] },
      {} as never,
      new Reflector(),
      jwt,
      { observeThrottled: () => undefined } as never,
    );
  }

  function contextFor(bucket?: string): ExecutionContext {
    const handler = () => undefined;
    if (bucket) Reflect.defineMetadata(ThrottleBucket.KEY, bucket, handler);

    return {
      getHandler: () => handler,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  const track = async (claims: Record<string, unknown> | null, bucket?: string, body?: unknown) => {
    const req: Record<string, unknown> = { ip: '203.0.113.9', headers: {}, body };
    if (claims) req.headers = { authorization: `Bearer ${jwt.sign(claims)}` };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (guard() as any).getTracker(req, contextFor(bucket)) as Promise<string>;
  };

  it('keys a fleet token on the TENANT, unchanged from before Phase 10', async () => {
    // Several owners of one fleet share a budget — that is the unit the `reads`
    // limit was sized against, and the byte-identical key matters because
    // `tenant-throttler.guard.spec.ts` asserts `thr:reads:f:<fleetId>` verbatim.
    const tracker = await track({ sub: 'user-1', role: 'fleet_owner', fleet_id: 'fleet-a' });
    expect(tracker).toBe('f:fleet-a');
  });

  it('keys a fleet token that somehow lost its binding on the subject, NOT the shared IP bucket', async () => {
    // An explicit case rather than a fallthrough: a malformed fleet token is
    // 403'd a guard later, but until then it must not be able to spend everyone
    // else's budget.
    const tracker = await track({ sub: 'user-9', role: 'fleet_owner' });
    expect(tracker).toBe('f:user-9');
  });

  it('gives drivers, customers and admins their own buckets', async () => {
    expect(await track({ sub: 'driver-1', role: 'driver', kyc_status: 'approved' })).toBe('d:driver-1');
    expect(await track({ sub: 'cust-1', role: 'customer' })).toBe('c:cust-1');
    expect(await track({ sub: 'admin-1', role: 'admin', sub_role: 'operations' })).toBe('a:admin-1');
  });

  it('falls back to the IP bucket only when there is no usable token', async () => {
    expect(await track(null)).toBe('ip:203.0.113.9');
    expect(await track({ sub: 'x', role: 'not-a-real-role' })).toBe('ip:203.0.113.9');
  });

  it('keys the auth bucket on the mobile number when there is no email', async () => {
    // The public OTP route has no email to key on. Without this the whole
    // account-targeting property of the `auth` bucket simply does not exist for
    // the two realms that log in by phone.
    const mobile = '+919876543210';
    const tracker = await track(null, 'auth', { mobile });

    expect(tracker).toBe(`m:${sha256(mobile)}`);
  });

  it('still prefers the email when both are present', async () => {
    const tracker = await track(null, 'auth', { email: 'Owner@Fleet.test', mobile: '+919876543210' });
    expect(tracker).toBe(`e:${sha256('owner@fleet.test')}`);
  });

  it('gives two different numbers independent auth budgets', async () => {
    const a = await track(null, 'auth', { mobile: '+919876543210' });
    const b = await track(null, 'auth', { mobile: '+919876543211' });
    expect(a).not.toBe(b);
  });
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
