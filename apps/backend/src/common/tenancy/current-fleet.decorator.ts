import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { FleetId } from '@towing/api-contracts';
import { ApiException } from '../errors/api-exception';
import { FLEET_REALM, type AuthedRequest } from '../../modules/auth/auth.types';

/**
 * The tenancy rule for the whole fleet realm:
 *
 *   1. Every repository method takes `fleetId` as its FIRST argument, and every
 *      query it builds filters on that argument.
 *   2. That value comes from the verified access token and nowhere else. A fleet
 *      id in a path param, query string or request body is client-supplied data
 *      and must never reach a WHERE clause — otherwise the entire tenant
 *      boundary is one URL edit away from being crossed.
 *
 * `FleetId` is branded so (1) is a compile error to get wrong; this decorator is
 * the only sanctioned way to produce one, which is what enforces (2).
 */
const currentFleet = createParamDecorator((_data: unknown, context: ExecutionContext): FleetId => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  const auth = request.auth;

  // Reached when a handler asks for the tenant without a guard having proven
  // one — a wiring mistake, but it fails closed rather than querying unscoped.
  if (!auth?.fleetId) throw ApiException.forbidden('Request is not bound to a fleet');

  // A DRIVER TOKEN ALSO CARRIES `fleet_id` — the fleet that employs them — and
  // that is emphatically not a tenant binding: a driver must never read their
  // employer's trucks, jobs or money. Today `JwtAuthGuard` already 403s a driver
  // before any fleet controller runs, so this is defence in depth; it is here so
  // the guarantee is stated rather than emergent from guard ordering.
  if (auth.realm !== FLEET_REALM) {
    throw ApiException.forbidden('This token is not a fleet-console session');
  }

  return auth.fleetId as FleetId;
});

export const CurrentFleet = (): ParameterDecorator => currentFleet();
