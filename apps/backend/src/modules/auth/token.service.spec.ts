import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv, type Env } from '../../config/env';
import { refreshTokens } from '../../db/schema';
import {
  seedFleet,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { realmRegistry } from '../../test/auth';
import { closeTestRedis, testRedis } from '../../test/redis';
import { RefreshGraceService } from './refresh-grace.service';
import { TokenService } from './token.service';

describe('TokenService (rotation + reuse detection)', () => {
  let db: TestDatabase;
  let env: Env;
  let tokens: TokenService;
  let userId: string;
  let fleetId: string;

  /**
   * REFRESH_GRACE_SECONDS=0 — this file is the CONTROL for rotation without the
   * grace window, and every assertion below is the pre-Phase-8 behaviour
   * unchanged. Turning the window off has to restore these semantics exactly,
   * or the flag is not the escape hatch it claims to be.
   *
   * `refresh-grace.e2e.spec.ts` covers the window switched on.
   */
  beforeAll(async () => {
    db = await setupTestDatabase();
    env = loadEnv({ ...process.env, REFRESH_GRACE_SECONDS: '0' });
    tokens = new TokenService(
      db as never,
      env,
      new JwtService({
        secret: env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
      }),
      new RefreshGraceService(testRedis(), env),
      realmRegistry(db),
    );
  });

  afterAll(async () => {
    await closeTestRedis();
  });

  beforeEach(async () => {
    await truncateAll();
    ({ ownerId: userId, fleetId } = await seedFleet(db, 'Token Test Fleet'));
  });

  it('issues a session whose access token carries the fleet claims', async () => {
    const pair = await tokens.issueSession({ subjectId: userId, realm: 'fleet', fleetId });

    expect(pair.refreshToken.length).toBeGreaterThanOrEqual(64);
    const claims = await tokens.verifyAccessToken(pair.accessToken);
    expect(claims).toMatchObject({ sub: userId, role: 'fleet_owner', fleet_id: fleetId });
  });

  it('rotates a refresh token into a new working pair', async () => {
    const first = await tokens.issueSession({ subjectId: userId, realm: 'fleet', fleetId });
    const second = await tokens.rotate(first.refreshToken, 'fleet');

    expect(second.refreshToken).not.toBe(first.refreshToken);
    const claims = await tokens.verifyAccessToken(second.accessToken);
    expect(claims).toMatchObject({ role: 'fleet_owner', fleet_id: fleetId });

    // The new token is itself rotatable — the family lives on.
    await expect(tokens.rotate(second.refreshToken, 'fleet')).resolves.toBeDefined();
  });

  it('detects reuse of a rotated token and burns the whole family', async () => {
    const first = await tokens.issueSession({ subjectId: userId, realm: 'fleet', fleetId });
    const second = await tokens.rotate(first.refreshToken, 'fleet');

    // Presenting the already-rotated value is indistinguishable from theft.
    await expect(tokens.rotate(first.refreshToken, 'fleet')).rejects.toMatchObject({
      code: 'unauthorized',
    });

    // The legitimate holder's current token is now dead too — by design.
    await expect(tokens.rotate(second.refreshToken, 'fleet')).rejects.toMatchObject({
      code: 'unauthorized',
    });

    const rows = await db.select().from(refreshTokens);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.revokedAt !== null || row.rotatedAt !== null)).toBe(true);
  });

  it('exactly one of two concurrent rotations of the same value wins', async () => {
    const { refreshToken } = await tokens.issueSession({ subjectId: userId, realm: 'fleet', fleetId });

    const results = await Promise.allSettled([
      tokens.rotate(refreshToken, 'fleet'),
      tokens.rotate(refreshToken, 'fleet'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('logout revokes the family so nothing descended from the login refreshes', async () => {
    const first = await tokens.issueSession({ subjectId: userId, realm: 'fleet', fleetId });
    const second = await tokens.rotate(first.refreshToken, 'fleet');

    await tokens.logout(second.refreshToken, 'fleet');

    await expect(tokens.rotate(second.refreshToken, 'fleet')).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('logout of an unknown value returns quietly (no token oracle)', async () => {
    await expect(tokens.logout('a'.repeat(64), 'fleet')).resolves.toBeUndefined();
  });

  it('rejects a token from a different auth realm (§15.2)', async () => {
    const { refreshToken } = await tokens.issueSession({ subjectId: userId, realm: 'fleet', fleetId });

    // Re-file the issued token under the admin realm, simulating a cross-realm
    // replay of a stolen value.
    await db
      .update(refreshTokens)
      .set({ realm: 'admin' })
      .where(eq(refreshTokens.subjectId, userId));

    await expect(tokens.rotate(refreshToken, 'fleet')).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('rejects an expired token', async () => {
    const { refreshToken } = await tokens.issueSession({ subjectId: userId, realm: 'fleet', fleetId });

    await db
      .update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(refreshTokens.subjectId, userId));

    await expect(tokens.rotate(refreshToken, 'fleet')).rejects.toMatchObject({ code: 'unauthorized' });
  });
});
