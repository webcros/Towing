import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ApiException } from '../errors/api-exception';
import { FleetScopeGuard } from './fleet-scope.guard';

const FLEET_A = '11111111-1111-4111-8111-111111111111';
const FLEET_B = '22222222-2222-4222-8222-222222222222';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function authedRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    auth: { sub: 'user-1', role: 'fleet_owner', fleet_id: FLEET_A, fleetId: FLEET_A },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

describe('FleetScopeGuard (tenancy)', () => {
  const guard = new FleetScopeGuard();

  it('rejects a request with no fleet binding', () => {
    expect(() => guard.canActivate(contextFor({ params: {}, query: {}, body: {} }))).toThrowError(
      ApiException,
    );
  });

  it('allows a request scoped to the authenticated fleet', () => {
    expect(guard.canActivate(contextFor(authedRequest()))).toBe(true);
  });

  it('allows a client-supplied fleet id equal to the authenticated one', () => {
    expect(
      guard.canActivate(contextFor(authedRequest({ body: { fleetId: FLEET_A } }))),
    ).toBe(true);
  });

  it.each([
    ['params', { params: { fleetId: FLEET_B } }],
    ['query (snake_case)', { query: { fleet_id: FLEET_B } }],
    ['body', { body: { fleetId: FLEET_B } }],
  ])('rejects a foreign fleet id smuggled via %s', (_label, overrides) => {
    let thrown: unknown;
    try {
      guard.canActivate(contextFor(authedRequest(overrides)));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ApiException);
    expect((thrown as ApiException).code).toBe('forbidden');
  });

  it('ignores non-string fleet fields (cannot be a tenant id)', () => {
    expect(
      guard.canActivate(contextFor(authedRequest({ body: { fleetId: 42 } }))),
    ).toBe(true);
  });
});
