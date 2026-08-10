import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { refreshTokens } from '../../db/schema';
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
 * The cross-realm matrix (§15.2) — the property this whole phase exists for.
 *
 * Before Phase 10 two of these were silent, destructive bugs the moment a second
 * realm existed: `rotate()` revoked the WHOLE FAMILY of any token without a
 * fleet binding, and `logout()` returned success having revoked nothing for any
 * non-fleet realm.
 */
describe('realm isolation (§15.2)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let tokens: TokenService;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  async function customerSession() {
    const userId = await seedCustomer(db);
    return { userId, ...(await tokens.issueSession({ subjectId: userId, realm: 'customer' })) };
  }

  it('a customer refresh token is refused by the fleet route WITHOUT burning the family', async () => {
    const session = await customerSession();

    await request(app.getHttpServer())
      .post('/v1/fleet/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    // The row must be untouched. If the realm predicate ever leaves the
    // conditional UPDATE, this probe stamps `rotated_at`, and the victim's next
    // legitimate refresh trips reuse detection — an attacker logging someone out
    // of a realm they have no access to, just by knocking on the wrong door.
    const rows = await db.select().from(refreshTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rotatedAt).toBeNull();
    expect(rows[0]!.revokedAt).toBeNull();

    // And the token still works where it belongs.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
  });

  it('a fleet refresh token is refused by the public route, family intact', async () => {
    const fleet = await seedFleet(db, 'Isolation Fleet');
    const pair = await tokens.issueSession({
      subjectId: fleet.ownerId,
      realm: 'fleet',
      fleetId: fleet.fleetId,
    });

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: pair.refreshToken })
      .expect(401);

    const [row] = await db.select().from(refreshTokens);
    expect(row!.rotatedAt).toBeNull();
    expect(row!.revokedAt).toBeNull();
  });

  it('a driver logout ACTUALLY revokes (it silently revoked nothing before Phase 10)', async () => {
    const driverId = await seedDriver(db);
    const pair = await tokens.issueSession({ subjectId: driverId, realm: 'driver' });

    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .send({ refreshToken: pair.refreshToken })
      .expect(204);

    const [row] = await db.select().from(refreshTokens);
    expect(row!.revokedReason).toBe('logout');

    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: pair.refreshToken })
      .expect(401);
  });

  it('an off-realm logout is a quiet no-op that revokes nothing (no token oracle)', async () => {
    const session = await customerSession();

    // 204, not 401: telling the caller "that token exists but is not yours"
    // would turn logout into an oracle for whether a token is real.
    await request(app.getHttpServer())
      .post('/v1/fleet/auth/logout')
      .send({ refreshToken: session.refreshToken })
      .expect(204);

    const [row] = await db.select().from(refreshTokens);
    expect(row!.revokedAt).toBeNull();
  });

  it('a customer token with no fleet binding refreshes instead of burning its family', async () => {
    // The pre-Phase-10 bug in one assertion: `fleet_id` is null for every
    // customer, driver and admin session, and `rotate()` treated that as
    // corruption and revoked the family with `missing_fleet_binding`.
    const session = await customerSession();

    const rotated = await tokens.rotate(session.refreshToken, ['customer', 'driver']);
    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    const revoked = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.revokedReason, 'missing_fleet_binding'));
    expect(revoked).toHaveLength(0);
  });

  it('an admin token is 403 on a fleet route, and a fleet token is 403 on an admin route', async () => {
    const admin = await seedAdmin(db);
    const fleet = await seedFleet(db, 'Realm Guard Fleet');

    const adminPair = await tokens.issueSession({ subjectId: admin.id, realm: 'admin' });
    const fleetPair = await tokens.issueSession({
      subjectId: fleet.ownerId,
      realm: 'fleet',
      fleetId: fleet.fleetId,
    });

    // 403 not 401 — the token is cryptographically valid, it just carries no
    // authority in this realm.
    await request(app.getHttpServer())
      .get('/v1/fleet/auth/me')
      .set('Authorization', `Bearer ${adminPair.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Authorization', `Bearer ${fleetPair.accessToken}`)
      .expect(403);
  });
});
