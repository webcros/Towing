// Before ANY import: `loadEnv()` runs when the module graph is built, so the
// flag has to exist by then. Same ordering trick as `refresh-grace.e2e.spec.ts`.
process.env.AUTH_DEV_OTP_ECHO = '1';

import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drivers, loginChallenges, users } from '../../db/schema';
import { createTestApp } from '../../test/app';
import { setupTestDatabase, truncateAll, uniqueMobile, type TestDatabase } from '../../test/db';
import { closeTestRedis, flushTestRedis } from '../../test/redis';

/**
 * Customer and driver phone-OTP login end to end (§9.1, §9.2, §16.1).
 *
 * This is also where the §3.1 default change is pinned: a driver who has done
 * nothing but enter an OTP must be `incomplete`, never `pending` — Phase 11's
 * approval queue selects `pending`, and filling it with zero-document rows would
 * make the queue useless on day one.
 */
describe('public OTP login (/v1/auth)', () => {
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
    // The per-mobile send counter outlives the spec that spent it.
    await flushTestRedis();
  });

  async function login(role: 'customer' | 'driver', mobile: string) {
    const sent = await request(app.getHttpServer())
      .post('/v1/auth/otp/send')
      .send({ mobile, role })
      .expect(200);

    const { otp } = (
      await request(app.getHttpServer())
        .get('/v1/auth/dev/otp')
        .query({ challengeId: sent.body.challengeId })
        .expect(200)
    ).body;

    const session = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: sent.body.challengeId, otp })
      .expect(200);

    return { sent: sent.body, session: session.body, otp };
  }

  it('signs a customer in and mints a token with no fleet binding', async () => {
    const mobile = uniqueMobile();
    const { sent, session } = await login('customer', mobile);

    expect(sent.resendAfterSeconds).toBeGreaterThan(0);
    expect(session.customer).toMatchObject({ mobile, isNew: true });

    const claims = jwt.verify<Record<string, unknown>>(session.accessToken);
    expect(claims.role).toBe('customer');
    // A customer has no tenant. Carrying a `fleet_id` here would be the seed of
    // a tenancy bug the first time something read it without checking the realm.
    expect(claims.fleet_id).toBeUndefined();
  });

  it('signs a driver in and carries kyc_status as a claim (§3.1)', async () => {
    const mobile = uniqueMobile();
    const { session } = await login('driver', mobile);

    expect(session.driver).toMatchObject({ mobile, kycStatus: 'incomplete', isNew: true });

    const claims = jwt.verify<Record<string, unknown>>(session.accessToken);
    expect(claims).toMatchObject({ role: 'driver', kyc_status: 'incomplete' });
  });

  it('a freshly provisioned driver is `incomplete`, NOT `pending`', async () => {
    const mobile = uniqueMobile();
    await login('driver', mobile);

    const [row] = await db.select().from(drivers).where(eq(drivers.mobile, mobile));
    expect(row!.kycStatus).toBe('incomplete');

    // The assertion that matters for Phase 11: this driver must not appear in
    // the approval queue, which selects `pending` = submitted, awaiting a human.
    const pending = await db.select().from(drivers).where(eq(drivers.kycStatus, 'pending'));
    expect(pending).toHaveLength(0);
  });

  it('writes a challenge whose subject is the driver row (migration 0007)', async () => {
    const mobile = uniqueMobile();
    const { sent } = await login('driver', mobile);

    const [challenge] = await db
      .select()
      .from(loginChallenges)
      .where(eq(loginChallenges.id, sent.challengeId));

    expect(challenge).toMatchObject({ subjectType: 'driver', realm: 'driver' });

    const [driver] = await db.select().from(drivers).where(eq(drivers.mobile, mobile));
    expect(challenge!.subjectId).toBe(driver!.id);
    // The id is a `drivers` id and emphatically not a `users` id — which is the
    // foreign key that used to make this INSERT fail with 23503.
    const asUser = await db.select().from(users).where(eq(users.id, challenge!.subjectId));
    expect(asUser).toHaveLength(0);
  });

  it('a second login on the same number reuses the account rather than creating one', async () => {
    const mobile = uniqueMobile();
    const first = await login('customer', mobile);
    // Stands in for the resend cooldown elapsing — the counter lives in Redis,
    // and asserting the cooldown itself is `otp-rate.e2e.spec.ts`'s job.
    await flushTestRedis();
    const second = await login('customer', mobile);

    expect(second.session.customer.id).toBe(first.session.customer.id);
    expect(second.session.customer.isNew).toBe(false);

    const rows = await db.select().from(users).where(eq(users.mobile, mobile));
    expect(rows).toHaveLength(1);
  });

  it('the same number in both apps is two independent accounts', async () => {
    // `users.mobile` and `drivers.mobile` are separate unique keys — a driver who
    // is also a customer is two subjects, and must be, since they hold two
    // sessions with different authority.
    const mobile = uniqueMobile();
    const customer = await login('customer', mobile);
    await flushTestRedis();
    const driver = await login('driver', mobile);

    expect(driver.session.driver.id).not.toBe(customer.session.customer.id);
  });

  it('a challenge is single-use — replaying code + challenge fails', async () => {
    const { sent, otp } = await login('customer', uniqueMobile());

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: sent.challengeId, otp })
      .expect(401);
  });

  it('rejects a wrong code, then caps guesses', async () => {
    const sent = await request(app.getHttpServer())
      .post('/v1/auth/otp/send')
      .send({ mobile: uniqueMobile(), role: 'customer' })
      .expect(200);

    const { otp: good } = (
      await request(app.getHttpServer())
        .get('/v1/auth/dev/otp')
        .query({ challengeId: sent.body.challengeId })
        .expect(200)
    ).body;
    const bad = good === '000000' ? '000001' : '000000';

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/v1/auth/otp/verify')
        .send({ challengeId: sent.body.challengeId, otp: bad })
        .expect(401);
    }

    // Attempts exhausted: even the correct code is refused now.
    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ challengeId: sent.body.challengeId, otp: good })
      .expect(429);
  });

  it('rejects a malformed mobile number before any row is written', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/otp/send')
      .send({ mobile: '9876543210', role: 'customer' })
      .expect(422);

    expect(await db.select().from(users)).toHaveLength(0);
  });
});
