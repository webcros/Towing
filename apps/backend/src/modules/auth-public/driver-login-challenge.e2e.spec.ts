import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  seedDriver,
  setupTestDatabase,
  testSql,
  truncateAll,
  uniqueMobile,
  type TestDatabase,
} from '../../test/db';

/**
 * THE FIRST TEST OF TRACK B PHASE 10, written before anything else in the phase.
 *
 * `login_challenges.user_id` referenced `users` — the CUSTOMER table. Drivers
 * live in `drivers` and admins in `admin_users`, so neither id exists in
 * `users`: the very first driver OTP login takes a foreign-key violation on
 * INSERT. Its sibling `refresh_tokens.subject_id` has been polymorphic and
 * FK-free since 0001 and happens to work, which is exactly what would have made
 * this present as a driver-only mystery bug.
 *
 * Written deliberately as raw SQL rather than through Drizzle so that the
 * failure is a clean runtime 23503 rather than a TypeScript error about a
 * column that does not exist yet. Recorded failure before migration 0007:
 *
 *   PostgresError: insert or update on table "login_challenges" violates
 *     foreign key constraint "login_challenges_user_id_users_id_fk"
 *     code: '23503'
 *     detail: 'Key (user_id)=(<driver-uuid>) is not present in table "users".'
 */
describe('login_challenges is realm-portable (§15.2)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await setupTestDatabase();
  });

  afterAll(async () => {
    // The pool is closed globally in src/test/setup.ts.
  });

  beforeEach(async () => {
    await truncateAll();
  });

  async function seedOtp(purpose: 'driver_login' | 'admin_login'): Promise<string> {
    const sql = testSql();
    const [row] = await sql<{ id: string }[]>`
      insert into otp_verifications (phone, purpose, code_hash, expires_at)
      values (${uniqueMobile()}, ${purpose}, ${'x'.repeat(64)}, now() + interval '5 minutes')
      returning id
    `;
    return row!.id;
  }

  it('accepts a challenge whose subject is a driver, not a user', async () => {
    const driverId = await seedDriver(db);
    const otpId = await seedOtp('driver_login');
    const sql = testSql();

    const rows = await sql<{ id: string }[]>`
      insert into login_challenges (subject_id, subject_type, realm, otp_id, expires_at)
      values (${driverId}, 'driver', 'driver', ${otpId}, now() + interval '5 minutes')
      returning id
    `;

    expect(rows).toHaveLength(1);
  });

  it('accepts a challenge whose subject is an admin', async () => {
    const sql = testSql();
    const [admin] = await sql<{ id: string }[]>`
      insert into admin_users (email, mobile, name, password_hash, sub_role)
      values ('challenge-probe@towing.local', ${uniqueMobile()}, 'Probe', 'scrypt$x', 'operations')
      returning id
    `;
    const otpId = await seedOtp('admin_login');

    const rows = await sql<{ id: string }[]>`
      insert into login_challenges (subject_id, subject_type, realm, otp_id, expires_at)
      values (${admin!.id}, 'admin', 'admin', ${otpId}, now() + interval '5 minutes')
      returning id
    `;

    expect(rows).toHaveLength(1);
  });

  it('rejects a subject_type outside the closed set', async () => {
    const driverId = await seedDriver(db);
    const otpId = await seedOtp('driver_login');
    const sql = testSql();

    await expect(
      sql`
        insert into login_challenges (subject_id, subject_type, realm, otp_id, expires_at)
        values (${driverId}, 'robot', 'driver', ${otpId}, now() + interval '5 minutes')
      `,
    ).rejects.toMatchObject({ constraint_name: 'ck_login_challenges_subject_type' });
  });
});
