import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ApiException } from '../../common/errors/api-exception';
import { DB, type Database } from '../../db/db.module';
import { drivers } from '../../db/schema';
import type { AuthedRequest } from './auth.types';

/**
 * The §3.1 API-layer gate: "a route reads `kyc_status` from the JWT (and
 * re-checks the DB on sensitive actions)". `JwtAuthGuard` must run first (it
 * populates `request.auth`) — attach both, `JwtAuthGuard` before this one.
 *
 * Two layers because a claim minted up to `JWT_ACCESS_TTL_SECONDS` ago can be
 * stale: `DriverRealmPolicy` rebuilds `kyc_status` on every refresh, so the
 * claim is at most one refresh cycle old, but an admin suspending a driver
 * mid-cycle must take effect on their very next request, not their next
 * refresh. The claim check is a cheap fail-fast for the common case (not yet
 * approved at all); the DB read only happens for a claim that says approved,
 * which is exactly the case that can be stale.
 */
@Injectable()
export class KycApprovedGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const auth = request.auth;

    if (!auth || auth.role !== 'driver') {
      throw ApiException.forbidden('This action requires an approved driver session');
    }

    if (auth.kyc_status !== 'approved') {
      throw ApiException.forbidden('KYC approval required', { reason: 'kyc_not_approved' });
    }

    const [row] = await this.db
      .select({ kycStatus: drivers.kycStatus })
      .from(drivers)
      .where(eq(drivers.id, auth.sub))
      .limit(1);

    if (row?.kycStatus !== 'approved') {
      throw ApiException.forbidden('KYC approval required', { reason: 'kyc_not_approved' });
    }

    return true;
  }
}
