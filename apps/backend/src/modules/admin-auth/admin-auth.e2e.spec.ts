process.env.AUTH_DEV_OTP_ECHO = '1';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminUsers } from '../../db/schema';
import { createTestApp } from '../../test/app';
import { seedAdmin, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { closeTestRedis, flushTestRedis } from '../../test/redis';

const PASSWORD = 'AdminPass123!';

/**
 * The admin realm's authentication surface (§9.4, §15.2) — password → OTP →
 * session, refresh/logout scoping. The KYC decision/queue/review routes moved
 * to `admin-drivers.e2e.spec.ts` (Phase 11) along with `modules/admin-drivers`.
 */
describe('admin auth (/v1/admin)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let jwt: JwtService;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
  });

  async function login(email: string) {
    const challenge = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    const { otp } = (
      await request(app.getHttpServer())
        .get('/v1/admin/auth/dev/otp')
        .query({ challengeId: challenge.body.challengeId })
        .expect(200)
    ).body;

    const session = await request(app.getHttpServer())
      .post('/v1/admin/auth/verify')
      .send({ challengeId: challenge.body.challengeId, otp })
      .expect(200);

    return session.body;
  }

  it('completes password -> OTP -> session and carries sub_role as a claim', async () => {
    const admin = await seedAdmin(db, { subRole: 'operations', password: PASSWORD });
    const session = await login(admin.email);

    expect(session.admin).toMatchObject({ id: admin.id, subRole: 'operations' });
    expect(jwt.verify<Record<string, unknown>>(session.accessToken)).toMatchObject({
      role: 'admin',
      sub_role: 'operations',
    });

    await request(app.getHttpServer())
      .get('/v1/admin/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
  });

  it('gives the same message for an unknown email and a wrong password', async () => {
    const admin = await seedAdmin(db, { password: PASSWORD });

    const unknown = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: 'nobody@towing.test', password: PASSWORD })
      .expect(401);

    const wrong = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: admin.email, password: 'WrongPass123!' })
      .expect(401);

    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('locks the account after 5 failures — the correct password stops working', async () => {
    const admin = await seedAdmin(db, { password: PASSWORD });

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email: admin.email, password: 'WrongPass123!' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: admin.email, password: PASSWORD })
      .expect(401);

    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, admin.id));
    expect(row!.lockedUntil).not.toBeNull();
  });

  it('admin refresh and logout are scoped to the admin realm', async () => {
    const admin = await seedAdmin(db, { password: PASSWORD });
    const session = await login(admin.email);

    const rotated = await request(app.getHttpServer())
      .post('/v1/admin/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    // The public route must not accept an admin token, and must not burn it.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/logout')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });
});
