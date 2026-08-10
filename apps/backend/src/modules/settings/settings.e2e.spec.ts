import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeaderFor, createTestApp } from '../../test/app';
import { seedFleet, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';

describe('settings e2e (/v1/fleet/settings)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let authA: string;
  let authB: string;
  let fleetA: string;
  let fleetB: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll();
    const a = await seedFleet(db, 'Settings Fleet A');
    const b = await seedFleet(db, 'Settings Fleet B');
    fleetA = a.fleetId;
    fleetB = b.fleetId;
    authA = await authHeaderFor(app, { userId: a.ownerId, fleetId: a.fleetId });
    authB = await authHeaderFor(app, { userId: b.ownerId, fleetId: b.fleetId });
  });

  const get = (auth: string) =>
    request(app.getHttpServer()).get('/v1/fleet/settings').set('Authorization', auth);

  describe('GET', () => {
    it('fills notification-pref defaults for a fleet stored as {}', async () => {
      const res = await get(authA).expect(200);

      // Defaulted on read, so adding a preference later cannot blank it for a
      // fleet whose stored object predates it.
      expect(res.body.notificationPrefs).toEqual({
        compliance: true,
        payouts: true,
        jobs: false,
        weekly: true,
      });
      expect(res.body.payoutAccount.status).toBe('unlinked');
      expect(res.body.onboarding).toMatchObject({
        step: 'done',
        profileComplete: true,
        payoutAccountLinked: false,
      });
    });

    it('reports an incomplete profile honestly', async () => {
      const c = await seedFleet(db, 'Fresh Fleet', { incomplete: true });
      const authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/settings')
        .set('Authorization', authC)
        .expect(200);

      expect(res.body.onboarding).toMatchObject({
        step: 'profile',
        profileComplete: false,
        completedAt: null,
      });
      expect(res.body.address).toBeNull();
    });
  });

  describe('PUT', () => {
    it('persists a partial patch and leaves the other fields alone', async () => {
      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authA)
        .send({ gstin: '29ABCDE1234F1Z5' })
        .expect(200);

      const res = await get(authA).expect(200);
      expect(res.body.gstin).toBe('29ABCDE1234F1Z5');
      expect(res.body.businessName).toBe('Settings Fleet A');
      expect(res.body.address).toBe('1 Test Road, Bengaluru 560001');
    });

    it('merges notification prefs rather than replacing the object', async () => {
      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authA)
        .send({ notificationPrefs: { jobs: true } })
        .expect(200);

      const res = await get(authA).expect(200);
      expect(res.body.notificationPrefs).toEqual({
        compliance: true,
        payouts: true,
        jobs: true,
        weekly: true,
      });
    });

    it('rejects an invalid GSTIN with field-level details', async () => {
      const res = await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authA)
        .send({ gstin: 'NOPE' })
        .expect(422);

      expect(res.body.error.code).toBe('validation_failed');
      expect(JSON.stringify(res.body.error.details)).toContain('gstin');
    });

    it('accepts both seeded fixture GSTINs', async () => {
      // The regex is verified against the demo data on purpose — a stricter
      // pattern would make `PUT` round-trips fail on a freshly seeded console.
      for (const gstin of ['29ABCDE1234F1Z5', '33FGHIJ5678K2Z9']) {
        await request(app.getHttpServer())
          .put('/v1/fleet/settings')
          .set('Authorization', authA)
          .send({ gstin })
          .expect(200);
      }
    });

    it('refuses an empty patch', async () => {
      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authA)
        .send({})
        .expect(422);
    });

    it('cannot set onboardingStep — that would walk a client past the gate', async () => {
      const c = await seedFleet(db, 'Sneaky Fleet', { incomplete: true });
      const authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });

      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authC)
        .send({ onboardingStep: 'done', profileCompletedAt: new Date().toISOString() })
        .expect(422); // unknown keys only ⇒ the refine() sees an empty patch

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/settings')
        .set('Authorization', authC)
        .expect(200);
      expect(res.body.onboarding.step).toBe('profile');
      expect(res.body.onboarding.profileComplete).toBe(false);
    });

    it('completing the profile sets profileCompletedAt exactly once', async () => {
      const c = await seedFleet(db, 'Growing Fleet', { incomplete: true });
      const authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });

      const first = await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authC)
        .send({ address: '9 Residency Road, Bengaluru 560025' })
        .expect(200);
      expect(first.body.onboarding.profileComplete).toBe(true);
      const completedAt = first.body.onboarding.completedAt;

      const second = await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authC)
        .send({ businessName: 'Growing Fleet Pvt Ltd' })
        .expect(200);

      // Never re-stamped: "when did this account become usable" stays honest.
      expect(second.body.onboarding.completedAt).toBe(completedAt);
    });

    it('is fleet-scoped — B cannot write A', async () => {
      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authB)
        .send({ businessName: 'Hijacked' })
        .expect(200);

      const a = await get(authA).expect(200);
      expect(a.body.businessName).toBe('Settings Fleet A');
    });
  });

  describe('payout account', () => {
    const link = (auth: string, body?: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/v1/fleet/settings/payout-account')
        .set('Authorization', auth)
        .send(
          body ?? {
            beneficiaryName: 'Settings Fleet A',
            accountNumber: '50100123456789',
            ifsc: 'HDFC0000123',
          },
        );

    it('links through the dev provider and stores only the last four digits', async () => {
      const res = await link(authA).expect(201);

      expect(res.body.payoutAccount).toMatchObject({
        status: 'active',
        beneficiaryName: 'Settings Fleet A',
        accountNumberLast4: '6789',
        ifsc: 'HDFC0000123',
      });
      expect(res.body.onboarding.payoutAccountLinked).toBe(true);

      // The full number must never be persisted, in any column.
      const [row] = (await db.execute(sql`
        select * from payout_accounts where owner_id = ${fleetA}::uuid
      `)) as unknown as [Record<string, unknown>];
      expect(JSON.stringify(row)).not.toContain('50100123456789');
      expect(row.account_number_fingerprint).toBeTruthy();
    });

    it('never returns the full account number on a later read', async () => {
      await link(authA).expect(201);
      const res = await get(authA).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('50100123456789');
    });

    it('rejects a malformed IFSC before any vendor call', async () => {
      const res = await link(authA, {
        beneficiaryName: 'Settings Fleet A',
        accountNumber: '50100123456789',
        ifsc: 'nope',
      }).expect(422);
      expect(res.body.error.code).toBe('validation_failed');
    });

    it('relinking replaces the destination rather than adding a row', async () => {
      await link(authA).expect(201);
      await link(authA, {
        beneficiaryName: 'Settings Fleet A',
        accountNumber: '50100999888777',
        ifsc: 'ICIC0000456',
      }).expect(201);

      const [{ count }] = (await db.execute(sql`
        select count(*)::int as count from payout_accounts where owner_id = ${fleetA}::uuid
      `)) as unknown as [{ count: number }];
      expect(count).toBe(1);

      const res = await get(authA).expect(200);
      expect(res.body.payoutAccount.accountNumberLast4).toBe('8777');
    });

    it('unlinks, and refuses while a payout is in flight', async () => {
      await link(authA).expect(201);

      await db.execute(sql`
        insert into payouts (owner_id, owner_type, amount, status, idempotency_key)
        values (${fleetA}::uuid, 'fleet', 1000, 'processing', 'test:open-payout')
      `);

      const blocked = await request(app.getHttpServer())
        .delete('/v1/fleet/settings/payout-account')
        .set('Authorization', authA)
        .expect(409);
      expect(blocked.body.error.code).toBe('conflict');

      await db.execute(sql`update payouts set status = 'paid' where owner_id = ${fleetA}::uuid`);

      const res = await request(app.getHttpServer())
        .delete('/v1/fleet/settings/payout-account')
        .set('Authorization', authA)
        .expect(200);
      expect(res.body.payoutAccount.status).toBe('unlinked');
    });
  });

  describe('the §9.3.1 gate — money paths only', () => {
    let authC: string;

    beforeEach(async () => {
      const c = await seedFleet(db, 'Incomplete Fleet', { incomplete: true });
      authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });
    });

    it('blocks linking a bank account until the profile is complete', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/fleet/settings/payout-account')
        .set('Authorization', authC)
        .send({
          beneficiaryName: 'Incomplete Fleet',
          accountNumber: '50100123456789',
          ifsc: 'HDFC0000123',
        })
        .expect(403);

      expect(res.body.error.code).toBe('profile_incomplete');
      expect(res.body.error.details).toMatchObject({
        onboardingStep: 'profile',
        missing: ['address'],
      });
    });

    it('leaves the rest of the console alone', async () => {
      // The whole point of scoping the gate to money: an incomplete fleet can
      // still run its business, it just cannot move money out.
      await request(app.getHttpServer())
        .post('/v1/fleet/trucks')
        .set('Authorization', authC)
        .send({ type: 'flatbed', plate: 'KA-99-ZZ-0001', capacityTons: 5 })
        .expect(201);

      await request(app.getHttpServer())
        .get('/v1/fleet/trucks')
        .set('Authorization', authC)
        .expect(200);

      await request(app.getHttpServer())
        .get('/v1/fleet/earnings')
        .set('Authorization', authC)
        .expect(200);
    });

    it('opens within the same request cycle once the profile is saved', async () => {
      await request(app.getHttpServer())
        .post('/v1/fleet/settings/payout-account')
        .set('Authorization', authC)
        .send({
          beneficiaryName: 'Incomplete Fleet',
          accountNumber: '50100123456789',
          ifsc: 'HDFC0000123',
        })
        .expect(403);

      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authC)
        .send({ address: '4 Church Street, Bengaluru 560001' })
        .expect(200);

      // The guard caches for 60 s; this passing immediately is what proves the
      // settings write busts that cache.
      await request(app.getHttpServer())
        .post('/v1/fleet/settings/payout-account')
        .set('Authorization', authC)
        .send({
          beneficiaryName: 'Incomplete Fleet',
          accountNumber: '50100123456789',
          ifsc: 'HDFC0000123',
        })
        .expect(201);
    });
  });

  describe('onboarding advance', () => {
    it('refuses to leave `profile` while the profile is incomplete', async () => {
      const c = await seedFleet(db, 'Stuck Fleet', { incomplete: true });
      const authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });

      const res = await request(app.getHttpServer())
        .post('/v1/fleet/settings/onboarding/advance')
        .set('Authorization', authC)
        .send({ from: 'profile' })
        .expect(403);
      expect(res.body.error.code).toBe('profile_incomplete');
    });

    it('advances exactly one step, and a double tap is a no-op', async () => {
      const c = await seedFleet(db, 'Wizard Fleet', { incomplete: true });
      const authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });

      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authC)
        .send({ address: '77 Brigade Road, Bengaluru 560001' })
        .expect(200);

      const first = await request(app.getHttpServer())
        .post('/v1/fleet/settings/onboarding/advance')
        .set('Authorization', authC)
        .send({ from: 'profile' })
        .expect(201);
      expect(first.body.onboarding.step).toBe('payout_account');

      // `where onboarding_step = $from` makes a replayed tap idempotent rather
      // than skipping a step.
      const second = await request(app.getHttpServer())
        .post('/v1/fleet/settings/onboarding/advance')
        .set('Authorization', authC)
        .send({ from: 'profile' })
        .expect(201);
      expect(second.body.onboarding.step).toBe('payout_account');
    });

    it('linking a bank account advances the payout step by itself', async () => {
      const c = await seedFleet(db, 'Linking Fleet', { incomplete: true });
      const authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });

      await request(app.getHttpServer())
        .put('/v1/fleet/settings')
        .set('Authorization', authC)
        .send({ address: '5 Residency Road, Bengaluru 560025' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/v1/fleet/settings/onboarding/advance')
        .set('Authorization', authC)
        .send({ from: 'profile' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/v1/fleet/settings/payout-account')
        .set('Authorization', authC)
        .send({ beneficiaryName: 'Linking Fleet', accountNumber: '50100111222333', ifsc: 'HDFC0000123' })
        .expect(201);

      expect(res.body.onboarding.step).toBe('notifications');
    });

    it('advancing from `done` is a no-op, not an error', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/fleet/settings/onboarding/advance')
        .set('Authorization', authA)
        .send({ from: 'done' })
        .expect(201);
      expect(res.body.onboarding.step).toBe('done');
    });
  });
});
