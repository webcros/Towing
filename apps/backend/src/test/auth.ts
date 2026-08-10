import type { Database } from '../db/db.module';
import { AdminRealmPolicy } from '../modules/auth/policies/admin.policy';
import { CustomerRealmPolicy } from '../modules/auth/policies/customer.policy';
import { DriverRealmPolicy } from '../modules/auth/policies/driver.policy';
import { FleetRealmPolicy } from '../modules/auth/policies/fleet.policy';
import { RealmPolicyRegistry } from '../modules/auth/realm.policy';
import type { TestDatabase } from './db';

/**
 * The same four policies `AuthModule` wires, for specs that construct
 * `TokenService` by hand rather than booting the full app.
 *
 * Deliberately the REAL policies, not stubs: their whole job is to re-read the
 * subject from the database on every rotation, so a stub would quietly delete
 * the behaviour those specs exist to pin.
 */
export function realmRegistry(db: TestDatabase): RealmPolicyRegistry {
  const database = db as unknown as Database;

  return new RealmPolicyRegistry([
    new FleetRealmPolicy(database),
    new DriverRealmPolicy(database),
    new CustomerRealmPolicy(database),
    new AdminRealmPolicy(database),
  ]);
}
