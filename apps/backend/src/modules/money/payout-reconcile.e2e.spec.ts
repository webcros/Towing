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
import { PayoutReconcileService } from './payout-reconcile.service';

/**
 * §19.3's missed-webhook sweep. This is what makes "a timeout is not a failure"
 * safe rather than a way to strand money.
 */
describe('payout reconciliation poll (e2e)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let reconcile: PayoutReconcileService;
  let authA: string;
  let fleetA: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
    reconcile = app.get(PayoutReconcileService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll();
    const a = await seedFleet(db, 'Reconcile Fleet');
    fleetA = a.fleetId;
    authA = await authHeaderFor(app, { userId: a.ownerId, fleetId: a.fleetId });
    await seedWalletWithLedger(db, { ownerId: fleetA, ownerType: 'fleet' }, [
      { type: 'fleet_share_credit', amount: '20000.00' },
    ]);
    await seedPayoutAccount(db, fleetA);
  });

  const createPayout = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/v1/fleet/payouts')
      .set('Authorization', authA)
      .set('Idempotency-Key', randomUUID())
      .send({ amountPaise: 1_000_000 })
      .expect(201);
    return res.body.id as string;
  };

  /** Backdates a payout so the poll's 2-minute grace window does not skip it. */
  const age = async (payoutId: string, minutes: number): Promise<void> => {
    await db.execute(sql`
      update payouts
         set updated_at = now() - (${minutes} || ' minutes')::interval,
             requested_at = now() - (${minutes} || ' minutes')::interval
       where id = ${payoutId}::uuid
    `);
  };

  const status = async (payoutId: string): Promise<string> => {
    const rows = (await db.execute(sql`
      select status::text as status from payouts where id = ${payoutId}::uuid
    `)) as unknown as Array<{ status: string }>;
    return rows[0]!.status;
  };

  const balance = async (): Promise<string> => {
    const rows = (await db.execute(sql`
      select balance from wallets where owner_type = 'fleet' and owner_id = ${fleetA}::uuid
    `)) as unknown as Array<{ balance: string }>;
    return rows[0]!.balance;
  };

  it('skips a payout that is still inside the grace window', async () => {
    const id = await createPayout();

    // Freshly created — the poll must not race a request that may still be
    // completing in another process.
    const result = await reconcile.reconcile('manual');
    expect(result.checked).toBe(0);
    expect(await status(id)).toBe('processing');
  });

  it('settles an accepted payout whose webhook never arrived', async () => {
    const id = await createPayout();
    await age(id, 5);

    const result = await reconcile.reconcile('manual');

    expect(result).toMatchObject({ checked: 1, settled: 1, failed: 0 });
    expect(await status(id)).toBe('paid');
    // `paid` is a status change; the debit already happened at request time.
    expect(await balance()).toBe('10000.00');
  });

  it('fails a payout the provider never acknowledged, returning the money', async () => {
    const id = await createPayout();
    // The request-time timeout case: no provider reference was ever recorded.
    await db.execute(sql`
      update payouts set route_ref = null, status = 'requested' where id = ${id}::uuid
    `);
    await age(id, 20);

    const result = await reconcile.reconcile('manual');

    expect(result).toMatchObject({ checked: 1, failed: 1 });
    expect(await status(id)).toBe('failed');
    expect(await balance()).toBe('20000.00');

    const alerts = (await db.execute(sql`
      select type::text as type from alerts where subject_type = 'payout' and subject_id = ${id}::uuid
    `)) as unknown as Array<{ type: string }>;
    expect(alerts.map((a) => a.type)).toEqual(['payout_failed']);
  });

  it('leaves an un-acknowledged payout alone until PAYOUT_STUCK_MINUTES', async () => {
    const id = await createPayout();
    await db.execute(sql`
      update payouts set route_ref = null, status = 'requested' where id = ${id}::uuid
    `);
    // Past the grace window but well short of the stuck threshold (15 min).
    await age(id, 5);

    const result = await reconcile.reconcile('manual');

    expect(result).toMatchObject({ checked: 1, settled: 0, failed: 0 });
    expect(await status(id)).toBe('requested');
  });

  it('is idempotent — a second sweep finds nothing left to do', async () => {
    const id = await createPayout();
    await age(id, 5);

    await reconcile.reconcile('manual');
    const second = await reconcile.reconcile('manual');

    expect(second).toMatchObject({ checked: 0, settled: 0, failed: 0 });
    expect(await status(id)).toBe('paid');
  });
});
