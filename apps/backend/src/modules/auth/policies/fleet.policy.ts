import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../../db/db.module';
import { fleets } from '../../../db/schema';
import type { Realm } from '../auth.types';
import type { RealmPolicy, ResolvedSubject } from '../realm.policy';

/**
 * The fleet console (§16.4).
 *
 * The ownership row is re-read on every rotation rather than trusted from the
 * token. That is a deliberate behaviour change in Phase 10: previously a fleet
 * suspended at 09:00 kept refreshing until its family expired up to 30 days
 * later, even though `AuthService.login` has always refused a suspended fleet
 * at the front door. One indexed primary-key lookup per refresh — and refreshes
 * happen once per access-token TTL, not once per request — buys the two rules
 * agreeing with each other.
 */
@Injectable()
export class FleetRealmPolicy implements RealmPolicy {
  readonly realm: Realm = 'fleet';
  readonly requiresFleet = true;

  constructor(@Inject(DB) private readonly db: Database) {}

  async resolve(subjectId: string, tokenFleetId: string | null): Promise<ResolvedSubject | null> {
    if (!tokenFleetId) return null;

    const [fleet] = await this.db
      .select({ id: fleets.id, status: fleets.status })
      .from(fleets)
      // Both halves matter: the id proves the fleet still exists, and the owner
      // check proves the binding still holds after an ownership transfer.
      .where(and(eq(fleets.id, tokenFleetId), eq(fleets.ownerId, subjectId)))
      .limit(1);

    if (!fleet || fleet.status === 'suspended') return null;

    return {
      claims: { sub: subjectId, role: 'fleet_owner', fleet_id: fleet.id },
      fleetId: fleet.id,
    };
  }
}
