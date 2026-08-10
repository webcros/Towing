import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeaderFor, createTestApp } from '../../test/app';
import {
  seedFleet,
  seedPayoutAccount,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { seedWalletWithLedger } from '../../test/fixtures';

/**
 * `POST /fleet/payouts` is the `money` throttle bucket's only user (20/min).
 *
 * That used to constrain this file — the note here said "keep the calls under
 * 20 a minute". Phase 8 moved the counter into Redis, where it outlives the
 * spec file that spent it, and this file promptly started 429ing. The budget is
 * no longer per-file to ration, so `src/test/setup.ts` sets
 * `THROTTLE_DISABLED=1` for the suite and the throttling specs opt back in.
 */
describe('payouts e2e (/v1/fleet/payouts)', () => {
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
    const a = await seedFleet(db, 'Payout Fleet A');
    const b = await seedFleet(db, 'Payout Fleet B');
    fleetA = a.fleetId;
    fleetB = b.fleetId;
    authA = await authHeaderFor(app, { userId: a.ownerId, fleetId: a.fleetId });
    authB = await authHeaderFor(app, { userId: b.ownerId, fleetId: b.fleetId });
  });

  /** ₹20,000 in the wallet plus a linked destination. */
  const fundAndLink = async (fleetId: string, rupees = '20000.00'): Promise<void> => {
    await seedWalletWithLedger(db, { ownerId: fleetId, ownerType: 'fleet' }, [
      { type: 'fleet_share_credit', amount: rupees },
    ]);
    await seedPayoutAccount(db, fleetId);
  };

  const post = (auth: string, amountPaise: number, key: string = randomUUID()) =>
    request(app.getHttpServer())
      .post('/v1/fleet/payouts')
      .set('Authorization', auth)
      .set('Idempotency-Key', key)
      .send({ amountPaise });

  const balanceOf = async (fleetId: string): Promise<string> => {
    const rows = (await db.execute(sql`
      select balance from wallets where owner_type = 'fleet' and owner_id = ${fleetId}::uuid
    `)) as unknown as Array<{ balance: string }>;
    return rows[0]?.balance ?? '0.00';
  };

  const ledgerRows = async (fleetId: string) =>
    (await db.execute(sql`
      select t.type::text as type, t.amount, t.ref_id, t.idempotency_key
        from wallet_transactions t
        join wallets w on w.id = t.wallet_id
       where w.owner_type = 'fleet' and w.owner_id = ${fleetId}::uuid
       order by t.created_at, t.idempotency_key
    `)) as unknown as Array<{
      type: string;
      amount: string;
      ref_id: string | null;
      idempotency_key: string;
    }>;

  it('debits the wallet at REQUEST time and hands the payout to the provider', async () => {
    await fundAndLink(fleetA);

    const res = await post(authA, 1_000_000).expect(201);

    expect(res.body).toMatchObject({ amountPaise: 1_000_000, status: 'processing' });
    expect(res.body.providerRef).toMatch(/^pout_dev_/);

    // The hold IS the debit — the balance moves now, not when the bank confirms.
    expect(await balanceOf(fleetA)).toBe('10000.00');

    const rows = await ledgerRows(fleetA);
    const debit = rows.find((r) => r.type === 'payout_debit');
    expect(debit).toMatchObject({ amount: '-10000.00', ref_id: res.body.id });
    expect(debit!.idempotency_key).toBe(`po:v1:${res.body.id}:debit`);
  });

  it('requires an Idempotency-Key header', async () => {
    await fundAndLink(fleetA);

    const res = await request(app.getHttpServer())
      .post('/v1/fleet/payouts')
      .set('Authorization', authA)
      .send({ amountPaise: 1_000_000 })
      .expect(422);

    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.message).toContain('Idempotency-Key');
    // Nothing was written on the way to that rejection.
    expect(await balanceOf(fleetA)).toBe('20000.00');
  });

  it('replays the same key to the same payout without moving money twice', async () => {
    await fundAndLink(fleetA);
    const key = randomUUID();

    const first = await post(authA, 1_000_000, key).expect(201);
    const second = await post(authA, 1_000_000, key).expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(await balanceOf(fleetA)).toBe('10000.00');

    const [{ count }] = (await db.execute(sql`
      select count(*)::int as count from payouts where owner_id = ${fleetA}::uuid
    `)) as unknown as [{ count: number }];
    expect(count).toBe(1);

    const debits = (await ledgerRows(fleetA)).filter((r) => r.type === 'payout_debit');
    expect(debits).toHaveLength(1);
  });

  it('two fleets can send the same Idempotency-Key without colliding', async () => {
    // `uq_payouts_idempotency_key` is global, so the stored key is namespaced by
    // fleet. Without that, fleet B's request would silently return A's payout.
    await fundAndLink(fleetA);
    await fundAndLink(fleetB);

    const a = await post(authA, 1_000_000, 'same-key').expect(201);
    const b = await post(authB, 1_000_000, 'same-key').expect(201);

    expect(b.body.id).not.toBe(a.body.id);
    expect(await balanceOf(fleetA)).toBe('10000.00');
    expect(await balanceOf(fleetB)).toBe('10000.00');
  });

  it('never lets concurrent requests overdraw the wallet', async () => {
    // Each request is individually affordable; together they are not. The
    // assertion that matters is the last one.
    await fundAndLink(fleetA, '15000.00');

    const results = await Promise.all([
      post(authA, 1_000_000),
      post(authA, 1_000_000),
      post(authA, 1_000_000),
    ]);

    const created = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status !== 201);

    expect(created).toHaveLength(1);
    expect(refused).toHaveLength(2);
    for (const res of refused) {
      expect(['payout_already_pending', 'insufficient_balance']).toContain(res.body.error.code);
    }

    const balance = Number(await balanceOf(fleetA));
    expect(balance).toBe(5_000);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it('refuses a second payout while one is still open', async () => {
    await fundAndLink(fleetA);
    await post(authA, 1_000_000).expect(201);

    const res = await post(authA, 1_000_000).expect(409);
    expect(res.body.error.code).toBe('payout_already_pending');
  });

  it('rejects below the minimum, and says what the minimum is', async () => {
    await fundAndLink(fleetA);

    const res = await post(authA, 50_000).expect(422);
    expect(res.body.error.code).toBe('payout_below_minimum');
    expect(res.body.error.details).toEqual({ minPaise: 100_000 });
    expect(await balanceOf(fleetA)).toBe('20000.00');
  });

  it('rejects above the maximum — the units-bug guard', async () => {
    await fundAndLink(fleetA, '9999999.00');

    const res = await post(authA, 60_000_000).expect(422);
    expect(res.body.error.code).toBe('payout_above_maximum');
  });

  it('rejects a payout larger than the balance', async () => {
    await fundAndLink(fleetA, '5000.00');

    const res = await post(authA, 1_000_000).expect(422);
    expect(res.body.error.code).toBe('insufficient_balance');
    expect(res.body.error.details).toMatchObject({ availablePaise: 500_000 });
    expect(await balanceOf(fleetA)).toBe('5000.00');

    // The failed attempt must not leave an open row occupying
    // `uq_payouts_one_open_per_owner` and blocking every future request.
    const [{ count }] = (await db.execute(sql`
      select count(*)::int as count from payouts
       where owner_id = ${fleetA}::uuid and status in ('requested', 'processing')
    `)) as unknown as [{ count: number }];
    expect(count).toBe(0);
  });

  it('refuses without a linked bank account', async () => {
    await seedWalletWithLedger(db, { ownerId: fleetA, ownerType: 'fleet' }, [
      { type: 'fleet_share_credit', amount: '20000.00' },
    ]);

    const res = await post(authA, 1_000_000).expect(409);
    expect(res.body.error.code).toBe('payout_account_not_linked');
  });

  it('refuses when the profile is incomplete (§9.3.1)', async () => {
    const c = await seedFleet(db, 'Incomplete Payout Fleet', { incomplete: true });
    const authC = await authHeaderFor(app, { userId: c.ownerId, fleetId: c.fleetId });
    await fundAndLink(c.fleetId);

    const res = await post(authC, 1_000_000).expect(403);
    expect(res.body.error.code).toBe('profile_incomplete');
  });

  describe('GET', () => {
    it('lists a fleet’s own payouts, newest first', async () => {
      await fundAndLink(fleetA);
      const created = await post(authA, 1_000_000).expect(201);

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/payouts')
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0]).toMatchObject({
        id: created.body.id,
        amountPaise: 1_000_000,
        status: 'processing',
      });
    });

    it('never shows another fleet’s payouts', async () => {
      await fundAndLink(fleetA);
      await post(authA, 1_000_000).expect(201);

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/payouts')
        .set('Authorization', authB)
        .expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('filters by status', async () => {
      await fundAndLink(fleetA);
      await post(authA, 1_000_000).expect(201);

      const paid = await request(app.getHttpServer())
        .get('/v1/fleet/payouts?status=paid')
        .set('Authorization', authA)
        .expect(200);
      expect(paid.body.items).toEqual([]);

      const processing = await request(app.getHttpServer())
        .get('/v1/fleet/payouts?status=processing')
        .set('Authorization', authA)
        .expect(200);
      expect(processing.body.items).toHaveLength(1);
    });
  });
});
