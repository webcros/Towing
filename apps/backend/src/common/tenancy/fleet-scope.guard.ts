import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ApiException } from '../errors/api-exception';
import type { AuthedRequest } from '../../modules/auth/auth.types';

/** Spellings a client might use to smuggle a tenant id past a handler. */
const CLIENT_FLEET_KEYS = ['fleetId', 'fleet_id'] as const;

/**
 * Enforces the tenancy rule documented on `CurrentFleet()`: the authenticated
 * fleet is the only tenant a request may touch.
 *
 * Guarding the route is not enough on its own — the second half of the rule is
 * that a client-supplied fleet id never becomes a query predicate. Rather than
 * trusting every future handler to ignore such a field, any request that carries
 * one pointing at a different tenant is rejected outright. Cross-tenant intent
 * is never legitimate here, so refusing it early beats hoping each new endpoint
 * remembers to drop it.
 */
@Injectable()
export class FleetScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const fleetId = request.auth?.fleetId;

    if (!fleetId) throw ApiException.forbidden('Request is not bound to a fleet');

    for (const source of [request.params, request.query, request.body]) {
      for (const key of CLIENT_FLEET_KEYS) {
        const supplied = readString(source, key);
        if (supplied !== undefined && supplied !== fleetId) {
          throw ApiException.forbidden('Request targets a fleet other than the authenticated one');
        }
      }
    }

    return true;
  }
}

function readString(source: unknown, key: string): string | undefined {
  if (typeof source !== 'object' || source === null) return undefined;

  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}
