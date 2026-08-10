import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminUsers, drivers, fleets, refreshTokens, users } from '../../db/schema';
import { createTestApp } from '../../test/app';
import {
  seedAdmin,
  seedCustomer,
  seedDriver,
  seedFleet,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { TokenService } from './token.service';

/**
 * Claims are REBUILT from live state on every rotation, never copied off the
 * refresh row — and a subject who may no longer hold a session has their family
 * revoked rather than merely refused.
 *
 * The first property is what makes §9.4.3 true: an admin approves a driver, and
 * the driver's app reflects it at the next refresh instead of whenever their
 * access token happens to expire. The second is what makes losing authority
 * immediate rather than eventual.
 */
describe('realm policies rebuild claims from current state', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let tokens: TokenService;
  let jwt: JwtService;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
    tokens = app.get(TokenService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  const claimsOf = (accessToken: string) => jwt.verify<Record<string, unknown>>(accessToken);

  it('an approval reaches the driver on their next refresh, with no re-login', async () => {
    const driverId = await seedDriver(db);
    await db.update(drivers).set({ kycStatus: 'incomplete' }).where(eq(drivers.id, driverId));

    const first = await tokens.issueSession({ subjectId: driverId, realm: 'driver' });
    expect(claimsOf(first.accessToken).kyc_status).toBe('incomplete');

    // An admin approves them while that access token is still perfectly valid.
    await db.update(drivers).set({ kycStatus: 'approved' }).where(eq(drivers.id, driverId));

    const second = await tokens.rotate(first.refreshToken, ['customer', 'driver']);
    expect(claimsOf(second.accessToken).kyc_status).toBe('approved');
  });

  it('suspending a driver revokes the family — authority dies now, not in 900s', async () => {
    const driverId = await seedDriver(db);
    const pair = await tokens.issueSession({ subjectId: driverId, realm: 'driver' });

    await db.update(drivers).set({ kycStatus: 'suspended' }).where(eq(drivers.id, driverId));

    await expect(tokens.rotate(pair.refreshToken, ['customer', 'driver'])).rejects.toMatchObject({
      code: 'unauthorized',
    });

    const rows = await db.select().from(refreshTokens);
    expect(rows.every((row) => row.revokedReason === 'subject_unavailable')).toBe(true);
  });

  it('a deleted customer cannot refresh (the App Store account-deletion path)', async () => {
    const userId = await seedCustomer(db);
    const pair = await tokens.issueSession({ subjectId: userId, realm: 'customer' });

    await db.update(users).set({ status: 'deleted' }).where(eq(users.id, userId));

    await expect(tokens.rotate(pair.refreshToken, ['customer', 'driver'])).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('a demoted admin refreshes into their NEW sub-role, not the one they logged in with', async () => {
    const admin = await seedAdmin(db, { subRole: 'super_admin' });
    const first = await tokens.issueSession({ subjectId: admin.id, realm: 'admin' });
    expect(claimsOf(first.accessToken).sub_role).toBe('super_admin');

    await db.update(adminUsers).set({ subRole: 'support' }).where(eq(adminUsers.id, admin.id));

    const second = await tokens.rotate(first.refreshToken, 'admin');
    expect(claimsOf(second.accessToken).sub_role).toBe('support');
  });

  it('a deactivated admin cannot refresh', async () => {
    const admin = await seedAdmin(db);
    const pair = await tokens.issueSession({ subjectId: admin.id, realm: 'admin' });

    await db.update(adminUsers).set({ status: 'suspended' }).where(eq(adminUsers.id, admin.id));

    await expect(tokens.rotate(pair.refreshToken, 'admin')).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('a suspended fleet loses its session at the next refresh', async () => {
    // A deliberate Phase 10 behaviour change: `AuthService.login` has always
    // refused a suspended fleet at the front door, but rotation trusted the
    // token, so an already-signed-in owner kept refreshing for up to 30 days.
    const fleet = await seedFleet(db, 'Suspendable Fleet');
    const pair = await tokens.issueSession({
      subjectId: fleet.ownerId,
      realm: 'fleet',
      fleetId: fleet.fleetId,
    });

    await db.update(fleets).set({ status: 'suspended' }).where(eq(fleets.id, fleet.fleetId));

    await expect(tokens.rotate(pair.refreshToken, 'fleet')).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('revokeSubject kills every live session for one subject in one realm', async () => {
    // The primitive Phase 11's suspend action calls, and what makes "revoked
    // immediately" true rather than "revoked at the next refresh".
    const driverId = await seedDriver(db);
    const phone = await tokens.issueSession({ subjectId: driverId, realm: 'driver' });
    const tablet = await tokens.issueSession({ subjectId: driverId, realm: 'driver' });
    const bystander = await seedDriver(db);
    const other = await tokens.issueSession({ subjectId: bystander, realm: 'driver' });

    const revoked = await tokens.revokeSubject(driverId, 'driver', 'kyc_suspend');
    expect(revoked).toBe(2);

    for (const dead of [phone, tablet]) {
      await expect(tokens.rotate(dead.refreshToken, ['customer', 'driver'])).rejects.toMatchObject({
        code: 'unauthorized',
      });
    }

    // Everyone else is untouched.
    await expect(tokens.rotate(other.refreshToken, ['customer', 'driver'])).resolves.toBeDefined();
  });

  it('issueSession refuses a subject who could not hold a session', async () => {
    const driverId = await seedDriver(db);
    await db.update(drivers).set({ kycStatus: 'suspended' }).where(eq(drivers.id, driverId));

    // Login and refresh mint through the same policy, so a subject that cannot
    // refresh cannot log in either — the two cannot drift apart.
    await expect(tokens.issueSession({ subjectId: driverId, realm: 'driver' })).rejects.toMatchObject(
      { code: 'forbidden' },
    );
  });
});
