import type { INestApplication } from '@nestjs/common';
import {
  adminCommissionConfigSchema,
  adminPricingConfigSchema,
} from '@towing/api-contracts';
import { desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminActions, commissionConfig, commissionConfigHistory } from '../../db/schema';
import { adminAuthHeaderFor, createTestApp, customerAuthHeaderFor } from '../../test/app';
import { expectMatchesContract } from '../../test/contracts';
import {
  seedAdmin,
  seedCustomer,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { closeTestRedis, flushTestRedis } from '../../test/redis';
import { seedPricingFixtures } from '../pricing/pricing.e2e.spec';

/**
 * §16.5 `GET/PUT /v1/admin/pricing` · `GET/PUT /v1/admin/commission`.
 *
 * The reason these routes exist in Phase 14 at all is that the §3.3 guardrail
 * needs a way to be exercised — so the assertions that matter here are the
 * rejection, the audit row that accompanies it, and the history trail.
 */
describe('admin config (/v1/admin/pricing, /v1/admin/commission)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let financeId: string;
  let financeAuth: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
    await seedPricingFixtures(db);
    const finance = await seedAdmin(db, { subRole: 'finance' });
    financeId = finance.id;
    financeAuth = await adminAuthHeaderFor(app, { adminId: finance.id, subRole: 'finance' });
  });

  describe('RBAC (§4.2)', () => {
    it('lets finance and super_admin read, and refuses operations and support', async () => {
      for (const subRole of ['finance', 'super_admin'] as const) {
        const admin = await seedAdmin(db, { subRole });
        await request(app.getHttpServer())
          .get('/v1/admin/commission')
          .set('Authorization', await adminAuthHeaderFor(app, { adminId: admin.id, subRole }))
          .expect(200);
      }

      // `operations` can approve a driver's documents. Re-rating every future
      // booking on the platform is a different authority (§4.2).
      for (const subRole of ['operations', 'support'] as const) {
        const admin = await seedAdmin(db, { subRole });
        await request(app.getHttpServer())
          .get('/v1/admin/commission')
          .set('Authorization', await adminAuthHeaderFor(app, { adminId: admin.id, subRole }))
          .expect(403);
      }
    });

    it('refuses a customer token and an anonymous caller', async () => {
      const customerAuth = await customerAuthHeaderFor(app, { userId: await seedCustomer(db) });
      await request(app.getHttpServer())
        .get('/v1/admin/pricing')
        .set('Authorization', customerAuth)
        .expect(403);
      await request(app.getHttpServer()).get('/v1/admin/pricing').expect(401);
    });

    it('refuses a support admin the WRITE as well as the read', async () => {
      const support = await seedAdmin(db, { subRole: 'support' });
      await request(app.getHttpServer())
        .put('/v1/admin/commission')
        .set('Authorization', await adminAuthHeaderFor(app, { adminId: support.id, subRole: 'support' }))
        .send({ bands: [{ band: 'A', pct: 9 }] })
        .expect(403);
    });
  });

  describe('GET', () => {
    it('serves the pricing config against its contract', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/pricing')
        .set('Authorization', financeAuth)
        .expect(200);

      expectMatchesContract(adminPricingConfigSchema, response.body);
      expect(response.body.charges.nightPct).toBe(15);
      expect(response.body.rules.length).toBeGreaterThan(0);
    });

    it('serves the commission config with its guardrail, so a form can render it', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/admin/commission')
        .set('Authorization', financeAuth)
        .expect(200);

      expectMatchesContract(adminCommissionConfigSchema, response.body);
      expect(response.body.floorPct).toBe(5);
      expect(response.body.capPct).toBe(10);
      expect(response.body.bands.map((b: { band: string; pct: number }) => [b.band, b.pct])).toEqual([
        ['A', 10],
        ['B', 8],
        ['C', 5],
      ]);
    });
  });

  describe('PUT /v1/admin/commission — the §3.3 guardrail', () => {
    it('accepts a change inside the band and writes config, history and audit', async () => {
      const response = await request(app.getHttpServer())
        .put('/v1/admin/commission')
        .set('Authorization', financeAuth)
        .send({ bands: [{ band: 'A', pct: 9.5 }], reason: 'Festive season retention' })
        .expect(200);

      expect(response.body.bands.find((b: { band: string }) => b.band === 'A').pct).toBe(9.5);

      const [row] = await db.select().from(commissionConfig).where(eq(commissionConfig.band, 'A'));
      expect(Number(row!.pct)).toBe(9.5);
      expect(row!.updatedBy).toBe(financeId);

      // §3.3 "versioned + audited" — the version half.
      const history = await db
        .select()
        .from(commissionConfigHistory)
        .where(eq(commissionConfigHistory.band, 'A'))
        .orderBy(desc(commissionConfigHistory.createdAt));
      expect(Number(history[0]!.oldPct)).toBe(10);
      expect(Number(history[0]!.newPct)).toBe(9.5);
      expect(history[0]!.reason).toBe('Festive season retention');

      // …and the audited half, joined to it.
      const audits = await db
        .select()
        .from(adminActions)
        .where(eq(adminActions.action, 'commission.update'));
      expect(audits).toHaveLength(1);
      expect(audits[0]!.adminId).toBe(financeId);
      expect(history[0]!.adminActionId).toBe(audits[0]!.id);
    });

    it('REJECTS an out-of-band percentage AND audits the attempt (§3.3)', async () => {
      // Both halves of §3.3's sentence: "attempts outside the band are rejected
      // AND audited". A rejection nobody can see afterwards is half a control —
      // someone probing the fare engine's limits is exactly what the audit log
      // is for.
      const response = await request(app.getHttpServer())
        .put('/v1/admin/commission')
        .set('Authorization', financeAuth)
        .send({ bands: [{ band: 'A', pct: 11 }], reason: 'Trying it on' })
        .expect(422);

      expect(JSON.stringify(response.body)).toMatch(/5.*10/);

      // THE AUDIT ROW. This is the half that a pipe-level range check would
      // have silently dropped: the schema deliberately stops at a sanity bound
      // so an out-of-band attempt reaches the service, which records it before
      // refusing.
      const rejected = await db
        .select()
        .from(adminActions)
        .where(eq(adminActions.action, 'commission.update.rejected'));
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.adminId).toBe(financeId);
      expect(rejected[0]!.reason).toBe('Trying it on');
      expect(rejected[0]!.after).toBeNull();

      // Nothing moved.
      const [row] = await db.select().from(commissionConfig).where(eq(commissionConfig.band, 'A'));
      expect(Number(row!.pct)).toBe(10);
      expect(await db.select().from(commissionConfigHistory).where(eq(commissionConfigHistory.oldPct, '10.00'))).toHaveLength(0);
    });

    it('rejects below the floor as well as above the cap', async () => {
      for (const pct of [4.99, 0, -5, 10.01, 50]) {
        await request(app.getHttpServer())
          .put('/v1/admin/commission')
          .set('Authorization', financeAuth)
          .send({ bands: [{ band: 'B', pct }] })
          .expect(422);
      }
      const [row] = await db.select().from(commissionConfig).where(eq(commissionConfig.band, 'B'));
      expect(Number(row!.pct)).toBe(8);
    });

    it('rejects the WHOLE request when any one band is out of range', async () => {
      // Partial application would leave the platform half re-rated, and the
      // admin with no signal about which half.
      await request(app.getHttpServer())
        .put('/v1/admin/commission')
        .set('Authorization', financeAuth)
        .send({
          bands: [
            { band: 'A', pct: 9 },
            { band: 'B', pct: 99 },
          ],
        })
        .expect(422);

      const rows = await db.select().from(commissionConfig);
      expect(rows.map((r) => Number(r.pct)).sort((a, b) => a - b)).toEqual([5, 8, 10]);
    });

    it('exposes the change through GET /commission/history', async () => {
      await request(app.getHttpServer())
        .put('/v1/admin/commission')
        .set('Authorization', financeAuth)
        .send({ bands: [{ band: 'C', pct: 6 }] })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/v1/admin/commission/history')
        .set('Authorization', financeAuth)
        .expect(200);

      // Three genesis rows from the fixture would be here too if it seeded them;
      // this fixture does not, so the newest row is the edit.
      expect(response.body[0].band).toBe('C');
      expect(response.body[0].newPct).toBe(6);
      expect(response.body[0].oldPct).toBe(5);
    });
  });

  describe('PUT /v1/admin/pricing', () => {
    it('patches a single charge without resetting its neighbours', async () => {
      // Phase 13's `.partial()` bug, in the place it would hurt most: a one-key
      // PUT that silently rewrites the whole fare matrix. The assertion is that
      // every OTHER key is untouched, not merely that this one changed.
      const before = (
        await request(app.getHttpServer()).get('/v1/admin/pricing').set('Authorization', financeAuth)
      ).body;

      await request(app.getHttpServer())
        .put('/v1/admin/pricing')
        .set('Authorization', financeAuth)
        .send({ charges: { nightPct: 20 } })
        .expect(200);

      const after = (
        await request(app.getHttpServer()).get('/v1/admin/pricing').set('Authorization', financeAuth)
      ).body;

      expect(after.charges.nightPct).toBe(20);
      expect({ ...after.charges, nightPct: 0 }).toEqual({ ...before.charges, nightPct: 0 });
    });

    it('edits a slab price and audits it', async () => {
      const before = (
        await request(app.getHttpServer()).get('/v1/admin/pricing').set('Authorization', financeAuth)
      ).body;
      const slab = before.rules.find((r: { ruleKind: string }) => r.ruleKind === 'slab');

      await request(app.getHttpServer())
        .put('/v1/admin/pricing')
        .set('Authorization', financeAuth)
        .send({ rules: [{ id: slab.id, pricePaise: 123_400 }], reason: 'Fuel cost' })
        .expect(200);

      const after = (
        await request(app.getHttpServer()).get('/v1/admin/pricing').set('Authorization', financeAuth)
      ).body;
      expect(after.rules.find((r: { id: string }) => r.id === slab.id).pricePaise).toBe(123_400);

      const audits = await db.select().from(adminActions).where(eq(adminActions.action, 'pricing.update'));
      expect(audits).toHaveLength(1);
      expect(audits[0]!.reason).toBe('Fuel cost');
      // Whole-row snapshots, so "what changed" is answerable without a diff log.
      expect(audits[0]!.before).toBeTruthy();
      expect(audits[0]!.after).toBeTruthy();
    });

    it('rejects an empty update rather than writing an audit row for nothing', async () => {
      await request(app.getHttpServer())
        .put('/v1/admin/pricing')
        .set('Authorization', financeAuth)
        .send({})
        .expect(422);

      expect(await db.select().from(adminActions).where(eq(adminActions.action, 'pricing.update'))).toHaveLength(0);
    });

    it('rejects a charge value outside its schema range', async () => {
      for (const charges of [
        { nightPct: 150 },
        { nightStartHour: 25 },
        { haversineRoadFactor: 0.5 },
        { surgePctPeak: -1 },
      ]) {
        await request(app.getHttpServer())
          .put('/v1/admin/pricing')
          .set('Authorization', financeAuth)
          .send({ charges })
          .expect(422);
      }
    });
  });

  describe('cache invalidation (§6.7 "no deploy needed")', () => {
    it('makes an admin edit visible to the very next estimate', async () => {
      const customerAuth = await customerAuthHeaderFor(app, { userId: await seedCustomer(db) });
      const estimate = () =>
        request(app.getHttpServer())
          .post('/v1/pricing/estimate')
          .set('Authorization', customerAuth)
          .send({
            serviceSlug: 'car_tow',
            vehicleClass: 'wheel_lift',
            pickup: { lat: 12.9716, lng: 77.5946 },
            drop: { lat: 12.9569, lng: 77.7011 },
            scheduledAt: '2026-08-16T18:00:00.000Z',
          })
          .expect(200);

      const before = await estimate();
      expect(before.body.breakdown.nightPaise).toBe(
        Math.round(before.body.breakdown.basePaise * 0.15),
      );

      await request(app.getHttpServer())
        .put('/v1/admin/pricing')
        .set('Authorization', financeAuth)
        .send({ charges: { nightPct: 50 } })
        .expect(200);

      // NO cache flush between these two calls — the write path must have
      // invalidated it. §6.7 promises "no deploy", not "no deploy but wait five
      // minutes for the TTL".
      const after = await estimate();
      expect(after.body.breakdown.nightPaise).toBe(
        Math.round(after.body.breakdown.basePaise * 0.5),
      );
    });
  });
});
