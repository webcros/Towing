/**
 * 1 s rather than the production 10 s, so the "outside the window" case costs a
 * second instead of ten. Same idea as the 3 s token TTL the Phase 4 refresh test
 * uses: shorten the clock, keep the code path real. Set before any import
 * reaches `loadEnv()`.
 */
process.env.REFRESH_GRACE_SECONDS = '1';

import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { refreshTokens } from '../../db/schema';
import { createTestApp } from '../../test/app';
import { seedFleet, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { closeTestRedis, flushTestRedis } from '../../test/redis';
import { TokenService } from './token.service';

/**
 * The Phase 8 deploy gate, half two.
 *
 * Two backend instances against one Redis and one database — the ECS rehearsal,
 * automated. The scenario is the ordinary one: a console with several tabs, an
 * access token that has just expired, and every in-flight query refreshing with
 * the same refresh token at the same moment, landing wherever the load balancer
 * sends them.
 *
 * Before this change, exactly one of those won and the rest were treated as
 * token theft, revoking the family and logging the user out.
 */
describe('refresh grace window (two instances, one Redis)', () => {
  let nodeA: INestApplication;
  let nodeB: INestApplication;
  let db: TestDatabase;
  let userId: string;
  let fleetId: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    nodeA = await createTestApp();
    nodeB = await createTestApp();
  });

  afterAll(async () => {
    await nodeA.close();
    await nodeB.close();
    await closeTestRedis();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
    ({ ownerId: userId, fleetId } = await seedFleet(db, 'Grace Fleet'));
  });

  const issue = () =>
    nodeA.get(TokenService).issueSession({ subjectId: userId, realm: 'fleet', fleetId });

  const refreshOn = (app: INestApplication, refreshToken: string) =>
    request(app.getHttpServer()).post('/v1/fleet/auth/refresh').send({ refreshToken });

  it('serves six concurrent refreshes of the same token across both nodes, identically', async () => {
    const { refreshToken } = await issue();

    const responses = await Promise.all([
      refreshOn(nodeA, refreshToken),
      refreshOn(nodeB, refreshToken),
      refreshOn(nodeA, refreshToken),
      refreshOn(nodeB, refreshToken),
      refreshOn(nodeA, refreshToken),
      refreshOn(nodeB, refreshToken),
    ]);

    for (const res of responses) expect(res.status).toBe(200);

    // Every caller gets the SAME successor pair — not six members of the family.
    // That is what makes the deferred theft detection work: at the next rotation
    // exactly one of them can win.
    const pairs = new Set(responses.map((res) => res.body.refreshToken as string));
    expect(pairs.size).toBe(1);

    const accessTokens = new Set(responses.map((res) => res.body.accessToken as string));
    expect(accessTokens.size).toBe(1);
  });

  it('leaves the family intact, and the successor still rotates', async () => {
    const { refreshToken } = await issue();

    const [a, b] = await Promise.all([
      refreshOn(nodeA, refreshToken),
      refreshOn(nodeB, refreshToken),
    ]);
    expect(a!.status).toBe(200);
    expect(b!.status).toBe(200);

    const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.fleetId, fleetId));
    expect(rows.some((row) => row.revokedReason === 'refresh_token_reuse')).toBe(false);

    // The session is genuinely alive, not merely un-revoked.
    await refreshOn(nodeB, a!.body.refreshToken as string).expect(200);
  });

  it('still burns the family for a replay after the window has passed', async () => {
    const { refreshToken } = await issue();

    await refreshOn(nodeA, refreshToken).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    // The window is leeway for a concurrent client, not an amnesty. Outside it
    // nothing has changed: a re-presented token is indistinguishable from a
    // stolen one and the whole family goes.
    await refreshOn(nodeB, refreshToken).expect(401);

    const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.fleetId, fleetId));
    expect(rows.some((row) => row.revokedReason === 'refresh_token_reuse')).toBe(true);
  });

  it('never revives a token the user explicitly logged out', async () => {
    const { refreshToken } = await issue();
    const rotated = await refreshOn(nodeA, refreshToken).expect(200);

    await request(nodeA.getHttpServer())
      .post('/v1/fleet/auth/logout')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(204);

    // Logout revokes the family. The grace entry for the ORIGINAL token is still
    // live in Redis, and replaying it must not hand back a working pair — the
    // parked pair's own row is revoked, so its next rotation fails.
    const replay = await refreshOn(nodeB, refreshToken);
    if (replay.status === 200) {
      await refreshOn(nodeA, replay.body.refreshToken as string).expect(401);
    } else {
      expect(replay.status).toBe(401);
    }
  });

  it('is a genuine rotation, not a no-op: the presented token does not survive', async () => {
    const { refreshToken } = await issue();
    const rotated = await refreshOn(nodeA, refreshToken).expect(200);

    expect(rotated.body.refreshToken).not.toBe(refreshToken);

    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.fleetId, fleetId))
      .limit(1);
    expect(row?.rotatedAt).not.toBeNull();
  });
});
