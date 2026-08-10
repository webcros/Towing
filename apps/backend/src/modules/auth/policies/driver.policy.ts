import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../../../db/db.module';
import { drivers } from '../../../db/schema';
import type { Realm } from '../auth.types';
import type { RealmPolicy, ResolvedSubject } from '../realm.policy';

/**
 * The driver app (§9.2).
 *
 * `kyc_status` is read fresh here on purpose — this is what makes an approval
 * take effect on the driver's next refresh rather than whenever their access
 * token happens to expire, and it is what §9.4.3 means by the toggle unlocking
 * without a manual refetch.
 *
 * `suspended` returns null, so `TokenService` revokes the family: a suspended
 * driver loses authority immediately rather than keeping a valid access token
 * for the rest of its 900-second life. Phase 11's suspend action calls
 * `TokenService.revokeSubject` for the same reason, from the other direction.
 */
@Injectable()
export class DriverRealmPolicy implements RealmPolicy {
  readonly realm: Realm = 'driver';
  readonly requiresFleet = false;

  constructor(@Inject(DB) private readonly db: Database) {}

  async resolve(subjectId: string): Promise<ResolvedSubject | null> {
    const [driver] = await this.db
      .select({
        id: drivers.id,
        kycStatus: drivers.kycStatus,
        fleetId: drivers.fleetId,
      })
      .from(drivers)
      .where(eq(drivers.id, subjectId))
      .limit(1);

    if (!driver || driver.kycStatus === 'suspended') return null;

    return {
      claims: {
        sub: driver.id,
        role: 'driver',
        kyc_status: driver.kycStatus,
        // Omitted rather than null when independent: an absent claim keeps the
        // token a few bytes smaller and reads the same downstream.
        ...(driver.fleetId ? { fleet_id: driver.fleetId } : {}),
      },
      // A driver's fleet is NOT a tenant binding — `FleetScopeGuard` must never
      // accept a driver token as a fleet-console session. It is recorded on the
      // refresh row for forensics only.
      fleetId: driver.fleetId,
    };
  }
}
