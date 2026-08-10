import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../../../db/db.module';
import { users } from '../../../db/schema';
import type { Realm } from '../auth.types';
import type { RealmPolicy, ResolvedSubject } from '../realm.policy';

/**
 * The customer app (§9.1). Phone-OTP or social sign-in; no password anywhere.
 *
 * `status` covers both `suspended` and `deleted`. The second matters for the
 * App Store's in-app account-deletion requirement (Phase 12's `DELETE /me`):
 * once a customer deletes their account, every live session must stop working
 * at the next refresh rather than lingering.
 */
@Injectable()
export class CustomerRealmPolicy implements RealmPolicy {
  readonly realm: Realm = 'customer';
  readonly requiresFleet = false;

  constructor(@Inject(DB) private readonly db: Database) {}

  async resolve(subjectId: string): Promise<ResolvedSubject | null> {
    const [user] = await this.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, subjectId))
      .limit(1);

    if (!user || user.status !== 'active') return null;

    return { claims: { sub: user.id, role: 'customer' }, fleetId: null };
  }
}
